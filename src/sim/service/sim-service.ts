import { asNumber, clamp, getAverage, getStdDev } from "../util.js"
import { HomeAway, Position, Handedness, PitchType, PitchCall, SwingResult, PlayResult, Contact, ShallowDeep, OfficialPlayResult, BaseResult, DefenseCreditType, OfficialRunnerResult, PitchZone, ThrowResult, PitchingRoleType } from "./enums.js"
import { StartGameCommand, GamePlayer, MatchupHandedness, Score, RunnerResult, DefensiveCredit, PitchLog, HalfInning, UpcomingMatchup, RunnerEvent, HitterChange, PitcherChange, SimPitchCommand, SimPitchResult, InningEndingEvent, Pitch, RollChart, Game, HitResultCount, HittingRatings,  Lineup, PitchCount, PitchRatings, PitchResultCount, Play, Player, RotationPitcher, RunnerThrowCommand, StolenBaseByCount, Team, TeamInfo, ThrowRoll, PitchEnvironmentTarget, ContactQuality, PitchQuality, PitchingRole } from "./interfaces.js"
import { RollChartService } from "./roll-chart-service.js"
import { RunnerService } from "./runner-service.js"
import { SubstitutionService } from "./substitution-service.js"


const STANDARD_INNINGS = 9
const AVG_PITCH_QUALITY = 50

const MIN_CHANGE = -.7
const MAX_CHANGE = .7

const PITCH_QUALITY_WEIGHTS = {
    velocity: 33.3,
    movement: 33.4,
    control: 33.3
} 

const DEFAULT_FULL_TEAM_DEFENSE_BONUS = 75
const DEFAULT_FULL_FIELDER_DEFENSE_BONUS = 75

const CONTACT_RATE_POINTS_PER_FULL_CONTACT_CHANGE = 40

const ZONE_SWING_POINTS_PER_FULL_DISCIPLINE_CHANGE = 8
const CHASE_SWING_POINTS_PER_FULL_DISCIPLINE_CHANGE = 20


const STRIKE_ZONE_LEFT = -0.83
const STRIKE_ZONE_RIGHT = 0.83
const STRIKE_ZONE_BOTTOM = 1.5
const STRIKE_ZONE_TOP = 3.5

class SimService {

    constructor(
        private rollChartService:RollChartService,
        private gameRolls:SimRolls,
        private runnerService:RunnerService,
        private gameInfo:GameInfo,
        private substitutionService:SubstitutionService,
        private defaultPitchEnvironmentTarget:PitchEnvironmentTarget
    ) {}

    public initGame(game:Game) {

        game.currentInning = 1
        game.isTopInning = true
        game.isStarted = false
        game.isComplete = false
        game.isFinished = false
        game.count = {
            balls: 0,
            strikes: 0,
            outs: 0
        }

        game.score = {
            away: 0,
            home: 0
        }

        game.halfInnings = []
        game.substitutions = []

        game.playIndex = 0

    }

    public startGame(command:StartGameCommand) : Game {

        let game = command.game

        //Validate lineups
        GameInfo.validateGameLineup(command.awayPlayers, command.awayLineup, command.awayStartingPitcher)
        GameInfo.validateGameLineup(command.homePlayers, command.homeLineup, command.homeStartingPitcher)

        //Use what gets passed in or just use default config
        game.pitchEnvironmentTarget = JSON.parse(JSON.stringify(command.pitchEnvironmentTarget ?? this.defaultPitchEnvironmentTarget))

        if (!game.pitchEnvironmentTarget) {
            throw new Error("No league averages provided to start game.")
        }

        game.away = this.gameInfo.buildTeamInfo(game.pitchEnvironmentTarget, command.away, command.awayLineup, command.awayAvailablePitchers, command.awayPlayers, command.awayStartingPitcher, command.away.colors.color1, command.away.colors.color2, HomeAway.AWAY, 1, command.awayTeamOptions)            
        game.home = this.gameInfo.buildTeamInfo(game.pitchEnvironmentTarget, command.home, command.homeLineup, command.homeAvailablePitchers, command.homePlayers, command.homeStartingPitcher, command.home.colors.color1, command.home.colors.color2, HomeAway.HOME, 1 + command.awayPlayers.length, command.homeTeamOptions)

        game.startDate = command.date
        game.count = {
            balls: 0,
            strikes: 0,
            outs: 0
        }

        game.isStarted = true
        
        return game 
    }

    public finishGame(game:Game) : void {

        let homeWin = game.score.home > game.score.away

        let winningTeam:TeamInfo = homeWin ? game.home : game.away
        let losingTeam:TeamInfo = homeWin ? game.away : game.home

        game.winningTeamId = winningTeam._id
        game.losingTeamId = losingTeam._id

        //Mark player team win/loss
        for(let winGp of winningTeam.players) {

            if (winGp.currentPosition == Position.PITCHER && winGp.isPitcherOfRecord) {
                game.winningPitcherId = winGp._id
                winGp.pitchResult.wins = 1
            } 

            winGp.pitchResult.teamWins = 1
            winGp.hitResult.teamWins = 1

        }

        for (let loseGp of losingTeam.players) {

            if (loseGp.currentPosition == Position.PITCHER && loseGp.isPitcherOfRecord) {
                game.losingPitcherId = loseGp._id
                loseGp.pitchResult.losses = 1
            }

            loseGp.pitchResult.teamLosses = 1
            loseGp.hitResult.teamLosses = 1

        }


        //Mark game as finished
        game.isFinished = true

    }    

    public simPitch(game: Game, rng: any) {

        let command: SimPitchCommand = this.createSimPitchCommand(game, rng)

        if (!command.play) {

            const pitcherChanged = this.substitutionService.changePitcherIfNeeded(game, command.defense, game.playIndex)

            if (pitcherChanged) {
                command = this.createSimPitchCommand(game, rng)
            }

            const nextHitter = this.substitutionService.getNextHitter(game, command.offense, command.defense)

            if (nextHitter) {
                this.substitutionService.changeHitter(
                    game,
                    command.offense,
                    command.hitter._id,
                    nextHitter._id,
                    game.playIndex
                )

                command = this.createSimPitchCommand(game, rng)
            }

            let runner1B = command.offense.players.find(p => p._id == command.offense.runner1BId)
            let runner2B = command.offense.players.find(p => p._id == command.offense.runner2BId)
            let runner3B = command.offense.players.find(p => p._id == command.offense.runner3BId)

            command.play = this.createPlay(
                game.playIndex,
                command.hitter,
                command.pitcher,
                command.catcher,
                runner1B,
                runner2B,
                runner3B,
                command.matchupHandedness,
                game.count.outs,
                game.score,
                game.currentInning,
                game.isTopInning
            )

            command.halfInning.plays.push(command.play)

            return
        }

        let result: SimPitchResult

        let continueAtBat = true
        let isInningEndingEvent = false

        try {
            result = this.simPitchRolls(command, command.play.pitchLog.pitches?.length || 0)
            continueAtBat = result.continueAtBat
        } catch (ex) {
            if (!(ex instanceof InningEndingEvent)) throw ex
            continueAtBat = false
            isInningEndingEvent = true
        }

        if (!continueAtBat) {
            this.finishPlay(game, command, isInningEndingEvent)
        }
    }

    private createPlay(playIndex:number,
               hitter:GamePlayer, 
               pitcher:GamePlayer, 
               catcher:GamePlayer, 
               runner1B:GamePlayer|undefined,
               runner2B:GamePlayer|undefined,
               runner3B:GamePlayer|undefined,
               matchupHandedness:MatchupHandedness,
               outs:number,
               score:Score,
               inningNum: number,
               inningTop: boolean
    ) : Play {

            let runnerResult:RunnerResult = {
                first: runner1B?._id,
                second: runner2B?._id,
                third: runner3B?._id,
                scored: [],
                out: []
            }

            //Preserve starting runners to save with play data
            let startingRunnerResult = JSON.parse(JSON.stringify(runnerResult))
            let endingRunnerResult = JSON.parse(JSON.stringify(runnerResult))


            let startingCount = JSON.parse(JSON.stringify( {
                balls: 0,
                strikes: 0,
                outs: outs
            }))

            let startingScore = JSON.parse(JSON.stringify(score))


            let defensiveCredits:DefensiveCredit[] = []

            let pitchLog: PitchLog = {

                count: {
                    balls: 0,
                    strikes: 0,
                    fouls: 0,
                    pitches: 0
                },

                pitches: []
            }

            return {
                index: playIndex,
                inningNum: inningNum,
                inningTop: inningTop,
                pitchLog: pitchLog,
                credits: defensiveCredits,
                runner: {
                    events: [],
                    result: {
                        start: startingRunnerResult,
                        end: endingRunnerResult //change this one during the play
                    }
                },
                hitterId: hitter._id,
                pitcherId: pitcher._id,
                catcherId: catcher._id,
                matchupHandedness: matchupHandedness,
                count: {
                    start: startingCount
                },
                score: {
                    start: startingScore
                }
            }


    }

    private createSimPitchCommand(game:Game, rng:any) : SimPitchCommand {
        
        let halfInning:HalfInning = game.halfInnings.find(i => i.num == game.currentInning && i.top == game.isTopInning)

        if (!halfInning) {
            halfInning = GameInfo.initHalfInning(game.currentInning, game.isTopInning) 
            game.halfInnings.push(halfInning)
        }

        let offense:TeamInfo = GameInfo.getOffense(game)
        let defense:TeamInfo = GameInfo.getDefense(game)

        let matchup:UpcomingMatchup = this.getUpcomingMatchup(game)

        let halfInningRunnerEvents:RunnerEvent[] = halfInning.plays.map(p => p.runner?.events).reduce((accumulator, reArray) => accumulator.concat(reArray), []) 

        let hitter:GamePlayer = offense.players.find( p => p._id == matchup.hitter._id)
        let pitcher = defense.players.find( p => p._id == matchup.pitcher._id)
        let catcher:GamePlayer = defense.players.find( p => p.currentPosition == Position.CATCHER)

        if (!hitter) throw new Error("createSimPitchCommand: matchup.hitter not found on offense roster")
        if (!pitcher) throw new Error("createSimPitchCommand: matchup.pitcher not found on defense roster")
        if (!catcher) throw new Error("createSimPitchCommand: catcher not found on defense roster")

        let matchupHandedness: MatchupHandedness = Matchup.getMatchupHandedness(hitter, pitcher)

        let hitterChange:HitterChange = matchupHandedness.throws == Handedness.L ? hitter.hitterChange.vsL : hitter.hitterChange.vsR
        let pitcherChange:PitcherChange = matchupHandedness.hits == Handedness.L ? pitcher.pitcherChange.vsL : pitcher.pitcherChange.vsR
        
        let allPlays:Play[] = GameInfo.getPlays(game)

        //Either grab the play in progress or create a new one.
        let play: Play

        if (allPlays?.length > 0) {
            const lastPlay = allPlays[allPlays.length - 1]

            if (!lastPlay.count?.end) {
                play = lastPlay
            }
        }

        
    
        return {

            game: game,
            play:play,

            offense:offense,
            defense:defense,

            hitter:hitter,
            pitcher:pitcher,

            hitterChange:hitterChange,
            pitcherChange:pitcherChange,

            catcher:catcher,

            halfInningRunnerEvents:halfInningRunnerEvents,
            halfInning: halfInning,

            pitchEnvironmentTarget: game.pitchEnvironmentTarget,

            matchupHandedness:matchupHandedness,

            rng:rng

        }
    }

    private simPitchRolls(command: SimPitchCommand, pitchIndex: number): SimPitchResult {
        const pitches = command.pitcher.pitchRatings.pitches
        const weights = [50, 25, 15, 5, 5]

        const pitchType: PitchType = Rolls.weightedRandom(command.rng, pitches, weights.slice(0, pitches.length))
        const hitterPitchGuess: PitchType = pitches[Rolls.getRoll(command.rng, 0, pitches.length - 1)]
        const guessPitch = hitterPitchGuess === pitchType

        const sampleMoment = (stat: any): number => {
            const avg = asNumber(stat?.avg)
            const sd = getStdDev(stat)
            if (!Number.isFinite(sd) || sd <= 0) return avg
            return avg + Rolls.getRollUnrounded(command.rng, -sd, sd)
        }

        const buildMomentStat = (count: number, total: number, totalSquared: number, avg: number) => ({ count, total, totalSquared, avg })

        const pitcherPhysics = command.pitchEnvironmentTarget.importReference.pitcher.physics
        const pitchTypePhysics = pitcherPhysics.byPitchType?.[pitchType]

        const velocityStat = pitchTypePhysics
            ? buildMomentStat(pitchTypePhysics.count, pitchTypePhysics.totalVelocity, pitchTypePhysics.totalVelocitySquared, pitchTypePhysics.avgVelocity)
            : pitcherPhysics.velocity

        const horizontalBreakStat = pitchTypePhysics
            ? buildMomentStat(pitchTypePhysics.count, pitchTypePhysics.totalHorizontalBreak, pitchTypePhysics.totalHorizontalBreakSquared, pitchTypePhysics.avgHorizontalBreak)
            : pitcherPhysics.horizontalBreak

        const verticalBreakStat = pitchTypePhysics
            ? buildMomentStat(pitchTypePhysics.count, pitchTypePhysics.totalVerticalBreak, pitchTypePhysics.totalVerticalBreakSquared, pitchTypePhysics.avgVerticalBreak)
            : pitcherPhysics.verticalBreak

        const leagueVelocity = sampleMoment(velocityStat)
        const leagueHorizontalBreak = sampleMoment(horizontalBreakStat)
        const leagueVerticalBreak = sampleMoment(verticalBreakStat)

        const velocityStdDev = getStdDev(velocityStat)
        const horizontalBreakStdDev = getStdDev(horizontalBreakStat)
        const verticalBreakStdDev = getStdDev(verticalBreakStat)

        const handedPitchRatings = command.matchupHandedness.hits === Handedness.L
            ? command.pitcher.pitchRatings.vsL
            : command.pitcher.pitchRatings.vsR

        const powerChange = clamp(PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, command.pitcher.pitchRatings.power), MIN_CHANGE, MAX_CHANGE)
        const movementChange = clamp(PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, handedPitchRatings.movement), MIN_CHANGE, MAX_CHANGE)
        const controlChange = clamp(PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, handedPitchRatings.control), MIN_CHANGE, MAX_CHANGE)

        const velocity = Math.max(0, leagueVelocity + (velocityStdDev * powerChange))
        const horizontalBreak = leagueHorizontalBreak + (horizontalBreakStdDev * movementChange)
        const verticalBreak = leagueVerticalBreak + (verticalBreakStdDev * movementChange)

        const velocityBaseline = asNumber(velocityStat.avg)
        const horizontalBreakBaseline = asNumber(horizontalBreakStat.avg)
        const verticalBreakBaseline = asNumber(verticalBreakStat.avg)

        const velocityQualityChange = velocityStdDev > 0
            ? clamp((velocity - velocityBaseline) / velocityStdDev, MIN_CHANGE, MAX_CHANGE)
            : powerChange

        const baselineMovement = Math.abs(horizontalBreakBaseline) + Math.abs(verticalBreakBaseline)
        const actualMovement = Math.abs(horizontalBreak) + Math.abs(verticalBreak)
        const movementStdDev = Math.abs(horizontalBreakStdDev) + Math.abs(verticalBreakStdDev)

        const movementQualityChange = movementStdDev > 0
            ? clamp((actualMovement - baselineMovement) / movementStdDev, MIN_CHANGE, MAX_CHANGE)
            : movementChange

        const velocityWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.velocity))
        const movementWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.movement))
        const controlWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.control))
        const weightTotal = velocityWeight + movementWeight + controlWeight

        if (weightTotal <= 0) {
            throw new Error("Pitch quality weights must total more than zero.")
        }

        const pitchQualityChange = clamp(
            (velocityQualityChange * (velocityWeight / weightTotal)) +
            (movementQualityChange * (movementWeight / weightTotal)) +
            (controlChange * (controlWeight / weightTotal)),
            MIN_CHANGE,
            MAX_CHANGE
        )

        let fatigueScale = this.substitutionService.getFatigueScale(command.pitcher)

        const powQ = clamp(Math.round((AVG_PITCH_QUALITY + (velocityQualityChange * AVG_PITCH_QUALITY)) * fatigueScale), 0, 99)
        const movQ = clamp(Math.round((AVG_PITCH_QUALITY + (movementQualityChange * AVG_PITCH_QUALITY)) * fatigueScale), 0, 99)
        const locQ = clamp(Math.round((AVG_PITCH_QUALITY + (controlChange * AVG_PITCH_QUALITY)) * fatigueScale), 0, 99)
        const overallQuality = clamp(Math.round((AVG_PITCH_QUALITY + (pitchQualityChange * AVG_PITCH_QUALITY)) * fatigueScale), 0, 99)



        const countInZoneRate = command.pitchEnvironmentTarget.pitch.inZoneByCount.find(
            r => r.balls === command.play.pitchLog.count.balls && r.strikes === command.play.pitchLog.count.strikes
        )?.inZone

        const walkRateScale = clamp(Number(command.pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.swing?.walkRateScale ?? 0), -1, 1)
        const inZoneRate = clamp(Number(countInZoneRate ?? command.pitchEnvironmentTarget.pitch.inZonePercent ?? 0) - (walkRateScale * 100), 0, 100)
        const intendedInZone = this.gameRolls.isInZone(command.rng, locQ, inZoneRate)

        const intentZone = this.gameRolls.getIntentZone(command.rng)
        const plateLocation = this.getPlateLocation(command.rng, intentZone, locQ, horizontalBreak, verticalBreak, intendedInZone)
        const actualZone = this.getZoneFromPlateLocation(plateLocation.plateX, plateLocation.plateZ)

        const inZone =
            plateLocation.plateX >= STRIKE_ZONE_LEFT &&
            plateLocation.plateX <= STRIKE_ZONE_RIGHT &&
            plateLocation.plateZ >= STRIKE_ZONE_BOTTOM &&
            plateLocation.plateZ <= STRIKE_ZONE_TOP

        const pitch: Pitch = {
            intentZone,
            actualZone,
            plateX: plateLocation.plateX,
            plateZ: plateLocation.plateZ,
            type: pitchType,
            quality: {
                velocity,
                horizontalBreak,
                verticalBreak
            },
            overallQuality,
            powQ,
            movQ,
            locQ,
            swing: false,
            con: false,
            result: inZone ? PitchCall.STRIKE : PitchCall.BALL,
            inZone,
            guess: guessPitch,
            isWP: false,
            isPB: false
        }

        const anomaly = this.getPitchAnomalyResult(command.rng, locQ, command.pitchEnvironmentTarget)

        if (anomaly) {
            pitch.inZone = false
            pitch.result = anomaly.result
            pitch.isWP = anomaly.isWP ?? false
            pitch.isPB = anomaly.isPB ?? false
        } else {
            const swingResult = this.gameRolls.getSwingResult(
                command.rng,
                command.hitterChange,
                command.pitchEnvironmentTarget,
                pitch.inZone,
                pitch.overallQuality,
                guessPitch,
                command.play.pitchLog.count
            )

            pitch.swing = swingResult !== SwingResult.NO_SWING
            pitch.con = swingResult === SwingResult.FAIR || swingResult === SwingResult.FOUL

            switch (swingResult) {
                case SwingResult.FAIR:
                    pitch.result = PitchCall.IN_PLAY
                    break
                case SwingResult.FOUL:
                    pitch.result = PitchCall.FOUL
                    break
                case SwingResult.STRIKE:
                    pitch.result = PitchCall.STRIKE
                    break
                case SwingResult.NO_SWING:
                    pitch.result = pitch.inZone ? PitchCall.STRIKE : PitchCall.BALL
                    break
            }
        }

        switch (pitch.result) {
            case PitchCall.FOUL:
                command.play.pitchLog.count.fouls++
                if (command.play.pitchLog.count.strikes < 2) {
                    command.play.pitchLog.count.strikes++
                }
                break
            case PitchCall.STRIKE:
                command.play.pitchLog.count.strikes++
                break
            case PitchCall.BALL:
                command.play.pitchLog.count.balls++
                break
            case PitchCall.HBP:
            case PitchCall.IN_PLAY:
                break
        }

        command.play.pitchLog.pitches.push(pitch)
        command.play.pitchLog.count.pitches = command.play.pitchLog.pitches.length

        let continueAtBat = true

        if (pitch.result === PitchCall.HBP) {
            command.play.result = PlayResult.HIT_BY_PITCH
            continueAtBat = false
        }

        if (pitch.result === PitchCall.IN_PLAY) {
            continueAtBat = false
        }

        if (command.play.pitchLog.count.balls === 4) {
            command.play.result = PlayResult.BB
            continueAtBat = false
        }

        if (command.play.pitchLog.count.strikes === 3) {
            command.play.result = PlayResult.STRIKEOUT
            continueAtBat = false
        }

        const result: SimPitchResult = {
            continueAtBat,
            pitch
        }

        this.runnerService.generateRunnerEventsFromPitch(command, pitchIndex, result)

        command.game.count.balls = command.play.pitchLog.count.balls
        command.game.count.strikes = command.play.pitchLog.count.strikes

        pitch.count = JSON.parse(JSON.stringify(command.game.count))

        return result
    }

    private getPlateLocation(rng: () => number, intentZone: PitchZone, locQ: number, horizontalBreak: number, verticalBreak: number, intendedInZone: boolean): { plateX: number, plateZ: number } {
        const zoneCenters: Record<PitchZone, { x: number, z: number }> = {
            [PitchZone.HIGH_INSIDE]: { x: -0.55, z: 3.15 },
            [PitchZone.HIGH_MIDDLE]: { x: 0, z: 3.15 },
            [PitchZone.HIGH_AWAY]: { x: 0.55, z: 3.15 },
            [PitchZone.MID_INSIDE]: { x: -0.55, z: 2.5 },
            [PitchZone.MID_MIDDLE]: { x: 0, z: 2.5 },
            [PitchZone.MID_AWAY]: { x: 0.55, z: 2.5 },
            [PitchZone.LOW_INSIDE]: { x: -0.55, z: 1.85 },
            [PitchZone.LOW_MIDDLE]: { x: 0, z: 1.85 },
            [PitchZone.LOW_AWAY]: { x: 0.55, z: 1.85 }
        }

        const ballCenters: Record<PitchZone, { x: number, z: number }> = {
            [PitchZone.HIGH_INSIDE]: { x: -0.9, z: 3.6 },
            [PitchZone.HIGH_MIDDLE]: { x: 0, z: 3.65 },
            [PitchZone.HIGH_AWAY]: { x: 0.9, z: 3.6 },
            [PitchZone.MID_INSIDE]: { x: -1.0, z: 2.5 },
            [PitchZone.MID_MIDDLE]: { x: 0, z: 3.65 },
            [PitchZone.MID_AWAY]: { x: 1.0, z: 2.5 },
            [PitchZone.LOW_INSIDE]: { x: -0.9, z: 1.4 },
            [PitchZone.LOW_MIDDLE]: { x: 0, z: 1.35 },
            [PitchZone.LOW_AWAY]: { x: 0.9, z: 1.4 }
        }

        const center = intendedInZone
            ? zoneCenters[intentZone] ?? zoneCenters[PitchZone.MID_MIDDLE]
            : ballCenters[intentZone] ?? ballCenters[PitchZone.MID_MIDDLE]

        const commandNoiseScale = (100 - locQ) / 100
        const missX = Rolls.getRollUnrounded(rng, -0.22, 0.22) * commandNoiseScale
        const missZ = Rolls.getRollUnrounded(rng, -0.28, 0.28) * commandNoiseScale
        const movementX = horizontalBreak / 24
        const movementZ = verticalBreak / 240

        let plateX = center.x + missX + movementX
        let plateZ = center.z + missZ + movementZ

        const isInStrikeZone = plateX >= STRIKE_ZONE_LEFT && plateX <= STRIKE_ZONE_RIGHT && plateZ >= STRIKE_ZONE_BOTTOM && plateZ <= STRIKE_ZONE_TOP

        if (intendedInZone && !isInStrikeZone) {
            plateX = clamp(plateX, STRIKE_ZONE_LEFT + 0.01, STRIKE_ZONE_RIGHT - 0.01)
            plateZ = clamp(plateZ, STRIKE_ZONE_BOTTOM + 0.01, STRIKE_ZONE_TOP - 0.01)
        }

        if (!intendedInZone && isInStrikeZone) {
            const distances = [
                { side: "LEFT", value: Math.abs(plateX - STRIKE_ZONE_LEFT) },
                { side: "RIGHT", value: Math.abs(plateX - STRIKE_ZONE_RIGHT) },
                { side: "BOTTOM", value: Math.abs(plateZ - STRIKE_ZONE_BOTTOM) },
                { side: "TOP", value: Math.abs(plateZ - STRIKE_ZONE_TOP) }
            ]

            const nearest = distances.sort((a, b) => a.value - b.value)[0].side

            if (nearest === "LEFT") plateX = STRIKE_ZONE_LEFT - 0.01
            if (nearest === "RIGHT") plateX = STRIKE_ZONE_RIGHT + 0.01
            if (nearest === "BOTTOM") plateZ = STRIKE_ZONE_BOTTOM - 0.01
            if (nearest === "TOP") plateZ = STRIKE_ZONE_TOP + 0.01
        }

        return {
            plateX: Number(plateX.toFixed(3)),
            plateZ: Number(plateZ.toFixed(3))
        }
    }

    private getZoneFromPlateLocation(plateX: number, plateZ: number): PitchZone {

        const horizontal =
            plateX < -0.25
                ? "INSIDE"
                : plateX > 0.25
                    ? "AWAY"
                    : "MIDDLE"

        const vertical =
            plateZ > 2.9
                ? "HIGH"
                : plateZ < 2.1
                    ? "LOW"
                    : "MID"

        if (vertical === "HIGH" && horizontal === "INSIDE") return PitchZone.HIGH_INSIDE
        if (vertical === "HIGH" && horizontal === "MIDDLE") return PitchZone.HIGH_MIDDLE
        if (vertical === "HIGH" && horizontal === "AWAY") return PitchZone.HIGH_AWAY

        if (vertical === "MID" && horizontal === "INSIDE") return PitchZone.MID_INSIDE
        if (vertical === "MID" && horizontal === "MIDDLE") return PitchZone.MID_MIDDLE
        if (vertical === "MID" && horizontal === "AWAY") return PitchZone.MID_AWAY

        if (vertical === "LOW" && horizontal === "INSIDE") return PitchZone.LOW_INSIDE
        if (vertical === "LOW" && horizontal === "MIDDLE") return PitchZone.LOW_MIDDLE

        return PitchZone.LOW_AWAY
    }

    private getPitchAnomalyResult(gameRNG: () => number, locationQuality: number, pitchEnvironmentTarget: PitchEnvironmentTarget): { result: PitchCall, isWP?: boolean, isPB?: boolean } | null {
        const baselineHbpPerPitch = pitchEnvironmentTarget.outcome.hbpPercent / pitchEnvironmentTarget.pitch.pitchesPerPA
        const locationBadness = Math.max(0, (50 - locationQuality) / 50)
        const hbpRoll = Rolls.getRollUnrounded(gameRNG, 0, 1)

        if (hbpRoll < baselineHbpPerPitch * (1 + locationBadness)) {
            return { result: PitchCall.HBP }
        }

        if (locationQuality >= 5) return null

        const extremeBadness = (5 - locationQuality) / 5
        const anomalyRoll = Rolls.getRollUnrounded(gameRNG, 0, 1)

        if (locationQuality < 0.5 && anomalyRoll < 0.01 * extremeBadness) {
            return { result: PitchCall.BALL, isPB: true }
        }

        if (anomalyRoll < 0.10 * extremeBadness) {
            return { result: PitchCall.BALL, isWP: true }
        }

        return null
    }

    private finishPlay(game:Game, command:SimPitchCommand, isInningEndingEvent:boolean) {
        let fielderPlayer: GamePlayer | undefined
        let isFieldingError = false

        const ballInPlay = command.play.pitchLog.pitches.find(p => p.result == PitchCall.IN_PLAY)

        if (!isInningEndingEvent) {
            if (ballInPlay) {
                const pitch = ballInPlay
                const pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitch.overallQuality)

                command.play.result = this.getTunedMatchupPowerResult(command)
                command.play.contact = this.getMatchupContactForPlayResult(command, command.play.result)

                const hitQuality = this.gameRolls.getHitQuality(
                    command.rng,
                    command.pitchEnvironmentTarget,
                    pitchQualityChange,
                    pitch.guess,
                    command.play.contact,
                    command.play.result
                )

                const fieldingResult = this.pickFielderFromLocation(
                    command,
                    command.play.contact,
                    hitQuality
                )

                command.play.fielder = fieldingResult.fielder
                command.play.shallowDeep = fieldingResult.shallowDeep
                fielderPlayer = fieldingResult.fielderPlayer

                command.play.result = this.applyDefenseToPlayResult(
                    command,
                    command.play.result,
                    fielderPlayer
                )

                pitch.contactQuality = hitQuality
                pitch.overallContactQuality = clamp(Math.round((this.getExpectedBasesForPlayResult(command.play.result) / 4) * 999), 0, 999)

                if (command.play.result === PlayResult.HR) {
                    command.play.shallowDeep = ShallowDeep.DEEP
                }

                if (command.play.result === PlayResult.TRIPLE && AtBatInfo.isToOF(command.play.fielder)) {
                    command.play.shallowDeep = ShallowDeep.DEEP
                }
            } else if (
                command.play.result != PlayResult.STRIKEOUT &&
                command.play.result != PlayResult.BB &&
                command.play.result != PlayResult.HIT_BY_PITCH
            ) {
                throw new Error("Error with pitchlog")
            }

            const runner1B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.first)
            const runner2B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.second)
            const runner3B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.third)

            if (command.play.runner.result.end.first && !runner1B) {
                throw new Error("Missing 1B runner.")
            }

            if (command.play.runner.result.end.second && !runner2B) {
                throw new Error("Missing 2B runner.")
            }

            if (command.play.runner.result.end.third && !runner3B) {
                throw new Error("Missing 3B runner.")
            }

            const inPlayRunnerEvents: RunnerEvent[] = this.runnerService.getRunnerEvents(
                command.rng,
                command.play.runner.result.end,
                command.halfInningRunnerEvents,
                command.play.credits,
                command.pitchEnvironmentTarget,
                command.play.result,
                command.play.contact,
                command.play.shallowDeep,
                command.hitter,
                fielderPlayer,
                runner1B,
                runner2B,
                runner3B,
                command.offense,
                command.defense,
                command.pitcher,
                command.play.pitchLog.count.pitches - 1
            )

            isFieldingError = inPlayRunnerEvents.filter(re => re.isError)?.length > 0

            command.play.runner.events.push(...inPlayRunnerEvents)
        }

        this.runnerService.validateRunnerResult(command.play.runner.result.end)

        if (command.play.result === PlayResult.OUT && isFieldingError) {
            command.play.result = PlayResult.ERROR
        }

        command.play.officialPlayResult = this.getOfficialPlayResult(
            command.play.result,
            command.play.contact,
            command.play.shallowDeep,
            command.play.fielder,
            command.play.runner.events
        )

        command.play.fielderId = fielderPlayer?._id

        const runner1B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.first)
        const runner2B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.second)
        const runner3B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.third)

        LogResult.logPlayResults(
            command.offense,
            command.defense,
            command.hitter,
            command.pitcher,
            runner1B?._id,
            runner2B?._id,
            runner3B?._id,
            command.play.credits,
            command.play.runner.events,
            command.play.contact,
            command.play.officialPlayResult,
            command.play.result,
            command.play.pitchLog,
            isInningEndingEvent
        )

        game.count.balls = 0
        game.count.strikes = 0

        game.count.outs += command.play.runner?.events.filter(re => re.movement.isOut).length

        game.playIndex++

        command.offense.runner1BId = command.play.runner?.result.end.first
        command.offense.runner2BId = command.play.runner?.result.end.second
        command.offense.runner3BId = command.play.runner?.result.end.third

        LinescoreActions.updateLinescore(game, command.halfInning, command.play)

        command.play.count.end = JSON.parse(JSON.stringify(game.count))
        command.play.score.end = JSON.parse(JSON.stringify(game.score))

        if (
            //@ts-ignore
            command.play.officialPlayResult != OfficialRunnerResult.CAUGHT_STEALING_2B &&
            //@ts-ignore
            command.play.officialPlayResult != OfficialRunnerResult.CAUGHT_STEALING_3B
        ) {
            if (command.offense.currentHitterIndex >= 8) {
                command.offense.currentHitterIndex = 0
            } else {
                command.offense.currentHitterIndex++
            }
        }

        this.validateNextHitterIsNotOnBase(command.offense, game, command.play)

        const isWalkoff = (game.currentInning >= STANDARD_INNINGS && !game.isTopInning && game.score.home > game.score.away)

        if (game.count.outs >= 3 || isWalkoff) {
            const leftOnBase = [command.offense.runner1BId, command.offense.runner2BId, command.offense.runner3BId]
                .filter(r => r != undefined).length

            if (leftOnBase > 0) {
                LinescoreActions.updateLinescoreLOB(command.halfInning, leftOnBase)
            }

            this.runnerService.clearRunners(command.offense)

            game.count.outs = 0

            game.isComplete = GameInfo.isGameOver(game)

            if (!game.isComplete) {
                if (game.isTopInning) {
                    game.isTopInning = false
                } else {
                    game.currentInning++
                    game.isTopInning = true
                }

                game.halfInnings.push(GameInfo.initHalfInning(game.currentInning, game.isTopInning))
            }
        }
    }

    private getTunedMatchupPowerResult(command: SimPitchCommand): PlayResult {
        const powerRollChart: RollChart = this.rollChartService.getMatchupPowerRollChart(
            command.pitchEnvironmentTarget,
            command.hitterChange,
            command.pitcherChange
        )

        let result = powerRollChart.entries.get(Rolls.getRoll(command.rng, 0, 999)) as PlayResult

        const tuning = command.pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.contactQuality
        const outOutcomeScale = Number(tuning?.outOutcomeScale ?? 0)
        const doubleOutcomeScale = Number(tuning?.doubleOutcomeScale ?? 0)
        const tripleOutcomeScale = Number(tuning?.tripleOutcomeScale ?? 0)
        const homeRunOutcomeScale = Number(tuning?.homeRunOutcomeScale ?? 0)

        const isHit = (playResult: PlayResult): boolean => {
            return playResult === PlayResult.SINGLE ||
                playResult === PlayResult.DOUBLE ||
                playResult === PlayResult.TRIPLE ||
                playResult === PlayResult.HR
        }

        const rollScale = (scale: number): boolean => {
            return scale > 0 && Rolls.getRollUnrounded(command.rng, 0, 1) < Math.min(1, scale)
        }

        if (outOutcomeScale > 0 && isHit(result) && rollScale(outOutcomeScale)) {
            result = PlayResult.OUT
        } else if (outOutcomeScale < 0 && result === PlayResult.OUT && rollScale(Math.abs(outOutcomeScale))) {
            result = PlayResult.SINGLE
        }

        if (homeRunOutcomeScale > 0 && (result === PlayResult.SINGLE || result === PlayResult.DOUBLE || result === PlayResult.TRIPLE) && rollScale(homeRunOutcomeScale)) {
            result = PlayResult.HR
        } else if (homeRunOutcomeScale < 0 && result === PlayResult.HR && rollScale(Math.abs(homeRunOutcomeScale))) {
            result = PlayResult.SINGLE
        }

        if (tripleOutcomeScale > 0 && (result === PlayResult.SINGLE || result === PlayResult.DOUBLE) && rollScale(tripleOutcomeScale)) {
            result = PlayResult.TRIPLE
        } else if (tripleOutcomeScale < 0 && result === PlayResult.TRIPLE && rollScale(Math.abs(tripleOutcomeScale))) {
            result = PlayResult.SINGLE
        }

        if (doubleOutcomeScale > 0 && result === PlayResult.SINGLE && rollScale(doubleOutcomeScale)) {
            result = PlayResult.DOUBLE
        } else if (doubleOutcomeScale < 0 && result === PlayResult.DOUBLE && rollScale(Math.abs(doubleOutcomeScale))) {
            result = PlayResult.SINGLE
        }

        return result
    }

    private getMatchupContactForPlayResult(command: SimPitchCommand, playResult: PlayResult): Contact {
        const contactRollChart: RollChart = this.rollChartService.getMatchupContactRollChart(
            command.pitchEnvironmentTarget,
            command.hitter.hittingRatings.contactProfile,
            command.pitcher.pitchRatings.contactProfile
        )

        const allowedContacts =
            playResult === PlayResult.HR ? [Contact.LINE_DRIVE, Contact.FLY_BALL] :
            playResult === PlayResult.TRIPLE ? [Contact.LINE_DRIVE, Contact.FLY_BALL] :
            [Contact.GROUNDBALL, Contact.LINE_DRIVE, Contact.FLY_BALL]

        const entries = [...contactRollChart.entries.entries()]
            .filter(([, contact]) => allowedContacts.includes(contact as Contact))

        if (entries.length === 0) {
            throw new Error(`No compatible contact entries for playResult ${playResult}`)
        }

        const selected = entries[Rolls.getRoll(command.rng, 0, entries.length - 1)]

        return selected[1] as Contact
    }    

    private getExpectedBasesForPlayResult(playResult: PlayResult): number {
        switch (playResult) {
            case PlayResult.SINGLE:
                return 1
            case PlayResult.DOUBLE:
                return 2
            case PlayResult.TRIPLE:
                return 3
            case PlayResult.HR:
                return 4
            default:
                return 0
        }
    }

    private validateNextHitterIsNotOnBase(offense: TeamInfo, game: Game, play: Play): void {
        const nextHitterId = offense.lineupIds[offense.currentHitterIndex]
        const baseRunnerIds = [offense.runner1BId, offense.runner2BId, offense.runner3BId].filter(id => id != undefined)

        if (baseRunnerIds.includes(nextHitterId)) {
            const halfInning = game.halfInnings.find(i => i.num === game.currentInning && i.top === game.isTopInning)
            const history = (halfInning?.plays ?? []).map(p => ({
                index: p.index,
                hitterId: p.hitterId,
                result: p.result,
                officialPlayResult: p.officialPlayResult,
                contact: p.contact,
                shallowDeep: p.shallowDeep,
                fielder: p.fielder,
                start: p.runner?.result?.start,
                end: p.runner?.result?.end,
                events: (p.runner?.events ?? []).map(e => ({
                    runnerId: e.runner?._id,
                    start: e.movement?.start,
                    end: e.movement?.end,
                    isOut: e.movement?.isOut,
                    eventType: e.eventType,
                    isScoringEvent: e.isScoringEvent,
                    isForce: e.isForce,
                    isError: e.isError,
                    isSB: e.isSB,
                    isCS: e.isCS
                }))
            }))

            throw new Error(`Next hitter is already on base nextHitter=${nextHitterId} first=${offense.runner1BId} second=${offense.runner2BId} third=${offense.runner3BId} playIndex=${play.index} inning=${game.currentInning} top=${game.isTopInning} playResult=${play.result} officialPlayResult=${play.officialPlayResult} runnerResult=${JSON.stringify(play.runner.result.end)} history=${JSON.stringify(history)}`)
        }
    }

    private applyDefenseToPlayResult(command: SimPitchCommand, playResult: PlayResult, fielderPlayer: GamePlayer): PlayResult {
        if (playResult === PlayResult.HR) {
            return playResult
        }

        const meta = command.pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.meta
        const teamDefense = GameInfo.getTeamDefense(command.defense)

        const teamDefenseChange = clamp(
            PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, teamDefense),
            MIN_CHANGE,
            MAX_CHANGE
        )

        const fielderDefenseChange = clamp(
            PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, fielderPlayer.hittingRatings.defense),
            MIN_CHANGE,
            MAX_CHANGE
        )

        const fullChange = Math.max(Math.abs(MIN_CHANGE), Math.abs(MAX_CHANGE))

        if (fullChange <= 0) {
            return playResult
        }

        const teamDefenseBonus =
            DEFAULT_FULL_TEAM_DEFENSE_BONUS +
            Number(meta?.fullTeamDefenseBonus ?? 0)

        const fielderDefenseBonus =
            DEFAULT_FULL_FIELDER_DEFENSE_BONUS +
            Number(meta?.fullFielderDefenseBonus ?? 0)

        const teamDefenseShare = teamDefenseChange / fullChange
        const fielderDefenseShare = fielderDefenseChange / fullChange

        const defenseShift = clamp(
            ((teamDefenseBonus / 1000) * teamDefenseShare) +
            ((fielderDefenseBonus / 1000) * fielderDefenseShare),
            -1,
            1
        )

        if (defenseShift > 0 && playResult !== PlayResult.OUT) {
            return Rolls.getRollUnrounded(command.rng, 0, 1) < defenseShift ? PlayResult.OUT : playResult
        }

        if (defenseShift < 0 && playResult === PlayResult.OUT) {
            return Rolls.getRollUnrounded(command.rng, 0, 1) < Math.abs(defenseShift) ? PlayResult.SINGLE : playResult
        }

        return playResult
    }    

    private getFielderWeights(command:SimPitchCommand): Record<Position, number> {
        const chart = command.play.matchupHandedness.hits == Handedness.R
            ? command.pitchEnvironmentTarget.fielderChance.vsR
            : command.pitchEnvironmentTarget.fielderChance.vsL

        return {
            [Position.PITCHER]: chart.pitcher ?? 0,
            [Position.CATCHER]: chart.catcher ?? 0,
            [Position.FIRST_BASE]: chart.first ?? 0,
            [Position.SECOND_BASE]: chart.second ?? 0,
            [Position.THIRD_BASE]: chart.third ?? 0,
            [Position.SHORTSTOP]: chart.shortstop ?? 0,
            [Position.LEFT_FIELD]: chart.leftField ?? 0,
            [Position.CENTER_FIELD]: chart.centerField ?? 0,
            [Position.RIGHT_FIELD]: chart.rightField ?? 0,
            [Position.DESIGNATED_HITTER]: 0
        }
    }

    private weightedPickPosition(command:SimPitchCommand, allowed:Position[]): Position {
        const weights = this.getFielderWeights(command)
        const candidates = allowed
            .map(position => ({
                position,
                weight: Math.max(1, weights[position] ?? 1)
            }))
            .filter(item => item.weight > 0)

        if (candidates.length === 0) {
            return allowed[0]
        }

        const total = candidates.reduce((sum, item) => sum + item.weight, 0)
        const roll = Rolls.getRollUnrounded(command.rng, 0, total)

        let running = 0
        for (const candidate of candidates) {
            running += candidate.weight
            if (roll <= running) return candidate.position
        }

        return candidates[candidates.length - 1].position
    }

    private getShallowDeepFromY(coordY:number, fielder:Position): ShallowDeep | undefined {
        if (!AtBatInfo.isToOF(fielder)) return undefined
        if (coordY < 180) return ShallowDeep.SHALLOW
        if (coordY > 260) return ShallowDeep.DEEP
        return ShallowDeep.NORMAL
    }

    private pickFielderFromLocation(command:SimPitchCommand, contact:Contact, hitQuality:ContactQuality): { fielder:Position, shallowDeep:ShallowDeep | undefined, fielderPlayer:GamePlayer } {
        const x = hitQuality.coordX
        const y = hitQuality.coordY

        const leftSide = x <= -20
        const rightSide = x >= 20
        const middle = !leftSide && !rightSide
        const shallow = y < 140
        const medium = y >= 140 && y < 220
        const deep = y >= 220

        let allowed:Position[] = []

        if (contact === Contact.GROUNDBALL) {
            if (y < 40) {
                allowed = middle ? [Position.PITCHER, Position.CATCHER] : leftSide ? [Position.THIRD_BASE, Position.SHORTSTOP] : [Position.FIRST_BASE, Position.SECOND_BASE]
            } else if (middle) {
                allowed = y >= 160 ? [Position.CENTER_FIELD, Position.SECOND_BASE, Position.SHORTSTOP] : [Position.PITCHER, Position.SECOND_BASE, Position.SHORTSTOP]
            } else if (leftSide) {
                allowed = shallow ? [Position.THIRD_BASE, Position.SHORTSTOP] : [Position.LEFT_FIELD, Position.SHORTSTOP]
            } else {
                allowed = shallow ? [Position.FIRST_BASE, Position.SECOND_BASE] : [Position.RIGHT_FIELD, Position.SECOND_BASE]
            }
        } else if (contact === Contact.LINE_DRIVE) {
            if (shallow) {
                if (leftSide) allowed = [Position.THIRD_BASE, Position.SHORTSTOP, Position.LEFT_FIELD]
                else if (rightSide) allowed = [Position.FIRST_BASE, Position.SECOND_BASE, Position.RIGHT_FIELD]
                else allowed = [Position.SECOND_BASE, Position.SHORTSTOP, Position.CENTER_FIELD]
            } else if (medium) {
                if (leftSide) allowed = [Position.LEFT_FIELD, Position.CENTER_FIELD]
                else if (rightSide) allowed = [Position.RIGHT_FIELD, Position.CENTER_FIELD]
                else allowed = [Position.CENTER_FIELD]
            } else {
                if (leftSide) allowed = [Position.LEFT_FIELD]
                else if (rightSide) allowed = [Position.RIGHT_FIELD]
                else allowed = [Position.CENTER_FIELD]
            }
        } else {
            if (shallow) {
                if (leftSide) allowed = [Position.LEFT_FIELD, Position.THIRD_BASE, Position.SHORTSTOP]
                else if (rightSide) allowed = [Position.RIGHT_FIELD, Position.FIRST_BASE, Position.SECOND_BASE]
                else allowed = [Position.CENTER_FIELD, Position.SECOND_BASE, Position.SHORTSTOP, Position.PITCHER, Position.CATCHER]
            } else if (leftSide) {
                allowed = deep ? [Position.LEFT_FIELD] : [Position.LEFT_FIELD, Position.CENTER_FIELD]
            } else if (rightSide) {
                allowed = deep ? [Position.RIGHT_FIELD] : [Position.RIGHT_FIELD, Position.CENTER_FIELD]
            } else {
                allowed = [Position.CENTER_FIELD]
            }
        }

        const fielder = this.weightedPickPosition(command, allowed)
        let shallowDeep = this.getShallowDeepFromY(y, fielder)

        if (!shallowDeep && AtBatInfo.isInAir(contact)) {
            shallowDeep = y < 180 ? ShallowDeep.SHALLOW : y > 260 ? ShallowDeep.DEEP : ShallowDeep.NORMAL
        }

        const fielderPlayer =
            fielder === Position.PITCHER
                ? command.defense.players.find(p => p._id === command.defense.currentPitcherId)
                : command.defense.players.find(p => p.currentPosition === fielder)

        if (!fielderPlayer) {
            throw new Error(`No fielder found at position ${fielder}`)
        }

        return {
            fielder,
            shallowDeep,
            fielderPlayer
        }
    }

    private getOfficialPlayResult(playResult: PlayResult, contact: Contact, shallowDeep: ShallowDeep, fielder: Position, runnerEvents: RunnerEvent[]) {

        switch (playResult) {

            case PlayResult.STRIKEOUT:
                return OfficialPlayResult.STRIKEOUT

            case PlayResult.OUT:

                if (contact == Contact.GROUNDBALL) {

                    //Check for double play
                    if (contact == Contact.GROUNDBALL && runnerEvents.filter(re => re?.movement?.isOut == true && !re.isCS).length >= 2) {
                        return OfficialPlayResult.GROUNDED_INTO_DP
                    }


                    if (runnerEvents.find( re => re.movement.start == BaseResult.HOME && re.isFC == true)) {
                        return OfficialPlayResult.FIELDERS_CHOICE
                    } else {
                        return OfficialPlayResult.GROUNDOUT
                    }

                }
                if (contact == Contact.FLY_BALL && AtBatInfo.isToInfielder(fielder)) return OfficialPlayResult.POP_OUT
                if (contact == Contact.FLY_BALL && AtBatInfo.isToOF(fielder)) return OfficialPlayResult.FLYOUT

                if (contact == Contact.LINE_DRIVE) return OfficialPlayResult.FLYOUT

            case PlayResult.BB:
                return OfficialPlayResult.WALK

            case PlayResult.HIT_BY_PITCH:
                return OfficialPlayResult.HIT_BY_PITCH

            case PlayResult.SINGLE:
                return OfficialPlayResult.SINGLE

            case PlayResult.DOUBLE:
                return OfficialPlayResult.DOUBLE

            case PlayResult.TRIPLE:
                return OfficialPlayResult.TRIPLE

            case PlayResult.HR:
                return OfficialPlayResult.HOME_RUN
            
            case PlayResult.ERROR:
                return OfficialPlayResult.REACHED_ON_ERROR

        }

    }

    public getUpcomingMatchup(game:Game) : UpcomingMatchup {

        if (game.isTopInning) {

            return {
                hitter: game.away.players.find(p => p._id == game.away.lineupIds[game.away.currentHitterIndex]),
                pitcher:  game.home.players.find(p => p._id == game.home.currentPitcherId)
            }

        } else {

            return {
                hitter: game.home.players.find(p => p._id == game.home.lineupIds[game.home.currentHitterIndex]),
                pitcher: game.away.players.find(p => p._id == game.away.currentPitcherId)
            }


        }

    }

}

class Matchup {


    static getMatchupHandedness(hitter:GamePlayer, pitcher:GamePlayer): MatchupHandedness {

        let pitchHand = pitcher.throws
        let batSide

        if (hitter.hits == Handedness.S) {
            batSide = pitcher.throws == Handedness.L ? Handedness.R : Handedness.L
        } else {
            batSide = hitter.hits
        }

        return {
            throws: pitchHand,
            hits: batSide,
            vsSameHand: hitter.hits == pitcher.throws
        }


    }


}

class SimRolls {

    constructor(
        private rollChartService:RollChartService
    ) {}

    getIntentZone(rng: () => number) {
        const index = Math.floor(rng() * ALL_PITCH_ZONES.length)
        return ALL_PITCH_ZONES[index]
    }

    getHitQuality(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, pitchQualityChange: number, guessPitch: boolean, contact: Contact, playResult?: PlayResult): ContactQuality {
        const tuning = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.contactQuality
        const hitterPhysics = pitchEnvironmentTarget.importReference.hitter.physics

        const getTrajectory = (): "groundBall" | "lineDrive" | "flyBall" | "popup" => {
            if (playResult === PlayResult.HR) return "flyBall"
            if (playResult === PlayResult.TRIPLE && contact === Contact.GROUNDBALL) return "lineDrive"
            if (contact === Contact.GROUNDBALL) return "groundBall"
            if (contact === Contact.LINE_DRIVE) return "lineDrive"

            const flyBalls = asNumber(pitchEnvironmentTarget.importReference?.hitter?.flyBalls, 0)
            const popups = asNumber(pitchEnvironmentTarget.importReference?.hitter?.popups, 0)
            const popupShare = (flyBalls + popups) > 0 ? popups / (flyBalls + popups) : 0

            return gameRNG() < popupShare ? "popup" : "flyBall"
        }

        const getOutcomeKey = (): "out" | "single" | "double" | "triple" | "hr" | undefined => {
            switch (playResult) {
                case PlayResult.OUT:
                    return "out"
                case PlayResult.SINGLE:
                    return "single"
                case PlayResult.DOUBLE:
                    return "double"
                case PlayResult.TRIPLE:
                    return "triple"
                case PlayResult.HR:
                    return "hr"
            }

            return undefined
        }

        const trajectory = getTrajectory()
        const evLaModel = (pitchEnvironmentTarget.battedBall as any)?.evLaModel?.[trajectory]
        const outcomeKey = getOutcomeKey()
        const outcomeKernel = outcomeKey ? (pitchEnvironmentTarget.battedBall as any)?.outcomeModel?.[trajectory]?.[outcomeKey] : undefined
        const sourceModel = outcomeKernel ?? evLaModel

        if (!sourceModel) {
            throw new Error(`Missing battedBall model for trajectory ${trajectory}`)
        }

        const trajectoryPhysics: any = (hitterPhysics.byTrajectory as any)?.[trajectory]

        if (!trajectoryPhysics) {
            throw new Error(`Missing hitter physics for trajectory ${trajectory}`)
        }

        const normal = (): number => {
            const u1 = Math.max(Number.MIN_VALUE, gameRNG())
            const u2 = Math.max(Number.MIN_VALUE, gameRNG())
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        }

        const getStat = (trajectoryPhysics: any, key: "exitVelocity" | "launchAngle" | "distance"): { count: number, total: number, totalSquared: number, avg: number } => {
            const direct = trajectoryPhysics?.[key]

            if (direct) {
                return {
                    count: asNumber(direct.count, 0),
                    total: asNumber(direct.total, 0),
                    totalSquared: asNumber(direct.totalSquared, 0),
                    avg: asNumber(direct.avg, 0)
                }
            }

            if (key === "exitVelocity") {
                return {
                    count: asNumber(trajectoryPhysics.count, 0),
                    total: asNumber(trajectoryPhysics.totalExitVelocity, 0),
                    totalSquared: asNumber(trajectoryPhysics.totalExitVelocitySquared, 0),
                    avg: asNumber(trajectoryPhysics.avgExitVelocity, hitterPhysics.exitVelocity?.avg ?? 0)
                }
            }

            if (key === "launchAngle") {
                return {
                    count: asNumber(trajectoryPhysics.count, 0),
                    total: asNumber(trajectoryPhysics.totalLaunchAngle, 0),
                    totalSquared: asNumber(trajectoryPhysics.totalLaunchAngleSquared, 0),
                    avg: asNumber(trajectoryPhysics.avgLaunchAngle, hitterPhysics.launchAngle?.avg ?? 0)
                }
            }

            return {
                count: asNumber(trajectoryPhysics.count, 0),
                total: asNumber(trajectoryPhysics.totalDistance, 0),
                totalSquared: asNumber(trajectoryPhysics.totalDistanceSquared, 0),
                avg: asNumber(trajectoryPhysics.avgDistance, hitterPhysics.distance?.avg ?? 0)
            }
        }

        const sampleMoment = (stat: { count: number, total: number, totalSquared: number, avg: number }): number => {
            const sd = getStdDev(stat)
            if (!Number.isFinite(sd) || sd <= 0) return stat.avg
            return stat.avg + Rolls.getRollUnrounded(gameRNG, -sd, sd)
        }

        const corr = clamp(asNumber(sourceModel.evLaCorrelation, 0), -0.95, 0.95)
        const evZ = normal()
        const rawLaZ = normal()
        const laZ = (corr * evZ) + (Math.sqrt(1 - (corr * corr)) * rawLaZ)

        const pitchEffect = clamp(pitchQualityChange * -1, -1, 1)
        const guessEffect = guessPitch ? Math.max(0, pitchEffect) : 0

        let exitVelocity = asNumber(sourceModel.evMean, evLaModel?.evMean ?? 0) + (Math.max(Number.EPSILON, asNumber(sourceModel.evStdDev, evLaModel?.evStdDev ?? 1)) * evZ)
        let launchAngle = asNumber(sourceModel.laMean, evLaModel?.laMean ?? 0) + (Math.max(Number.EPSILON, asNumber(sourceModel.laStdDev, evLaModel?.laStdDev ?? 1)) * laZ)
        let distance = sampleMoment(getStat(trajectoryPhysics, "distance"))

        exitVelocity += (asNumber(tuning?.evScale, 0) * (pitchEffect + guessEffect))
        launchAngle += (asNumber(tuning?.laScale, 0) * pitchEffect)
        distance += (asNumber(tuning?.distanceScale, 0) * (pitchEffect + guessEffect))

        exitVelocity = Math.max(0, exitVelocity)
        distance = Math.max(0, distance)

        const coordY =
            contact === Contact.GROUNDBALL ? clamp(distance * 0.6, 20, 190) :
            trajectory === "popup" ? clamp(distance * 0.65, 70, 210) :
            contact === Contact.LINE_DRIVE ? clamp(distance, 130, 320) :
            clamp(distance, 170, 360)

        const sprayModel = (pitchEnvironmentTarget.battedBall as any)?.sprayModel?.[trajectory]

        let coordX = 0

        if (sprayModel) {
            const pullShare = Math.max(0, asNumber(sprayModel.pullShare, 0.33))
            const centerShare = Math.max(0, asNumber(sprayModel.centerShare, 0.34))
            const oppoShare = Math.max(0, asNumber(sprayModel.oppoShare, 0.33))
            const totalShare = pullShare + centerShare + oppoShare
            const roll = Rolls.getRollUnrounded(gameRNG, 0, totalShare > 0 ? totalShare : 1)

            const mean =
                roll < pullShare ? asNumber(sprayModel.pullMean, -45) :
                roll < pullShare + centerShare ? asNumber(sprayModel.centerMean, 0) :
                asNumber(sprayModel.oppoMean, 45)

            coordX = mean + (normal() * asNumber(sprayModel.stdDev, 35))
        }

        return {
            launchAngle,
            exitVelocity,
            distance,
            coordX,
            coordY
        }
    }
    
    getSwingResult(gameRNG: () => number, hitterChange: HitterChange, pitchEnvironmentTarget: PitchEnvironmentTarget, inZone: boolean, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): SwingResult {
        let pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitchQuality)

        const t = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning
        const swingTuning = t?.swing
        const contactTuning = t?.contact
        const behavior = pitchEnvironmentTarget.swing.behaviorByCount.find(b => b.balls === pitchCount.balls && b.strikes === pitchCount.strikes)

        if (!behavior) {
            throw new Error(`Missing swing behavior for count ${pitchCount.balls}-${pitchCount.strikes}`)
        }

        let swingRate = inZone
            ? behavior.zoneSwingPercent
            : behavior.chaseSwingPercent

        if (inZone) {
            swingRate += pitchQualityChange * (swingTuning?.pitchQualityZoneSwingEffect ?? 0) * -1

            swingRate += hitterChange.plateDisiplineChange * ZONE_SWING_POINTS_PER_FULL_DISCIPLINE_CHANGE * (1 + (swingTuning?.disciplineZoneSwingEffect ?? 0))
            
        } else {
            swingRate += pitchQualityChange * (swingTuning?.pitchQualityChaseSwingEffect ?? 0)

            swingRate += hitterChange.plateDisiplineChange * CHASE_SWING_POINTS_PER_FULL_DISCIPLINE_CHANGE * (1 + (swingTuning?.disciplineChaseSwingEffect ?? 0)) * -1
        }

        swingRate = Math.max(0, Math.min(100, swingRate))

        let die = Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (die < swingRate) {
            let swingContactRate = inZone
                ? behavior.zoneContactPercent
                : behavior.chaseContactPercent

            swingContactRate += pitchQualityChange * (1 + (contactTuning?.pitchQualityContactEffect ?? 0)) * -1
            swingContactRate += hitterChange.contactChange * CONTACT_RATE_POINTS_PER_FULL_CONTACT_CHANGE * (1 + (contactTuning?.contactSkillEffect ?? 0))

            swingContactRate = Math.max(0, Math.min(100, swingContactRate))

            let die2 = Rolls.getRollUnrounded(gameRNG, 0, 100)

            if (die2 < swingContactRate) {
                const foulContactRate = Math.max(0, Math.min(100, behavior.foulContactPercent))
                let die3 = Rolls.getRollUnrounded(gameRNG, 0, 100)

                if (die3 < foulContactRate) {
                    return SwingResult.FOUL
                }

                return SwingResult.FAIR
            }

            return SwingResult.STRIKE
        }

        return SwingResult.NO_SWING
    }
    
    isInZone(gameRNG: () => number, locationQuality:number, inZoneRate:number) {

        //90% of the chance should be a coin-flip (better location doesn't necessarily mean a strike)
        //and also with pitchers with poor location skills they'll walk like 80% of players making it unplayable.
        let chance = Rolls.getRollUnrounded(gameRNG, 0, 90)

        chance += (locationQuality / 99) * 10

        return chance >= (99 - inZoneRate)
    }

    getFielder(gameRNG: () => number, pitchEnvironmentTarget:PitchEnvironmentTarget, hitterHandedness:Handedness): Position {

        let rollChart = this.rollChartService.getFielderChanceRollChart(hitterHandedness == Handedness.R ? pitchEnvironmentTarget.fielderChance.vsR : pitchEnvironmentTarget.fielderChance.vsL)

        return rollChart.entries.get(Rolls.getRoll(gameRNG, 0, 99)) as Position

    }

    getShallowDeep(gameRNG: any, pitchEnvironmentTarget:PitchEnvironmentTarget): ShallowDeep {

        let rollChart = this.rollChartService.getShallowDeepRollChart(pitchEnvironmentTarget.fielderChance.shallowDeep)

        return rollChart.entries.get(Rolls.getRoll(gameRNG, 0, 99)) as ShallowDeep

    }    

    getThrowResult(gameRNG: () => number, overallSafeChance:number) : ThrowRoll {

        let roll = Rolls.getRoll(gameRNG, 1, 100)

        let result

        if (roll > overallSafeChance) {
            //out
            result = ThrowResult.OUT
        } else {
            //safe
            result = ThrowResult.SAFE
        }

        return {
            roll: roll,
            result: result
        }
    }    

    getStealResult(gameRNG: () => number) {

        //Don't steal every time. 
        return Rolls.getRoll(gameRNG, 0, 999)

    }

}

class GamePlayers {

    constructor() {}

    initGamePlayers(pitchEnvironmentTarget:PitchEnvironmentTarget, players:Player[], startingPitcher:RotationPitcher, teamId:string, color1:string, color2:string, startingId:number) : GamePlayer[] {

        let gamePlayers:GamePlayer[] = []
        
        for (let p of players) {
        
            let isStartingPitcher = p._id == startingPitcher?._id

            let hittingRatings = p.hittingRatings
            let pitchRatings = p.pitchRatings

            gamePlayers.push({ 
                _id: p._id,
                fullName: `${p.firstName} ${p.lastName}`,
                firstName: p.firstName,
                lastName: p.lastName,
                displayName: `${p.firstName[0]}. ${p.lastName}`,
                stamina: p.stamina,
                maxPitchCount: p.maxPitchCount,

                teamId: teamId,

                age: p.age,
                
                overallRating:{
                    before: p.overallRating,
                },

                color1: color1,
                color2: color2,

                throws: p.throws,
                hits: p.hits,
            
                pitchRatings: pitchRatings,
                hittingRatings: hittingRatings,

                currentPosition: p.primaryPosition,
                positions: [p.primaryPosition],
    
                hitResult: {
                    games: 0,
                    uniqueGames: 0,
                    teamWins: 0,
                    teamLosses: 0,
                    pa: 0,
                    atBats: 0,
                    hits: 0,
                    singles: 0,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 0,
                    runs: 0,
                    rbi: 0,
                    bb: 0,
                    sb: 0,
                    cs: 0,
                    hbp: 0,
                    so: 0,
                    lob: 0,
                    sacBunts: 0,
                    sacFlys: 0,
                    groundOuts: 0,
                    flyOuts: 0,
                    lineOuts: 0,
                    outs: 0,
                    groundBalls: 0,
                    lineDrives: 0,
                    flyBalls: 0,
                    gidp: 0,
                    po: 0,
                    assists: 0,
                    e: 0,
                    pitches: 0,
                    balls: 0,
                    strikes: 0,
                    fouls: 0,
                    swings: 0,
                    swingAtBalls: 0,
                    swingAtStrikes: 0,
                    inZone: 0,
                    ballsInPlay: 0,
                    totalPitchQuality: 0,
                    totalPitchPowerQuality: 0,
                    totalPitchLocationQuality: 0,
                    totalPitchMovementQuality: 0,
                    inZoneContact: 0,
                    outZoneContact: 0,
                    passedBalls: 0,
                    csDefense: 0,
                    doublePlays: 0,
                    sbAttempts: 0,
                    outfieldAssists: 0,
                    wpa: 0,
                    calledStrikes: 0,
                    swingingStrikes: 0
                },
    
                pitchResult: {
                    games: 0,
                    uniqueGames: 0,
                    teamWins: 0,
                    teamLosses: 0,
                    outs: 0,
                    er: 0,
                    so: 0,
                    hits: 0,
                    bb: 0,
                    hbp: 0,
                    singles: 0,
                    doubles: 0,
                    triples: 0,
                    runs: 0,
                    homeRuns: 0,
                    wins: 0,
                    losses: 0,
                    saves: 0,
                    bs: 0,
                    sho: 0,
                    cg: 0,
                    battersFaced: 0,
                    atBats: 0,
                    groundOuts: 0,
                    flyOuts: 0,
                    lineOuts: 0,
                    groundBalls: 0,
                    lineDrives: 0,
                    flyBalls: 0,
                    pitches: 0,
                    balls: 0,
                    strikes: 0,
                    fouls: 0,
                    swings: 0,
                    swingAtBalls: 0,
                    swingAtStrikes: 0,
                    inZone: 0,
                    starts: p._id == startingPitcher?._id ? 1 : 0,
                    ip: '0.0',
                    sacFlys: 0,
                    ballsInPlay: 0,
                    totalPitchQuality: 0,
                    totalPitchPowerQuality: 0,
                    totalPitchLocationQuality: 0,
                    totalPitchMovementQuality: 0,
                    inZoneContact: 0,
                    outZoneContact: 0,
                    wildPitches: 0,
                    wpa: 0,
                    calledStrikes: 0,
                    swingingStrikes: 0
                },

                hitterChange: {
                    vsL: PlayerChange.getHitterChange(p.hittingRatings, pitchEnvironmentTarget.avgRating, Handedness.L),
                    vsR: PlayerChange.getHitterChange(p.hittingRatings, pitchEnvironmentTarget.avgRating, Handedness.R),
                },

                pitcherChange: {
                    vsL: PlayerChange.getPitcherChange(p.pitchRatings, pitchEnvironmentTarget.avgRating, Handedness.L),
                    vsR: PlayerChange.getPitcherChange(p.pitchRatings, pitchEnvironmentTarget.avgRating, Handedness.R),
                },
    
                lineupIndex: undefined,

                isPitcherOfRecord: isStartingPitcher
                
                
            })
        }

        return gamePlayers
    }

    getGamePlayer(game:Game, playerId:string) {

        let player = game.away.players.find(p => p._id == playerId)

        if (!player) {
            player = game.home.players.find( p => p._id == playerId)
        }

        return player

    }   


}

class GameInfo {

    constructor(
        private gamePlayers:GamePlayers
    ) {}

    static initHalfInning(num:number, top: boolean) : HalfInning {

        let halfInning:HalfInning = {
            linescore: {
                runs: 0,
                hits: 0,
                errors: 0,
                leftOnBase: 0
            },
            num: num,
            top: top,
            plays: []
        }

        return halfInning

    }

    static getOffense(game:Game) {

        if (game.isTopInning) {
            return game.away
        } else {
            return game.home
        }
    }

    static getDefense(game:Game) {

        if (game.isTopInning) {
            return game.home
        } else {
            return game.away
        }
    }
    
    static isGameOver(game: Game): boolean {

        //in the bottom of an inning 9+ where we're not tied. Game over.
        if (game.currentInning >= STANDARD_INNINGS && game.isTopInning == false && game.score.home != game.score.away) return true 

        //after the top of the 9+ inning where the home team is ahead. Game over.
        if (game.currentInning >= STANDARD_INNINGS && game.isTopInning == true && game.score.home > game.score.away) return true 

        return false

    }

    static getTeamDefense(teamInfo: TeamInfo) {

        let teamRating = 0

        //Loop through lineup. Look up each player's current position. Get their defense rating for that position
        for (let id of teamInfo.lineupIds) {
            let player: GamePlayer = teamInfo.players.find(p => p._id == id)
            teamRating += player.hittingRatings.defense
        }

        return Math.round(teamRating / teamInfo.lineupIds.length)

    }

    static getPlays(game:Game) : Play[] {
        return game.halfInnings.map((inning) => inning.plays).reduce((accumulator, playsArray) => accumulator.concat(playsArray), []) // Flatten into a single array
    }

    static validateGameLineup(players:Player[], lineup:Lineup, startingPitcher:RotationPitcher) {

        //Make sure there are 9 spots in the order 
        if (lineup.order.length != 9) {
            throw new Error("Lineup must have 9 players.")
        }

        //Make sure no one is playing a duplicate position
        let filledSpots = lineup.order.filter(o => o.position != undefined)
        let filledPositions = new Set(filledSpots.map( o => o.position))

        if (filledPositions.size != filledSpots.length) {
            throw new Error("Duplicate position players.")
        }

        //Verify the pitcher and all players in the lineup are in the players list
        for (let spot of lineup.order) {

            let player = players.find( p => p._id == spot._id)

            if (!player) {
                throw new Error(`Player with id ${spot._id} in lineup not found in players list.`)
            }

        }

        if (!startingPitcher) {
            throw new Error(`No valid starting pitcher`)
        }

    } 

    buildTeamInfo(pitchEnvironmentTarget:PitchEnvironmentTarget, team:Team, lineup:Lineup, availablePitchers:PitchingRole[], players:Player[], startingPitcher:RotationPitcher, color1:string, color2:string, homeAway:HomeAway, startingId:number, teamOptions?:any) : TeamInfo {

        let gamePlayer:GamePlayer[] = this.gamePlayers.initGamePlayers(pitchEnvironmentTarget, players, startingPitcher, team._id, color1, color2, startingId)

        if (!startingPitcher) throw new Error("No valid starting pitcher.")

        const pitcherSpot = lineup.order.find(p => p.position == Position.PITCHER)

        if (!pitcherSpot) {
            throw new Error("Lineup has no pitcher spot.")
        }

        pitcherSpot._id = startingPitcher._id

        let pitcherGP = gamePlayer.find(gp => gp._id == startingPitcher._id)

        if (!pitcherGP) {
            throw new Error("Starting pitcher was not found in game players.")
        }

        for (let player of gamePlayer) {
            player.currentPosition = undefined
            player.lineupIndex = undefined
        }

        let teamInfo:TeamInfo = Object.assign({
            _id: team._id,

            name: team.name,
            abbrev: team.abbrev,

            players: gamePlayer,

            lineupIds: lineup.order.map(op => op._id),
            availablePitchers: availablePitchers,

            currentHitterIndex: 0,
            currentPitcherId: pitcherGP._id,

            runner1BId: undefined,
            runner2BId: undefined,
            runner3BId: undefined,

            homeAway: homeAway,

            color1: color1,
            color2: color2

        }, teamOptions)

        lineup.order.forEach((spot, idx) => {
            let player:GamePlayer|undefined = teamInfo.players?.find(p => p._id == spot._id)

            if (player) {
                player.currentPosition = spot.position
                player.lineupIndex = idx
            }
        })

        return teamInfo

    }  


}

class AtBatInfo {

    static isAtBat(playResult: OfficialPlayResult) {

        if (playResult == OfficialPlayResult.HIT_BY_PITCH) return false
        if (playResult == OfficialPlayResult.WALK) return false
        if (playResult == OfficialPlayResult.RUNNER_OUT) return false
        if (playResult == OfficialPlayResult.EJECTION) return false

        return true
    }


    static isInAir(contact: Contact) {
        return contact == Contact.FLY_BALL || contact == Contact.LINE_DRIVE
    }

    static isToInfielder(fielder: Position) {

        switch (fielder) {
            case Position.PITCHER:
            case Position.CATCHER:
            case Position.FIRST_BASE:
            case Position.SECOND_BASE:
            case Position.THIRD_BASE:
            case Position.SHORTSTOP:
                return true
        }

        return false

    }

    static isToOF(fielder: Position) {

        switch (fielder) {
            case Position.LEFT_FIELD:
            case Position.RIGHT_FIELD:
            case Position.CENTER_FIELD:
                return true
        }

        return false

    }

    static isHit(playResult: PlayResult) {

        switch (playResult) {
            case PlayResult.SINGLE:
            case PlayResult.DOUBLE:
            case PlayResult.TRIPLE:
            case PlayResult.HR:
                return true
        }

        return false

    }

}

class LogResult {

    constructor() {}

    static logAtBat(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.atBats++
        pitchResult.atBats++
    }

    static logWildPitch(pitchResult: PitchResultCount) {
        pitchResult.wildPitches++
    }

    static logPassedBall(hitResult: HitResultCount) {
        hitResult.passedBalls++
    }

    static logStolenBase(hitResult: HitResultCount) {
        hitResult.sb++
    }

    static logStolenBaseAttempt(hitResult: HitResultCount) {
        hitResult.sbAttempts++
    }

    static logCaughtStealing(hitResult: HitResultCount) {
        hitResult.cs++
    }

    static logCSDefense(hitResult: HitResultCount) {
        hitResult.csDefense++
    }

    static logAssist(hitResult: HitResultCount) {
        hitResult.assists++
    }

    static logOutfieldAssist(hitResult: HitResultCount) {
        hitResult.outfieldAssists++
    }

    static logPutout(hitResult: HitResultCount) {
        hitResult.po++
    }

    static logErrors(hitResult: HitResultCount) {
        hitResult.e++
    }

    static logDoublePlays(hitResult: HitResultCount) {
        hitResult.doublePlays++
    }

    static logGIDP(hitResult: HitResultCount) {
        hitResult.gidp++
    }

    static logHit(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.hits++
        pitchResult.hits++
    }

    static logStrikeout(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.so++
        pitchResult.so++
    }

    static logBB(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.bb++
        pitchResult.bb++
    }

    static logHBP(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.hbp++
        pitchResult.hbp++
    }

    static log1B(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.singles++
        pitchResult.singles++
    }

    static log2B(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.doubles++
        pitchResult.doubles++
    }

    static log3B(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.triples++
        pitchResult.triples++
    }

    static logHR(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.homeRuns++
        pitchResult.homeRuns++
    }

    static logGroundout(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.groundOuts++
        pitchResult.groundOuts++
    }

    static logFlyout(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.flyOuts++
        pitchResult.flyOuts++
    }

    static logOuts(pitchResult: PitchResultCount|HitResultCount, outs: number) {
        pitchResult.outs += outs
    }

    static logLineout(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.lineOuts++
        pitchResult.lineOuts++
    }

    static logGroundball(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.groundBalls++
        pitchResult.groundBalls++
    }

    static logLineDrive(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.lineDrives++
        pitchResult.lineDrives++
    }

    static logFlyBall(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.flyBalls++
        pitchResult.flyBalls++
    }

    static logRuns(hitResult: HitResultCount, pitchResult: PitchResultCount) {
        hitResult.runs++
        pitchResult.runs++
    }

    static logEarnedRuns(pitchResult: PitchResultCount) {
        pitchResult.er++ 
    }

    static logLOB(hitResult: HitResultCount, toLog: number) {
        hitResult.lob += toLog
    }

    static logRBI(hitResult: HitResultCount, rbi: number) {
        hitResult.rbi += rbi
    }

    static logGidp(hitResult: HitResultCount) {
        hitResult.gidp++
    }

    static logPlayResults(offense:TeamInfo, defense:TeamInfo, hitter:GamePlayer, pitcher:GamePlayer, runner1BId:string, runner2BId:string, runner3BId:string, defensiveCredits:DefensiveCredit[], runnerEvents: RunnerEvent[], contact: Contact, officialPlayResult: OfficialPlayResult, playResult: PlayResult, pitchLog: PitchLog, isInningEndingEvent:boolean) {

        let outEvents = runnerEvents.filter( re => re.movement?.isOut)

        if (outEvents?.length > 0) {

            LogResult.logOuts(pitcher.pitchResult, outEvents.length)

            //Log out for each runner
            for (let oe of outEvents) {
                LogResult.logOuts(offense.players.find( p => p._id == oe.runner._id).hitResult, 1)
            }

        }


        //Log unearned runs
        let unearnedRuns = runnerEvents.filter( re => re.isScoringEvent)

        //If double play or an error, no RBIs.
        if (outEvents.length <= 1 && this.getTotalOuts(runnerEvents) < 2 && defensiveCredits.find(dc => dc.type == DefenseCreditType.ERROR) == undefined ) {
            LogResult.logRBI(hitter.hitResult, unearnedRuns.length)
        }


        for (let re of unearnedRuns) {
            let runner = offense.players.find(p => p._id == re.runner._id)
            LogResult.logRuns(runner.hitResult, pitcher.pitchResult)

            if (!re.isUnearned) {
                LogResult.logEarnedRuns(pitcher.pitchResult)
            }

        }

        //Log left on base.
        if (this.getTotalOuts(runnerEvents) >= 3) {
            let startRunners = [runner1BId, runner2BId, runner3BId].filter(r => r != undefined).length
            LogResult.logLOB(hitter.hitResult, startRunners - unearnedRuns.length)
        }

        if (AtBatInfo.isAtBat(officialPlayResult)) {
            LogResult.logAtBat(hitter.hitResult, pitcher.pitchResult)
        }

        // gidp:number    
        // doublePlays:number

        //Update wild pitches
        pitcher.pitchResult.wildPitches += pitchLog.pitches.filter( p => p.isWP)?.length

        //Stolen base attempts
        let sbAttempts = runnerEvents.filter(re => re.isSBAttempt)

        for (let re of sbAttempts) {
            let runner = offense.players.find(p => p._id == re.runner._id)
            LogResult.logStolenBaseAttempt(runner.hitResult)
        }

        //Stolen bases
        let sb = runnerEvents.filter(re => re.isSB)

        for (let re of sb) {
            let runner = offense.players.find(p => p._id == re.runner._id)
            LogResult.logStolenBase(runner.hitResult)
        }

        //Caught stealing
        let cs = runnerEvents.filter(re => re.isCS)

        for (let re of cs) {
            let runner = offense.players.find(p => p._id == re.runner._id)
            LogResult.logCaughtStealing(runner.hitResult)
        }


        //Passed balls
        let passedBalls = defensiveCredits.filter( dc => dc.type == DefenseCreditType.PASSED_BALL)

        for (let dc of passedBalls) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logPassedBall(defender.hitResult)
        }

        //Putouts
        let putouts = defensiveCredits.filter( dc => dc.type == DefenseCreditType.PUTOUT)

        for (let dc of putouts) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logPutout(defender.hitResult)
        }

        //Assists
        let assists = defensiveCredits.filter( dc => dc.type == DefenseCreditType.ASSIST)

        for (let dc of assists) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logAssist(defender.hitResult)
        }


        //OF Assists
        let ofAssists = defensiveCredits.filter( dc => dc.type == DefenseCreditType.ASSIST && AtBatInfo.isToOF(defense.players.find(p => p._id == dc._id).currentPosition))

        for (let dc of ofAssists) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logOutfieldAssist(defender.hitResult)
        }

        //Errors
        let errors = defensiveCredits.filter( dc => dc.type == DefenseCreditType.ERROR)

        for (let dc of errors) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logErrors(defender.hitResult)
        }

        //Caught stealing defense
        let csDefense = defensiveCredits.filter( dc => dc.type == DefenseCreditType.CAUGHT_STEALING)

        for (let dc of csDefense) {
            let defender = defense.players.find(p => p._id == dc._id)
            LogResult.logCSDefense(defender.hitResult)
        }


        switch (contact) {

            case Contact.FLY_BALL:
                LogResult.logFlyBall(hitter.hitResult, pitcher.pitchResult)
                break

            case Contact.GROUNDBALL:
                LogResult.logGroundball(hitter.hitResult, pitcher.pitchResult)
                break

            case Contact.LINE_DRIVE:
                LogResult.logLineDrive(hitter.hitResult, pitcher.pitchResult)
                break

        }


        switch (playResult) {

            case PlayResult.STRIKEOUT:
                LogResult.logStrikeout(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.BB:
                LogResult.logBB(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.HIT_BY_PITCH:
                LogResult.logHBP(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.SINGLE:
                LogResult.log1B(hitter.hitResult, pitcher.pitchResult)
                LogResult.logHit(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.DOUBLE:
                LogResult.log2B(hitter.hitResult, pitcher.pitchResult)
                LogResult.logHit(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.TRIPLE:
                LogResult.log3B(hitter.hitResult, pitcher.pitchResult)
                LogResult.logHit(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.HR:
                LogResult.logHR(hitter.hitResult, pitcher.pitchResult)
                LogResult.logHit(hitter.hitResult, pitcher.pitchResult)
                break

            case PlayResult.OUT:
            
                switch(contact) {
                    case Contact.FLY_BALL:
                        LogResult.logFlyout(hitter.hitResult, pitcher.pitchResult)
                        break
                    case Contact.GROUNDBALL:
                        LogResult.logGroundout(hitter.hitResult, pitcher.pitchResult)

                        const nonCaughtStealingOuts = runnerEvents.filter(re => re?.movement?.isOut && !re.isCS).length

                        if (nonCaughtStealingOuts >= 2) {
                            LogResult.logDoublePlays(hitter.hitResult)
                            LogResult.logGIDP(hitter.hitResult)
                        }

                        break
                    case Contact.LINE_DRIVE:
                        LogResult.logLineout(hitter.hitResult, pitcher.pitchResult)
                        break
                }

                break
        
            case PlayResult.ERROR:
                break
                
            default: 

                if (!isInningEndingEvent) {
                    throw Error(`Error logging unknown play result ${playResult}`)
                }


        }


        //Pitcher
        pitcher.pitchResult.games = 1
        pitcher.pitchResult.uniqueGames = 1

        pitcher.pitchResult.battersFaced++

        pitcher.pitchResult.pitches += pitchLog.count.pitches
        pitcher.pitchResult.balls += pitchLog.count.balls
        pitcher.pitchResult.strikes += pitchLog.count.strikes
        pitcher.pitchResult.fouls += pitchLog.count.fouls
        
        pitcher.pitchResult.swings += pitchLog.pitches.filter( p => p.swing == true).length || 0
        pitcher.pitchResult.swingAtBalls += pitchLog.pitches.filter( p => p.swing == true && p.inZone == false).length || 0
        pitcher.pitchResult.swingAtStrikes += pitchLog.pitches.filter( p => p.swing == true && p.inZone == true).length || 0
        pitcher.pitchResult.ballsInPlay += pitchLog.pitches.filter( p => p.swing == true && p.result == PitchCall.IN_PLAY).length || 0

        pitcher.pitchResult.calledStrikes += pitchLog.pitches.filter( p => p.result == PitchCall.STRIKE && p.swing == false).length || 0
        pitcher.pitchResult.swingingStrikes += pitchLog.pitches.filter( p => p.result == PitchCall.STRIKE && p.swing == true && p.con == false).length || 0

        pitcher.pitchResult.inZone += pitchLog.pitches.filter( p => p.inZone == true).length || 0
        pitcher.pitchResult.inZoneContact += pitchLog.pitches.filter( p => p.inZone == true && p.con == true  ).length || 0
        pitcher.pitchResult.outZoneContact += pitchLog.pitches.filter( p => p.inZone == false && p.con == true  ).length || 0
        pitcher.pitchResult.ip = LogResult.getIP(pitcher.pitchResult.outs)


        pitcher.pitchResult.totalPitchQuality += pitchLog.pitches.map( p => p.overallQuality).reduce((prev, curr) => prev + curr)
        pitcher.pitchResult.totalPitchLocationQuality += pitchLog.pitches.map( p => p.locQ).reduce((prev, curr) => prev + curr)
        pitcher.pitchResult.totalPitchMovementQuality += pitchLog.pitches.map( p => p.movQ).reduce((prev, curr) => prev + curr)
        pitcher.pitchResult.totalPitchPowerQuality += pitchLog.pitches.map( p => p.powQ).reduce((prev, curr) => prev + curr)

        //Hitter
        hitter.hitResult.games = 1
        hitter.hitResult.uniqueGames = 1

        hitter.hitResult.pa++

        hitter.hitResult.pitches += pitchLog.count.pitches
        hitter.hitResult.balls += pitchLog.count.balls
        hitter.hitResult.strikes += pitchLog.count.strikes
        hitter.hitResult.fouls += pitchLog.count.fouls

        hitter.hitResult.swings += pitchLog.pitches.filter( p => p.swing == true).length || 0
        hitter.hitResult.swingAtBalls += pitchLog.pitches.filter( p => p.swing == true && p.inZone == false).length || 0
        hitter.hitResult.swingAtStrikes += pitchLog.pitches.filter( p => p.swing == true && p.inZone == true).length || 0
        hitter.hitResult.ballsInPlay += pitchLog.pitches.filter( p => p.swing == true && p.result == PitchCall.IN_PLAY).length || 0

        hitter.hitResult.calledStrikes += pitchLog.pitches.filter( p => p.result == PitchCall.STRIKE && p.swing == false).length || 0
        hitter.hitResult.swingingStrikes += pitchLog.pitches.filter( p => p.result == PitchCall.STRIKE && p.swing == true && p.con == false).length || 0

        hitter.hitResult.inZone += pitchLog.pitches.filter( p => p.inZone == true).length || 0
        hitter.hitResult.inZoneContact += pitchLog.pitches.filter( p => p.inZone == true && p.con == true ).length || 0
        hitter.hitResult.outZoneContact += pitchLog.pitches.filter( p => p.inZone == false && p.con == true  ).length || 0

        hitter.hitResult.totalPitchQuality += pitchLog.pitches.map( p => p.overallQuality).reduce((prev, curr) => prev + curr)
        hitter.hitResult.totalPitchLocationQuality += pitchLog.pitches.map( p => p.locQ).reduce((prev, curr) => prev + curr)
        hitter.hitResult.totalPitchMovementQuality += pitchLog.pitches.map( p => p.movQ).reduce((prev, curr) => prev + curr)
        hitter.hitResult.totalPitchPowerQuality += pitchLog.pitches.map( p => p.powQ).reduce((prev, curr) => prev + curr)

    }

    //Not sure this belongs but here it is.
    static getIP(outs) {

        if (!outs) return "0.0"

        const innings = Math.floor(outs / 3)
        const thirds = outs % 3

        if (thirds === 0) {
            return innings + ".0"
        } else if (thirds === 1) {
            return innings + ".1"
        } else {
            return innings + ".2"
        }

    }

    static getTotalOuts(runnerEvents: RunnerEvent[]) {
        return runnerEvents.filter( re => re?.movement?.isOut == true).length
    }

}

class Rolls {

    static getRoll(generator: () => number, min: number, max: number) {
        if (max < min) throw new Error(`getRoll max < min (${max} < ${min})`)
        return Math.floor(generator() * (max - min + 1)) + min
    }

    static getRollUnrounded(generator: () => number, min: number, max: number) {
        if (max < min) throw new Error(`getRollUnrounded max < min (${max} < ${min})`)
        return (generator() * (max - min)) + min // continuous in [min, max)
    }

        //Source 
    // https://github.com/trekhleb/javascript-algorithms/blob/master/src/algorithms/statistics/weighted-random/weightedRandom.js
    static weightedRandom(gameRNG: () => number, items, weights) {

        if (items.length !== weights.length) {
            throw new Error('Items and weights must be of the same size')
        }

        if (!items.length) {
            throw new Error('Items must not be empty')
        }

        // Preparing the cumulative weights array.
        // For example:
        // - weights = [1, 4, 3]
        // - cumulativeWeights = [1, 5, 8]
        const cumulativeWeights = [];
        for (let i = 0; i < weights.length; i += 1) {
            cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0)
        }

        // Getting the random number in a range of [0...sum(weights)]
        // For example:
        // - weights = [1, 4, 3]
        // - maxCumulativeWeight = 8
        // - range for the random number is [0...8]
        const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1]
        const randomNumber = maxCumulativeWeight * gameRNG()

        // Picking the random item based on its weight.
        // The items with higher weight will be picked more often.
        for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
            if (cumulativeWeights[itemIndex] >= randomNumber) {
                return items[itemIndex]
            }
        }
    }

}

class PlayerChange {

    static getChange(a:number, b:number) {
        
        if (a == 0) {
            if (b > 0) return 1
            if (b < 0) return -1
            return 0
        }

        return ((b / a * 100) - 100) / 100
    }

    static getPitcherChange(pitchRatings: PitchRatings, laRating:number, hits:Handedness): PitcherChange {

        let handednessRatings = hits == Handedness.R ? pitchRatings.vsR : pitchRatings.vsL

        return {

            controlChange: clamp(PlayerChange.getChange(laRating, handednessRatings.control), MIN_CHANGE, MAX_CHANGE),
            movementChange: clamp(PlayerChange.getChange(laRating, handednessRatings.movement), MIN_CHANGE, MAX_CHANGE),
            powerChange: clamp(PlayerChange.getChange(laRating, pitchRatings.power), MIN_CHANGE, MAX_CHANGE),


            // pitchesChange: pitchesChange
        }
    }

    static getHitterChange(hittingRatings: HittingRatings, laRating:number, throws:Handedness): HitterChange {

        let handednessRatings = throws == Handedness.R ? hittingRatings.vsR : hittingRatings.vsL

        return {
            plateDisiplineChange: clamp(PlayerChange.getChange(laRating, handednessRatings.plateDiscipline), MIN_CHANGE, MAX_CHANGE),
            contactChange: clamp(PlayerChange.getChange(laRating, handednessRatings.contact), MIN_CHANGE, MAX_CHANGE),

            gapPowerChange: clamp(PlayerChange.getChange(laRating, handednessRatings.gapPower), MIN_CHANGE, MAX_CHANGE),
            hrPowerChange: clamp(PlayerChange.getChange(laRating, handednessRatings.homerunPower), MIN_CHANGE, MAX_CHANGE),

            speedChange: clamp(PlayerChange.getChange(laRating, hittingRatings.speed), MIN_CHANGE, MAX_CHANGE),
            stealsChange: clamp(PlayerChange.getChange(laRating, hittingRatings.steals), MIN_CHANGE, MAX_CHANGE),

            defenseChange: clamp(PlayerChange.getChange(laRating, hittingRatings.defense), MIN_CHANGE, MAX_CHANGE),
            armChange: clamp(PlayerChange.getChange(laRating, hittingRatings.arm), MIN_CHANGE, MAX_CHANGE)

        }

    }

    static getClampedChange(avgRating:number, rating:number) {
        return clamp(this.getChange(avgRating, rating), MIN_CHANGE, MAX_CHANGE)
    }

    static applyChanges(base:number, changes:number[]) {

        base = PlayerChange.applyChange(base, getAverage(changes))

        return base
    }

    static applyChange(value:number, change:number) {
        if (change == 0) return value
        return value + (value * change)
    }

    static applyNegativeChange(value:number, change:number) {
        if (change == 0) return value
        return value - (value * change)
    }

}

class LinescoreActions {

    static updateLinescore(game:Game, halfInning:HalfInning, play:Play) {

        //Runs
        if (play.runner?.result?.end?.scored?.length > 0) {

            if (game.isTopInning) {
                halfInning.linescore.runs += play.runner?.result?.end?.scored?.length
            } else {
                halfInning.linescore.runs += play.runner?.result?.end?.scored?.length
            }

        }

        //Hits
        if (AtBatInfo.isHit(play.result)) {
            if (game.isTopInning) {
                halfInning.linescore.hits++
            } else {
                halfInning.linescore.hits++
            }
        }        

        //Runs
        if (play.runner?.result?.end?.scored?.length > 0) {

            if (game.isTopInning) {
                game.score.away += play.runner?.result?.end?.scored?.length
            } else {
                game.score.home += play.runner?.result?.end?.scored?.length
            }

        }        

    }

    static updateLinescoreLOB(halfInning:HalfInning, lob:number) {
        halfInning.linescore.leftOnBase += lob
    }
}




const ALL_PITCH_ZONES: readonly PitchZone[] = [
  PitchZone.LOW_AWAY, PitchZone.LOW_MIDDLE, PitchZone.LOW_INSIDE,
  PitchZone.MID_AWAY, PitchZone.MID_MIDDLE, PitchZone.MID_INSIDE,
  PitchZone.HIGH_AWAY, PitchZone.HIGH_MIDDLE, PitchZone.HIGH_INSIDE,
] as const




export {
    SimService, PlayerChange, Rolls, AtBatInfo, SimRolls, Matchup, GameInfo, GamePlayers
}
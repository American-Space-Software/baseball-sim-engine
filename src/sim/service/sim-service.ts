import { HomeAway, Position, Handedness, PitchType, PitchCall, SwingResult, PlayResult, Contact, ShallowDeep, OfficialPlayResult, BaseResult, DefenseCreditType, OfficialRunnerResult, PitchZone, ThrowResult } from "./enums.js"
import { StartGameCommand, GamePlayer, MatchupHandedness, Score, RunnerResult, DefensiveCredit, PitchLog, HalfInning, UpcomingMatchup, RunnerEvent, HitterChange, PitcherChange, SimPitchCommand, SimPitchResult, InningEndingEvent, Pitch, RollChart, Game, HitResultCount, HittingRatings,  Lineup, PitchCount, PitchRatings, PitchResultCount, Play, Player, RotationPitcher, RunnerThrowCommand, StolenBaseByCount, Team, TeamInfo, ThrowRoll, PitchEnvironmentTarget, ContactQuality, PitchQuality } from "./interfaces.js"
import { RollChartService } from "./roll-chart-service.js"


const APPLY_PLAYER_CHANGES = true
const PLAYER_CHANGE_SCALE = 0.75
const STANDARD_INNINGS = 9
const AVG_PITCH_QUALITY = 50

const MIN_CHANGE = -.5
const MAX_CHANGE = .5

const PITCH_QUALITY_WEIGHTS = {
    velocity: 33.3,
    movement: 33.4,
    control: 33.3
} 

const DEFAULT_FULL_PITCH_QUALITY_BONUS = 500
const DEFAULT_FULL_TEAM_DEFENSE_BONUS = 100
const DEFAULT_FULL_FIELDER_DEFENSE_BONUS = 100

class SimService {

    constructor(
        private rollChartService:RollChartService,
        private gameRolls:SimRolls,
        private runnerActions:RunnerActions,
        private gameInfo:GameInfo,
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

        game.playIndex = 0

    }

    public startGame(command:StartGameCommand) : Game {

        let game = command.game

        //Validate lineups
        GameInfo.validateGameLineup(command.awayLineup, command.awayStartingPitcher)
        GameInfo.validateGameLineup(command.homeLineup, command.homeStartingPitcher)

        //Use what gets passed in or just use default config
        game.pitchEnvironmentTarget = JSON.parse(JSON.stringify(command.pitchEnvironmentTarget ?? this.defaultPitchEnvironmentTarget))

        if (!game.pitchEnvironmentTarget) {
            throw new Error("No league averages provided to start game.")
        }

        game.away = this.gameInfo.buildTeamInfoFromTeam(game.pitchEnvironmentTarget, command.away, command.awayLineup,  command.awayPlayers, command.awayStartingPitcher, command.away.colors.color1, command.away.colors.color2, HomeAway.AWAY, 1, command.awayTeamOptions)            
        game.home = this.gameInfo.buildTeamInfoFromTeam(game.pitchEnvironmentTarget, command.home, command.homeLineup, command.homePlayers, command.homeStartingPitcher, command.home.colors.color1, command.home.colors.color2, HomeAway.HOME, 1 + command.awayPlayers.length, command.homeTeamOptions)

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

    public simPitch(game:Game, rng:any) {

        let command:SimPitchCommand = this.createSimPitchCommand(game, rng)


        if (!command.play) {

            let runner1B = command.offense.players.find( p => p._id == command.offense.runner1BId)
            let runner2B = command.offense.players.find( p => p._id == command.offense.runner2BId)
            let runner3B = command.offense.players.find( p => p._id == command.offense.runner3BId)

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

          //Add play to half inning
          command.halfInning.plays.push(command.play)

          //Just add the play.
          return

        }


        let result:SimPitchResult

        let continueAtBat = true
        let isInningEndingEvent = false

        //Do matchup
        try {
            result = this.simPitchRolls(command, command.play.pitchLog.pitches?.length || 0)
            continueAtBat = result.continueAtBat
        } catch(ex) {
            //Ignore inning ending events errors.
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

        const hitterPitchGuess: PitchType =
            command.pitcher.pitchRatings.pitches[Rolls.getRoll(command.rng, 0, pitches.length - 1)]
        const guessPitch: boolean = hitterPitchGuess == pitchType

        const pitchQuality: PitchQuality = this.gameRolls.getPitchQuality(command.rng, command.pitcherChange, command.pitchEnvironmentTarget)
        const pitcherPhysics = command.pitchEnvironmentTarget.importReference.pitcher.physics

        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
        const asNumber = (value: any): number => Number.isFinite(Number(value)) ? Number(value) : 0

        const velocityWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.velocity))
        const movementWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.movement))
        const controlWeight = Math.max(0, asNumber(PITCH_QUALITY_WEIGHTS.control))
        const weightTotal = velocityWeight + movementWeight + controlWeight

        if (weightTotal <= 0) {
            throw new Error("Pitch quality weights must total more than zero.")
        }

        const normalizedVelocityWeight = velocityWeight / weightTotal
        const normalizedMovementWeight = movementWeight / weightTotal
        const normalizedControlWeight = controlWeight / weightTotal

        const velocityStdDev = _getStdDev(pitcherPhysics.velocity)
        const horizontalBreakStdDev = _getStdDev(pitcherPhysics.horizontalBreak)
        const verticalBreakStdDev = _getStdDev(pitcherPhysics.verticalBreak)

        const velocityDelta = velocityStdDev > 0
            ? (pitchQuality.velocity - pitcherPhysics.velocity.avg) / velocityStdDev
            : 0

        const horizontalBreakDelta = horizontalBreakStdDev > 0
            ? (pitchQuality.horizontalBreak - pitcherPhysics.horizontalBreak.avg) / horizontalBreakStdDev
            : 0

        const verticalBreakDelta = verticalBreakStdDev > 0
            ? (pitchQuality.verticalBreak - pitcherPhysics.verticalBreak.avg) / verticalBreakStdDev
            : 0

        const avgAbsBreakDelta = (Math.abs(horizontalBreakDelta) + Math.abs(verticalBreakDelta)) / 2
        const centeredMovementDelta = avgAbsBreakDelta - 0.5
        const controlDelta = command.pitcherChange.controlChange

        const velocityComponent = clamp(velocityDelta / 2, -0.5, 0.5)
        const movementComponent = clamp(centeredMovementDelta, -0.5, 0.5)
        const controlComponent = clamp(controlDelta, -0.5, 0.5)

        const pitchQualityChange =
            (velocityComponent * normalizedVelocityWeight) +
            (movementComponent * normalizedMovementWeight) +
            (controlComponent * normalizedControlWeight)

        const powQ = clamp(Math.round(50 + (velocityComponent * 99)), 0, 99)
        const movQ = clamp(Math.round(50 + (movementComponent * 99)), 0, 99)
        const locQ = clamp(Math.round(50 + (controlComponent * 99)), 0, 99)
        const overallQuality = clamp(Math.round(50 + (pitchQualityChange * 99)), 0, 99)

        let inZoneRate = command.pitchEnvironmentTarget.pitch.inZoneByCount.find(
            r => r.balls === command.play.pitchLog.count.balls && r.strikes === command.play.pitchLog.count.strikes
        )?.inZone

        const inZone = this.gameRolls.isInZone(command.rng, locQ, inZoneRate)

        const intentZone = this.gameRolls.getIntentZone(command.rng)
        const actualZone = Pitching.getActualZone(intentZone, locQ)

        const pitch: Pitch = {
            intentZone,
            actualZone,
            type: pitchType,
            quality: pitchQuality,
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
                inZone,
                pitch.overallQuality,
                guessPitch,
                command.play.pitchLog.count
            )

            pitch.swing = (swingResult != SwingResult.NO_SWING)
            pitch.con = (swingResult == SwingResult.FAIR || swingResult == SwingResult.FOUL)

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
                    pitch.result = inZone ? PitchCall.STRIKE : PitchCall.BALL
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

        if (pitch.result == PitchCall.HBP) {
            command.play.result = PlayResult.HIT_BY_PITCH
            continueAtBat = false
        }

        if (pitch.result == PitchCall.IN_PLAY) continueAtBat = false

        if (command.play.pitchLog.count.balls == 4) {
            command.play.result = PlayResult.BB
            continueAtBat = false
        }

        if (command.play.pitchLog.count.strikes == 3) {
            command.play.result = PlayResult.STRIKEOUT
            continueAtBat = false
        }

        const result: SimPitchResult = {
            continueAtBat,
            pitch,
        }

        this.runnerActions.generateRunnerEventsFromPitch(command, pitchIndex, result)

        command.game.count.balls = command.play.pitchLog.count.balls
        command.game.count.strikes = command.play.pitchLog.count.strikes

        pitch.count = JSON.parse(JSON.stringify(command.game.count))

        return result
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
        let fielderPlayer:GamePlayer

        let ballInPlay:Pitch = command.play.pitchLog.pitches.find(p => p.result == PitchCall.IN_PLAY)

        let isFieldingError = false

        if (!isInningEndingEvent) {
            
            if (ballInPlay) {

                let pitch = ballInPlay

                let pitchQualityChange = PlayerChange.getChange(AVG_PITCH_QUALITY, pitch.overallQuality)

                let contactRollChart:RollChart = this.rollChartService.getMatchupContactRollChart(
                    command.pitchEnvironmentTarget,
                    command.hitter.hittingRatings.contactProfile,
                    command.pitcher.pitchRatings.contactProfile,
                    APPLY_PLAYER_CHANGES
                )

                const clamp = (value:number, min:number, max:number) => Math.max(min, Math.min(max, value))

                let hitQuality:ContactQuality
                let overallContactQuality:number

                command.play.contact = contactRollChart.entries.get(Rolls.getRoll(command.rng, 0, 99)) as Contact

                hitQuality = this.gameRolls.getHitQuality(
                    command.rng,
                    command.pitchEnvironmentTarget,
                    pitchQualityChange,
                    pitch.guess,
                    command.play.contact
                )

                let outcomeModel = this.getOutcomeModelForContactQuality(
                    command.pitchEnvironmentTarget,
                    hitQuality,
                    command.play.contact,
                    pitchQualityChange
                )

                const fieldingResult = this.pickFielderFromLocation(
                    command,
                    command.play.contact,
                    hitQuality
                )

                command.play.fielder = fieldingResult.fielder
                command.play.shallowDeep = fieldingResult.shallowDeep
                fielderPlayer = fieldingResult.fielderPlayer

                outcomeModel = this.applyDefenseToOutcomeModel(
                    command,
                    outcomeModel,
                    fielderPlayer
                )

                overallContactQuality = clamp(Math.round((outcomeModel.expectedBases / 4) * 999), 0, 999)
                command.play.result = this.getPlayResultFromOutcomeModel(outcomeModel, command.rng)

                pitch.contactQuality = hitQuality
                pitch.overallContactQuality = overallContactQuality

                if (command.play.result === PlayResult.HR) {
                    command.play.shallowDeep = ShallowDeep.DEEP
                }

                if (command.play.result === PlayResult.TRIPLE && AtBatInfo.isToOF(command.play.fielder)) {
                    command.play.shallowDeep = ShallowDeep.DEEP
                }

            } else {

                if (
                    command.play.result != PlayResult.STRIKEOUT &&
                    command.play.result != PlayResult.BB &&
                    command.play.result != PlayResult.HIT_BY_PITCH &&
                    !isInningEndingEvent
                ) {
                    throw new Error("Error with pitchlog")
                }

            }

            let runner1B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.first)
            let runner2B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.second)
            let runner3B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.third)

            if (command.play.runner.result.end.first && !runner1B) {
                throw new Error("Missing 1B runner.")
            }

            if (command.play.runner.result.end.second && !runner2B) {
                throw new Error("Missing 2B runner.")
            }

            if (command.play.runner.result.end.third && !runner3B) {
                throw new Error("Missing 3B runner.")
            }

            let inPlayRunnerEvents: RunnerEvent[] = this.runnerActions.getRunnerEvents(
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

        this.runnerActions.validateRunnerResult(command.play.runner.result.end)

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

        let runner1B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.first)
        let runner2B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.second)
        let runner3B: GamePlayer = command.offense.players.find(p => p._id == command.play.runner.result.end.third)

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

            let leftOnBase = [command.offense.runner1BId, command.offense.runner2BId, command.offense.runner3BId]
                .filter(r => r != undefined).length

            if (leftOnBase > 0) {
                LinescoreActions.updateLinescoreLOB(command.halfInning, leftOnBase)
            }

            RunnerActions.clearRunners(command.offense)

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

    private getOutcomeModelForContactQuality(pitchEnvironmentTarget: PitchEnvironmentTarget, contactQuality: ContactQuality, contact: Contact, pitchQualityChange: number): { count: number, out: number, single: number, double: number, triple: number, hr: number, evBin: number, laBin: number, expectedBases: number } {
        const outcomeByEvLa = pitchEnvironmentTarget.battedBall?.outcomeByEvLa ?? []

        if (outcomeByEvLa.length === 0) {
            throw new Error("Missing outcomeByEvLa data")
        }

        const rawEvBin = Math.floor(contactQuality.exitVelocity / 2) * 2
        const rawLaBin = Math.floor(contactQuality.launchAngle / 2) * 2

        const evBins = Array.from(new Set(outcomeByEvLa.map((bucket: any) => Number(bucket.evBin)).filter((value: number) => Number.isFinite(value)))).sort((a, b) => a - b)
        const laBins = Array.from(new Set(outcomeByEvLa.map((bucket: any) => Number(bucket.laBin)).filter((value: number) => Number.isFinite(value)))).sort((a, b) => a - b)

        if (evBins.length === 0 || laBins.length === 0) {
            throw new Error("Missing outcomeByEvLa bin data")
        }

        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

        const evBin = clamp(rawEvBin, evBins[0], evBins[evBins.length - 1])
        const laBin = clamp(rawLaBin, laBins[0], laBins[laBins.length - 1])

        let exact = outcomeByEvLa.find((bucket: any) => Number(bucket.evBin) === evBin && Number(bucket.laBin) === laBin)

        if (!exact) {
            exact = outcomeByEvLa
                .map((bucket: any) => {
                    const bucketEvBin = Number(bucket.evBin)
                    const bucketLaBin = Number(bucket.laBin)

                    return {
                        bucket,
                        distance: Math.abs(bucketEvBin - evBin) + Math.abs(bucketLaBin - laBin),
                        evDistance: Math.abs(bucketEvBin - evBin),
                        laDistance: Math.abs(bucketLaBin - laBin)
                    }
                })
                .filter((row: any) => Number.isFinite(row.distance))
                .sort((a: any, b: any) => {
                    if (a.distance !== b.distance) return a.distance - b.distance
                    if (a.evDistance !== b.evDistance) return a.evDistance - b.evDistance
                    return a.laDistance - b.laDistance
                })[0]?.bucket
        }

        if (!exact) {
            throw new Error(`Missing outcomeByEvLa bucket for evBin=${evBin} laBin=${laBin}`)
        }

        const finalEvBin = Number(exact.evBin)
        const finalLaBin = Number(exact.laBin)

        const count = Number(exact.count ?? 0)
        let out = Number(exact.out ?? 0)
        let single = Number(exact.single ?? 0)
        let double = Number(exact.double ?? 0)
        let triple = Number(exact.triple ?? 0)
        let hr = Number(exact.hr ?? 0)

        if (count <= 0) {
            throw new Error(`Empty outcomeByEvLa bucket for evBin=${finalEvBin} laBin=${finalLaBin}`)
        }

        const total = out + single + double + triple + hr

        if (total <= 0) {
            throw new Error(`Empty outcomeByEvLa result totals for evBin=${finalEvBin} laBin=${finalLaBin}`)
        }

        const pitchQualityBonus = DEFAULT_FULL_PITCH_QUALITY_BONUS + Number(pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.meta?.fullPitchQualityBonus ?? 0)
        const cappedPitchQualityChange = clamp(pitchQualityChange, -0.5, 0.5)
        const maxShiftShare = clamp(pitchQualityBonus / 1000, 0, 0.6)
        const shiftWeight = total * Math.abs(cappedPitchQualityChange) * maxShiftShare

        const move = (from: number, amount: number): number => Math.min(from, Math.max(0, amount))

        if (shiftWeight > 0 && cappedPitchQualityChange > 0) {
            let remaining = shiftWeight

            let moved = move(hr, remaining)
            hr -= moved
            triple += moved
            remaining -= moved

            moved = move(triple, remaining)
            triple -= moved
            double += moved
            remaining -= moved

            moved = move(double, remaining)
            double -= moved
            single += moved
            remaining -= moved

            moved = move(single, remaining)
            single -= moved
            out += moved
        }

        if (shiftWeight > 0 && cappedPitchQualityChange < 0) {
            let remaining = shiftWeight

            let moved = move(out, remaining)
            out -= moved
            single += moved
            remaining -= moved

            moved = move(single, remaining)
            single -= moved
            double += moved
            remaining -= moved

            moved = move(double, remaining)
            double -= moved
            triple += moved
            remaining -= moved

            moved = move(triple, remaining)
            triple -= moved
            hr += moved
        }

        if (contact === Contact.GROUNDBALL) {
            triple += hr
            hr = 0
        } else {
            const homeRunOutcomeScale = Math.max(
                0,
                1 + Number(pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.contactQuality?.homeRunOutcomeScale ?? 0)
            )

            if (homeRunOutcomeScale !== 1 && hr > 0) {
                const scaledHr = hr * homeRunOutcomeScale

                if (scaledHr > hr) {
                    const moved = move(out, scaledHr - hr)
                    out -= moved
                    hr += moved
                } else {
                    const moved = hr - scaledHr
                    hr -= moved
                    out += moved
                }
            }
        }

        const adjustedTotal = out + single + double + triple + hr

        if (adjustedTotal <= 0) {
            throw new Error(`Empty adjusted outcomeByEvLa result totals for evBin=${finalEvBin} laBin=${finalLaBin}`)
        }

        const expectedBases = (single + (double * 2) + (triple * 3) + (hr * 4)) / adjustedTotal

        return {
            count: adjustedTotal,
            out,
            single,
            double,
            triple,
            hr,
            evBin: finalEvBin,
            laBin: finalLaBin,
            expectedBases
        }
    }

    private applyDefenseToOutcomeModel(command: SimPitchCommand, model: { count: number, out: number, single: number, double: number, triple: number, hr: number, evBin: number, laBin: number, expectedBases: number }, fielderPlayer: GamePlayer): { count: number, out: number, single: number, double: number, triple: number, hr: number, evBin: number, laBin: number, expectedBases: number } {
        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
        const meta = command.pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.meta
        const contact = command.play.contact

        const teamDefense = GameInfo.getTeamDefense(command.defense)
        const teamDefenseChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, teamDefense)
        const fielderDefenseChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, fielderPlayer.hittingRatings.defense)

        const fullTeamDefenseBonus = DEFAULT_FULL_TEAM_DEFENSE_BONUS + Number(meta?.fullTeamDefenseBonus ?? 0)
        const fullFielderDefenseBonus = DEFAULT_FULL_FIELDER_DEFENSE_BONUS + Number(meta?.fullFielderDefenseBonus ?? 0)

        const baselineDefenseShift =
            contact === Contact.GROUNDBALL ? (fullTeamDefenseBonus + fullFielderDefenseBonus) / 5000 :
            contact === Contact.LINE_DRIVE ? (fullTeamDefenseBonus + fullFielderDefenseBonus) / 9000 :
            contact === Contact.FLY_BALL ? (fullTeamDefenseBonus + fullFielderDefenseBonus) / 12000 :
            0

        const teamRatingShift = teamDefenseChange * (fullTeamDefenseBonus / 1000)
        const fielderRatingShift = fielderDefenseChange * (fullFielderDefenseBonus / 1000)
        const defenseShift = clamp(baselineDefenseShift + teamRatingShift + fielderRatingShift, -0.35, 0.35)

        let out = model.out
        let single = model.single
        let double = model.double
        let triple = model.triple
        let hr = model.hr

        const total = out + single + double + triple + hr

        if (total <= 0 || defenseShift === 0) {
            return model
        }

        const move = (from: number, amount: number): number => Math.min(from, Math.max(0, amount))

        if (defenseShift > 0) {
            let remaining = total * defenseShift

            let moved = move(single, remaining)
            single -= moved
            out += moved
            remaining -= moved

            if (contact === Contact.GROUNDBALL) {
                moved = move(double, remaining)
                double -= moved
                single += moved
                remaining -= moved

                moved = move(triple, remaining)
                triple -= moved
                double += moved
            }

            if (contact === Contact.LINE_DRIVE) {
                moved = move(double, remaining * 0.5)
                double -= moved
                single += moved
                remaining -= moved

                moved = move(triple, remaining * 0.25)
                triple -= moved
                double += moved
            }
        } else {
            let remaining = total * Math.abs(defenseShift)

            let moved = move(out, remaining)
            out -= moved

            if (contact === Contact.GROUNDBALL) {
                single += moved
            } else if (contact === Contact.LINE_DRIVE) {
                single += moved * 0.8
                double += moved * 0.2
            } else {
                single += moved * 0.65
                double += moved * 0.35
            }
        }

        const adjustedTotal = out + single + double + triple + hr

        if (adjustedTotal <= 0) {
            return model
        }

        const expectedBases = (single + (double * 2) + (triple * 3) + (hr * 4)) / adjustedTotal

        return {
            count: adjustedTotal,
            out,
            single,
            double,
            triple,
            hr,
            evBin: model.evBin,
            laBin: model.laBin,
            expectedBases
        }
    }

    private getPlayResultFromOutcomeModel(model:{ count:number, out:number, single:number, double:number, triple:number, hr:number }, rng:() => number): PlayResult {
        const total = model.out + model.single + model.double + model.triple + model.hr

        if (total <= 0) {
            return PlayResult.OUT
        }

        const roll = Rolls.getRollUnrounded(rng, 0, total)

        let running = model.out
        if (roll < running) return PlayResult.OUT

        running += model.single
        if (roll < running) return PlayResult.SINGLE

        running += model.double
        if (roll < running) return PlayResult.DOUBLE

        running += model.triple
        if (roll < running) return PlayResult.TRIPLE

        return PlayResult.HR
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
                allowed = [Position.PITCHER, Position.SECOND_BASE, Position.SHORTSTOP]
            } else if (leftSide) {
                allowed = shallow ? [Position.THIRD_BASE, Position.SHORTSTOP] : [Position.SHORTSTOP, Position.LEFT_FIELD]
            } else {
                allowed = shallow ? [Position.FIRST_BASE, Position.SECOND_BASE] : [Position.SECOND_BASE, Position.RIGHT_FIELD]
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
                if (leftSide) allowed = [Position.THIRD_BASE, Position.SHORTSTOP, Position.LEFT_FIELD]
                else if (rightSide) allowed = [Position.FIRST_BASE, Position.SECOND_BASE, Position.RIGHT_FIELD]
                else allowed = [Position.CATCHER, Position.PITCHER, Position.SECOND_BASE, Position.SHORTSTOP, Position.CENTER_FIELD]
            } else if (leftSide) {
                allowed = deep ? [Position.LEFT_FIELD] : [Position.LEFT_FIELD, Position.CENTER_FIELD]
            } else if (rightSide) {
                allowed = deep ? [Position.RIGHT_FIELD] : [Position.RIGHT_FIELD, Position.CENTER_FIELD]
            } else {
                allowed = [Position.CENTER_FIELD]
            }
        }

        const fielder = this.weightedPickPosition(command, allowed)
        const shallowDeep = this.getShallowDeepFromY(y, fielder)
        const fielderPlayer = command.defense.players.find(p => p.currentPosition == fielder)

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
                    if (contact == Contact.GROUNDBALL && runnerEvents.filter( re => re?.movement?.isOut == true && !re.isCS).length > 2) {
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

    private getUpcomingMatchup(game:Game) : UpcomingMatchup {

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

class RunnerActions {

    constructor(
        private rollChartService:RollChartService,
        private gameRolls:SimRolls
    ) {}


    static clearRunners(team:TeamInfo) {
        team.runner1BId = undefined
        team.runner2BId = undefined
        team.runner3BId = undefined
    }

    static getTotalOuts(runnerEvents: RunnerEvent[]) {
        return runnerEvents.filter( re => re?.movement?.isOut == true).length
    }

    static validateInningOver( allEvents:RunnerEvent[]) {

        if ( RunnerActions.getTotalOuts( allEvents ) >= 3 ) {
            throw new InningEndingEvent()
        }

        return false
    }

    static getThrowCount(runnerEvents:RunnerEvent[]) : number  {
        return runnerEvents.filter( re => re?.throw != undefined).length
    }   

    static filterNonEvents(runnerEvents:RunnerEvent[], hitter:GamePlayer) {
        return runnerEvents.filter(re => re.movement.end != undefined || re.runner._id == hitter?._id)
    }    
    
    initRunnerEvents(pitcher:GamePlayer, hitter:GamePlayer, runner1B:GamePlayer, runner2B:GamePlayer, runner3B:GamePlayer, pitchIndex:number) {

        let hitterRA: RunnerEvent|undefined
        let runner1bRA:RunnerEvent|undefined
        let runner2bRA:RunnerEvent|undefined
        let runner3bRA:RunnerEvent|undefined

        if (hitter) {
            hitterRA = {
                pitchIndex: pitchIndex,
                pitcher: {
                    _id: pitcher._id
                },
    
                runner: {
                    _id: hitter._id,
                    // speed: hitter.hittingRatings.speed,
                    // steals: hitter.hittingRatings.steals
                },
                movement: {
                    start: BaseResult.HOME,
                    isOut: false
                }
            }
        }

        if (runner1B) {
            runner1bRA = {
                pitchIndex: pitchIndex,
                pitcher: {
                    _id: pitcher._id
                },
                runner: {
                    _id: runner1B._id,
                    // speed: runner1B.hittingRatings.speed,
                    // steals: runner1B.hittingRatings.steals
                },                
                movement: {
                    start: BaseResult.FIRST,
                    isOut: false
                },
                isScoringEvent: false,
                isUnearned: false
            }
        }

        if (runner2B) {
            runner2bRA = {
                pitchIndex: pitchIndex,
                pitcher: {
                    _id: pitcher._id
                },
                runner: {
                    _id: runner2B._id,
                    // speed: runner2B.hittingRatings.speed,
                    // steals: runner2B.hittingRatings.steals
                },
                movement: {
                    start: BaseResult.SECOND,
                    isOut: false
                },
                isScoringEvent: false,
                isUnearned: false
            }
        }

        if (runner3B) {
            runner3bRA = {
                pitchIndex: pitchIndex,
                pitcher: {
                    _id: pitcher._id
                },
                runner: {
                    _id: runner3B._id,
                    // speed: runner3B.hittingRatings.speed,
                    // steals: runner3B.hittingRatings.steals
                },
                movement: {
                    start: BaseResult.THIRD,
                    isOut: false
                },
                isScoringEvent: false,
                isUnearned: false
            }
        }

        return [ runner3bRA, runner2bRA, runner1bRA, hitterRA].filter( r => r?.movement != undefined)

    }    

    isRunUnearned(inningRunnerEvents:RunnerEvent[], runnerEvent:RunnerEvent) : boolean {

        let errorsBeforeScoring = false
        let outs = 0
    
        // Iterate through the inning events to check the situation
        for (let event of inningRunnerEvents) {

            // Count outs
            if (event.movement?.isOut) {
                outs++
            }
    
            // // If the current event is the one being analyzed, check if it's a scoring event
            // if (event === runnerEvent && event.isScoringEvent) {

            //     // If there was an error or passed ball before the runner scored
            //     if (errorsBeforeScoring || event.isPassedBall || event.isWildPitch) {
            //         return true; // Unearned run
            //     }
    
            //     // If the runner reached base due to an error, it's unearned
            //     if (event.eventType === PlayResult.Error || event.isFieldersChoice) {
            //         return true; // Unearned run
            //     }
    
            //     // If the runner scores after 3 outs should have been recorded, it's unearned
            //     if (outs >= 3) {
            //         return true; // Unearned run
            //     }
            // }
    
            // // Track if errors occurred before scoring
            // if (event.eventType === PlayResult.Error) {
            //     errorsBeforeScoring = true;
            // }
    
            // // Stop evaluating once 3 outs have occurred
            // if (outs >= 3) {
            //     break;
            // }
        }
    
        // If no condition for an unearned run was met, return false (run is earned)
        return false
    }

    runnerIsOut(runnerResult:RunnerResult, allEvents:RunnerEvent[], defensiveCredits:DefensiveCredit[], fielderPlayer:GamePlayer, runnerEvent:RunnerEvent, outNumber:number, outBase:BaseResult) {

        if (runnerEvent) {

            switch(runnerEvent.movement.start) {
                case BaseResult.FIRST:
                    runnerResult.first = undefined
                    break
                case BaseResult.SECOND:
                    runnerResult.second = undefined
                    break
                case BaseResult.THIRD:
                    runnerResult.third = undefined
                    break
            }

            runnerEvent.movement.isOut = true
            runnerEvent.movement.outNumber = outNumber
            runnerEvent.movement.outBase = outBase
            runnerEvent.movement.end = outBase


            if (runnerResult.out.includes(runnerEvent.runner._id)) {
                throw new Error('Runner recorded out twice')
            }

            runnerResult.out.push(runnerEvent.runner._id)

            if (this.isRunUnearned(allEvents, runnerEvent)) {
                runnerEvent.isUnearned = true
            }

            //Credit fielder with putout
            defensiveCredits.push({
                _id: fielderPlayer._id,
                type: DefenseCreditType.PUTOUT
            })

            RunnerActions.validateInningOver(allEvents)

        }

    }

    runnerToBase(runnerResult: RunnerResult, runnerEvent: RunnerEvent, start: BaseResult, end: BaseResult, eventType: PlayResult | OfficialRunnerResult, isForce: boolean) {
        const isScoringEvent = end == BaseResult.HOME

        if (runnerEvent) {
            runnerEvent.movement.start = start
            runnerEvent.movement.end = end
            runnerEvent.eventType = eventType
            runnerEvent.isScoringEvent = isScoringEvent
            runnerEvent.isForce = isForce

            switch (start) {
                case BaseResult.FIRST:
                    runnerResult.first = undefined
                    break
                case BaseResult.SECOND:
                    runnerResult.second = undefined
                    break
                case BaseResult.THIRD:
                    runnerResult.third = undefined
                    break
            }

            switch (end) {
                case BaseResult.FIRST:
                    runnerResult.first = runnerEvent.runner._id
                    break
                case BaseResult.SECOND:
                    runnerResult.second = runnerEvent.runner._id
                    break
                case BaseResult.THIRD:
                    runnerResult.third = runnerEvent.runner._id
                    break
            }

            if (isScoringEvent) {
                if (runnerResult.scored.includes(runnerEvent.runner._id)) {
                    throw new Error(`Runner recorded scored twice runner=${runnerEvent.runner._id} start=${start} end=${end} eventType=${eventType} bases=${JSON.stringify(runnerResult)}`)
                }

                runnerResult.scored.push(runnerEvent.runner._id)
            }

        }
    }

    runnerOutAtBase(runnerEvent:RunnerEvent, end:BaseResult, isForce:boolean, isFieldersChoice:boolean, defense:TeamInfo, throwFrom:GamePlayer, outs:number) {

        let throwTo:GamePlayer = defense.players.find( p => p.currentPosition == this.getPositionCoveringBase(throwFrom.currentPosition, end))

        outs++
        runnerEvent.movement.end = end
        runnerEvent.eventType = isForce ? OfficialRunnerResult.FORCE_OUT : OfficialRunnerResult.TAGGED_OUT
        runnerEvent.isForce = isForce
        runnerEvent.movement.isOut = true
        runnerEvent.movement.outNumber = outs
        runnerEvent.isFC = isFieldersChoice

        runnerEvent.throw = {
            result: ThrowResult.OUT,
            from: { _id: throwFrom._id, position: throwFrom.currentPosition},
            to: { _id: throwTo._id, position: throwTo.currentPosition}
        }

    }

    runnersTagWithThrow(gameRNG: () => number, runnerResult:RunnerResult, pitchEnvironmentTarget:PitchEnvironmentTarget, allEvents:RunnerEvent[], runnerEvents:RunnerEvent[], defensiveCredits:DefensiveCredit[], defense:TeamInfo, offense:TeamInfo, pitcher:GamePlayer, fielderPlayer:GamePlayer, runner1bRA:RunnerEvent, runner2bRA:RunnerEvent, runner3bRA:RunnerEvent, chanceRunnerSafe:number, pitchIndex:number ) {

        let hitterRA = runnerEvents.find(re => re.movement.start == BaseResult.HOME)

        if (runnerResult.third) {

            this.runnerToBaseWithThrow({
                gameRNG: gameRNG,
                runnerResult: runnerResult,
                allEvents: allEvents,
                runnerEvents: runnerEvents,
                runnerEvent: runner3bRA,
                hitterEvent: hitterRA,
                defensiveCredits: defensiveCredits,
                start: BaseResult.THIRD,
                end: BaseResult.HOME,
                eventType: OfficialRunnerResult.TAGGED_THIRD_TO_HOME,
                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                pitchEnvironmentTarget: pitchEnvironmentTarget,
                pitcher: pitcher,
                offense: offense,
                pitchIndex: pitchIndex,
                defense: defense,
                throwFrom: fielderPlayer,
                chanceRunnerSafe: chanceRunnerSafe,
                isForce: false,
                isFieldersChoice: false
            })

        }

        if (runnerResult.second) {

            this.runnerToBaseWithThrow({
                gameRNG: gameRNG,
                runnerResult: runnerResult,
                allEvents: allEvents,
                runnerEvents: runnerEvents,
                runnerEvent: runner2bRA,
                hitterEvent: hitterRA,
                defensiveCredits: defensiveCredits,
                start: BaseResult.SECOND,
                end: BaseResult.THIRD,
                eventType: OfficialRunnerResult.TAGGED_SECOND_TO_THIRD,
                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                pitchEnvironmentTarget: pitchEnvironmentTarget,
                pitcher: pitcher,
                offense: offense,
                pitchIndex: pitchIndex,
                defense: defense,
                throwFrom: fielderPlayer,
                chanceRunnerSafe: chanceRunnerSafe,
                isForce: false,
                isFieldersChoice: false
            })

        }

        if (runnerResult.first) {

            this.runnerToBaseWithThrow({
                gameRNG: gameRNG,
                runnerResult: runnerResult,
                allEvents: allEvents,
                runnerEvents: runnerEvents,
                runnerEvent: runner1bRA,
                hitterEvent: hitterRA,
                defensiveCredits: defensiveCredits,
                start: BaseResult.FIRST,
                end: BaseResult.SECOND,
                eventType: OfficialRunnerResult.TAGGED_FIRST_TO_SECOND,
                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                pitchEnvironmentTarget: pitchEnvironmentTarget,
                pitcher: pitcher,
                offense: offense,
                pitchIndex: pitchIndex,
                defense: defense,
                throwFrom: fielderPlayer,
                chanceRunnerSafe: chanceRunnerSafe, 
                isForce: false,
                isFieldersChoice: false
            })

        }
    }

    runnerToBaseWithThrow(command:RunnerThrowCommand) {

        if (command.runnerEvent) {

            command.runnerEvent.movement.start = command.start

            if (RunnerActions.getThrowCount(command.runnerEvents) < 1) {
    
                let throwTo:GamePlayer = command.defense.players.find( p => p.currentPosition == this.getPositionCoveringBase(command.throwFrom.currentPosition, command.end))
                let throwRoll:ThrowRoll = this.gameRolls.getThrowResult(command.gameRNG, command.chanceRunnerSafe)
    
                if (throwTo._id != command.throwFrom._id) {
                    command.runnerEvent.throw = {
                        result: throwRoll.result,
                        from: { _id: command.throwFrom._id, position: command.throwFrom.currentPosition},
                        to: { _id: throwTo._id, position: throwTo.currentPosition},
                    }
                }

                if (throwRoll.result == ThrowResult.OUT) {
                    
                    command.runnerEvent.eventType = command.eventTypeOut

                    //Credit the thrower
                    if (throwTo._id != command.throwFrom._id) {
                        command.defensiveCredits.push({
                            _id: command.throwFrom._id,
                            type: DefenseCreditType.ASSIST
                        })
                    }

                    if (command.hitterEvent) {
                        command.hitterEvent.isFC = command.isFieldersChoice
                    }

                    this.runnerIsOut(command.runnerResult, command.allEvents, command.defensiveCredits, throwTo, command.runnerEvent, RunnerActions.getTotalOuts(command.runnerEvents), command.end)

                } else {

                    //Runner is safe. Move runner to base.
                    this.runnerToBase(command.runnerResult, command.runnerEvent, command.start, command.end, command.eventType, command.isForce)

                    //Was there an error? Lowest rolls
                    if (throwRoll.roll < 10) {

                        command.runnerEvent.isError = true

                        let roll = throwRoll.roll

                        //Was it on the throw or on the catch?
                        if (APPLY_PLAYER_CHANGES) {

                            let armChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, _getAverage([command.throwFrom.hittingRatings.arm, command.throwFrom.hittingRatings.defense]))
                            let receivingChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, command.throwFrom.hittingRatings.defense)
    
                            roll = throwRoll.roll + (throwRoll.roll * (armChange * PLAYER_CHANGE_SCALE)) - (throwRoll.roll * (receivingChange * PLAYER_CHANGE_SCALE))
                        }


                        if (roll >= 5 && throwTo._id != command.throwFrom._id) {

                            //Thrower's fault
                            command.defensiveCredits.push({
                                _id: command.throwFrom._id,
                                type: DefenseCreditType.ERROR
                            })

                        } else {
                            //Receiver's fault
                            command.defensiveCredits.push({
                                _id: throwTo._id,
                                type: DefenseCreditType.ERROR
                            })
                        }

                        //Move all runnners up
                        let errorEvents:RunnerEvent[] = this.initRunnerEvents(command.pitcher, 
                            undefined,
                            command.offense.players.find( p => p._id == command.runnerResult.first), 
                            command.offense.players.find( p => p._id == command.runnerResult.second), 
                            command.offense.players.find( p => p._id == command.runnerResult.third), 
                            command.pitchIndex
                        )
            
                        for (let ev of errorEvents) {
                            ev.isError = true
                        }


                        this.advanceRunnersOneBase(command.runnerResult, errorEvents, false)

                        command.runnerEvents.push(...RunnerActions.filterNonEvents(errorEvents, undefined))

                    } 

                    command.runnerEvent.eventType = command.eventType
                }

            } else {
                this.runnerToBase(command.runnerResult, command.runnerEvent, command.start, command.end, command.eventType, command.isForce)
            }

        }
        
    }

    advanceRunnersOneBase(runnerResult:RunnerResult, events:RunnerEvent[], isForce:boolean) {

        let runner3bRA = events.find(e => e.movement?.start == BaseResult.THIRD && runnerResult.third == e.runner._id)
        let runner2bRA = events.find(e => e.movement?.start == BaseResult.SECOND && runnerResult.second == e.runner._id)
        let runner1bRA = events.find(e => e.movement?.start == BaseResult.FIRST && runnerResult.first == e.runner._id)

        //Advance runners one base
        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, isForce)
        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, isForce)
        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, isForce)
    }

    advanceOtherRunnersOneBase(runnerResult:RunnerResult, events:RunnerEvent[], runner:RunnerEvent, isForce:boolean) {

        let runner3bRA = events.find(e => e.movement?.start == BaseResult.THIRD && runnerResult.third == e.runner._id)
        let runner2bRA = events.find(e => e.movement?.start == BaseResult.SECOND && runnerResult.second == e.runner._id)
        let runner1bRA = events.find(e => e.movement?.start == BaseResult.FIRST && runnerResult.first == e.runner._id)

        //Advance runners one base
        if (runner.runner._id != runner3bRA?.runner._id) {
            this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, isForce)
        }

        if (runner.runner._id != runner2bRA?.runner._id) {
            this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, isForce)
        }

        if (runner.runner._id != runner1bRA?.runner._id) {
            this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, isForce)
        }

    }

    getPositionCoveringBase(throwFromPosition:Position, throwToBase:BaseResult) {

        switch(throwToBase) {
            case BaseResult.FIRST:
                return Position.FIRST_BASE
            case BaseResult.SECOND:
                if (throwFromPosition == Position.SECOND_BASE) return Position.SHORTSTOP
                return Position.SECOND_BASE
            case BaseResult.THIRD:
                return Position.THIRD_BASE
            case BaseResult.HOME:
                return Position.CATCHER
        }

    }    

    stealBases(runner1B: GamePlayer, runner2B: GamePlayer, runner3B: GamePlayer, gameRNG: () => number, runnerResult: RunnerResult, allEvents: RunnerEvent[], runnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], pitchEnvironmentTarget: PitchEnvironmentTarget, catcher: GamePlayer, defense: TeamInfo, offense: TeamInfo, pitcher: GamePlayer, pitchIndex: number, pitchCount: PitchCount) {
        let runners = [runner1B, runner2B, runner3B].filter(r => r != undefined)
        const stealAttemptAggressionScale = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.running?.stealAttemptAggressionScale ?? 1

        if (runnerEvents.length > 0) {
            for (let re of runnerEvents) {
                if (re.movement.isOut) continue
                if (re.movement.end != undefined) continue
                if (re.isSBAttempt) continue
                if (re.isSB) continue
                if (re.isCS) continue

                if (re.movement.start == BaseResult.THIRD) continue
                if (re.movement.start == BaseResult.SECOND && runnerResult.third) continue
                if (re.movement.start == BaseResult.FIRST && runnerResult.second && runnerResult.first) continue

                const supportedStealState =
                    (runnerResult.first && !runnerResult.second && !runnerResult.third) ||
                    (runnerResult.second && !runnerResult.first && !runnerResult.third) ||
                    (runnerResult.first && runnerResult.second && !runnerResult.third)

                if (!supportedStealState) continue

                if (re.movement.start == BaseResult.FIRST && runnerEvents.find(re => re.movement.start == BaseResult.SECOND)?.isSBAttempt == false) continue

                if (re.movement.start == BaseResult.FIRST && runnerEvents.find(re => re?.movement?.start == BaseResult.SECOND)?.isSBAttempt) {
                    this.runnerToBase(runnerResult, re, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.STOLEN_BASE_2B, false)

                    re.isSBAttempt = true
                    re.isSB = true
                    re.pitchIndex = pitchIndex
                } else {
                    let runner = runners.find(r => r._id == re.runner._id)

                    if (!runner) continue

                    const stealSettings = this.getStealSettingsForState(pitchEnvironmentTarget, pitchCount)

                    const isStealOfThird = re.movement.start == BaseResult.SECOND

                    const effectiveAttempt = Math.max(
                        0,
                        Math.min(
                            100,
                            Math.round(isStealOfThird ? stealSettings.attempt3BChance : stealSettings.attempt2BChance)
                        )
                    )

                    const effectiveSuccess = Math.max(
                        0,
                        Math.min(
                            100,
                            Math.round(isStealOfThird ? stealSettings.attempt3BSuccess : stealSettings.attempt2BSuccess)
                        )
                    )

                    if (effectiveAttempt <= 0 || effectiveSuccess <= 0) continue

                    let chanceRunnerSafe = this.getStolenBaseSafe(
                        pitchEnvironmentTarget,
                        catcher.hittingRatings.arm,
                        runner.hittingRatings.speed,
                        runner.hittingRatings.steals,
                        effectiveSuccess
                    )

                    const MIN_SUCCESS = 55
                    const GREEN_LIGHT_SUCCESS = 75

                    let successScale = (chanceRunnerSafe - MIN_SUCCESS) / (GREEN_LIGHT_SUCCESS - MIN_SUCCESS)
                    successScale = Math.max(0, Math.min(1, successScale))

                    let greenLightAttempt = effectiveAttempt * successScale * stealAttemptAggressionScale
                    greenLightAttempt = Math.max(0, Math.min(100, Math.round(greenLightAttempt)))

                    if (greenLightAttempt <= 0) continue

                    let jumpRoll = Rolls.getRoll(gameRNG, 1, 100)

                    let endBase
                    let eventType
                    let eventTypeOut

                    if (jumpRoll <= greenLightAttempt) {
                        if (re.movement.start == BaseResult.SECOND) {
                            endBase = BaseResult.THIRD
                            eventType = OfficialRunnerResult.STOLEN_BASE_3B
                            eventTypeOut = OfficialRunnerResult.CAUGHT_STEALING_3B
                        } else if (re.movement.start == BaseResult.FIRST) {
                            endBase = BaseResult.SECOND
                            eventType = OfficialRunnerResult.STOLEN_BASE_2B
                            eventTypeOut = OfficialRunnerResult.CAUGHT_STEALING_2B
                        } else {
                            continue
                        }

                        re.isSBAttempt = true

                        this.runnerToBaseWithThrow({
                            gameRNG: gameRNG,
                            runnerResult: runnerResult,
                            allEvents: allEvents,
                            runnerEvents: runnerEvents,
                            runnerEvent: re,
                            hitterEvent: undefined,
                            defensiveCredits: defensiveCredits,
                            start: re.movement.start,
                            end: endBase,
                            eventType: eventType,
                            eventTypeOut: eventTypeOut,
                            pitchEnvironmentTarget: pitchEnvironmentTarget,
                            defense: defense,
                            offense: offense,
                            pitcher: pitcher,
                            throwFrom: catcher,
                            chanceRunnerSafe: chanceRunnerSafe,
                            isForce: false,
                            isFieldersChoice: false,
                            pitchIndex: pitchIndex
                        })

                        if (re.movement.isOut) {
                            re.isCS = true

                            defensiveCredits.push({
                                _id: catcher._id,
                                type: DefenseCreditType.CAUGHT_STEALING
                            })
                        } else {
                            re.isSB = true
                        }
                    }
                }
            }
        }
    }

    private getStealSettingsForState(pitchEnvironmentTarget: PitchEnvironmentTarget, pitchCount?: PitchCount): StolenBaseByCount {
        const table: StolenBaseByCount[] = pitchEnvironmentTarget.running?.steal ?? []

        return table.find(r => r.balls === pitchCount?.balls && r.strikes === pitchCount?.strikes)
            ?? {
                balls: pitchCount?.balls ?? 0,
                strikes: pitchCount?.strikes ?? 0,
                attempt2BChance: 0,
                attempt2BSuccess: 0,
                attempt3BChance: 0,
                attempt3BSuccess: 0
            }
    }

    getStolenBaseSafe(pitchEnvironmentTarget:PitchEnvironmentTarget, armRating:number, runnerSpeed:number, runnerSteals:number, defaultSuccess:number) {

        let fielderChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, armRating)
        let runnerSpeedChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, runnerSpeed)
        let runnerStealsChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, runnerSteals)

        //Take the default success rate and apply the fielder and runner's changes.
        //Return the % chance that the runner is out.
        if (APPLY_PLAYER_CHANGES) {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerSpeedChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerStealsChange * PLAYER_CHANGE_SCALE)), 0, 99)
        } else {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess), 0, 99)
        }

    }

    getChanceRunnerSafe(pitchEnvironmentTarget:PitchEnvironmentTarget, armRating:number, runnerSpeed:number, defaultSuccess:number) {

        let fielderChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, armRating)
        let runnerChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, runnerSpeed)

        //Take the default success rate and apply the fielder and runner's changes.
        //Return the % chance that the runner is out.

        if (APPLY_PLAYER_CHANGES) {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerChange  * PLAYER_CHANGE_SCALE)), 0, 99)
        } else {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess), 0, 99)
        }


    }    

    getRunnerEvents(gameRNG: () => number, runnerResult: RunnerResult, halfInningRunnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], pitchEnvironmentTarget: PitchEnvironmentTarget, playResult: PlayResult, contact: Contact | undefined, shallowDeep: ShallowDeep | undefined, hitter: GamePlayer, fielderPlayer: GamePlayer | undefined, runner1B: GamePlayer | undefined, runner2B: GamePlayer | undefined, runner3B: GamePlayer | undefined, offense: TeamInfo, defense: TeamInfo, pitcher: GamePlayer, pitchIndex: number): RunnerEvent[] {
            
        const requiresFielder =
            playResult === PlayResult.OUT ||
            playResult === PlayResult.SINGLE ||
            playResult === PlayResult.DOUBLE ||
            playResult === PlayResult.TRIPLE ||
            playResult === PlayResult.HR

        if (requiresFielder && !fielderPlayer) {
            throw new Error(`${playResult} requires fielderPlayer`)
        }

        const requiresContact =
            playResult === PlayResult.OUT ||
            playResult === PlayResult.SINGLE ||
            playResult === PlayResult.DOUBLE ||
            playResult === PlayResult.TRIPLE ||
            playResult === PlayResult.HR

        if (requiresContact && !contact) {
            throw new Error(`${playResult} requires contact`)
        }

        let events: RunnerEvent[] = this.initRunnerEvents(pitcher, hitter, runner1B, runner2B, runner3B, pitchIndex)

        let hitterRA = events.find(e => e.runner._id == hitter?._id)
        let runner1bRA = events.find(e => e.runner._id == runner1B?._id)
        let runner2bRA = events.find(e => e.runner._id == runner2B?._id)
        let runner3bRA = events.find(e => e.runner._id == runner3B?._id)

        hitterRA.eventType = playResult

        let allEvents = [].concat(halfInningRunnerEvents).concat(events)

        const advancement = pitchEnvironmentTarget.running?.advancement

        const clampRate = (value:number | undefined): number => {
            return Math.max(0, Math.min(1, value ?? 0))
        }

        const shouldAdvance = (rate:number | undefined): boolean => {
            return Rolls.getRollUnrounded(gameRNG, 0, 1) < clampRate(rate)
        }

        const DEFAULT_SUCCESS = 95

        try {
            switch (playResult) {
                case PlayResult.STRIKEOUT:
                    this.runnerIsOut(runnerResult, allEvents, defensiveCredits, defense.players.find(p => p.currentPosition == Position.CATCHER), hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                    break

                case PlayResult.OUT:
                    if (!contact) throw new Error("OUT requires contact")
                    if (!fielderPlayer) throw new Error("OUT requires fielderPlayer")

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && (shallowDeep == ShallowDeep.DEEP)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallDeep)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner3B.hittingRatings.speed,
                                DEFAULT_SUCCESS
                            )

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }

                        if (runnerResult.second && runner2bRA) {
                            this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                        }

                        if (runnerResult.first && runner1bRA) {
                            this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, false)
                        }

                        break
                    }

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && (shallowDeep == ShallowDeep.NORMAL)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallNormal)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner3B.hittingRatings.speed,
                                DEFAULT_SUCCESS - 5
                            )

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }

                        if (runnerResult.second && runner2bRA) {
                            this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                        }

                        if (runnerResult.first && runner1bRA) {
                            this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, false)
                        }

                        break
                    }

                    if (contact == Contact.FLY_BALL && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && shallowDeep == ShallowDeep.SHALLOW) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallShallow)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner3B.hittingRatings.speed,
                                DEFAULT_SUCCESS - 30
                            )

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }

                        if (runnerResult.second && runner2bRA) {
                            this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                        }

                        if (runnerResult.first && runner1bRA) {
                            this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, false)
                        }

                        break
                    }

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition)) {
                        this.runnerIsOut(
                            runnerResult,
                            allEvents,
                            defensiveCredits,
                            fielderPlayer,
                            hitterRA,
                            RunnerActions.getTotalOuts(allEvents) + 1,
                            BaseResult.HOME
                        )
                        break
                    }

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToInfielder(fielderPlayer.currentPosition)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        break
                    }

                    if (contact == Contact.GROUNDBALL) {
                        const outsBeforePlay = RunnerActions.getTotalOuts(allEvents)

                        if (outsBeforePlay >= 2) {
                            const chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                hitter.hittingRatings.speed,
                                1
                            )

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                defense: defense,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: true,
                                isFieldersChoice: false
                            })

                            break
                        }

                        if (runner3B != undefined) {
                            runner3bRA.isForce = (runner2B != undefined && runner1B != undefined)

                            if (runner3bRA.isForce) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, 1)

                                this.runnerToBaseWithThrow({
                                    gameRNG: gameRNG,
                                    runnerResult: runnerResult,
                                    allEvents: allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner3bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits: defensiveCredits,
                                    start: BaseResult.THIRD,
                                    end: BaseResult.HOME,
                                    eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget: pitchEnvironmentTarget,
                                    pitcher: pitcher,
                                    offense: offense,
                                    pitchIndex: pitchIndex,
                                    defense: defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe: chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else if (shouldAdvance(advancement?.runnerOnThirdToHomeOnGroundBall)) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(
                                    pitchEnvironmentTarget,
                                    fielderPlayer.hittingRatings.arm,
                                    runner3B.hittingRatings.speed,
                                    DEFAULT_SUCCESS - 30
                                )

                                this.runnerToBaseWithThrow({
                                    gameRNG: gameRNG,
                                    runnerResult: runnerResult,
                                    allEvents: allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner3bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits: defensiveCredits,
                                    start: BaseResult.THIRD,
                                    end: BaseResult.HOME,
                                    eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                    eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                    pitchEnvironmentTarget: pitchEnvironmentTarget,
                                    pitcher: pitcher,
                                    offense: offense,
                                    pitchIndex: pitchIndex,
                                    defense: defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe: chanceRunnerSafe,
                                    isForce: false,
                                    isFieldersChoice: true
                                })
                            }
                        }

                        if (runner2B != undefined) {
                            runner2bRA.isForce = (runner1B != undefined)

                            if (runner2bRA.isForce) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner2B.hittingRatings.speed, 1)

                                this.runnerToBaseWithThrow({
                                    gameRNG: gameRNG,
                                    runnerResult: runnerResult,
                                    allEvents: allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner2bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits: defensiveCredits,
                                    start: BaseResult.SECOND,
                                    end: BaseResult.THIRD,
                                    eventType: OfficialRunnerResult.SECOND_TO_THIRD,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget: pitchEnvironmentTarget,
                                    pitcher: pitcher,
                                    offense: offense,
                                    pitchIndex: pitchIndex,
                                    defense: defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe: chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else if (shouldAdvance(advancement?.runnerOnSecondToThirdOnGroundBall)) {
                                this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                            }
                        }

                        if (runner1B != undefined) {
                            runner1bRA.isForce = true

                            if (RunnerActions.getThrowCount(events) < 1) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 1)

                                this.runnerToBaseWithThrow({
                                    gameRNG: gameRNG,
                                    runnerResult: runnerResult,
                                    allEvents: allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner1bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits: defensiveCredits,
                                    start: BaseResult.FIRST,
                                    end: BaseResult.SECOND,
                                    eventType: OfficialRunnerResult.FIRST_TO_SECOND,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget: pitchEnvironmentTarget,
                                    pitcher: pitcher,
                                    offense: offense,
                                    pitchIndex: pitchIndex,
                                    defense: defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe: chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else {
                                this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)
                            }
                        }

                        if (RunnerActions.getThrowCount(events) > 0) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 75)

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                defense: defense,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: true,
                                isFieldersChoice: true
                            })
                        } else {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 1)

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                defense: defense,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: true,
                                isFieldersChoice: false
                            })
                        }

                        break
                    }

                    break

                case PlayResult.BB:
                    if (runnerResult.third != undefined && runnerResult.second != undefined && runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, true)
                    }

                    if (runnerResult.second != undefined && runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, true)
                    }

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.FIRST, PlayResult.BB, true)
                    break

                case PlayResult.HIT_BY_PITCH:
                    if (runnerResult.third != undefined && runnerResult.second != undefined && runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, true)
                    }

                    if (runnerResult.second != undefined && runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, true)
                    }

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.FIRST, PlayResult.HIT_BY_PITCH, true)
                    break

                case PlayResult.SINGLE: {
                    const outsBeforePlay = RunnerActions.getTotalOuts(allEvents)

                    if (runnerResult.third != undefined) {
                        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined))
                    }

                    if (runnerResult.second != undefined) {
                        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, runnerResult.first != undefined)

                        const sendRunnerHome =
                            AtBatInfo.isToOF(fielderPlayer?.currentPosition) &&
                            shallowDeep != ShallowDeep.SHALLOW &&
                            (outsBeforePlay >= 2 || shouldAdvance(advancement?.runnerOnSecondToHomeOnSingle))

                        if (sendRunnerHome) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner2B.hittingRatings.speed,
                                75
                            )

                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner2bRA))
                            clone.movement.start = BaseResult.THIRD
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)

                        if ((fielderPlayer.currentPosition == Position.RIGHT_FIELD || fielderPlayer.currentPosition == Position.CENTER_FIELD) && shouldAdvance(advancement?.runnerOnFirstToThirdOnSingle)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner1B.hittingRatings.speed,
                                75
                            )

                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
                            clone.movement.start = BaseResult.SECOND
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.SECOND,
                                end: BaseResult.THIRD,
                                eventType: OfficialRunnerResult.SECOND_TO_THIRD,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.FIRST, PlayResult.SINGLE, true)
                    break
                }

                case PlayResult.DOUBLE:
                    this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined))
                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.HOME, OfficialRunnerResult.SECOND_TO_HOME, false)

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.THIRD, OfficialRunnerResult.FIRST_TO_THIRD, false)

                        if (shallowDeep != ShallowDeep.SHALLOW && shouldAdvance(advancement?.runnerOnFirstToHomeOnDouble)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(
                                pitchEnvironmentTarget,
                                fielderPlayer.hittingRatings.arm,
                                runner1B.hittingRatings.speed,
                                60
                            )

                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
                            clone.movement.start = BaseResult.THIRD
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG: gameRNG,
                                runnerResult: runnerResult,
                                allEvents: allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits: defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget: pitchEnvironmentTarget,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe: chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.SECOND, PlayResult.DOUBLE, true)
                    break

                case PlayResult.TRIPLE:
                    this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, true)
                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.HOME, OfficialRunnerResult.SECOND_TO_HOME, true)
                    this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.HOME, OfficialRunnerResult.FIRST_TO_HOME, true)

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.THIRD, PlayResult.TRIPLE, true)
                    break

                case PlayResult.HR:
                    this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, true)
                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.HOME, OfficialRunnerResult.SECOND_TO_HOME, true)
                    this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.HOME, OfficialRunnerResult.FIRST_TO_HOME, true)

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.HOME, PlayResult.HR, true)
                    break
            }
        } catch (ex) {
            if (!(ex instanceof InningEndingEvent)) throw ex
        }

        return RunnerActions.filterNonEvents(events, hitter)
    }

    generateRunnerEventsFromPitch(command:SimPitchCommand, pitchIndex:number, result:SimPitchResult) {

        let runner1B = command.offense.players.find( p => p._id == command.play.runner.result.end.first)
        let runner2B = command.offense.players.find( p => p._id == command.play.runner.result.end.second)
        let runner3B = command.offense.players.find( p => p._id == command.play.runner.result.end.third)

        if (command.play.runner.result.end.first && !runner1B ) throw new Error(`Runner on 1B not found in offense`)
        if (command.play.runner.result.end.second && !runner2B ) throw new Error(`Runner on 2B not found in offense`)
        if (command.play.runner.result.end.third && !runner3B ) throw new Error(`Runner on 3B not found in offense`)


        let pitchEvents:RunnerEvent[] = this.initRunnerEvents(command.pitcher, 
            undefined,
            runner1B, 
            runner2B, 
            runner3B, 
            pitchIndex
        )

        
        if (result.pitch.isWP) {

            //Move runners up on wild pitch.

            //Advance runners one base
            this.advanceRunnersOneBase(command.play.runner.result.end, pitchEvents, false)

            for (let re of pitchEvents) {
                re.isWP = true
            }

            
        } if (result.pitch.isPB) {

            //Move runners up on passed ball.

            //Advance runners one base
            this.advanceRunnersOneBase(command.play.runner.result.end, pitchEvents, false)

            for (let re of pitchEvents) {
                re.isPB = true
            }

            //Credit the catcher
            command.play.credits.push({
                _id: command.catcher._id,
                type: DefenseCreditType.PASSED_BALL
            })

        } if (result.continueAtBat) {
            
            //Stolen bases
            this.stealBases(
                runner1B,
                runner2B,
                runner3B,
                command.rng,
                command.play.runner.result.end,
                command.halfInningRunnerEvents,
                pitchEvents,
                command.play.credits,
                command.pitchEnvironmentTarget,
                command.catcher,
                command.defense,
                command.offense,
                command.pitcher,
                pitchIndex,
                command.play.pitchLog.count
            )

}


        command.play.runner.events.push(...RunnerActions.filterNonEvents(pitchEvents, undefined))


        RunnerActions.validateInningOver( [].concat(command.halfInningRunnerEvents).concat(command.play.runner.events) )

    }    

    validateRunners(firstId:string, secondId:string, thirdId:string) {

        let runnerIds = [firstId, secondId, thirdId].filter(r => r != undefined)

        if (new Set(runnerIds).size != runnerIds.length) {
            throw new Error("Runners are not unique.")
        }
        
    }

    validateRunnerResult(runnerResult: RunnerResult) {
        const all = [].concat(runnerResult.scored).concat(runnerResult.out)

        if (new Set(all).size != all.length) {
            console.log(JSON.stringify(runnerResult, null, 2))
            throw new Error(`Duplicate runner id in scored/out.`)
        }

        this.validateRunners(runnerResult.first, runnerResult.second, runnerResult.third)
    }

    applyMinMaxToNumber(num, min, max) {

        num = Math.round(num)

        //Apply the max. If die is greater than max make it the max
        num = Math.min(num, max)

        //If we went negative go with 0
        num = Math.max(min, num)

        return num
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

    getHitQuality(gameRNG: () => number, pitchEnvironmentTarget: PitchEnvironmentTarget, pitchQualityChange: number, guessPitch: boolean, contact: Contact): ContactQuality {
        const tuning = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.contactQuality
        const hitterPhysics = pitchEnvironmentTarget.importReference.hitter.physics
        const trajectory =
            contact === Contact.GROUNDBALL ? "groundBall" :
            contact === Contact.LINE_DRIVE ? "lineDrive" :
            "flyBall"

        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
        const asNumber = (value: any, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback

        const weightedPick = <T extends { count?: number }>(rows: T[]): T | undefined => {
            if (!rows.length) return undefined

            const total = rows.reduce((sum, row) => sum + Math.max(0, asNumber(row.count, 0)), 0)
            if (total <= 0) return rows[0]

            let roll = Rolls.getRollUnrounded(gameRNG, 0, total)

            for (const row of rows) {
                roll -= Math.max(0, asNumber(row.count, 0))
                if (roll <= 0) return row
            }

            return rows[rows.length - 1]
        }

        const inferStep = (rows: any[], key: string, fallback: number): number => {
            const values = Array.from(new Set(
                rows
                    .map(row => asNumber(row?.[key], Number.NaN))
                    .filter(value => Number.isFinite(value))
                    .sort((a, b) => a - b)
            ))

            if (values.length < 2) return fallback

            let minStep = Number.POSITIVE_INFINITY

            for (let i = 1; i < values.length; i++) {
                const diff = values[i] - values[i - 1]

                if (diff > 0 && diff < minStep) {
                    minStep = diff
                }
            }

            return Number.isFinite(minStep) ? minStep : fallback
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
            const sd = _getStdDev(stat)

            if (!Number.isFinite(sd) || sd <= 0) {
                return stat.avg
            }

            return stat.avg + Rolls.getRollUnrounded(gameRNG, -sd, sd)
        }

        const aggregateEvLaRows = (rows: any[]): { evBin: number, laBin: number, count: number }[] => {
            const byKey = new Map<string, { evBin: number, laBin: number, count: number }>()

            for (const row of rows) {
                if (row?.trajectory !== trajectory) continue

                const evBin = asNumber(row.evBin, Number.NaN)
                const laBin = asNumber(row.laBin, Number.NaN)
                const count = Math.max(0, asNumber(row.count, 0))

                if (!Number.isFinite(evBin) || !Number.isFinite(laBin) || count <= 0) continue

                const key = `${evBin}:${laBin}`
                const existing = byKey.get(key)

                if (existing) {
                    existing.count += count
                } else {
                    byKey.set(key, { evBin, laBin, count })
                }
            }

            return Array.from(byKey.values())
        }

        const trajectoryPhysics: any = (hitterPhysics.byTrajectory as any)?.[trajectory]

        if (!trajectoryPhysics) {
            throw new Error(`Missing hitter physics for trajectory ${trajectory}`)
        }

        const pitchEffect = clamp(pitchQualityChange * -1, -1, 1)
        const guessEffect = guessPitch ? Math.max(0, pitchEffect) : 0

        const xyByTrajectoryEvLa = (pitchEnvironmentTarget.battedBall.xy?.byTrajectoryEvLa ?? []).filter((row: any) =>
            row?.trajectory === trajectory
        )

        const xyByTrajectory = (pitchEnvironmentTarget.battedBall.xy?.byTrajectory ?? []).filter((row: any) =>
            row?.trajectory === trajectory
        )

        const sprayByTrajectoryEvLa = (pitchEnvironmentTarget.battedBall.spray?.byTrajectoryEvLa ?? []).filter((row: any) =>
            row?.trajectory === trajectory
        )

        const sprayByTrajectory = (pitchEnvironmentTarget.battedBall.spray?.byTrajectory ?? []).filter((row: any) =>
            row?.trajectory === trajectory
        )

        const evLaRows = aggregateEvLaRows(xyByTrajectoryEvLa)
        const sprayEvLaRows = aggregateEvLaRows(sprayByTrajectoryEvLa)
        const evLaSourceRows = evLaRows.length > 0 ? evLaRows : sprayEvLaRows

        const exitVelocityStat = getStat(trajectoryPhysics, "exitVelocity")
        const launchAngleStat = getStat(trajectoryPhysics, "launchAngle")
        const distanceStat = getStat(trajectoryPhysics, "distance")

        let exitVelocity: number
        let launchAngle: number
        let distance = sampleMoment(distanceStat)

        const pickedEvLa = weightedPick(evLaSourceRows)

        if (pickedEvLa) {
            const evStep = inferStep(evLaSourceRows, "evBin", 2)
            const laStep = inferStep(evLaSourceRows, "laBin", 2)

            exitVelocity = pickedEvLa.evBin + Rolls.getRollUnrounded(gameRNG, 0, evStep)
            launchAngle = pickedEvLa.laBin + Rolls.getRollUnrounded(gameRNG, 0, laStep)
        } else {
            exitVelocity = sampleMoment(exitVelocityStat)
            launchAngle = sampleMoment(launchAngleStat)
        }

        exitVelocity += (asNumber(tuning?.evScale, 0) * (pitchEffect + guessEffect))
        launchAngle += (asNumber(tuning?.laScale, 0) * pitchEffect)
        distance += (asNumber(tuning?.distanceScale, 0) * (pitchEffect + guessEffect))

        exitVelocity = Math.max(0, exitVelocity)
        distance = Math.max(0, distance)

        const evBin = Math.floor(exitVelocity / 2) * 2
        const laBin = Math.floor(launchAngle / 2) * 2

        let coordX: number | undefined
        let coordY: number | undefined

        const matchingXyByTrajectoryEvLa = xyByTrajectoryEvLa.filter((row: any) =>
            Number(row?.evBin) === evBin &&
            Number(row?.laBin) === laBin
        )

        const pickedXy = weightedPick(matchingXyByTrajectoryEvLa) ?? weightedPick(xyByTrajectory)

        if (pickedXy) {
            const xyRows = matchingXyByTrajectoryEvLa.length > 0 ? matchingXyByTrajectoryEvLa : xyByTrajectory
            const xStep = inferStep(xyRows, "xBin", 10)
            const yStep = inferStep(xyRows, "yBin", 10)

            coordX = asNumber((pickedXy as any).xBin, 0) + Rolls.getRollUnrounded(gameRNG, -(xStep / 2), xStep / 2)
            coordY = asNumber((pickedXy as any).yBin, 0) + Rolls.getRollUnrounded(gameRNG, -(yStep / 2), yStep / 2)
        }

        if (!Number.isFinite(coordX) || !Number.isFinite(coordY)) {
            const matchingSprayByTrajectoryEvLa = sprayByTrajectoryEvLa.filter((row: any) =>
                Number(row?.evBin) === evBin &&
                Number(row?.laBin) === laBin
            )

            const pickedSpray = weightedPick(matchingSprayByTrajectoryEvLa) ?? weightedPick(sprayByTrajectory)

            if (pickedSpray) {
                const sprayRows = matchingSprayByTrajectoryEvLa.length > 0 ? matchingSprayByTrajectoryEvLa : sprayByTrajectory
                const sprayStep = inferStep(sprayRows, "sprayBin", 5)
                const sprayAngle = asNumber((pickedSpray as any).sprayBin, 0) + Rolls.getRollUnrounded(gameRNG, -(sprayStep / 2), sprayStep / 2)
                const radians = sprayAngle * (Math.PI / 180)

                coordX = Math.sin(radians) * distance
                coordY = Math.cos(radians) * distance
            }
        }

        if (!Number.isFinite(coordX) || !Number.isFinite(coordY)) {
            coordX = 0
            coordY = distance
        }

        coordY = Math.max(0, coordY)

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

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * (swingTuning?.disciplineZoneSwingEffect ?? 0)
            }
        } else {
            swingRate += pitchQualityChange * (swingTuning?.pitchQualityChaseSwingEffect ?? 0)

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * (swingTuning?.disciplineChaseSwingEffect ?? 0) * -1
            }
        }

        swingRate = Math.max(0, Math.min(100, swingRate))

        let die = Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (die < swingRate) {
            let swingContactRate = inZone
                ? behavior.zoneContactPercent
                : behavior.chaseContactPercent

            swingContactRate += pitchQualityChange * (contactTuning?.pitchQualityContactEffect ?? 0) * -1

            if (APPLY_PLAYER_CHANGES) {
                swingContactRate += hitterChange.contactChange * (contactTuning?.contactSkillEffect ?? 0) * -1
            }

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

    getPitchQuality(gameRNG: () => number, pitcherChange: PitcherChange, pitchEnvironmentTarget: PitchEnvironmentTarget): PitchQuality {

        const physics = pitchEnvironmentTarget.importReference.pitcher.physics

        const velocityAvg = physics.velocity.avg
        const velocityStdDev = _getStdDev(physics.velocity)

        const horizontalBreakAvg = physics.horizontalBreak.avg
        const horizontalBreakStdDev = _getStdDev(physics.horizontalBreak)

        const verticalBreakAvg = physics.verticalBreak.avg
        const verticalBreakStdDev = _getStdDev(physics.verticalBreak)

        const velocityRandom = Rolls.getRollUnrounded(gameRNG, -velocityStdDev, velocityStdDev)
        const horizontalBreakRandom = Rolls.getRollUnrounded(gameRNG, -horizontalBreakStdDev, horizontalBreakStdDev)
        const verticalBreakRandom = Rolls.getRollUnrounded(gameRNG, -verticalBreakStdDev, verticalBreakStdDev)

        const velocity = Math.max(0, velocityAvg + velocityRandom + (velocityAvg * pitcherChange.powerChange * PLAYER_CHANGE_SCALE))
        const horizontalBreak = horizontalBreakAvg + horizontalBreakRandom + (horizontalBreakAvg * pitcherChange.movementChange * PLAYER_CHANGE_SCALE)
        const verticalBreak = verticalBreakAvg + verticalBreakRandom + (verticalBreakAvg * pitcherChange.movementChange * PLAYER_CHANGE_SCALE)

        return {
            velocity: Number(velocity.toFixed(3)),
            horizontalBreak: Number(horizontalBreak.toFixed(3)),
            verticalBreak: Number(verticalBreak.toFixed(3))
        }
    }


}

class GamePlayers {

    constructor(
        private rollChartService:RollChartService
    ) {}

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

    static validateGameLineup(lineup:Lineup, startingPitcher:RotationPitcher) {

        //Make sure there are 9 spots in the order and 5 spots in the rotation
        if (lineup.order.length != 9) {
            throw new Error("Lineup must have 9 players.")
        }

        if (lineup.rotation.length != 5) {
            throw new Error("Rotation must have 5 players.")
        }

        //Make sure no one is playing a duplicate position
        let filledSpots = lineup.order.filter(o => o.position != undefined)
        let filledPositions = new Set(filledSpots.map( o => o.position))

        if (filledPositions.size != filledSpots.length) {
            throw new Error("Duplicate position players.")
        }


        if (!startingPitcher) {
            throw new Error(`No valid starting pitcher`)
        }

    } 

    buildTeamInfoFromTeam(pitchEnvironmentTarget:PitchEnvironmentTarget, team:Team, lineup:Lineup, players:Player[], startingPitcher:RotationPitcher, color1:string, color2:string, homeAway:HomeAway, startingId:number, teamOptions?:any) : TeamInfo {

        let gamePlayer:GamePlayer[] = this.gamePlayers.initGamePlayers(pitchEnvironmentTarget, players, startingPitcher, team._id, color1, color2, startingId)

        if (!startingPitcher) throw new Error("No valid starting pitcher.")

        lineup.order.find( p => p.position == Position.PITCHER)._id = startingPitcher._id

        let pitcherGP = gamePlayer.find( gp => gp._id == startingPitcher._id)


        let teamInfo:TeamInfo = Object.assign({
            _id: team._id,        

            name: team.name,
            abbrev: team.abbrev,

            players: gamePlayer,

            lineupIds: lineup.order.map( op => op._id ),

            currentHitterIndex: 0,
            currentPitcherId: pitcherGP._id,

            runner1BId: undefined,
            runner2BId: undefined,
            runner3BId: undefined,

            homeAway: homeAway,

            color1: color1,
            color2: color2

        }, teamOptions)

        //Sync players to the proper positions. Right now this is simple because 
        //a player can only play one position but it's possible we'll need to pass
        //this info in later.
        teamInfo.lineupIds.forEach( (id, idx) => {

            let player:GamePlayer = teamInfo.players.find( p => p._id == id)
            //Set spot in lineup
            if (player) player.lineupIndex = idx 

        })

        return teamInfo

    }    

    buildTeamInfoFromPlayers (pitchEnvironmentTarget:PitchEnvironmentTarget, name:string, teamId:string, players:Player[], color1:string, color2:string, startingId:number, teamOptions?:any)  {

        let startingPitcher = players.find( p => p.primaryPosition == Position.PITCHER)

        let gamePlayer:GamePlayer[] = this.gamePlayers.initGamePlayers(pitchEnvironmentTarget, players, { _id: startingPitcher._id, stamina: 1}, teamId, color1, color2, startingId)

        let teamInfo:TeamInfo = Object.assign({

            name: name,
            abbrev: name,
            players: gamePlayer,

            lineupIds: players.map( p =>  p._id ),

            currentHitterIndex: 0,
            currentPitcherId: undefined,

            runner1BId: undefined,
            runner2BId: undefined,
            runner3BId: undefined,

            homeAway: undefined,

            color1: color1,
            color2: color2

        }, teamOptions)

        //Sync players to the proper positions. Right now this is simple because 
        //a player can only play one position but it's possible we'll need to pass
        //this info in later.
        teamInfo.lineupIds.forEach( (id, idx) => {

            let player:GamePlayer = teamInfo.players.find( p => p._id == id)
            //Set spot in lineup
            if (player) player.lineupIndex = idx 

        })

        teamInfo.currentPitcherId = teamInfo.players.find( p => p.currentPosition == Position.PITCHER)._id

        return teamInfo

    }


}

class Pitching {

    static getActualZone(intentZone: PitchZone, locQ: number): PitchZone {

        // 67–99 => on target, 34–66 => off by 1 zone, 0–33 => off by 2 zones
        let missSize: 0 | 1 | 2 = 0
        if (locQ <= 33) missSize = 2
        else if (locQ <= 66) missSize = 1

        if (missSize === 0) return intentZone

        // Deterministic direction from locQ (no RNG)
        // 0=up, 1=down, 2=away, 3=inside
        const direction = locQ % 4

        // Parse intentZone like "LOW_AWAY"
        const [verticalText, horizontalText] = intentZone.split("_")

        // Convert to 0..2 indices
        let vertical: 0 | 1 | 2 =
            verticalText === "LOW" ? 0 :
            verticalText === "MID" ? 1 : 2

        let horizontal: 0 | 1 | 2 =
            horizontalText === "AWAY" ? 0 :
            horizontalText === "MIDDLE" ? 1 : 2

        // Apply miss
        let v = vertical
        let h = horizontal

        if (direction === 0) v = (v + missSize) as any       // up
        else if (direction === 1) v = (v - missSize) as any  // down
        else if (direction === 2) h = (h - missSize) as any  // away
        else h = (h + missSize) as any                       // inside

        // Clamp to 0..2
        if (v < 0) v = 0
        if (v > 2) v = 2
        if (h < 0) h = 0
        if (h > 2) h = 2

        // Convert back to PitchZone
        const newVerticalText = v === 0 ? "LOW" : v === 1 ? "MID" : "HIGH"
        const newHorizontalText = h === 0 ? "AWAY" : h === 1 ? "MIDDLE" : "INSIDE"

        return `${newVerticalText}_${newHorizontalText}` as PitchZone
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
        if (outEvents.length <= 1 && RunnerActions.getTotalOuts(runnerEvents) < 2 && defensiveCredits.find(dc => dc.type == DefenseCreditType.ERROR) == undefined ) {
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
        if (RunnerActions.getTotalOuts(runnerEvents) >= 3) {
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

            controlChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.control), MIN_CHANGE, MAX_CHANGE),
            movementChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.movement), MIN_CHANGE, MAX_CHANGE),
            powerChange: PlayerChange.clamp(PlayerChange.getChange(laRating, pitchRatings.power), MIN_CHANGE, MAX_CHANGE),


            // pitchesChange: pitchesChange
        }
    }

    static getHitterChange(hittingRatings: HittingRatings, laRating:number, throws:Handedness): HitterChange {

        let handednessRatings = throws == Handedness.R ? hittingRatings.vsR : hittingRatings.vsL

        return {
            plateDisiplineChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.plateDiscipline), MIN_CHANGE, MAX_CHANGE),
            contactChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.contact), MIN_CHANGE, MAX_CHANGE),

            gapPowerChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.gapPower), MIN_CHANGE, MAX_CHANGE),
            hrPowerChange: PlayerChange.clamp(PlayerChange.getChange(laRating, handednessRatings.homerunPower), MIN_CHANGE, MAX_CHANGE),

            speedChange: PlayerChange.clamp(PlayerChange.getChange(laRating, hittingRatings.speed), MIN_CHANGE, MAX_CHANGE),
            stealsChange: PlayerChange.clamp(PlayerChange.getChange(laRating, hittingRatings.steals), MIN_CHANGE, MAX_CHANGE),

            defenseChange: PlayerChange.clamp(PlayerChange.getChange(laRating, hittingRatings.defense), MIN_CHANGE, MAX_CHANGE),
            armChange: PlayerChange.clamp(PlayerChange.getChange(laRating, hittingRatings.arm), MIN_CHANGE, MAX_CHANGE)

        }

    }

    static getClampedChange(avgRating:number, rating:number) {
        return this.clamp(this.getChange(avgRating, rating), MIN_CHANGE, MAX_CHANGE)
    }

    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max)
    }


    static applyChanges(base:number, changes:number[]) {

        base = PlayerChange.applyChange(base, _getAverage(changes))

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

const _getStdDev = (stat: { count: number, total: number, totalSquared: number, avg: number }): number => {

    if (!stat || stat.count <= 1) return 0

    const mean = stat.avg
    const variance = Math.max(0, (stat.totalSquared / stat.count) - (mean * mean))
    return Math.sqrt(variance)
}

const _getAverage = (array: number[]) => {
    return array.reduce((a, b) => a + b) / array.length
}


export {
    SimService, PlayerChange, Rolls, AtBatInfo, SimRolls, Matchup, RunnerActions, GameInfo, GamePlayers
}
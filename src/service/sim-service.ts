import { BaseResult, Contact, DefenseCreditType, Handedness, HomeAway, OfficialPlayResult, OfficialRunnerResult, PitchCall, PitchType, PitchZone, PlayResult, Position, ShallowDeep, SwingResult, ThrowResult } from "./enums.js";
import {  ContactTypeRollInput, Count, DefensiveCredit, FielderChance, Game, GamePlayer, HalfInning, HitResultCount, HitterChange, HitterStatLine, HittingRatings, InningEndingEvent, InZoneByCount, LeagueAverage, Lineup, MatchupHandedness, Pitch, PitchCount, PitchEnvironmentTarget, PitchEnvironmentTuning, PitcherChange, PitchLog, PitchRatings, PitchResultCount, PitchTypeMovementStat, Play, Player, PlayerFromStatsCommand, PlayerImportBaseline, PlayerImportRaw, PowerRollInput, RollChart, RotationPitcher, RunnerEvent, RunnerResult, RunnerThrowCommand, Score, ShallowDeepChance, SimPitchCommand, SimPitchResult, StartGameCommand, StolenBaseByCount, Team, TeamInfo, ThrowRoll, UpcomingMatchup } from "./interfaces.js";
import { RollChartService } from "./roll-chart-service.js";
import { StatService } from "./stat-service.js";


const APPLY_PLAYER_CHANGES = true
const PLAYER_CHANGE_SCALE = 0.75
const STANDARD_INNINGS = 9

const MIN_CHANGE = -.5
const MAX_CHANGE = .5


const DEFAULT_SEASON = 2025

class SimService {

    private gameInfo:GameInfo    
    private gamePlayers:GamePlayers

    private sim:Sim
    private simRolls:SimRolls  
    
    private runnerActions:RunnerActions
    private matchup:Matchup

    private playerImporter:PlayerImporter

    
    constructor(
        private rollChartService: RollChartService,
        private statService:StatService
    ) {
        this.simRolls = new SimRolls(rollChartService)
        this.gamePlayers = new GamePlayers(rollChartService)
        this.runnerActions = new RunnerActions(rollChartService, this.simRolls)
        this.matchup = new Matchup(this.gamePlayers)
        this.gameInfo = new GameInfo(this.gamePlayers)
        
        this.sim = new Sim(rollChartService, this.simRolls, this.matchup, this.runnerActions, this.gameInfo)

        this.playerImporter = new PlayerImporter(this.sim, this.statService)
        
    }

    initGame(game:Game) {
        return this.sim.initGame(game)
    }

    startGame(command:StartGameCommand) : Game {
        return this.sim.startGame(command)
    }

    finishGame(game:Game) : void {
        return this.sim.finishGame(game)
    }

    getPlayerImportBaseline(pitchEnvironment: PitchEnvironmentTarget, rng: Function): PlayerImportBaseline {
        return this.playerImporter.getPlayerImportBaseline(pitchEnvironment, rng)
    }

    getTuningsForPitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, options?: { maxIterations?: number, gamesPerIteration?: number }): PitchEnvironmentTuning {
        return this.playerImporter.getTuningsForPitchEnvironment(pitchEnvironment, rng, options)
    }


    /*
    Passthrough/public stuff for tests.

    */

    simPitch(game:Game, rng:any) {
        return this.sim.simPitch(game, rng)
    }

    buildTeamInfoFromPlayers (leagueAverage:LeagueAverage, name:string, teamId:string, players:Player[], color1:string, color2:string, startingId:number) {
        return this.gameInfo.buildTeamInfoFromPlayers(leagueAverage, name, teamId, players, color1, color2, startingId)
    }

    getThrowResult(gameRNG, overallSafeChance:number) : ThrowRoll {
        return this.simRolls.getThrowResult(gameRNG, overallSafeChance)
    }

    getRunnerEvents(gameRNG, runnerResult:RunnerResult, halfInningRunnerEvents:RunnerEvent[], defensiveCredits:DefensiveCredit[], leagueAverages: LeagueAverage, playResult: PlayResult, 
                    contact: Contact|undefined, shallowDeep: ShallowDeep|undefined, hitter:GamePlayer, fielderPlayer: GamePlayer|undefined, 
                    runner1B:GamePlayer|undefined, runner2B:GamePlayer|undefined, runner3B:GamePlayer|undefined, offense:TeamInfo, defense:TeamInfo, pitcher:GamePlayer, pitchIndex:number) : RunnerEvent[] {

                    return this.runnerActions.getRunnerEvents(gameRNG, runnerResult, halfInningRunnerEvents, defensiveCredits, leagueAverages, playResult, contact, shallowDeep, hitter, fielderPlayer, runner1B, runner2B, runner3B, offense, defense, pitcher, pitchIndex)
    }

    getChanceRunnerSafe(leagueAverages: LeagueAverage, armRating:number, runnerSpeed:number, defaultSuccess:number) {
        return this.runnerActions.getChanceRunnerSafe(leagueAverages, armRating, runnerSpeed, defaultSuccess)
    }
    
    getUpcomingMatchup(game:Game) : UpcomingMatchup {
        return this.sim.getUpcomingMatchup(game)
    }

    //Exposed in tests.
    initGamePlayers(leagueAverage:LeagueAverage, players:Player[], startingPitcher:RotationPitcher, teamId:string, color1:string, color2:string, startingId:number) : GamePlayer[] {
        return this.gamePlayers.initGamePlayers(leagueAverage, players, startingPitcher, teamId, color1, color2, startingId)
    }
    

}

const _getAverage = (array: number[]) => {
    return array.reduce((a, b) => a + b) / array.length
}

class Sim {

    constructor(
        private rollChartService:RollChartService,
        private gameRolls:SimRolls,
        private matchup:Matchup,
        private runnerActions:RunnerActions,
        private gameInfo:GameInfo,
    ) {}

    initGame(game:Game) {

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

    startGame(command:StartGameCommand) : Game {

        let game = command.game

        //Validate lineups
        GameInfo.validateGameLineup(command.awayLineup, command.awayStartingPitcher)
        GameInfo.validateGameLineup(command.homeLineup, command.homeStartingPitcher)

        //Use what gets passed in or just use default config
        game.leagueAverages = command.leagueAverages //?? PlayerImporter.pitchEnvironmentTargetToLeagueAverage(PlayerImporter.getPitchEnvironmentTargetForSeason(DEFAULT_SEASON))

        game.away = this.gameInfo.buildTeamInfoFromTeam(command.leagueAverages, command.away, command.awayLineup,  command.awayPlayers, command.awayStartingPitcher, command.away.colors.color1, command.away.colors.color2, HomeAway.AWAY, 1, command.awayTeamOptions)            
        game.home = this.gameInfo.buildTeamInfoFromTeam(command.leagueAverages, command.home, command.homeLineup, command.homePlayers, command.homeStartingPitcher, command.home.colors.color1, command.home.colors.color2, HomeAway.HOME, 1 + command.awayPlayers.length, command.homeTeamOptions)

        game.startDate = command.date
        game.count = {
            balls: 0,
            strikes: 0,
            outs: 0
        }

        game.isStarted = true
        
        return game 
    }

    finishGame(game:Game) : void {

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

    createPlay(playIndex:number,
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

    createSimPitchCommand(game:Game, rng:any) {
        
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
            leagueAverages: game.leagueAverages,

            matchupHandedness:matchupHandedness,

            rng:rng

        }
    }

    simPitch(game:Game, rng:any) {

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

    simPitchRolls(command: SimPitchCommand, pitchIndex: number): SimPitchResult {

        const pitches = command.pitcher.pitchRatings.pitches
        const weights = [50, 25, 15, 5, 5]

        const pitchType: PitchType = Rolls.weightedRandom(command.rng, pitches, weights.slice(0, pitches.length))

        const hitterPitchGuess: PitchType =
            command.pitcher.pitchRatings.pitches[Rolls.getRoll(command.rng, 0, pitches.length - 1)]
        const guessPitch: boolean = hitterPitchGuess == pitchType

        const powerQuality = this.gameRolls.getPowerQuality(command.rng, command.pitcherChange.powerChange)
        const locationQuality = this.gameRolls.getLocationQuality(command.rng, command.pitcherChange.controlChange)
        const movementQuality = this.gameRolls.getMovementQuality(command.rng, command.pitcherChange.movementChange)

        const pitchQuality = Pitching.getPitchQuality(powerQuality, locationQuality, movementQuality)

        let inZoneRate = command.leagueAverages.inZoneByCount.find(
            r => r.balls === command.play.pitchLog.count.balls && r.strikes === command.play.pitchLog.count.strikes
        )?.inZone

        const inZone = this.gameRolls.isInZone(command.rng, locationQuality, inZoneRate)

        const intentZone = this.gameRolls.getIntentZone(command.rng)
        const actualZone = Pitching.getActualZone(intentZone, locationQuality)

        const pitch: Pitch = {
            intentZone,
            actualZone,
            type: pitchType,
            quality: pitchQuality,
            locQ: locationQuality,
            movQ: movementQuality,
            powQ: powerQuality,
            swing: false,
            con: false,
            result: inZone ? PitchCall.STRIKE : PitchCall.BALL,
            inZone,
            guess: guessPitch,
            isWP: false,
            isPB: false,
        }

        const anomaly = this.getPitchAnomalyResult(command.rng, locationQuality)

        if (anomaly) {

            pitch.inZone = false
            pitch.result = anomaly.result
            pitch.isWP = anomaly.isWP ?? false
            pitch.isPB = anomaly.isPB ?? false

        } else {

            const swingResult = this.gameRolls.getSwingResult(
                command.rng,
                command.hitterChange,
                command.leagueAverages,
                inZone,
                pitchQuality,
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

    private getPitchAnomalyResult(  gameRNG, locationQuality: number ): { result: PitchCall, isWP?: boolean, isPB?: boolean } | null {

        // Only truly bad location can trigger anomalies
        if (locationQuality >= 5) return null

        const badness = (5 - locationQuality) / 5
        const rareRoll = Rolls.getRollUnrounded(gameRNG, 0, 1)

        if (locationQuality < 0.5 && rareRoll < 0.01 * badness) {
            return { result: PitchCall.BALL, isPB: true }
        }

        if (rareRoll < 0.08 * badness) {
            return { result: PitchCall.HBP }
        }

        if (rareRoll < 0.18 * badness) {
            return { result: PitchCall.BALL, isWP: true }
        }

        return null
    }

    finishPlay(game:Game, command:SimPitchCommand, isInningEndingEvent:boolean) {

        let fielderPlayer:GamePlayer

        let ballInPlay:Pitch = command.play.pitchLog.pitches.find(p => p.result == PitchCall.IN_PLAY)

        let isFieldingError = false

        if (!isInningEndingEvent) {
            
            if (ballInPlay) {

                //In play
                let pitch = ballInPlay

                //How much better than average?
                let pitchQualityChange = PlayerChange.getChange(command.leagueAverages.pitchQuality, pitch.quality)

                let contactRollChart:RollChart = this.rollChartService.getMatchupContactRollChart(command.leagueAverages, command.hitter.hittingRatings.contactProfile, command.pitcher.pitchRatings.contactProfile, APPLY_PLAYER_CHANGES)

                const pickFielder = (contact:Contact) => {

                    let ignoreList = []
                    
                    switch(contact) {
                        case Contact.LINE_DRIVE:
                            //No line drives to the catcher. 
                            ignoreList.push(Position.CATCHER)
                            break
                        
                    }

                    //Who did it get hit towards?
                    fielderPlayer = undefined

                    command.play.fielder = this.gameRolls.getFielder(command.rng, command.leagueAverages, command.play.matchupHandedness.hits)

                    //If we match on the ignore list get fielders until we don't.
                    while (ignoreList.includes(command.play.fielder)) {
                        command.play.fielder = this.gameRolls.getFielder(command.rng, command.leagueAverages, command.play.matchupHandedness.hits)
                    }

                    fielderPlayer = command.defense.players.find(p => p.currentPosition == command.play.fielder)


                }

                let hitQuality:number

                //What kind of contact? 
                command.play.contact = contactRollChart.entries.get(Rolls.getRoll(command.rng, 0, 99)) as Contact

                pickFielder(command.play.contact)

                //Calculate team defense. We're going to use this overall average to simulate being slightly better or worse at positioning.
                let teamDefenseChange:number = PlayerChange.getChange(command.leagueAverages.hittingRatings.defense, GameInfo.getTeamDefense(command.defense))
                let fielderDefenseChange:number = PlayerChange.getChange(command.leagueAverages.hittingRatings.defense, fielderPlayer.hittingRatings.defense)


                let powerRollChart:RollChart = this.rollChartService.getMatchupPowerRollChart(command.leagueAverages, command.hitterChange, command.pitcherChange, APPLY_PLAYER_CHANGES)


                //Was it high quality contact? 1-1000
                hitQuality = this.gameRolls.getHitQuality(command.rng, command.leagueAverages, pitchQualityChange, teamDefenseChange, fielderDefenseChange, command.play.contact, pitch.guess, powerRollChart)


                //O, 1B, 2B, 3B, or HR
                command.play.result = powerRollChart.entries.get(hitQuality) as PlayResult

                //No pop up/line drive hits to IF. 
                while (AtBatInfo.isInAir(command.play.contact) && !AtBatInfo.isToOF(command.play.fielder) && command.play.result != PlayResult.OUT) {
                    pickFielder(command.play.contact)
                }

                //No ground ball outs to the OF. Redirect to infielder.
                while (command.play.contact == Contact.GROUNDBALL && AtBatInfo.isToOF(command.play.fielder) && command.play.result == PlayResult.OUT) {
                    pickFielder(command.play.contact)
                }

                //No doubles or triples to infielders
                while ( (command.play.result == PlayResult.DOUBLE || command.play.result == PlayResult.TRIPLE) && AtBatInfo.isToInfielder(command.play.fielder)) {
                    pickFielder(command.play.contact)
                }


                if (!fielderPlayer) {
                   throw new Error(`No fielder found at position ${command.play.fielder}`)
                }

                if (AtBatInfo.isToOF(command.play.fielder)) {
                    command.play.shallowDeep = this.gameRolls.getShallowDeep(command.rng, command.leagueAverages)
                } 

                if (command.play.result == PlayResult.HR) {
                    if (command.play.contact == Contact.GROUNDBALL) {
                        command.play.contact = hitQuality > 70 ? Contact.LINE_DRIVE : Contact.FLY_BALL
                    }

                    command.play.shallowDeep = ShallowDeep.DEEP
                } 

                if (command.play.result == PlayResult.TRIPLE) {
                    command.play.shallowDeep = ShallowDeep.DEEP //Triples always deep for now.
                } 

            } else {

                //If the ball isn't in play let's make sure it's a legit reason.
                if (command.play.result != PlayResult.STRIKEOUT && command.play.result != PlayResult.BB &&  command.play.result != PlayResult.HIT_BY_PITCH && !isInningEndingEvent) {
                    throw new Error("Error with pitchlog")
                }

            }

            //Players could have moved. Grab the correct base runners.
            let runner1B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.first)
            let runner2B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.second)
            let runner3B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.third)

            if (command.play.runner.result.end.first && !runner1B) {
                throw new Error("Missing 1B runner.")
            }

            if (command.play.runner.result.end.second && !runner2B) {
                throw new Error("Missing 2B runner.")
            }

            if (command.play.runner.result.end.third && !runner3B) {
                throw new Error("Missing 3B runner.")
            }

            //Add in-play runner events
            let inPlayRunnerEvents: RunnerEvent[] = this.runnerActions.getRunnerEvents(command.rng, command.play.runner.result.end, command.halfInningRunnerEvents, command.play.credits, 
                                command.leagueAverages, command.play.result, command.play.contact, command.play.shallowDeep, command.hitter, fielderPlayer, runner1B, runner2B, runner3B, 
                                command.offense, command.defense, command.pitcher, command.play.pitchLog.count.pitches - 1)


            isFieldingError = inPlayRunnerEvents.filter( re => re.isError)?.length > 0

            command.play.runner.events.push(...inPlayRunnerEvents)

        }

        
        this.runnerActions.validateRunnerResult(command.play.runner.result.end)

        //If playResult was OUT and there was an error change playResult to ERROR.
        if (command.play.result == PlayResult.OUT && isFieldingError) {
            command.play.result = PlayResult.ERROR
        }

        command.play.officialPlayResult = this.getOfficialPlayResult(command.play.result, command.play.contact, command.play.shallowDeep, command.play.fielder,command.play.runner.events)

        command.play.fielderId = fielderPlayer?._id




        //Players could have moved. Grab the correct base runners.
        let runner1B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.first)
        let runner2B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.second)
        let runner3B: GamePlayer = command.offense.players.find( p => p._id == command.play.runner.result.end.third)


        LogResult.logPlayResults(command.offense, command.defense, command.hitter, command.pitcher, runner1B?._id, runner2B?._id, runner3B?._id, command.play.credits, command.play.runner.events, command.play.contact, command.play.officialPlayResult, command.play.result, command.play.pitchLog, isInningEndingEvent)

        //Reset count
        game.count.balls = 0
        game.count.strikes = 0

        //Increase outs
        game.count.outs += command.play.runner?.events.filter( re => re.movement.isOut).length

        game.playIndex++

        //Set runners
        command.offense.runner1BId = command.play.runner?.result.end.first
        command.offense.runner2BId = command.play.runner?.result.end.second
        command.offense.runner3BId = command.play.runner?.result.end.third

        //Add result to line score and gamescore
        LinescoreActions.updateLinescore(game, command.halfInning, command.play)

        //Make sure the play has the end count. Clone so we don't accidentally change them.
        command.play.count.end = JSON.parse(JSON.stringify(game.count))
        command.play.score.end = JSON.parse(JSON.stringify(game.score))

        //Move lineup to next hitter except on failed stolen bases that end an inning.
        //@ts-ignore
        if (command.play.officialPlayResult != OfficialRunnerResult.CAUGHT_STEALING_2B && command.play.officialPlayResult != OfficialRunnerResult.CAUGHT_STEALING_3B) {

            //Move to next hitter.
            if (command.offense.currentHitterIndex >= 8) {
                command.offense.currentHitterIndex = 0
            } else {
                command.offense.currentHitterIndex++
            }

        }

        const isWalkoff = (game.currentInning >=STANDARD_INNINGS && !game.isTopInning && game.score.home > game.score.away)

        if (game.count.outs >= 3 || isWalkoff ) {

            //Update linescore LOB
            let leftOnBase = [command.offense.runner1BId, command.offense.runner2BId, command.offense.runner3BId ].filter( r => r != undefined).length

            if (leftOnBase > 0) {
                LinescoreActions.updateLinescoreLOB(command.halfInning, leftOnBase)
            }

            //Clear runners
            RunnerActions.clearRunners(command.offense)

            //Clear outs
            game.count.outs = 0

            //Check if game over
            game.isComplete = GameInfo.isGameOver(game)

            if (!game.isComplete) {

                const from = { inning: game.currentInning, isTop: game.isTopInning }

                if (game.isTopInning) {
                    game.isTopInning = false
                } else {
                    game.currentInning++
                    game.isTopInning = true
                }

                const to = { inning: game.currentInning, isTop: game.isTopInning }

                //Init next half inning
                game.halfInnings.push(GameInfo.initHalfInning(game.currentInning, game.isTopInning))
            } 
        }

    }

    getOfficialPlayResult(playResult: PlayResult, contact: Contact, shallowDeep: ShallowDeep, fielder: Position, runnerEvents: RunnerEvent[]) {

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

    getUpcomingMatchup(game:Game) : UpcomingMatchup {

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

    constructor(
        private gamePlayers:GamePlayers
    ) {}

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

        let hitterRA: RunnerEvent 
        let runner1bRA:RunnerEvent
        let runner2bRA:RunnerEvent
        let runner3bRA:RunnerEvent

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

    runnerToBase(runnerResult:RunnerResult, runnerEvent:RunnerEvent, start:BaseResult, end:BaseResult, eventType: PlayResult|OfficialRunnerResult, isForce:boolean) {
        
        let isScoringEvent = end == BaseResult.HOME

        if (runnerEvent) {
            
            runnerEvent.movement.start = start
            runnerEvent.movement.end = end
            runnerEvent.eventType = eventType
            runnerEvent.isScoringEvent = isScoringEvent        
            runnerEvent.isForce = isForce

            switch(start) {
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


            switch(end) {
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

    runnersTagWithThrow(gameRNG, runnerResult:RunnerResult, leagueAverages:LeagueAverage, allEvents:RunnerEvent[], runnerEvents:RunnerEvent[], defensiveCredits:DefensiveCredit[], defense:TeamInfo, offense:TeamInfo, pitcher:GamePlayer, fielderPlayer:GamePlayer, runner1bRA:RunnerEvent, runner2bRA:RunnerEvent, runner3bRA:RunnerEvent, chanceRunnerSafe:number, pitchIndex:number ) {

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
                leagueAverage: leagueAverages,
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
                leagueAverage: leagueAverages,
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
                leagueAverage: leagueAverages,
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

                            let armChange = PlayerChange.getChange(command.leagueAverage.hittingRatings.arm, _getAverage([command.throwFrom.hittingRatings.arm, command.throwFrom.hittingRatings.defense]))
                            let receivingChange = PlayerChange.getChange(command.leagueAverage.hittingRatings.defense, command.throwFrom.hittingRatings.defense)
    
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

    stealBases(runner1B: GamePlayer, runner2B: GamePlayer, runner3B: GamePlayer, gameRNG, runnerResult: RunnerResult, allEvents: RunnerEvent[], runnerEvents: RunnerEvent[], defensiveCredits: DefensiveCredit[], leagueAverages: LeagueAverage, catcher: GamePlayer, defense: TeamInfo, offense: TeamInfo, pitcher: GamePlayer, pitchIndex: number, pitchCount: PitchCount) {

        let runners = [runner1B, runner2B, runner3B].filter(r => r != undefined)

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

                    const stealSettings = this.getStealSettingsForState(
                        leagueAverages,
                        pitchCount
                    )

                    let chanceRunnerSafe = this.getStolenBaseSafe(
                        leagueAverages,
                        catcher.hittingRatings.arm,
                        runner.hittingRatings.speed,
                        runner.hittingRatings.steals,
                        stealSettings.success
                    )

                    const MIN_SUCCESS = 55
                    const GREEN_LIGHT_SUCCESS = 75

                    let successScale = (chanceRunnerSafe - MIN_SUCCESS) / (GREEN_LIGHT_SUCCESS - MIN_SUCCESS)
                    successScale = Math.max(0, Math.min(1, successScale))

                    let effectiveAttempt = stealSettings.attempt * successScale
                    effectiveAttempt = Math.max(0, Math.min(100, Math.round(effectiveAttempt)))

                    if (effectiveAttempt <= 0) continue

                    let jumpRoll = Rolls.getRoll(gameRNG, 1, 100)

                    let endBase
                    let eventType
                    let eventTypeOut

                    if (jumpRoll <= effectiveAttempt) {

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
                            leagueAverage: leagueAverages,
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

    getStolenBaseSafe(leagueAverages: LeagueAverage, armRating:number, runnerSpeed:number, runnerSteals:number, defaultSuccess:number) {

        let fielderChange = PlayerChange.getChange(leagueAverages.hittingRatings.arm, armRating)
        let runnerSpeedChange = PlayerChange.getChange(leagueAverages.hittingRatings.speed, runnerSpeed)
        let runnerStealsChange = PlayerChange.getChange(leagueAverages.hittingRatings.steals, runnerSteals)

        //Take the default success rate and apply the fielder and runner's changes.
        //Return the % chance that the runner is out.
        if (APPLY_PLAYER_CHANGES) {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerSpeedChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerStealsChange * PLAYER_CHANGE_SCALE)), 0, 99)
        } else {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess), 0, 99)
        }

    }

    getChanceRunnerSafe(leagueAverages: LeagueAverage, armRating:number, runnerSpeed:number, defaultSuccess:number) {

        let fielderChange = PlayerChange.getChange(leagueAverages.hittingRatings.arm, armRating)
        let runnerChange = PlayerChange.getChange(leagueAverages.hittingRatings.speed, runnerSpeed)

        //Take the default success rate and apply the fielder and runner's changes.
        //Return the % chance that the runner is out.

        if (APPLY_PLAYER_CHANGES) {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerChange  * PLAYER_CHANGE_SCALE)), 0, 99)
        } else {
            return this.applyMinMaxToNumber(Math.round(defaultSuccess), 0, 99)
        }


    }    

    getRunnerEvents(gameRNG, runnerResult:RunnerResult, halfInningRunnerEvents:RunnerEvent[], defensiveCredits:DefensiveCredit[], leagueAverages: LeagueAverage, playResult: PlayResult, 
                    contact: Contact|undefined, shallowDeep: ShallowDeep|undefined, hitter:GamePlayer, fielderPlayer: GamePlayer|undefined, 
                    runner1B:GamePlayer|undefined, runner2B:GamePlayer|undefined, runner3B:GamePlayer|undefined, offense:TeamInfo, defense:TeamInfo, pitcher:GamePlayer, pitchIndex:number) : RunnerEvent[] {
        
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


        let events:RunnerEvent[] = this.initRunnerEvents(pitcher, hitter, runner1B, runner2B, runner3B, pitchIndex)

        let hitterRA = events.find( e => e.runner._id == hitter?._id)
        let runner1bRA = events.find( e => e.runner._id == runner1B?._id)
        let runner2bRA = events.find( e => e.runner._id == runner2B?._id)
        let runner3bRA = events.find( e => e.runner._id == runner3B?._id)

        hitterRA.eventType = playResult

        let allEvents = [].concat(halfInningRunnerEvents).concat(events)

        try {

            const DEFAULT_SUCCESS = 95

            switch (playResult) {
    
                case PlayResult.STRIKEOUT:
                    this.runnerIsOut(runnerResult, allEvents, defensiveCredits, defense.players.find( p => p.currentPosition == Position.CATCHER), hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                    break
    
                case PlayResult.OUT:
    
                    if (!contact) throw new Error("OUT requires contact")
                    if (!fielderPlayer) throw new Error("OUT requires fielderPlayer")

                    //Fly balls. Tag up. 99% success
                    //Deep fly ball
                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && (shallowDeep == ShallowDeep.DEEP)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        this.runnersTagWithThrow(gameRNG, runnerResult, leagueAverages, allEvents, events, defensiveCredits, defense,offense, pitcher,  fielderPlayer, runner1bRA, runner2bRA, runner3bRA, 99, pitchIndex)
                        break
                    }
    
                    //Normal fly ball. 95% runner success rate. Roll for throw.
                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && (shallowDeep == ShallowDeep.NORMAL)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        this.runnersTagWithThrow(gameRNG, runnerResult, leagueAverages, allEvents, events, defensiveCredits, defense, offense, pitcher, fielderPlayer, runner1bRA, runner2bRA, runner3bRA, 95, pitchIndex)
                        break
                    }
    
                    //Shallow fly ball. Roll for throw. Only run from 3B. Only if good chance to succeed.
                    if (contact == Contact.FLY_BALL && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && shallowDeep == ShallowDeep.SHALLOW) {
    
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer,hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
    
                        if (runnerResult.third) {
    
                            //Unless a 90% chance to succeed don't even run.
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS - 30)
    
                            if (chanceRunnerSafe > 90) {
    
                                //Runners from 1B and 2B move forward 
                                this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                                this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, false)
    
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
                                    leagueAverage: leagueAverages,
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
    
                        break
                    }

                    //Fly ball to infielder
                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToInfielder(fielderPlayer.currentPosition) ) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, RunnerActions.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        break
                    }
    
                    //If it's a ground ball go for the force out. 
                    if (contact == Contact.GROUNDBALL) {
                
                        // If 2 outs already, always take the out at 1B first.
                        const outsBeforePlay = RunnerActions.getTotalOuts(allEvents)
                        if (outsBeforePlay >= 2) {

                            // batter-runner force at 1B
                            const chanceRunnerSafe = this.getChanceRunnerSafe(
                                leagueAverages,
                                fielderPlayer.hittingRatings.arm,
                                hitter.hittingRatings.speed,
                                1 //super low chance of being safe
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
                                leagueAverage: leagueAverages,
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

                        //Handle runner on third. 
                        if (runner3B != undefined) {
    
                            runner3bRA.isForce = (runner2B != undefined && runner1B != undefined)
    
                            if (runner3bRA.isForce) {
    
                                let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, 1) //low chance
    
                                //Force at home. Other runners advance.
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
                                    leagueAverage: leagueAverages,
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
    
                                //Unless a 90% chance to succeed don't even run. Saying an average speed player has a 65% success rate. So many won't run.
                                let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS - 30)
    
                                if (chanceRunnerSafe > 90) {
    
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
                                        leagueAverage: leagueAverages,
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

                        }
    
                        //Handle runner on second
                        if (runner2B != undefined) {
    
                            runner2bRA.isForce = (runner1B != undefined)
    
                            if (runner2bRA.isForce) {
    
                                let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner2B.hittingRatings.speed, 1) //low chance
    
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
                                    leagueAverage: leagueAverages,
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
    
                                //If there's a runner on third or it's hit to the right side of the infield then go without a throw 
                                if (runner3bRA || (fielderPlayer.currentPosition == Position.SECOND_BASE || fielderPlayer.currentPosition == Position.FIRST_BASE || fielderPlayer.currentPosition == Position.CATCHER) ) {
                                    //If hit to right side of infield then go without a throw
                                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                                }
    
                                //Otherwise just stay there
                            }
    
                        }
    
                        //Handle runner on 1B
                        if (runner1B != undefined) {
    
                            runner1bRA.isForce = true
    
                            if (RunnerActions.getThrowCount(events) < 1) {

                                let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 1) //low chance

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
                                    leagueAverage: leagueAverages,
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

                                //Throw already made. Just advance.
                                this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)

                            }

                        }

                        //Handle hitter
                        if (RunnerActions.getThrowCount(events) > 0) {
                            //We've already made a throw

                            //Try for double play. Always go for hitter for now.
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 75) //high chance they are safe
    
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
                                leagueAverage: leagueAverages,
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

                            //Throw is to 1B
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 1) //low chance
        
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
                                leagueAverage: leagueAverages,
                                pitcher: pitcher,
                                offense: offense,
                                pitchIndex: pitchIndex,
                                defense: defense,
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
    
                    //Move runners
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
    
                    //Move runners
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
    
                case PlayResult.SINGLE:
    
                    //Move runners
                    if (runnerResult.third != undefined) {
                        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined) )
                    }
    
                    if (runnerResult.second != undefined) {
    
                        //Runner on 2nd moves 1 base by default.
                        //score if hit to outfield. not shallow outfield unless fast runner. roll for outfield throw.
                        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, runnerResult.first != undefined )
    
                        if (AtBatInfo.isToOF(fielderPlayer?.currentPosition) && shallowDeep != ShallowDeep.SHALLOW) {
    
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner2B.hittingRatings.speed, 75) //high chance they are safe
    
                            if (chanceRunnerSafe > 90) {
    
                                //Add new event for throw result.
                                let clone:RunnerEvent = JSON.parse(JSON.stringify(runner2bRA))
    
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
                                    leagueAverage: leagueAverages,
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
                    }
    
                    if (runnerResult.first != undefined) {
    
                        //Advance to 2B by default
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true )
    
                        //go to third if fast runner. roll for outfield throw. 
                        if (fielderPlayer.currentPosition == Position.RIGHT_FIELD || fielderPlayer.currentPosition == Position.CENTER_FIELD) {
    
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 75) //high chance they are safe
    
                            if (chanceRunnerSafe > 90) {
    
                                //Add new event for throw result.
                                let clone:RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
    
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
                                    leagueAverage: leagueAverages,
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
    
                    }
    
                    //Hitter goes to 1B
                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.FIRST, PlayResult.SINGLE, true)
    
                    break
    
                case PlayResult.DOUBLE:
    
                    //Move runners. Third and second score.
                    this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined))
                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.HOME, OfficialRunnerResult.SECOND_TO_HOME, false)
    
                    if (runnerResult.first != undefined) {
    
                        //Advance to 3B by default
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.THIRD, OfficialRunnerResult.FIRST_TO_THIRD, false)
    
                        //Score unless hit to shallow OF. roll for outfield throw. 
                        if (shallowDeep != ShallowDeep.SHALLOW) {
    
                            let chanceRunnerSafe = this.getChanceRunnerSafe(leagueAverages, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 60) //kinda high chance they are safe
    
                            if (chanceRunnerSafe > 90) {
    
                                //Add new event for throw result.
                                let clone:RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
    
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
                                    leagueAverage: leagueAverages,
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
    
                    }
    
                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.SECOND, PlayResult.DOUBLE, true)
    
                    break
    
                case PlayResult.TRIPLE:
    
                    //Move runners
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

        } catch(ex) {
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
                command.leagueAverages,
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

    private getStealSettingsForState( leagueAverages: LeagueAverage, pitchCount?: PitchCount ): StolenBaseByCount {

        let table: StolenBaseByCount[] = leagueAverages.steal

        return table.find(r => r.balls === pitchCount.balls && r.strikes === pitchCount.strikes)
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

    getIntentZone(rng) {
        const index = Math.floor(rng() * ALL_PITCH_ZONES.length)
        return ALL_PITCH_ZONES[index]
    }

    getHitQuality(gameRNG, leagueAverages: LeagueAverage, pitchQualityChange: number, teamDefenseChange: number, fielderDefenseChange: number, contact: Contact, guessPitch: boolean, powerRollChart: RollChart): number {

        const singleStart = this.rollChartService.getFirstRollIndex(powerRollChart, PlayResult.SINGLE)
        const doubleStart = this.rollChartService.getFirstRollIndex(powerRollChart, PlayResult.DOUBLE)
        const tripleStart = this.rollChartService.getFirstRollIndex(powerRollChart, PlayResult.TRIPLE)

        const doubleBandSize = Math.max(1, tripleStart - doubleStart)
        const lowDoubleTarget = doubleStart + Math.floor(doubleBandSize * 0.33)

        const base = Rolls.getRoll(gameRNG, 0, 999)

        let roll = base

        const hitterPitchAdvantage = pitchQualityChange * -1
        const hitterTeamDefenseAdvantage = teamDefenseChange * -1
        const hitterFielderDefenseAdvantage = fielderDefenseChange * -1

        roll += leagueAverages.tuning.fullPitchQualityBonus * hitterPitchAdvantage
        roll += leagueAverages.tuning.fullTeamDefenseBonus * hitterTeamDefenseAdvantage
        roll += leagueAverages.tuning.fullFielderDefenseBonus * hitterFielderDefenseAdvantage

        switch (contact) {
            case Contact.GROUNDBALL:
                roll += leagueAverages.tuning.groundballOutcomeBoost
                break

            case Contact.FLY_BALL:
                roll += leagueAverages.tuning.flyballOutcomeBoost
                break

            case Contact.LINE_DRIVE:
                roll += leagueAverages.tuning.lineDriveOutcomeBoost
                break
        }

        roll = Math.max(0, Math.min(999, roll))

        const currentResult = powerRollChart.entries.get(Math.round(roll))

        switch (contact) {
            case Contact.GROUNDBALL:
                if (currentResult === PlayResult.DOUBLE) {
                    roll -= leagueAverages.tuning.groundballDoublePenalty
                } else if (currentResult === PlayResult.TRIPLE) {
                    roll -= leagueAverages.tuning.groundballTriplePenalty
                } else if (currentResult === PlayResult.HR) {
                    roll -= leagueAverages.tuning.groundballHRPenalty
                }
                break

            case Contact.FLY_BALL:
                if (currentResult === PlayResult.HR) {
                    roll -= leagueAverages.tuning.flyballHRPenalty
                }
                break

            case Contact.LINE_DRIVE:
                if (currentResult === PlayResult.OUT) {
                    if (roll >= singleStart - leagueAverages.tuning.lineDriveOutToSingleWindow) {
                        roll += leagueAverages.tuning.lineDriveOutToSingleBoost
                    }
                }

                if (currentResult === PlayResult.SINGLE) {
                    roll += (lowDoubleTarget - roll) * leagueAverages.tuning.lineDriveSingleToDoubleFactor
                }
                break
        }

        return Math.max(0, Math.min(999, Math.round(roll)))
    }

    getSwingResult(gameRNG, hitterChange: HitterChange, leagueAverage: LeagueAverage, inZone: boolean, pitchQuality: number, guessPitch: boolean, pitchCount: PitchCount): SwingResult {

        let pitchQualityChange = PlayerChange.getChange(leagueAverage.pitchQuality, pitchQuality)

        const t = leagueAverage.tuning

        const isTwoStrike = pitchCount.strikes >= 2
        const isThreeBall = pitchCount.balls >= 3

        let swingRate = 0

        if (inZone) {

            swingRate = t.zoneSwingBase

            swingRate += pitchCount.strikes * t.zoneSwingPerStrike
            swingRate += pitchCount.balls * t.zoneSwingPerBall

            if (isThreeBall) {
                swingRate -= t.threeBallZoneSwingPenalty
            }

            swingRate += pitchQualityChange * t.pitchQualityZoneSwingEffect * -1

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * t.disciplineZoneSwingEffect
            }

        } else {

            swingRate = t.chaseSwingBase

            swingRate += pitchCount.strikes * t.chaseSwingPerStrike
            swingRate += pitchCount.balls * t.chaseSwingPerBall

            if (isThreeBall) {
                swingRate -= t.threeBallChaseSwingPenalty
            }

            swingRate += pitchQualityChange * t.pitchQualityChaseSwingEffect

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * t.disciplineChaseSwingEffect * -1
            }

        }

        swingRate = Math.max(0, Math.min(100, swingRate))

        let die = Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (die < swingRate) {

            let swingContactRate = inZone ? t.zoneContactBase : t.chaseContactBase

            if (inZone) {
                swingContactRate += pitchCount.strikes * t.zoneContactPerStrike
                swingContactRate += pitchCount.balls * t.zoneContactPerBall
            } else {
                swingContactRate += pitchCount.strikes * t.chaseContactPerStrike
                swingContactRate += pitchCount.balls * t.chaseContactPerBall
            }

            if (isTwoStrike) {
                swingContactRate += inZone ? t.twoStrikeZoneContactBonus : t.twoStrikeChaseContactBonus
            }

            swingContactRate += pitchQualityChange * t.pitchQualityContactEffect * -1

            if (APPLY_PLAYER_CHANGES) {
                swingContactRate += hitterChange.contactChange * t.contactSkillEffect * -1
            }

            swingContactRate = Math.max(0, Math.min(100, swingContactRate))

            let die2 = Rolls.getRollUnrounded(gameRNG, 0, 100)

            if (die2 < swingContactRate) {

                let foulRate = t.foulRateBase

                if (isTwoStrike) {
                    foulRate += t.twoStrikeFoulBonus
                }

                foulRate = Math.max(0, Math.min(100, foulRate))

                let die3 = Rolls.getRoll(gameRNG, 0, 99)

                if (die3 > 99 - foulRate) {
                    return SwingResult.FOUL
                } else {
                    return SwingResult.FAIR
                }

            } else {
                return SwingResult.STRIKE
            }

        } else {
            return SwingResult.NO_SWING
        }

    }

    isInZone(gameRNG, locationQuality:number, inZoneRate:number) {

        //90% of the chance should be a coin-flip (better location doesn't necessarily mean a strike)
        //and also with pitchers with poor location skills they'll walk like 80% of players making it unplayable.
        let chance = Rolls.getRollUnrounded(gameRNG, 0, 90)

        chance += (locationQuality / 99) * 10

        return chance >= (99 - inZoneRate)
    }

    getFielder(gameRNG, leagueAverages: LeagueAverage, hitterHandedness:Handedness): Position {

        let rollChart = this.rollChartService.getFielderChanceRollChart(hitterHandedness == Handedness.R ? leagueAverages.fielderChanceR : leagueAverages.fielderChanceL)

        return rollChart.entries.get(Rolls.getRoll(gameRNG, 0, 99)) as Position

    }

    getShallowDeep(gameRNG: any, leagueAverages: LeagueAverage): ShallowDeep {

        let rollChart = this.rollChartService.getShallowDeepRollChart(leagueAverages.shallowDeepChance)

        return rollChart.entries.get(Rolls.getRoll(gameRNG, 0, 99)) as ShallowDeep

    }    

    getThrowResult(gameRNG, overallSafeChance:number) : ThrowRoll {

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

    getStealResult(gameRNG) {

        //Don't steal every time. 
        return Rolls.getRoll(gameRNG, 0, 999)

    }


    getPowerQuality(gameRNG, powerChange: number): number {

        let roll =  Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (APPLY_PLAYER_CHANGES) {
            roll += (roll * powerChange * PLAYER_CHANGE_SCALE)
        }


        if (roll < 0) roll = 0
        if (roll > 100) roll = 100

        return parseFloat(roll.toFixed(2))

    }

    getLocationQuality(gameRNG, controlChange: number): number {

        let roll = Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (APPLY_PLAYER_CHANGES) {
            roll += (roll * controlChange * PLAYER_CHANGE_SCALE) 
        }

        if (roll < 0) roll = 0
        if (roll > 100) roll = 100

        return parseFloat(roll.toFixed(2))

    }

    getMovementQuality(gameRNG, movementChange: number): number {
        
        let roll =  Rolls.getRollUnrounded(gameRNG, 0, 100)


        if (APPLY_PLAYER_CHANGES) {
            roll += (roll * movementChange * PLAYER_CHANGE_SCALE)
        }


        if (roll < 0) roll = 0
        if (roll > 100) roll = 100

        return parseFloat(roll.toFixed(2))

    }

}

class GamePlayers {

    constructor(
        private rollChartService:RollChartService
    ) {}

    initGamePlayers(leagueAverage:LeagueAverage, players:Player[], startingPitcher:RotationPitcher, teamId:string, color1:string, color2:string, startingId:number) : GamePlayer[] {

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
                    vsL: PlayerChange.getHitterChange(p.hittingRatings, leagueAverage.hittingRatings, Handedness.L),
                    vsR: PlayerChange.getHitterChange(p.hittingRatings, leagueAverage.hittingRatings, Handedness.R),
                },

                pitcherChange: {
                    vsL: PlayerChange.getPitcherChange(p.pitchRatings, leagueAverage.pitchRatings, Handedness.L),
                    vsR: PlayerChange.getPitcherChange(p.pitchRatings, leagueAverage.pitchRatings, Handedness.R),
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

    buildTeamInfoFromTeam(leagueAverage:LeagueAverage, team:Team, lineup:Lineup, players:Player[], startingPitcher:RotationPitcher, color1:string, color2:string, homeAway:HomeAway, startingId:number, teamOptions?:any) : TeamInfo {

        let gamePlayer:GamePlayer[] = this.gamePlayers.initGamePlayers(leagueAverage, players, startingPitcher, team._id, color1, color2, startingId)

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

    buildTeamInfoFromPlayers (leagueAverage:LeagueAverage, name:string, teamId:string, players:Player[], color1:string, color2:string, startingId:number, teamOptions?:any)  {

        let startingPitcher = players.find( p => p.primaryPosition == Position.PITCHER)

        let gamePlayer:GamePlayer[] = this.gamePlayers.initGamePlayers(leagueAverage, players, { _id: startingPitcher._id, stamina: 1}, teamId, color1, color2, startingId)

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

    static getPitchQuality(powerQuality: number, locationQuality: number, movementQuality: number) {
        return Math.round(_getAverage([powerQuality, locationQuality, movementQuality]))
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


        pitcher.pitchResult.totalPitchQuality += pitchLog.pitches.map( p => p.quality).reduce((prev, curr) => prev + curr)
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

        hitter.hitResult.totalPitchQuality += pitchLog.pitches.map( p => p.quality).reduce((prev, curr) => prev + curr)
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
    static weightedRandom(gameRNG, items, weights) {

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

    static getPitcherChange(pitchRatings: PitchRatings, laPitchRatings:PitchRatings, hits:Handedness): PitcherChange {

        let handednessRatings = hits == Handedness.R ? pitchRatings.vsR : pitchRatings.vsL
        let laHandednessRatings = hits == Handedness.R ? laPitchRatings.vsR : laPitchRatings.vsL

        return {

            controlChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.control, handednessRatings.control), MIN_CHANGE, MAX_CHANGE),
            movementChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.movement, handednessRatings.movement), MIN_CHANGE, MAX_CHANGE),
            powerChange: PlayerChange.clamp(PlayerChange.getChange(laPitchRatings.power, pitchRatings.power), MIN_CHANGE, MAX_CHANGE),


            // pitchesChange: pitchesChange
        }
    }

    static getHitterChange(hittingRatings: HittingRatings, laHittingRatings:HittingRatings, throws:Handedness): HitterChange {

        let handednessRatings = throws == Handedness.R ? hittingRatings.vsR : hittingRatings.vsL
        let laHandednessRatings = throws == Handedness.R ? laHittingRatings.vsR : laHittingRatings.vsL



        return {
            plateDisiplineChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.plateDiscipline, handednessRatings.plateDiscipline), MIN_CHANGE, MAX_CHANGE),
            contactChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.contact, handednessRatings.contact), MIN_CHANGE, MAX_CHANGE),

            gapPowerChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.gapPower, handednessRatings.gapPower), MIN_CHANGE, MAX_CHANGE),
            hrPowerChange: PlayerChange.clamp(PlayerChange.getChange(laHandednessRatings.homerunPower, handednessRatings.homerunPower), MIN_CHANGE, MAX_CHANGE),

            speedChange: PlayerChange.clamp(PlayerChange.getChange(laHittingRatings.speed, hittingRatings.speed), MIN_CHANGE, MAX_CHANGE),
            stealsChange: PlayerChange.clamp(PlayerChange.getChange(laHittingRatings.speed, hittingRatings.steals), MIN_CHANGE, MAX_CHANGE),

            defenseChange: PlayerChange.clamp(PlayerChange.getChange(laHittingRatings.defense, hittingRatings.defense), MIN_CHANGE, MAX_CHANGE),
            armChange: PlayerChange.clamp(PlayerChange.getChange(laHittingRatings.arm, hittingRatings.arm), MIN_CHANGE, MAX_CHANGE)

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

class PlayerImporter {

    constructor(private sim: Sim, private statService: StatService) {}

    static buildLeagueAverageRatings(laRating: number) {
        return {
            hittingRatings: {
                speed: laRating,
                steals: laRating,
                arm: laRating,
                defense: laRating,
                vsL: {
                    contact: laRating,
                    gapPower: laRating,
                    homerunPower: laRating,
                    plateDiscipline: laRating
                },
                vsR: {
                    contact: laRating,
                    gapPower: laRating,
                    homerunPower: laRating,
                    plateDiscipline: laRating
                }
            },

            pitchRatings: {
                power: laRating,
                vsL: {
                    control: laRating,
                    movement: laRating
                },
                vsR: {
                    control: laRating,
                    movement: laRating
                }
            }
        }
    }

    static pitchEnvironmentTargetToLeagueAverage(target: PitchEnvironmentTarget): LeagueAverage {
        return {
            ...this.buildLeagueAverageRatings(100),

            foulRate: target.pitch.foulContactPercent,

            zoneSwingContactRate: target.swing.inZoneContactPercent,
            chaseSwingContactRate: target.swing.outZoneContactPercent,

            pitchQuality: 50,

            contactTypeRollInput: target.battedBall.contactRollInput,
            powerRollInput: target.battedBall.powerRollInput,

            fielderChanceL: target.fielderChance.vsL,
            fielderChanceR: target.fielderChance.vsR,

            shallowDeepChance: target.fielderChance.shallowDeep,

            inZoneByCount: target.pitch.inZoneByCount,
            steal: target.steal,

            tuning: target.pitchEnvironmentTuning.tuning
        }
    }

    static getPitchEnvironmentTargetForSeason(season: number, players: Map<string, PlayerImportRaw>): PitchEnvironmentTarget {

        const allPlayers = Array.from(players.values())

        if (allPlayers.length === 0) {
            throw new Error(`No player import rows found for season ${season}`)
        }

        const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0
        const round = (num: number, digits: number): number => Number(num.toFixed(digits))
        const scaleTo = (value: number, fromDenominator: number, toDenominator: number): number => Math.round(safeDiv(value * toDenominator, fromDenominator))

        const hitterTotals = {
            games: 0,
            pa: 0,
            ab: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            bb: 0,
            so: 0,
            hbp: 0,
            groundBalls: 0,
            flyBalls: 0,
            lineDrives: 0,
            popups: 0,
            pitchesSeen: 0,
            ballsSeen: 0,
            strikesSeen: 0,
            swings: 0,
            swingAtBalls: 0,
            swingAtStrikes: 0,
            calledStrikes: 0,
            swingingStrikes: 0,
            inZonePitches: 0,
            inZoneContact: 0,
            outZoneContact: 0,
            fouls: 0,
            ballsInPlay: 0
        }

        const pitcherTotals = {
            games: 0,
            starts: 0,
            battersFaced: 0,
            outs: 0,
            hitsAllowed: 0,
            doublesAllowed: 0,
            triplesAllowed: 0,
            homeRunsAllowed: 0,
            bbAllowed: 0,
            so: 0,
            hbpAllowed: 0,
            groundBallsAllowed: 0,
            flyBallsAllowed: 0,
            lineDrivesAllowed: 0,
            popupsAllowed: 0,
            pitchesThrown: 0,
            ballsThrown: 0,
            strikesThrown: 0,
            swingsInduced: 0,
            swingAtBallsAllowed: 0,
            swingAtStrikesAllowed: 0,
            inZoneContactAllowed: 0,
            outZoneContactAllowed: 0,
            foulsAllowed: 0,
            ballsInPlayAllowed: 0
        }

        const runningTotals = {
            sb: 0,
            cs: 0,
            sbAttempts: 0,
            timesOnFirst: 0,
            extraBaseTaken: 0,
            extraBaseOpportunities: 0
        }

        const fieldingTotals = {
            errors: 0,
            assists: 0,
            putouts: 0,
            chances: 0,
            doublePlays: 0,
            doublePlayOpportunities: 0,
            outfieldAssists: 0,
            catcherCaughtStealing: 0,
            catcherStolenBasesAllowed: 0,
            passedBalls: 0,
            throwsAttempted: 0,
            successfulThrowOuts: 0,
            groundBallsFielded: 0,
            flyBallsFielded: 0,
            lineDrivesFielded: 0,
            popupsFielded: 0
        }

        const splitHittingTotals = {
            vsL: { pa: 0, ab: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, bb: 0, so: 0, hbp: 0, exitVelocityWeighted: 0 },
            vsR: { pa: 0, ab: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, bb: 0, so: 0, hbp: 0, exitVelocityWeighted: 0 }
        }

        const splitPitchingTotals = {
            vsL: { battersFaced: 0, outs: 0, hitsAllowed: 0, doublesAllowed: 0, triplesAllowed: 0, homeRunsAllowed: 0, bbAllowed: 0, so: 0, hbpAllowed: 0 },
            vsR: { battersFaced: 0, outs: 0, hitsAllowed: 0, doublesAllowed: 0, triplesAllowed: 0, homeRunsAllowed: 0, bbAllowed: 0, so: 0, hbpAllowed: 0 }
        }

        const inZoneByCountSeed = [
            { balls: 0, strikes: 0, inZone: 0, total: 0 },
            { balls: 0, strikes: 1, inZone: 0, total: 0 },
            { balls: 0, strikes: 2, inZone: 0, total: 0 },
            { balls: 1, strikes: 0, inZone: 0, total: 0 },
            { balls: 1, strikes: 1, inZone: 0, total: 0 },
            { balls: 1, strikes: 2, inZone: 0, total: 0 },
            { balls: 2, strikes: 0, inZone: 0, total: 0 },
            { balls: 2, strikes: 1, inZone: 0, total: 0 },
            { balls: 2, strikes: 2, inZone: 0, total: 0 },
            { balls: 3, strikes: 0, inZone: 0, total: 0 },
            { balls: 3, strikes: 1, inZone: 0, total: 0 },
            { balls: 3, strikes: 2, inZone: 0, total: 0 }
        ]

        const inZoneByCountMap = new Map<string, { balls: number, strikes: number, inZone: number, total: number }>()
        for (const bucket of inZoneByCountSeed) {
            inZoneByCountMap.set(`${bucket.balls}-${bucket.strikes}`, bucket)
        }

        const positionSeeds: Record<Position, number> = {
            [Position.PITCHER]: 0,
            [Position.CATCHER]: 0,
            [Position.FIRST_BASE]: 0,
            [Position.SECOND_BASE]: 0,
            [Position.THIRD_BASE]: 0,
            [Position.SHORTSTOP]: 0,
            [Position.LEFT_FIELD]: 0,
            [Position.CENTER_FIELD]: 0,
            [Position.RIGHT_FIELD]: 0,
            [Position.DESIGNATED_HITTER]: 0
        }

        for (const player of allPlayers) {
            hitterTotals.games += player.hitting.games
            hitterTotals.pa += player.hitting.pa
            hitterTotals.ab += player.hitting.ab
            hitterTotals.hits += player.hitting.hits
            hitterTotals.doubles += player.hitting.doubles
            hitterTotals.triples += player.hitting.triples
            hitterTotals.homeRuns += player.hitting.homeRuns
            hitterTotals.bb += player.hitting.bb
            hitterTotals.so += player.hitting.so
            hitterTotals.hbp += player.hitting.hbp
            hitterTotals.groundBalls += player.hitting.groundBalls
            hitterTotals.flyBalls += player.hitting.flyBalls
            hitterTotals.lineDrives += player.hitting.lineDrives
            hitterTotals.popups += player.hitting.popups
            hitterTotals.pitchesSeen += player.hitting.pitchesSeen
            hitterTotals.ballsSeen += player.hitting.ballsSeen
            hitterTotals.strikesSeen += player.hitting.strikesSeen
            hitterTotals.swings += player.hitting.swings
            hitterTotals.swingAtBalls += player.hitting.swingAtBalls
            hitterTotals.swingAtStrikes += player.hitting.swingAtStrikes
            hitterTotals.calledStrikes += player.hitting.calledStrikes
            hitterTotals.swingingStrikes += player.hitting.swingingStrikes
            hitterTotals.inZonePitches += player.hitting.inZonePitches
            hitterTotals.inZoneContact += player.hitting.inZoneContact
            hitterTotals.outZoneContact += player.hitting.outZoneContact
            hitterTotals.fouls += player.hitting.fouls
            hitterTotals.ballsInPlay += player.hitting.ballsInPlay

            pitcherTotals.games += player.pitching.games
            pitcherTotals.starts += player.pitching.starts
            pitcherTotals.battersFaced += player.pitching.battersFaced
            pitcherTotals.outs += player.pitching.outs
            pitcherTotals.hitsAllowed += player.pitching.hitsAllowed
            pitcherTotals.doublesAllowed += player.pitching.doublesAllowed
            pitcherTotals.triplesAllowed += player.pitching.triplesAllowed
            pitcherTotals.homeRunsAllowed += player.pitching.homeRunsAllowed
            pitcherTotals.bbAllowed += player.pitching.bbAllowed
            pitcherTotals.so += player.pitching.so
            pitcherTotals.hbpAllowed += player.pitching.hbpAllowed
            pitcherTotals.groundBallsAllowed += player.pitching.groundBallsAllowed
            pitcherTotals.flyBallsAllowed += player.pitching.flyBallsAllowed
            pitcherTotals.lineDrivesAllowed += player.pitching.lineDrivesAllowed
            pitcherTotals.popupsAllowed += player.pitching.popupsAllowed
            pitcherTotals.pitchesThrown += player.pitching.pitchesThrown
            pitcherTotals.ballsThrown += player.pitching.ballsThrown
            pitcherTotals.strikesThrown += player.pitching.strikesThrown
            pitcherTotals.swingsInduced += player.pitching.swingsInduced
            pitcherTotals.swingAtBallsAllowed += player.pitching.swingAtBallsAllowed
            pitcherTotals.swingAtStrikesAllowed += player.pitching.swingAtStrikesAllowed
            pitcherTotals.inZoneContactAllowed += player.pitching.inZoneContactAllowed
            pitcherTotals.outZoneContactAllowed += player.pitching.outZoneContactAllowed
            pitcherTotals.foulsAllowed += player.pitching.foulsAllowed
            pitcherTotals.ballsInPlayAllowed += player.pitching.ballsInPlayAllowed

            runningTotals.sb += player.running.sb
            runningTotals.cs += player.running.cs
            runningTotals.sbAttempts += player.running.sbAttempts
            runningTotals.timesOnFirst += player.running.timesOnFirst
            runningTotals.extraBaseTaken += player.running.extraBaseTaken
            runningTotals.extraBaseOpportunities += player.running.extraBaseOpportunities

            fieldingTotals.errors += player.fielding.errors
            fieldingTotals.assists += player.fielding.assists
            fieldingTotals.putouts += player.fielding.putouts
            fieldingTotals.chances += player.fielding.chances
            fieldingTotals.doublePlays += player.fielding.doublePlays
            fieldingTotals.doublePlayOpportunities += player.fielding.doublePlayOpportunities
            fieldingTotals.outfieldAssists += player.fielding.outfieldAssists
            fieldingTotals.catcherCaughtStealing += player.fielding.catcherCaughtStealing
            fieldingTotals.catcherStolenBasesAllowed += player.fielding.catcherStolenBasesAllowed
            fieldingTotals.passedBalls += player.fielding.passedBalls
            fieldingTotals.throwsAttempted += player.fielding.throwsAttempted
            fieldingTotals.successfulThrowOuts += player.fielding.successfulThrowOuts
            fieldingTotals.groundBallsFielded += player.fielding.groundBallsFielded ?? 0
            fieldingTotals.flyBallsFielded += player.fielding.flyBallsFielded ?? 0
            fieldingTotals.lineDrivesFielded += player.fielding.lineDrivesFielded ?? 0
            fieldingTotals.popupsFielded += player.fielding.popupsFielded ?? 0

            splitHittingTotals.vsL.pa += player.splits.hitting.vsL.pa
            splitHittingTotals.vsL.ab += player.splits.hitting.vsL.ab
            splitHittingTotals.vsL.hits += player.splits.hitting.vsL.hits
            splitHittingTotals.vsL.doubles += player.splits.hitting.vsL.doubles
            splitHittingTotals.vsL.triples += player.splits.hitting.vsL.triples
            splitHittingTotals.vsL.homeRuns += player.splits.hitting.vsL.homeRuns
            splitHittingTotals.vsL.bb += player.splits.hitting.vsL.bb
            splitHittingTotals.vsL.so += player.splits.hitting.vsL.so
            splitHittingTotals.vsL.hbp += player.splits.hitting.vsL.hbp
            splitHittingTotals.vsL.exitVelocityWeighted += player.splits.hitting.vsL.exitVelocity * player.splits.hitting.vsL.pa

            splitHittingTotals.vsR.pa += player.splits.hitting.vsR.pa
            splitHittingTotals.vsR.ab += player.splits.hitting.vsR.ab
            splitHittingTotals.vsR.hits += player.splits.hitting.vsR.hits
            splitHittingTotals.vsR.doubles += player.splits.hitting.vsR.doubles
            splitHittingTotals.vsR.triples += player.splits.hitting.vsR.triples
            splitHittingTotals.vsR.homeRuns += player.splits.hitting.vsR.homeRuns
            splitHittingTotals.vsR.bb += player.splits.hitting.vsR.bb
            splitHittingTotals.vsR.so += player.splits.hitting.vsR.so
            splitHittingTotals.vsR.hbp += player.splits.hitting.vsR.hbp
            splitHittingTotals.vsR.exitVelocityWeighted += player.splits.hitting.vsR.exitVelocity * player.splits.hitting.vsR.pa

            splitPitchingTotals.vsL.battersFaced += player.splits.pitching.vsL.battersFaced
            splitPitchingTotals.vsL.outs += player.splits.pitching.vsL.outs
            splitPitchingTotals.vsL.hitsAllowed += player.splits.pitching.vsL.hitsAllowed
            splitPitchingTotals.vsL.doublesAllowed += player.splits.pitching.vsL.doublesAllowed
            splitPitchingTotals.vsL.triplesAllowed += player.splits.pitching.vsL.triplesAllowed
            splitPitchingTotals.vsL.homeRunsAllowed += player.splits.pitching.vsL.homeRunsAllowed
            splitPitchingTotals.vsL.bbAllowed += player.splits.pitching.vsL.bbAllowed
            splitPitchingTotals.vsL.so += player.splits.pitching.vsL.so
            splitPitchingTotals.vsL.hbpAllowed += player.splits.pitching.vsL.hbpAllowed

            splitPitchingTotals.vsR.battersFaced += player.splits.pitching.vsR.battersFaced
            splitPitchingTotals.vsR.outs += player.splits.pitching.vsR.outs
            splitPitchingTotals.vsR.hitsAllowed += player.splits.pitching.vsR.hitsAllowed
            splitPitchingTotals.vsR.doublesAllowed += player.splits.pitching.vsR.doublesAllowed
            splitPitchingTotals.vsR.triplesAllowed += player.splits.pitching.vsR.triplesAllowed
            splitPitchingTotals.vsR.homeRunsAllowed += player.splits.pitching.vsR.homeRunsAllowed
            splitPitchingTotals.vsR.bbAllowed += player.splits.pitching.vsR.bbAllowed
            splitPitchingTotals.vsR.so += player.splits.pitching.vsR.so
            splitPitchingTotals.vsR.hbpAllowed += player.splits.pitching.vsR.hbpAllowed

            for (const rawBucket of player.hitting.inZoneByCount ?? []) {
                const balls = Number(rawBucket?.balls ?? 0)
                const strikes = Number(rawBucket?.strikes ?? 0)

                if (balls < 0 || balls > 3 || strikes < 0 || strikes > 2) continue

                const bucket = inZoneByCountMap.get(`${balls}-${strikes}`)
                if (!bucket) continue

                bucket.inZone += Number(rawBucket?.inZone ?? 0)
                bucket.total += Number(rawBucket?.total ?? 0)
            }

            const positionStats = player.fielding.positionStats ?? {}

            for (const [positionKey, stats] of Object.entries(positionStats)) {
                const pos = positionKey as Position
                const ps: any = stats ?? {}

                if (pos === Position.DESIGNATED_HITTER) continue

                const fieldedBalls = Number(ps.fieldedBalls ?? 0)
                const assists = Number(ps.assists ?? 0)
                const putouts = Number(ps.putouts ?? 0)
                const errors = Number(ps.errors ?? 0)

                let seed = fieldedBalls + assists + errors

                if (pos === Position.CATCHER) {
                    seed += Number(player.fielding.catcherCaughtStealing ?? 0) + Number(player.fielding.passedBalls ?? 0)
                } else if (pos === Position.FIRST_BASE) {
                    seed += putouts * 0.05
                } else {
                    seed += putouts * 0.15
                }

                if (pos === Position.LEFT_FIELD || pos === Position.CENTER_FIELD || pos === Position.RIGHT_FIELD) {
                    seed += Number(ps.assists ?? 0) * 2
                }

                positionSeeds[pos] += seed
            }
        }

        const totalTeamGames = safeDiv(pitcherTotals.outs, 27)
        const singles = hitterTotals.hits - hitterTotals.doubles - hitterTotals.triples - hitterTotals.homeRuns
        const babipDenominator = hitterTotals.ab - hitterTotals.so - hitterTotals.homeRuns

        const contactGbSource = hitterTotals.groundBalls
        const contactFbSource = hitterTotals.flyBalls + hitterTotals.popups
        const contactLdSource = hitterTotals.lineDrives

        const allocateToTotal = (values: Record<string, number>, totalScale: number): Record<string, number> => {
            const entries = Object.entries(values)
            const total = entries.reduce((sum, [, value]) => sum + value, 0)

            if (total <= 0) {
                return Object.fromEntries(entries.map(([key]) => [key, 0]))
            }

            const exact = entries.map(([key, value]) => {
                const scaled = (value / total) * totalScale
                const floorValue = Math.floor(scaled)
                return {
                    key,
                    scaled,
                    floorValue,
                    remainder: scaled - floorValue
                }
            })

            let allocated = exact.reduce((sum, item) => sum + item.floorValue, 0)
            let remaining = totalScale - allocated

            exact.sort((a, b) => {
                if (b.remainder !== a.remainder) return b.remainder - a.remainder
                return a.key.localeCompare(b.key)
            })

            for (let i = 0; i < exact.length && remaining > 0; i++, remaining--) {
                exact[i].floorValue++
            }

            exact.sort((a, b) => a.key.localeCompare(b.key))

            return Object.fromEntries(exact.map(item => [item.key, item.floorValue]))
        }

        const contactPct = allocateToTotal({
            groundball: contactGbSource,
            flyBall: contactFbSource,
            lineDrive: contactLdSource
        }, 100)

        const gbPct = contactPct.groundball
        const fbPct = contactPct.flyBall
        const ldPct = contactPct.lineDrive

        const inPlayOuts = Math.max(0, hitterTotals.ballsInPlay - (hitterTotals.hits - hitterTotals.homeRuns))

        const powerRollInputRaw = allocateToTotal({
            out: inPlayOuts,
            singles,
            doubles: hitterTotals.doubles,
            triples: hitterTotals.triples,
            hr: hitterTotals.homeRuns
        }, 1000)

        const fielderSeedTotal = Object.values(positionSeeds).reduce((sum, value) => sum + value, 0)

        const derivedFielderChance = {
            pitcher: round(safeDiv(positionSeeds[Position.PITCHER], fielderSeedTotal) * 100, 0),
            catcher: round(safeDiv(positionSeeds[Position.CATCHER], fielderSeedTotal) * 100, 0),
            first: round(safeDiv(positionSeeds[Position.FIRST_BASE], fielderSeedTotal) * 100, 0),
            second: round(safeDiv(positionSeeds[Position.SECOND_BASE], fielderSeedTotal) * 100, 0),
            third: round(safeDiv(positionSeeds[Position.THIRD_BASE], fielderSeedTotal) * 100, 0),
            shortstop: round(safeDiv(positionSeeds[Position.SHORTSTOP], fielderSeedTotal) * 100, 0),
            leftField: round(safeDiv(positionSeeds[Position.LEFT_FIELD], fielderSeedTotal) * 100, 0),
            centerField: round(safeDiv(positionSeeds[Position.CENTER_FIELD], fielderSeedTotal) * 100, 0),
            rightField: round(safeDiv(positionSeeds[Position.RIGHT_FIELD], fielderSeedTotal) * 100, 0)
        }

        const stealSuccessPercent = round(safeDiv(runningTotals.sb, runningTotals.sbAttempts) * 100, 0)

        const finalizedInZoneByCount = inZoneByCountSeed.map(bucket => ({
            balls: bucket.balls,
            strikes: bucket.strikes,
            inZone: round(safeDiv(bucket.inZone, bucket.total) * 100, 0)
        }))

        const measuredInZoneContactPercent = round(safeDiv(hitterTotals.inZoneContact, hitterTotals.swingAtStrikes) * 100, 1)
        const measuredOutZoneContactPercent = round(safeDiv(hitterTotals.outZoneContact, hitterTotals.swingAtBalls) * 100, 1)

        const target: PitchEnvironmentTarget = {
            season,

            pitch: {
                inZonePercent: round(safeDiv(hitterTotals.inZonePitches, hitterTotals.pitchesSeen) * 100, 1),
                strikePercent: round(safeDiv(hitterTotals.strikesSeen, hitterTotals.pitchesSeen) * 100, 1),
                ballPercent: round(safeDiv(hitterTotals.ballsSeen, hitterTotals.pitchesSeen) * 100, 1),
                swingPercent: round(safeDiv(hitterTotals.swings, hitterTotals.pitchesSeen) * 100, 1),
                foulContactPercent: round(safeDiv(pitcherTotals.foulsAllowed, pitcherTotals.inZoneContactAllowed + pitcherTotals.outZoneContactAllowed) * 100, 1),
                pitchesPerPA: round(safeDiv(hitterTotals.pitchesSeen, hitterTotals.pa), 2),
                inZoneByCount: finalizedInZoneByCount
            },

            swing: {
                swingAtStrikesPercent: round(safeDiv(hitterTotals.swingAtStrikes, hitterTotals.inZonePitches) * 100, 1),
                swingAtBallsPercent: round(safeDiv(hitterTotals.swingAtBalls, hitterTotals.pitchesSeen - hitterTotals.inZonePitches) * 100, 1),
                inZoneContactPercent: measuredInZoneContactPercent,
                outZoneContactPercent: measuredOutZoneContactPercent
            },

            battedBall: {
                inPlayPercent: round(safeDiv(hitterTotals.ballsInPlay, hitterTotals.pitchesSeen) * 100, 1),
                contactRollInput: {
                    groundball: gbPct,
                    flyBall: fbPct,
                    lineDrive: ldPct
                },
                powerRollInput: {
                    out: powerRollInputRaw.out,
                    singles: powerRollInputRaw.singles,
                    doubles: powerRollInputRaw.doubles,
                    triples: powerRollInputRaw.triples,
                    hr: powerRollInputRaw.hr
                }
            },

            outcome: {
                avg: round(safeDiv(hitterTotals.hits, hitterTotals.ab), 3),
                obp: round(safeDiv(hitterTotals.hits + hitterTotals.bb + hitterTotals.hbp, hitterTotals.pa), 3),
                slg: round(safeDiv(singles + (hitterTotals.doubles * 2) + (hitterTotals.triples * 3) + (hitterTotals.homeRuns * 4), hitterTotals.ab), 3),
                ops: round(
                    safeDiv(hitterTotals.hits + hitterTotals.bb + hitterTotals.hbp, hitterTotals.pa) +
                    safeDiv(singles + (hitterTotals.doubles * 2) + (hitterTotals.triples * 3) + (hitterTotals.homeRuns * 4), hitterTotals.ab),
                    3
                ),
                babip: round(safeDiv(hitterTotals.hits - hitterTotals.homeRuns, babipDenominator), 3),
                homeRunPercent: round(safeDiv(hitterTotals.homeRuns, hitterTotals.pa), 3),
                doublePercent: round(safeDiv(hitterTotals.doubles, hitterTotals.pa), 3),
                triplePercent: round(safeDiv(hitterTotals.triples, hitterTotals.pa), 3),
                bbPercent: round(safeDiv(hitterTotals.bb, hitterTotals.pa), 3),
                soPercent: round(safeDiv(hitterTotals.so, hitterTotals.pa), 3),
                hbpPercent: round(safeDiv(hitterTotals.hbp, hitterTotals.pa), 3)
            },

            team: {
                runsPerGame: round(safeDiv(hitterTotals.hits + hitterTotals.bb + hitterTotals.hbp, hitterTotals.pa) * 14.2, 2),
                hitsPerGame: round(safeDiv(hitterTotals.hits, totalTeamGames), 2),
                homeRunsPerGame: round(safeDiv(hitterTotals.homeRuns, totalTeamGames), 2),
                bbPerGame: round(safeDiv(hitterTotals.bb, totalTeamGames), 2),
                soPerGame: round(safeDiv(hitterTotals.so, totalTeamGames), 2)
            },

            steal: [
                { balls: 0, strikes: 0, attempt: 32, success: stealSuccessPercent },
                { balls: 0, strikes: 1, attempt: 42, success: stealSuccessPercent },
                { balls: 0, strikes: 2, attempt: 18, success: stealSuccessPercent },
                { balls: 1, strikes: 0, attempt: 32, success: stealSuccessPercent },
                { balls: 1, strikes: 1, attempt: 42, success: stealSuccessPercent },
                { balls: 1, strikes: 2, attempt: 20, success: stealSuccessPercent },
                { balls: 2, strikes: 0, attempt: 49, success: stealSuccessPercent },
                { balls: 2, strikes: 1, attempt: 53, success: stealSuccessPercent },
                { balls: 2, strikes: 2, attempt: 25, success: stealSuccessPercent },
                { balls: 3, strikes: 0, attempt: 1, success: stealSuccessPercent },
                { balls: 3, strikes: 1, attempt: 14, success: stealSuccessPercent },
                { balls: 3, strikes: 2, attempt: 29, success: stealSuccessPercent }
            ],

            fielderChance: {
                vsR: derivedFielderChance,
                vsL: derivedFielderChance,
                shallowDeep: {
                    shallow: 20,
                    normal: 60,
                    deep: 20
                }
            },

            importReference: {
                hitter: {
                    games: 162,
                    pa: 1000,
                    ab: scaleTo(hitterTotals.ab, hitterTotals.pa, 1000),

                    hits: scaleTo(hitterTotals.hits, hitterTotals.pa, 1000),
                    doubles: scaleTo(hitterTotals.doubles, hitterTotals.pa, 1000),
                    triples: scaleTo(hitterTotals.triples, hitterTotals.pa, 1000),
                    homeRuns: scaleTo(hitterTotals.homeRuns, hitterTotals.pa, 1000),
                    bb: scaleTo(hitterTotals.bb, hitterTotals.pa, 1000),
                    so: scaleTo(hitterTotals.so, hitterTotals.pa, 1000),
                    hbp: scaleTo(hitterTotals.hbp, hitterTotals.pa, 1000),

                    groundBalls: scaleTo(hitterTotals.groundBalls, hitterTotals.pa, 1000),
                    flyBalls: scaleTo(hitterTotals.flyBalls, hitterTotals.pa, 1000),
                    lineDrives: scaleTo(hitterTotals.lineDrives, hitterTotals.pa, 1000),
                    popups: scaleTo(hitterTotals.popups, hitterTotals.pa, 1000),

                    pitchesSeen: scaleTo(hitterTotals.pitchesSeen, hitterTotals.pa, 1000),
                    ballsSeen: scaleTo(hitterTotals.ballsSeen, hitterTotals.pa, 1000),
                    strikesSeen: scaleTo(hitterTotals.strikesSeen, hitterTotals.pa, 1000),

                    swings: scaleTo(hitterTotals.swings, hitterTotals.pa, 1000),
                    swingAtBalls: scaleTo(hitterTotals.swingAtBalls, hitterTotals.pa, 1000),
                    swingAtStrikes: scaleTo(hitterTotals.swingAtStrikes, hitterTotals.pa, 1000),

                    calledStrikes: scaleTo(hitterTotals.calledStrikes, hitterTotals.pa, 1000),
                    swingingStrikes: scaleTo(hitterTotals.swingingStrikes, hitterTotals.pa, 1000),

                    inZonePitches: scaleTo(hitterTotals.inZonePitches, hitterTotals.pa, 1000),
                    inZoneContact: scaleTo(hitterTotals.inZoneContact, hitterTotals.pa, 1000),
                    outZoneContact: scaleTo(hitterTotals.outZoneContact, hitterTotals.pa, 1000),

                    fouls: scaleTo(hitterTotals.fouls, hitterTotals.pa, 1000),
                    ballsInPlay: scaleTo(hitterTotals.ballsInPlay, hitterTotals.pa, 1000)
                },

                pitcher: {
                    games: 32,
                    starts: 32,

                    battersFaced: 1000,
                    outs: scaleTo(pitcherTotals.outs, pitcherTotals.battersFaced, 1000),

                    hitsAllowed: scaleTo(pitcherTotals.hitsAllowed, pitcherTotals.battersFaced, 1000),
                    doublesAllowed: scaleTo(pitcherTotals.doublesAllowed, pitcherTotals.battersFaced, 1000),
                    triplesAllowed: scaleTo(pitcherTotals.triplesAllowed, pitcherTotals.battersFaced, 1000),
                    homeRunsAllowed: scaleTo(pitcherTotals.homeRunsAllowed, pitcherTotals.battersFaced, 1000),
                    bbAllowed: scaleTo(pitcherTotals.bbAllowed, pitcherTotals.battersFaced, 1000),
                    so: scaleTo(pitcherTotals.so, pitcherTotals.battersFaced, 1000),
                    hbpAllowed: scaleTo(pitcherTotals.hbpAllowed, pitcherTotals.battersFaced, 1000),

                    groundBallsAllowed: scaleTo(pitcherTotals.groundBallsAllowed, pitcherTotals.battersFaced, 1000),
                    flyBallsAllowed: scaleTo(pitcherTotals.flyBallsAllowed, pitcherTotals.battersFaced, 1000),
                    lineDrivesAllowed: scaleTo(pitcherTotals.lineDrivesAllowed, pitcherTotals.battersFaced, 1000),
                    popupsAllowed: scaleTo(pitcherTotals.popupsAllowed, pitcherTotals.battersFaced, 1000),

                    pitchesThrown: scaleTo(pitcherTotals.pitchesThrown, pitcherTotals.battersFaced, 1000),
                    ballsThrown: scaleTo(pitcherTotals.ballsThrown, pitcherTotals.battersFaced, 1000),
                    strikesThrown: scaleTo(pitcherTotals.strikesThrown, pitcherTotals.battersFaced, 1000),

                    swingsInduced: scaleTo(pitcherTotals.swingsInduced, pitcherTotals.battersFaced, 1000),
                    swingAtBallsAllowed: scaleTo(pitcherTotals.swingAtBallsAllowed, pitcherTotals.battersFaced, 1000),
                    swingAtStrikesAllowed: scaleTo(pitcherTotals.swingAtStrikesAllowed, pitcherTotals.battersFaced, 1000),

                    inZoneContactAllowed: scaleTo(pitcherTotals.inZoneContactAllowed, pitcherTotals.battersFaced, 1000),
                    outZoneContactAllowed: scaleTo(pitcherTotals.outZoneContactAllowed, pitcherTotals.battersFaced, 1000),

                    foulsAllowed: scaleTo(pitcherTotals.foulsAllowed, pitcherTotals.battersFaced, 1000),
                    ballsInPlayAllowed: scaleTo(pitcherTotals.ballsInPlayAllowed, pitcherTotals.battersFaced, 1000)
                },

                fielding: {
                    errors: scaleTo(fieldingTotals.errors, pitcherTotals.battersFaced, 1000),
                    assists: scaleTo(fieldingTotals.assists, pitcherTotals.battersFaced, 1000),
                    putouts: scaleTo(fieldingTotals.putouts, pitcherTotals.battersFaced, 1000),
                    chances: scaleTo(fieldingTotals.chances, pitcherTotals.battersFaced, 1000),
                    doublePlays: scaleTo(fieldingTotals.doublePlays, pitcherTotals.battersFaced, 1000),
                    doublePlayOpportunities: scaleTo(fieldingTotals.doublePlayOpportunities, pitcherTotals.battersFaced, 1000),
                    outfieldAssists: scaleTo(fieldingTotals.outfieldAssists, pitcherTotals.battersFaced, 1000),
                    catcherCaughtStealing: scaleTo(fieldingTotals.catcherCaughtStealing, pitcherTotals.battersFaced, 1000),
                    catcherStolenBasesAllowed: scaleTo(fieldingTotals.catcherStolenBasesAllowed, pitcherTotals.battersFaced, 1000),
                    passedBalls: scaleTo(fieldingTotals.passedBalls, pitcherTotals.battersFaced, 1000),
                    throwsAttempted: scaleTo(fieldingTotals.throwsAttempted, pitcherTotals.battersFaced, 1000),
                    successfulThrowOuts: scaleTo(fieldingTotals.successfulThrowOuts, pitcherTotals.battersFaced, 1000)
                },

                running: {
                    sb: scaleTo(runningTotals.sb, hitterTotals.pa, 1000),
                    cs: scaleTo(runningTotals.cs, hitterTotals.pa, 1000),
                    sbAttempts: scaleTo(runningTotals.sbAttempts, hitterTotals.pa, 1000),
                    timesOnFirst: scaleTo(runningTotals.timesOnFirst, hitterTotals.pa, 1000),
                    extraBaseTaken: scaleTo(runningTotals.extraBaseTaken, hitterTotals.pa, 1000),
                    extraBaseOpportunities: scaleTo(runningTotals.extraBaseOpportunities, hitterTotals.pa, 1000)
                },

                splits: {
                    hitting: {
                        vsL: {
                            pa: scaleTo(splitHittingTotals.vsL.pa, hitterTotals.pa, 1000),
                            ab: scaleTo(splitHittingTotals.vsL.ab, hitterTotals.pa, 1000),
                            hits: scaleTo(splitHittingTotals.vsL.hits, hitterTotals.pa, 1000),
                            doubles: scaleTo(splitHittingTotals.vsL.doubles, hitterTotals.pa, 1000),
                            triples: scaleTo(splitHittingTotals.vsL.triples, hitterTotals.pa, 1000),
                            homeRuns: scaleTo(splitHittingTotals.vsL.homeRuns, hitterTotals.pa, 1000),
                            bb: scaleTo(splitHittingTotals.vsL.bb, hitterTotals.pa, 1000),
                            so: scaleTo(splitHittingTotals.vsL.so, hitterTotals.pa, 1000),
                            hbp: scaleTo(splitHittingTotals.vsL.hbp, hitterTotals.pa, 1000),
                            exitVelocity: round(safeDiv(splitHittingTotals.vsL.exitVelocityWeighted, splitHittingTotals.vsL.pa), 3)
                        },
                        vsR: {
                            pa: scaleTo(splitHittingTotals.vsR.pa, hitterTotals.pa, 1000),
                            ab: scaleTo(splitHittingTotals.vsR.ab, hitterTotals.pa, 1000),
                            hits: scaleTo(splitHittingTotals.vsR.hits, hitterTotals.pa, 1000),
                            doubles: scaleTo(splitHittingTotals.vsR.doubles, hitterTotals.pa, 1000),
                            triples: scaleTo(splitHittingTotals.vsR.triples, hitterTotals.pa, 1000),
                            homeRuns: scaleTo(splitHittingTotals.vsR.homeRuns, hitterTotals.pa, 1000),
                            bb: scaleTo(splitHittingTotals.vsR.bb, hitterTotals.pa, 1000),
                            so: scaleTo(splitHittingTotals.vsR.so, hitterTotals.pa, 1000),
                            hbp: scaleTo(splitHittingTotals.vsR.hbp, hitterTotals.pa, 1000),
                            exitVelocity: round(safeDiv(splitHittingTotals.vsR.exitVelocityWeighted, splitHittingTotals.vsR.pa), 3)
                        }
                    },
                    pitching: {
                        vsL: {
                            battersFaced: scaleTo(splitPitchingTotals.vsL.battersFaced, pitcherTotals.battersFaced, 1000),
                            outs: scaleTo(splitPitchingTotals.vsL.outs, pitcherTotals.battersFaced, 1000),
                            hitsAllowed: scaleTo(splitPitchingTotals.vsL.hitsAllowed, pitcherTotals.battersFaced, 1000),
                            doublesAllowed: scaleTo(splitPitchingTotals.vsL.doublesAllowed, pitcherTotals.battersFaced, 1000),
                            triplesAllowed: scaleTo(splitPitchingTotals.vsL.triplesAllowed, pitcherTotals.battersFaced, 1000),
                            homeRunsAllowed: scaleTo(splitPitchingTotals.vsL.homeRunsAllowed, pitcherTotals.battersFaced, 1000),
                            bbAllowed: scaleTo(splitPitchingTotals.vsL.bbAllowed, pitcherTotals.battersFaced, 1000),
                            so: scaleTo(splitPitchingTotals.vsL.so, pitcherTotals.battersFaced, 1000),
                            hbpAllowed: scaleTo(splitPitchingTotals.vsL.hbpAllowed, pitcherTotals.battersFaced, 1000)
                        },
                        vsR: {
                            battersFaced: scaleTo(splitPitchingTotals.vsR.battersFaced, pitcherTotals.battersFaced, 1000),
                            outs: scaleTo(splitPitchingTotals.vsR.outs, pitcherTotals.battersFaced, 1000),
                            hitsAllowed: scaleTo(splitPitchingTotals.vsR.hitsAllowed, pitcherTotals.battersFaced, 1000),
                            doublesAllowed: scaleTo(splitPitchingTotals.vsR.doublesAllowed, pitcherTotals.battersFaced, 1000),
                            triplesAllowed: scaleTo(splitPitchingTotals.vsR.triplesAllowed, pitcherTotals.battersFaced, 1000),
                            homeRunsAllowed: scaleTo(splitPitchingTotals.vsR.homeRunsAllowed, pitcherTotals.battersFaced, 1000),
                            bbAllowed: scaleTo(splitPitchingTotals.vsR.bbAllowed, pitcherTotals.battersFaced, 1000),
                            so: scaleTo(splitPitchingTotals.vsR.so, pitcherTotals.battersFaced, 1000),
                            hbpAllowed: scaleTo(splitPitchingTotals.vsR.hbpAllowed, pitcherTotals.battersFaced, 1000)
                        }
                    }
                }
            }
        }

        return target
    }

    static clampRating(value: number, min = 50, max = 200): number {
        return Math.max(min, Math.min(max, Math.round(value)))
    }

    static getHigherIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (playerRate <= 0 || baselineRate <= 0) return 0

        const ratio = playerRate / baselineRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    static getLowerIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (playerRate <= 0 || baselineRate <= 0) return 0

        const ratio = baselineRate / playerRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    static buildHittingRatings(command: PlayerFromStatsCommand): HittingRatings {
        const tuning = command.pitchEnvironmentTarget.pitchEnvironmentTuning.ratingTuning.hitting

        const vsR = command.splits.hitting.vsR
        const vsL = command.splits.hitting.vsL

        const totalPA = command.hitter.pa

        if (totalPA === 0) {
            return {
                speed: 50,
                steals: 50,
                defense: 50,
                arm: 50,
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                vsR: { plateDiscipline: 50, contact: 50, gapPower: 50, homerunPower: 50 },
                vsL: { plateDiscipline: 50, contact: 50, gapPower: 50, homerunPower: 50 }
            }
        }

        const leagueBaseline = command.leagueImportBaseline.hitting
        const playerBaseline = command.playerImportBaseline.hitting
        const pitchEnvironment = command.pitchEnvironmentTarget

        const overallAVG = command.hitter.ab > 0 ? command.hitter.hits / command.hitter.ab : pitchEnvironment.outcome.avg
        const overallEV = command.hitter.exitVelocity?.avgExitVelo ?? 88
        const overallSO = command.hitter.pa > 0 ? command.hitter.so / command.hitter.pa : playerBaseline.contactSOPercent

        const swings = command.hitter.swings
        const swingStrikes = command.hitter.swingAtStrikes
        const swingBalls = command.hitter.swingAtBalls
        const pitchesSeen = command.hitter.pitchesSeen
        const inZonePitches = command.hitter.inZonePitches
        const outOfZonePitches = Math.max(0, pitchesSeen - inZonePitches)

        const leagueZoneContact = pitchEnvironment.swing.inZoneContactPercent / 100
        const leagueChaseContact = pitchEnvironment.swing.outZoneContactPercent / 100
        const leagueZoneSwing = pitchEnvironment.swing.swingAtStrikesPercent / 100
        const leagueChaseSwing = pitchEnvironment.swing.swingAtBallsPercent / 100
        const leagueWhiff = Math.max(0.01, 1 - (((leagueZoneContact * leagueZoneSwing) + (leagueChaseContact * leagueChaseSwing)) / Math.max(0.01, leagueZoneSwing + leagueChaseSwing)))

        const zoneContact = swingStrikes > 0 ? command.hitter.inZoneContact / swingStrikes : leagueZoneContact
        const chaseContact = swingBalls > 0 ? command.hitter.outZoneContact / swingBalls : leagueChaseContact
        const whiffRate = swings > 0 ? command.hitter.swingingStrikes / swings : leagueWhiff
        const zoneSwingRate = inZonePitches > 0 ? command.hitter.swingAtStrikes / inZonePitches : leagueZoneSwing
        const chaseSwingRate = outOfZonePitches > 0 ? command.hitter.swingAtBalls / outOfZonePitches : leagueChaseSwing

        const contactBaselineBonus =
            this.getLowerIsBetterDelta(playerBaseline.contactSOPercent, leagueBaseline.contactSOPercent, tuning.overallContactScale * 0.12) +
            this.getLowerIsBetterDelta(overallSO, leagueBaseline.contactSOPercent, tuning.overallContactScale * 0.04)

        const contactSkillBonus =
            this.getHigherIsBetterDelta(zoneContact, leagueZoneContact, tuning.contactSkillScale * 0.65) +
            this.getHigherIsBetterDelta(chaseContact, leagueChaseContact, tuning.contactSkillScale * 0.10) +
            this.getLowerIsBetterDelta(whiffRate, leagueWhiff, tuning.contactSkillScale * 0.25)

        const decisionBonus =
            this.getHigherIsBetterDelta(zoneSwingRate, leagueZoneSwing, tuning.contactDecisionScale * 0.25) +
            this.getLowerIsBetterDelta(chaseSwingRate, leagueChaseSwing, tuning.contactDecisionScale * 0.75)

        const outlierAvgBonus = this.getHigherIsBetterDelta(overallAVG, pitchEnvironment.outcome.avg, tuning.overallContactScale * 0.75)
        const outlierEvBonus = this.getHigherIsBetterDelta(overallEV, 88, tuning.contactEvScale * 0.90)

        const resultLayerBonus =
            outlierAvgBonus +
            outlierEvBonus +
            Math.max(0, outlierAvgBonus) * Math.max(0, outlierEvBonus) * 0.10

        const vsRAVG = vsR.ab > 0 ? vsR.hits / vsR.ab : overallAVG
        const vsLAVG = vsL.ab > 0 ? vsL.hits / vsL.ab : overallAVG

        const vsREV = vsR.exitVelocity > 0 ? vsR.exitVelocity : overallEV
        const vsLEV = vsL.exitVelocity > 0 ? vsL.exitVelocity : overallEV

        const vsRSO = vsR.pa > 0 ? vsR.so / vsR.pa : overallSO
        const vsLSO = vsL.pa > 0 ? vsL.so / vsL.pa : overallSO

        const vsRContactSplit =
            this.getLowerIsBetterDelta(vsRSO, overallSO, tuning.splitContactScale * 0.20) +
            this.getHigherIsBetterDelta(vsRAVG, overallAVG, tuning.splitContactScale * 0.45) +
            this.getHigherIsBetterDelta(vsREV, overallEV, tuning.contactEvScale * 0.35)

        const vsLContactSplit =
            this.getLowerIsBetterDelta(vsLSO, overallSO, tuning.splitContactScale * 0.20) +
            this.getHigherIsBetterDelta(vsLAVG, overallAVG, tuning.splitContactScale * 0.45) +
            this.getHigherIsBetterDelta(vsLEV, overallEV, tuning.contactEvScale * 0.35)

        const overallContactBonus =
            contactBaselineBonus +
            contactSkillBonus +
            decisionBonus +
            resultLayerBonus

        const vsRBB = vsR.pa > 0 ? vsR.bb / vsR.pa : playerBaseline.plateDisciplineBBPercent
        const vsLBB = vsL.pa > 0 ? vsL.bb / vsL.pa : playerBaseline.plateDisciplineBBPercent

        const overallPlateDisciplineBonus =
            this.getHigherIsBetterDelta(playerBaseline.plateDisciplineBBPercent, leagueBaseline.plateDisciplineBBPercent, tuning.overallPlateDisciplineScale)

        const vsRPlateDisciplineSplit =
            this.getHigherIsBetterDelta(vsRBB, playerBaseline.plateDisciplineBBPercent, tuning.splitPlateDisciplineScale)

        const vsLPlateDisciplineSplit =
            this.getHigherIsBetterDelta(vsLBB, playerBaseline.plateDisciplineBBPercent, tuning.splitPlateDisciplineScale)

        const vsRGap = vsR.pa > 0 ? (vsR.doubles + vsR.triples) / vsR.pa : playerBaseline.gapPowerPercent
        const vsLGap = vsL.pa > 0 ? (vsL.doubles + vsL.triples) / vsL.pa : playerBaseline.gapPowerPercent

        const overallGapPowerBonus =
            this.getHigherIsBetterDelta(playerBaseline.gapPowerPercent, leagueBaseline.gapPowerPercent, tuning.overallGapPowerScale)

        const vsRGapPowerSplit =
            this.getHigherIsBetterDelta(vsRGap, playerBaseline.gapPowerPercent, tuning.splitGapPowerScale)

        const vsLGapPowerSplit =
            this.getHigherIsBetterDelta(vsLGap, playerBaseline.gapPowerPercent, tuning.splitGapPowerScale)

        const vsRHR = vsR.pa > 0 ? vsR.homeRuns / vsR.pa : playerBaseline.homerunPowerPercent
        const vsLHR = vsL.pa > 0 ? vsL.homeRuns / vsL.pa : playerBaseline.homerunPowerPercent

        const overallHrPowerBonus =
            this.getHigherIsBetterDelta(playerBaseline.homerunPowerPercent, leagueBaseline.homerunPowerPercent, tuning.overallHrPowerScale * 0.70) +
            this.getHigherIsBetterDelta(overallEV, 88, tuning.overallHrPowerScale * 0.30)

        const vsRHrPowerSplit =
            this.getHigherIsBetterDelta(vsRHR, playerBaseline.homerunPowerPercent, tuning.splitHrPowerScale * 0.75) +
            this.getHigherIsBetterDelta(vsREV, overallEV, tuning.hrEvScale)

        const vsLHrPowerSplit =
            this.getHigherIsBetterDelta(vsLHR, playerBaseline.homerunPowerPercent, tuning.splitHrPowerScale * 0.75) +
            this.getHigherIsBetterDelta(vsLEV, overallEV, tuning.hrEvScale)

        const totalBattedBalls = command.hitter.groundBalls + command.hitter.flyBalls + command.hitter.lineDrives

        let groundball = 43
        let flyBall = 35
        let lineDrive = 22

        if (totalBattedBalls > 0) {
            groundball = Math.round((command.hitter.groundBalls / totalBattedBalls) * 100)
            flyBall = Math.round((command.hitter.flyBalls / totalBattedBalls) * 100)
            lineDrive = 100 - groundball - flyBall
        }

        const running = command.running
        const fielding = command.fielding

        const sb = running.sb ?? 0
        const cs = running.cs ?? 0
        const sbAttempts = running.sbAttempts ?? 0
        const stealSuccessRate = sbAttempts > 0 ? sb / sbAttempts : 0
        const stealAttemptRate = totalPA > 0 ? sbAttempts / totalPA : 0

        const speedBonus =
            this.getHigherIsBetterDelta(stealAttemptRate, 0.02, 26) +
            this.getHigherIsBetterDelta(stealSuccessRate, 0.72, 14)

        const stealsBonus =
            this.getHigherIsBetterDelta(stealAttemptRate, 0.04, 34) +
            this.getHigherIsBetterDelta(stealSuccessRate, 0.72, 28)

        const gamesAtPosition = fielding.gamesAtPosition ?? {}
        const inningsAtPosition = fielding.inningsAtPosition ?? {}

        const totalGamesAtPosition = Object.values(gamesAtPosition).reduce((sum, value) => sum + (value ?? 0), 0)

        const primaryPositionGames = gamesAtPosition[command.primaryPosition] ?? 0
        const primaryPositionInnings = inningsAtPosition[command.primaryPosition] ?? 0

        const errors = fielding.errors ?? 0
        const assists = fielding.assists ?? 0
        const putouts = fielding.putouts ?? 0
        const chances = errors + assists + putouts
        const outfieldAssists = fielding.outfieldAssists ?? 0
        const catcherCaughtStealing = fielding.catcherCaughtStealing ?? 0
        const catcherStolenBasesAllowed = fielding.catcherStolenBasesAllowed ?? 0
        const doublePlays = fielding.doublePlays ?? 0
        const passedBalls = fielding.passedBalls ?? 0

        const chanceRatePerGame = primaryPositionGames > 0 ? chances / primaryPositionGames : 0
        const chanceRatePerInning = primaryPositionInnings > 0 ? chances / primaryPositionInnings : 0
        const errorRate = chances > 0 ? errors / chances : 0
        const assistRatePerGame = primaryPositionGames > 0 ? assists / primaryPositionGames : 0
        const outfieldAssistRate = primaryPositionGames > 0 ? outfieldAssists / primaryPositionGames : 0
        const positionalCommitment = totalGamesAtPosition > 0 ? primaryPositionGames / totalGamesAtPosition : 1
        const catcherControlAttempts = catcherCaughtStealing + catcherStolenBasesAllowed
        const catcherControlRate = catcherControlAttempts > 0 ? catcherCaughtStealing / catcherControlAttempts : 0
        const doublePlayRate = primaryPositionGames > 0 ? doublePlays / primaryPositionGames : 0
        const passedBallRate = primaryPositionGames > 0 ? passedBalls / primaryPositionGames : 0

        let defenseBonus =
            this.getHigherIsBetterDelta(chanceRatePerGame, 2.0, 10) +
            this.getHigherIsBetterDelta(chanceRatePerInning, 0.22, 8) +
            this.getLowerIsBetterDelta(Math.max(errorRate, 0.001), 0.025, 28) +
            this.getHigherIsBetterDelta(positionalCommitment, 0.65, 6)

        let armBonus =
            this.getHigherIsBetterDelta(assistRatePerGame, 0.08, 10)

        if (
            command.primaryPosition === Position.LEFT_FIELD ||
            command.primaryPosition === Position.CENTER_FIELD ||
            command.primaryPosition === Position.RIGHT_FIELD
        ) {
            armBonus += this.getHigherIsBetterDelta(outfieldAssistRate, 0.02, 18)
        }

        if (
            command.primaryPosition === Position.SECOND_BASE ||
            command.primaryPosition === Position.THIRD_BASE ||
            command.primaryPosition === Position.SHORTSTOP
        ) {
            defenseBonus += this.getHigherIsBetterDelta(doublePlayRate, 0.05, 4)
            armBonus += this.getHigherIsBetterDelta(assistRatePerGame, 0.9, 10)
        }

        if (command.primaryPosition === Position.FIRST_BASE) {
            defenseBonus += this.getHigherIsBetterDelta(doublePlayRate, 0.05, 2)
            armBonus += this.getHigherIsBetterDelta(assistRatePerGame, 0.9, 4)
        }

        if (command.primaryPosition === Position.CATCHER) {
            armBonus += this.getHigherIsBetterDelta(catcherControlRate, 0.24, 16)
            defenseBonus += this.getLowerIsBetterDelta(Math.max(passedBallRate, 0.001), 0.03, 14)
        }

        if (command.primaryPosition === Position.PITCHER) {
            armBonus += this.getHigherIsBetterDelta(assistRatePerGame, 0.2, 6)
        }

        return {
            speed: this.clampRating(100 + speedBonus),
            steals: this.clampRating(100 + stealsBonus),
            defense: this.clampRating(100 + defenseBonus),
            arm: this.clampRating(100 + armBonus),

            contactProfile: { groundball, flyBall, lineDrive },

            vsR: {
                plateDiscipline: this.clampRating(100 + overallPlateDisciplineBonus + vsRPlateDisciplineSplit),
                contact: this.clampRating(100 + overallContactBonus + vsRContactSplit),
                gapPower: this.clampRating(100 + overallGapPowerBonus + vsRGapPowerSplit),
                homerunPower: this.clampRating(100 + overallHrPowerBonus + vsRHrPowerSplit)
            },

            vsL: {
                plateDiscipline: this.clampRating(100 + overallPlateDisciplineBonus + vsLPlateDisciplineSplit),
                contact: this.clampRating(100 + overallContactBonus + vsLContactSplit),
                gapPower: this.clampRating(100 + overallGapPowerBonus + vsLGapPowerSplit),
                homerunPower: this.clampRating(100 + overallHrPowerBonus + vsLHrPowerSplit)
            }
        }
    }

    static buildPitchRatings(command: PlayerFromStatsCommand): PitchRatings {
        const tuning = command.pitchEnvironmentTarget.pitchEnvironmentTuning.ratingTuning.pitching

        const vsR = command.splits.pitching.vsR
        const vsL = command.splits.pitching.vsL

        const totalBF = vsR.battersFaced + vsL.battersFaced

        if (totalBF === 0) {
            return {
                power: 50,
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                vsR: { control: 50, movement: 50 },
                vsL: { control: 50, movement: 50 }
            }
        }

        const leagueBaseline = command.leagueImportBaseline.pitching
        const playerBaseline = command.playerImportBaseline.pitching
        const pitchEnvironment = command.pitchEnvironmentTarget

        const totalSO = vsR.so + vsL.so
        const soRate = totalSO / totalBF

        const pitchTypes = command.pitcher.pitchTypes ?? {}

        const hardFastballs = [
            pitchTypes[PitchType.FF],
            pitchTypes[PitchType.SI],
            pitchTypes[PitchType.FC]
        ].filter((p): p is PitchTypeMovementStat => !!p && p.count > 0)

        let veloBonus = 0

        if (hardFastballs.length > 0) {
            const maxMph = Math.max(...hardFastballs.map(p => p.avgMph))
            const normalized = (maxMph - tuning.minFastball) / (tuning.maxFastball - tuning.minFastball)
            const clamped = Math.max(0, Math.min(1, normalized))
            veloBonus = (clamped - 0.5) * 2 * tuning.veloScale
        }

        const kDelta =
            ((soRate / Math.max(0.0001, leagueBaseline.powerSOPercent)) - 1) * tuning.kScale

        const baselineDelta =
            ((playerBaseline.powerSOPercent / Math.max(0.0001, leagueBaseline.powerSOPercent)) - 1) * tuning.baselinePowerScale

        const swingsInduced = command.pitcher.swingsInduced
        const totalContactAllowed = command.pitcher.inZoneContactAllowed + command.pitcher.outZoneContactAllowed

        const leagueZoneContact = pitchEnvironment.swing.inZoneContactPercent / 100
        const leagueChaseContact = pitchEnvironment.swing.outZoneContactPercent / 100

        const zoneSwingsAllowed = command.pitcher.swingAtStrikesAllowed
        const chaseSwingsAllowed = command.pitcher.swingAtBallsAllowed

        const zoneContactAllowedRate = zoneSwingsAllowed > 0
            ? command.pitcher.inZoneContactAllowed / zoneSwingsAllowed
            : leagueZoneContact

        const chaseContactAllowedRate = chaseSwingsAllowed > 0
            ? command.pitcher.outZoneContactAllowed / chaseSwingsAllowed
            : leagueChaseContact

        const contactSuppression =
            ((leagueZoneContact / Math.max(0.0001, zoneContactAllowedRate)) - 1) * 0.7 +
            ((leagueChaseContact / Math.max(0.0001, chaseContactAllowedRate)) - 1) * 0.3

        const contactDelta = contactSuppression * tuning.contactSuppressionScale

        const amplified =
            kDelta +
            baselineDelta +
            contactDelta +
            veloBonus

        const rawPower = 100 + (amplified * 1.35)

        const centered = rawPower - 100

        const compressed =
            centered >= 0
                ? centered / (1 + centered / 80)
                : centered / (1 + Math.abs(centered) / 50)

        const floor = 85
        const lifted = 100 + compressed < floor
            ? floor + (100 + compressed - floor) * 0.5
            : 100 + compressed

        const power = this.clampRating(lifted)

        const overallBBRate = command.pitcher.bbAllowed / totalBF
        const overallHRRate = command.pitcher.homeRunsAllowed / totalBF

        const leagueBBRate = leagueBaseline.controlBBPercent
        const leagueHRRate = leagueBaseline.movementHRPercent

        const totalPitchEntries = Object.values(pitchTypes).filter((p): p is PitchTypeMovementStat => !!p && p.count > 0)
        const totalPitchCount = totalPitchEntries.reduce((sum, p) => sum + p.count, 0)

        let movementShapeBonus = 0

        if (totalPitchCount > 0) {
            const weightedShape = totalPitchEntries.reduce((sum, p) => {
                const shapeScore = Math.abs(p.avgHorizontalBreak) + (Math.abs(p.avgVerticalBreak) * 0.6)
                return sum + (shapeScore * p.count)
            }, 0) / totalPitchCount

            const normalizedShape = Math.max(0, Math.min(1, (weightedShape - 18) / (42 - 18)))
            movementShapeBonus = (normalizedShape - 0.5) * 2 * tuning.arsenalMovementScale
        }

        const overallControlBonus =
            this.getLowerIsBetterDelta(overallBBRate, leagueBBRate, tuning.overallControlScale)

        const overallMovementBonus =
            movementShapeBonus +
            this.getLowerIsBetterDelta(overallHRRate, leagueHRRate, tuning.overallMovementScale) +
            this.getLowerIsBetterDelta(zoneContactAllowedRate, leagueZoneContact, tuning.contactSuppressionScale)

        return {
            power,
            contactProfile: {
                groundball: 43,
                flyBall: 35,
                lineDrive: 22
            },
            vsR: {
                control: this.clampRating(100 + overallControlBonus),
                movement: this.clampRating(100 + overallMovementBonus)
            },
            vsL: {
                control: this.clampRating(100 + overallControlBonus),
                movement: this.clampRating(100 + overallMovementBonus)
            }
        }
    }

    static createPlayerFromStats(command: PlayerFromStatsCommand): { hittingRatings: HittingRatings, pitchRatings: PitchRatings } {
        return {
            hittingRatings: this.buildHittingRatings(command),
            pitchRatings: this.buildPitchRatings(command)
        }
    }

    static getImportBaselineForPlayer(pitchEnvironment: PitchEnvironmentTarget, playerImportBaseline: PlayerImportBaseline, playerImportRaw: PlayerImportRaw): PlayerImportBaseline {
        
        const importReference = pitchEnvironment.importReference

        const blendedRate = (playerNumerator: number, playerDenominator: number, referenceNumerator: number, referenceDenominator: number, fallback: number): number => {
            const totalDenominator = playerDenominator + referenceDenominator
            if (totalDenominator <= 0) return fallback
            return (playerNumerator + referenceNumerator) / totalDenominator
        }

        const blendedContactProfile = (playerGroundballs: number, playerFlyballs: number, playerPopups: number, playerLineDrives: number, referenceGroundballs: number, referenceFlyballs: number, referencePopups: number, referenceLineDrives: number, fallback: { groundball: number, flyBall: number, lineDrive: number }) => {
            const gb = playerGroundballs + referenceGroundballs
            const fb = (playerFlyballs + playerPopups) + (referenceFlyballs + referencePopups)
            const ld = playerLineDrives + referenceLineDrives

            const total = gb + fb + ld

            if (total <= 0) {
                return fallback
            }

            return {
                groundball: gb / total,
                flyBall: fb / total,
                lineDrive: ld / total
            }
        }

        return {
            hitting: {
                plateDisciplineBBPercent: blendedRate(
                    playerImportRaw.hitting.bb,
                    playerImportRaw.hitting.pa,
                    importReference.hitter.bb,
                    importReference.hitter.pa,
                    playerImportBaseline.hitting.plateDisciplineBBPercent
                ),

                contactSOPercent: blendedRate(
                    playerImportRaw.hitting.so,
                    playerImportRaw.hitting.pa,
                    importReference.hitter.so,
                    importReference.hitter.pa,
                    playerImportBaseline.hitting.contactSOPercent
                ),

                gapPowerPercent: blendedRate(
                    playerImportRaw.hitting.doubles + playerImportRaw.hitting.triples,
                    playerImportRaw.hitting.pa,
                    importReference.hitter.doubles + importReference.hitter.triples,
                    importReference.hitter.pa,
                    playerImportBaseline.hitting.gapPowerPercent
                ),

                homerunPowerPercent: blendedRate(
                    playerImportRaw.hitting.homeRuns,
                    playerImportRaw.hitting.pa,
                    importReference.hitter.homeRuns,
                    importReference.hitter.pa,
                    playerImportBaseline.hitting.homerunPowerPercent
                ),

                speedExtraBaseTakenPercent: blendedRate(
                    playerImportRaw.running.extraBaseTaken,
                    playerImportRaw.running.extraBaseOpportunities,
                    importReference.running.extraBaseTaken,
                    importReference.running.extraBaseOpportunities,
                    playerImportBaseline.hitting.speedExtraBaseTakenPercent
                ),

                stealsAttemptPercent: blendedRate(
                    playerImportRaw.running.sbAttempts,
                    playerImportRaw.running.timesOnFirst,
                    importReference.running.sbAttempts,
                    importReference.running.timesOnFirst,
                    playerImportBaseline.hitting.stealsAttemptPercent
                ),

                stealsSuccessPercent: blendedRate(
                    playerImportRaw.running.sb,
                    playerImportRaw.running.sbAttempts,
                    importReference.running.sb,
                    importReference.running.sbAttempts,
                    playerImportBaseline.hitting.stealsSuccessPercent
                ),

                defenseErrorPercent: blendedRate(
                    playerImportRaw.fielding.errors,
                    playerImportRaw.fielding.chances,
                    importReference.fielding.errors,
                    importReference.fielding.chances,
                    playerImportBaseline.hitting.defenseErrorPercent
                ),

                defenseFieldingPlayPercent: blendedRate(
                    playerImportRaw.fielding.putouts + playerImportRaw.fielding.assists,
                    playerImportRaw.fielding.chances,
                    importReference.fielding.putouts + importReference.fielding.assists,
                    importReference.fielding.chances,
                    playerImportBaseline.hitting.defenseFieldingPlayPercent
                ),

                armThrowOutPercent: blendedRate(
                    playerImportRaw.fielding.successfulThrowOuts,
                    playerImportRaw.fielding.throwsAttempted,
                    importReference.fielding.successfulThrowOuts,
                    importReference.fielding.throwsAttempted,
                    playerImportBaseline.hitting.armThrowOutPercent
                ),

                defenseDoublePlayPercent: blendedRate(
                    playerImportRaw.fielding.doublePlays,
                    playerImportRaw.fielding.doublePlayOpportunities,
                    importReference.fielding.doublePlays,
                    importReference.fielding.doublePlayOpportunities,
                    playerImportBaseline.hitting.defenseDoublePlayPercent
                ),

                catcherCaughtStealingPercent: blendedRate(
                    playerImportRaw.fielding.catcherCaughtStealing,
                    playerImportRaw.fielding.catcherCaughtStealing + playerImportRaw.fielding.catcherStolenBasesAllowed,
                    importReference.fielding.catcherCaughtStealing,
                    importReference.fielding.catcherCaughtStealing + importReference.fielding.catcherStolenBasesAllowed,
                    playerImportBaseline.hitting.catcherCaughtStealingPercent ?? playerImportBaseline.hitting.armThrowOutPercent
                ),

                catcherPassedBallPercent: blendedRate(
                    playerImportRaw.fielding.passedBalls,
                    playerImportRaw.fielding.chances,
                    importReference.fielding.passedBalls,
                    importReference.fielding.chances,
                    playerImportBaseline.hitting.catcherPassedBallPercent ?? playerImportBaseline.hitting.defenseErrorPercent
                ),

                outfieldAssistPercent: blendedRate(
                    playerImportRaw.fielding.outfieldAssists,
                    playerImportRaw.fielding.throwsAttempted,
                    importReference.fielding.outfieldAssists,
                    importReference.fielding.throwsAttempted,
                    playerImportBaseline.hitting.outfieldAssistPercent ?? playerImportBaseline.hitting.armThrowOutPercent
                ),

                contactProfile: blendedContactProfile(
                    playerImportRaw.hitting.groundBalls,
                    playerImportRaw.hitting.flyBalls,
                    playerImportRaw.hitting.popups,
                    playerImportRaw.hitting.lineDrives,

                    importReference.hitter.groundBalls,
                    importReference.hitter.flyBalls,
                    importReference.hitter.popups,
                    importReference.hitter.lineDrives,

                    playerImportBaseline.hitting.contactProfile
                )
            },

            pitching: {
                powerSOPercent: blendedRate(
                    playerImportRaw.pitching.so,
                    playerImportRaw.pitching.battersFaced,
                    importReference.pitcher.so,
                    importReference.pitcher.battersFaced,
                    playerImportBaseline.pitching.powerSOPercent
                ),

                controlBBPercent: blendedRate(
                    playerImportRaw.pitching.bbAllowed,
                    playerImportRaw.pitching.battersFaced,
                    importReference.pitcher.bbAllowed,
                    importReference.pitcher.battersFaced,
                    playerImportBaseline.pitching.controlBBPercent
                ),

                movementHRPercent: blendedRate(
                    playerImportRaw.pitching.homeRunsAllowed,
                    playerImportRaw.pitching.battersFaced,
                    importReference.pitcher.homeRunsAllowed,
                    importReference.pitcher.battersFaced,
                    playerImportBaseline.pitching.movementHRPercent
                ),

                contactProfile: blendedContactProfile(
                    playerImportRaw.pitching.groundBallsAllowed,
                    playerImportRaw.pitching.flyBallsAllowed,
                    playerImportRaw.pitching.popupsAllowed,
                    playerImportRaw.pitching.lineDrivesAllowed,

                    importReference.pitcher.groundBallsAllowed,
                    importReference.pitcher.flyBallsAllowed,
                    importReference.pitcher.popupsAllowed,
                    importReference.pitcher.lineDrivesAllowed,

                    playerImportBaseline.pitching.contactProfile
                )
            }
        }
    }

    static createPlayerFromStatsCommand(pitchEnvironment: PitchEnvironmentTarget, leagueImportBaseline: PlayerImportBaseline, playerImportBaseline: PlayerImportBaseline, playerImportRaw: PlayerImportRaw): PlayerFromStatsCommand {
        const leagueAverages = PlayerImporter.pitchEnvironmentTargetToLeagueAverage(pitchEnvironment)

        const hasHittingSample = playerImportRaw.hitting.pa > 0
        const hasPitchingSample = playerImportRaw.pitching.battersFaced > 0

        const primaryRole: "hitter" | "pitcher" | "twoWay" =
            hasHittingSample && hasPitchingSample
                ? "twoWay"
                : hasPitchingSample
                    ? "pitcher"
                    : "hitter"

        return {
            season: pitchEnvironment.season,

            playerId: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,

            age: playerImportRaw.age,

            primaryPosition: playerImportRaw.primaryPosition,
            secondaryPositions: playerImportRaw.secondaryPositions ?? [],

            throws: playerImportRaw.throws,
            hits: playerImportRaw.bats,

            primaryRole,

            hitter: {
                ...playerImportRaw.hitting
            },

            pitcher: {
                ...playerImportRaw.pitching
            },

            fielding: {
                ...playerImportRaw.fielding,
                gamesAtPosition: { ...(playerImportRaw.fielding?.gamesAtPosition ?? {}) },
                inningsAtPosition: { ...(playerImportRaw.fielding?.inningsAtPosition ?? {}) }
            },

            running: {
                ...playerImportRaw.running
            },

            splits: {
                hitting: {
                    vsL: { ...playerImportRaw.splits.hitting.vsL },
                    vsR: { ...playerImportRaw.splits.hitting.vsR }
                },
                pitching: {
                    vsL: { ...playerImportRaw.splits.pitching.vsL },
                    vsR: { ...playerImportRaw.splits.pitching.vsR }
                }
            },

            leagueAverages,
            playerImportBaseline,
            leagueImportBaseline,
            pitchEnvironmentTarget: pitchEnvironment
        }
    }

    getPlayerImportBaseline(pitchEnvironment: PitchEnvironmentTarget, rng: Function): PlayerImportBaseline {

        const importReference = pitchEnvironment.importReference

        const leagueAverages = PlayerImporter.pitchEnvironmentTargetToLeagueAverage(pitchEnvironment)

        const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0

        const baselineCommand: PlayerFromStatsCommand = {
            season: pitchEnvironment.season,

            playerId: "baseline",
            firstName: "Baseline",
            lastName: "Baseline",

            age: 27,

            primaryPosition: Position.CENTER_FIELD,
            secondaryPositions: [],

            throws: Handedness.R,
            hits: Handedness.R,

            primaryRole: "twoWay",

            hitter: { ...importReference.hitter },
            pitcher: { ...importReference.pitcher },

            fielding: { ...importReference.fielding },
            running: { ...importReference.running },

            splits: {
                hitting: {
                    vsL: { ...importReference.splits.hitting.vsL },
                    vsR: { ...importReference.splits.hitting.vsR }
                },
                pitching: {
                    vsL: { ...importReference.splits.pitching.vsL },
                    vsR: { ...importReference.splits.pitching.vsR }
                }
            },

            leagueAverages,
            playerImportBaseline: {} as PlayerImportBaseline,
            leagueImportBaseline: {} as PlayerImportBaseline,
            pitchEnvironmentTarget: pitchEnvironment
        }

        let totalHit: HitResultCount = {} as HitResultCount

        const NUM_GAMES = 250

        for (let i = 0; i < NUM_GAMES; i++) {
            const awayPlayers = this.buildBaselinePlayers()
            const homePlayers = this.buildBaselinePlayers()

            const awayLineup = this.buildBaselineLineup(awayPlayers)
            const homeLineup = this.buildBaselineLineup(homePlayers)

            const awayStartingPitcher: RotationPitcher = {
                _id: awayPlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
                stamina: 1
            }

            const homeStartingPitcher: RotationPitcher = {
                _id: homePlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
                stamina: 1
            }

            const awayTeam: Team = {
                _id: `baseline-away-${i}`,
                name: "Away",
                abbrev: "AWAY",
                colors: {
                    color1: "#ff0000",
                    color2: "#ffffff"
                }
            }

            const homeTeam: Team = {
                _id: `baseline-home-${i}`,
                name: "Home",
                abbrev: "HOME",
                colors: {
                    color1: "#0000ff",
                    color2: "#ffffff"
                }
            }

            const game: Game = { _id: `baseline-${i}` } as Game

            this.sim.initGame(game)

            const startedGame = this.sim.startGame({
                game,
                away: awayTeam,
                awayTeamOptions: {},
                awayPlayers,
                awayLineup,
                awayStartingPitcher,

                home: homeTeam,
                homeTeamOptions: {},
                homePlayers,
                homeLineup,
                homeStartingPitcher,

                leagueAverages,
                date: new Date()
            })

            while (!startedGame.isComplete) {
                this.sim.simPitch(startedGame, rng)
            }

            this.sim.finishGame(startedGame)

            const allPlayers = [
                ...startedGame.away.players,
                ...startedGame.home.players
            ]

            for (const p of allPlayers) {
                totalHit = this.mergeHitResults(totalHit, p.hitResult)
            }
        }

        const stats: HitterStatLine = this.statService.hitResultToHitterStatLine(totalHit)

        const baseline: PlayerImportBaseline = {
            hitting: {
                plateDisciplineBBPercent: stats.bbPercent ?? safeDiv(stats.bb, stats.pa),
                contactSOPercent: stats.soPercent ?? safeDiv(stats.so, stats.pa),
                gapPowerPercent: (stats.doublePercent ?? safeDiv(stats.doubles, stats.pa)) + (stats.triplePercent ?? safeDiv(stats.triples, stats.pa)),
                homerunPowerPercent: stats.homeRunPercent ?? safeDiv(stats.homeRuns, stats.pa),

                speedExtraBaseTakenPercent: safeDiv((totalHit as any).extraBaseTaken ?? 0, (totalHit as any).extraBaseOpportunities ?? 0),
                stealsAttemptPercent: safeDiv(stats.sbAttempts, (totalHit as any).timesOnFirst ?? 0),
                stealsSuccessPercent: safeDiv(stats.sb, stats.sbAttempts),

                defenseErrorPercent: safeDiv(stats.e, stats.po + stats.assists + stats.e),
                defenseFieldingPlayPercent: safeDiv(stats.po + stats.assists, stats.po + stats.assists + stats.e),
                armThrowOutPercent: safeDiv(stats.outfieldAssists + stats.csDefense, stats.outfieldAssists + stats.csDefense + stats.passedBalls),
                defenseDoublePlayPercent: safeDiv(stats.doublePlays, (totalHit as any).doublePlayOpportunities ?? stats.doublePlays),

                catcherCaughtStealingPercent: safeDiv(stats.csDefense, stats.csDefense + stats.sb),
                catcherPassedBallPercent: safeDiv(stats.passedBalls, stats.passedBalls + stats.csDefense + stats.sb),
                outfieldAssistPercent: safeDiv(stats.outfieldAssists, (totalHit as any).throwsAttempted ?? stats.outfieldAssists),

                contactProfile: {
                    groundball: stats.groundBallPercent ?? 0,
                    flyBall: stats.flyBallPercent ?? 0,
                    lineDrive: stats.ldPercent ?? 0
                }
            },
            pitching: {
                powerSOPercent: stats.soPercent ?? safeDiv(stats.so, stats.pa),
                controlBBPercent: stats.bbPercent ?? safeDiv(stats.bb, stats.pa),
                movementHRPercent: stats.homeRunPercent ?? safeDiv(stats.homeRuns, stats.pa),
                contactProfile: {
                    groundball: stats.groundBallPercent ?? 0,
                    flyBall: stats.flyBallPercent ?? 0,
                    lineDrive: stats.ldPercent ?? 0
                }
            }
        }

        return baseline
    }

    getTuningsForPitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, options?:any): PitchEnvironmentTuning {

        const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0
        const clamp = (num: number, min: number, max: number): number => Math.max(min, Math.min(max, num))
        const round = (num: number, digits: number = 2): number => Number(num.toFixed(digits))
        const normalize = (v: number): number => v / 100

        const seedPitchEnvironmentTuning = (): PitchEnvironmentTuning => {
            const inZoneByCount = pitchEnvironment.pitch.inZoneByCount ?? []

            const getCountRate = (balls: number, strikes: number): number => {
                const found = inZoneByCount.find(c => c.balls === balls && c.strikes === strikes)
                return found?.inZone ?? pitchEnvironment.pitch.inZonePercent
            }

            const zone00 = getCountRate(0, 0)
            const zone10 = getCountRate(1, 0)
            const zone20 = getCountRate(2, 0)
            const zone30 = getCountRate(3, 0)
            const zone01 = getCountRate(0, 1)
            const zone11 = getCountRate(1, 1)
            const zone21 = getCountRate(2, 1)
            const zone31 = getCountRate(3, 1)
            const zone02 = getCountRate(0, 2)
            const zone12 = getCountRate(1, 2)
            const zone22 = getCountRate(2, 2)
            const zone32 = getCountRate(3, 2)

            const countSlopeStrike = safeDiv(((zone01 - zone00) + (zone02 - zone01) + (zone11 - zone10) + (zone12 - zone11) + (zone21 - zone20) + (zone22 - zone21) + (zone31 - zone30) + (zone32 - zone31)), 8)
            const countSlopeBall = safeDiv(((zone10 - zone00) + (zone20 - zone10) + (zone30 - zone20) + (zone11 - zone01) + (zone21 - zone11) + (zone31 - zone21) + (zone12 - zone02) + (zone22 - zone12) + (zone32 - zone22)), 9)

            return {
                tuning: {
                    zoneSwingBase: round(clamp(pitchEnvironment.swing.swingAtStrikesPercent - 20, 20, 65)),
                    chaseSwingBase: round(clamp(pitchEnvironment.swing.swingAtBallsPercent - 11, 6, 30)),

                    zoneSwingPerStrike: round(clamp(16 + (countSlopeStrike * 0.35), 8, 30)),
                    zoneSwingPerBall: round(clamp(4 + (countSlopeBall * 0.08), 0, 10)),

                    chaseSwingPerStrike: round(clamp(9 + (countSlopeStrike * 0.16), 4, 18)),
                    chaseSwingPerBall: round(clamp(2.25 + (countSlopeBall * 0.04), 0, 8)),

                    threeBallZoneSwingPenalty: round(clamp((pitchEnvironment.swing.swingAtStrikesPercent - pitchEnvironment.swing.swingAtBallsPercent) * 0.55, 8, 28)),
                    threeBallChaseSwingPenalty: round(clamp(pitchEnvironment.swing.swingAtBallsPercent * 0.75, 8, 28)),

                    pitchQualityZoneSwingEffect: 5,
                    pitchQualityChaseSwingEffect: 6,

                    disciplineZoneSwingEffect: 6.25,
                    disciplineChaseSwingEffect: 8.25,

                    zoneContactBase: round(clamp(pitchEnvironment.swing.inZoneContactPercent - 1.2, 65, 90)),
                    chaseContactBase: round(clamp(pitchEnvironment.swing.outZoneContactPercent - 1.0, 35, 75)),

                    zoneContactPerStrike: 0.5,
                    zoneContactPerBall: 0,

                    chaseContactPerStrike: 0.5,
                    chaseContactPerBall: 0,

                    twoStrikeZoneContactBonus: round(clamp((100 - pitchEnvironment.swing.inZoneContactPercent) * 0.14, 0.5, 5)),
                    twoStrikeChaseContactBonus: round(clamp((100 - pitchEnvironment.swing.outZoneContactPercent) * 0.03, 0.25, 3)),

                    pitchQualityContactEffect: 8.5,
                    contactSkillEffect: 12,

                    foulRateBase: round(clamp(pitchEnvironment.pitch.foulContactPercent - 1.25, 35, 65)),
                    twoStrikeFoulBonus: round(clamp((100 - pitchEnvironment.pitch.foulContactPercent) * 0.07, 1, 6)),

                    fullPitchQualityBonus: 8,
                    fullTeamDefenseBonus: 0,
                    fullFielderDefenseBonus: 2,

                    groundballDoublePenalty: round(clamp(2 + ((pitchEnvironment.battedBall.contactRollInput.groundball - 35) * 0.10), 1, 8)),
                    groundballTriplePenalty: round(clamp(8 + ((pitchEnvironment.battedBall.contactRollInput.groundball - 35) * 0.18), 4, 18)),
                    groundballHRPenalty: round(clamp(6 + ((pitchEnvironment.battedBall.contactRollInput.groundball - 35) * 0.16), 2, 18)),

                    flyballHRPenalty: round(clamp(1 + ((pitchEnvironment.battedBall.contactRollInput.flyBall - 30) * 0.08), 0, 8)),

                    lineDriveOutToSingleWindow: round(clamp(36 + ((pitchEnvironment.battedBall.contactRollInput.lineDrive - 20) * 1.8), 20, 100)),
                    lineDriveOutToSingleBoost: round(clamp(30 + ((pitchEnvironment.battedBall.contactRollInput.lineDrive - 20) * 1.6), 15, 90)),

                    lineDriveSingleToDoubleFactor: round(clamp(0.45 + ((pitchEnvironment.outcome.slg - pitchEnvironment.outcome.avg) * 0.55), 0.2, 0.7), 3),

                    groundballOutcomeBoost: round(clamp((pitchEnvironment.battedBall.contactRollInput.groundball - 38) * 0.25, 0, 8)),
                    flyballOutcomeBoost: round(clamp((pitchEnvironment.battedBall.contactRollInput.flyBall - 30) * 0.10, 0, 4)),
                    lineDriveOutcomeBoost: round(clamp((pitchEnvironment.battedBall.contactRollInput.lineDrive - 18) * 0.9, 4, 36))
                },

                ratingTuning: {
                    hitting: {
                        overallPlateDisciplineScale: 75,
                        splitPlateDisciplineScale: 28,

                        overallContactScale: 186,
                        splitContactScale: 12,
                        contactSkillScale: 28,
                        contactDecisionScale: 18,
                        contactEvScale: 74,

                        overallGapPowerScale: 92,
                        splitGapPowerScale: 30,

                        overallHrPowerScale: 110,
                        splitHrPowerScale: 38,
                        hrEvScale: 40
                    },

                    pitching: {
                        minFastball: 89,
                        maxFastball: 103,

                        veloScale: 185,
                        kScale: 84,
                        baselinePowerScale: 70,

                        overallControlScale: 95,
                        splitControlScale: 26,
                        strikeoutControlHelpScale: 6,

                        overallMovementScale: 50,
                        splitMovementScale: 6,
                        arsenalMovementScale: 36,

                        contactSuppressionScale: 22,
                        missBatScale: 18
                    }
                }
            }
        }

        const simulatePitchEnvironmentCandidate = (candidate: PitchEnvironmentTuning, games: number = 50): { actual: any, target: any, diff: any, score: number } => {
            const candidatePitchEnvironment: PitchEnvironmentTarget = {
                ...pitchEnvironment,
                tuning: candidate.tuning,
                ratingTuning: candidate.ratingTuning,
                pitchEnvironmentTuning: candidate
            } as PitchEnvironmentTarget

            const leagueAverages = PlayerImporter.pitchEnvironmentTargetToLeagueAverage(candidatePitchEnvironment)

            let totalHit: HitResultCount = {} as HitResultCount
            let totalPitch: PitchResultCount = {} as PitchResultCount

            for (let i = 0; i < games; i++) {
                const awayPlayers = this.buildBaselinePlayers()
                const homePlayers = this.buildBaselinePlayers()

                const awayLineup = this.buildBaselineLineup(awayPlayers)
                const homeLineup = this.buildBaselineLineup(homePlayers)

                const awayStartingPitcher: RotationPitcher = {
                    _id: awayPlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
                    stamina: 1
                }

                const homeStartingPitcher: RotationPitcher = {
                    _id: homePlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
                    stamina: 1
                }

                const awayTeam: Team = {
                    _id: `tune-away-${i}`,
                    name: "Away",
                    abbrev: "AWAY",
                    colors: {
                        color1: "#ff0000",
                        color2: "#ffffff"
                    }
                }

                const homeTeam: Team = {
                    _id: `tune-home-${i}`,
                    name: "Home",
                    abbrev: "HOME",
                    colors: {
                        color1: "#0000ff",
                        color2: "#ffffff"
                    }
                }

                const game: Game = { _id: `tune-${i}` } as Game

                this.sim.initGame(game)

                const startedGame = this.sim.startGame({
                    game,
                    away: awayTeam,
                    awayTeamOptions: {},
                    awayPlayers,
                    awayLineup,
                    awayStartingPitcher,

                    home: homeTeam,
                    homeTeamOptions: {},
                    homePlayers,
                    homeLineup,
                    homeStartingPitcher,

                    leagueAverages,
                    date: new Date()
                })

                while (!startedGame.isComplete) {
                    this.sim.simPitch(startedGame, rng)
                }

                this.sim.finishGame(startedGame)

                const allPlayers = [
                    ...startedGame.away.players,
                    ...startedGame.home.players
                ]

                for (const p of allPlayers) {
                    if (p.hitResult) {
                        totalHit = this.mergeHitResults(totalHit, p.hitResult)
                    }

                    if (p.pitchResult) {
                        totalPitch = this.mergePitchResults(totalPitch, p.pitchResult)
                    }
                }
            }

            const hitterStatLine: any = this.statService.hitResultToHitterStatLine(totalHit)
            const pitcherStatLine: any = this.statService.pitchResultToPitcherStatLine(totalPitch)

            const totalTeamGames = hitterStatLine.games / 9

            const actual = {
                inZonePercent: hitterStatLine.inZonePercent,
                strikePercent: hitterStatLine.strikePercent,
                ballPercent: hitterStatLine.ballPercent,
                swingPercent: hitterStatLine.swingPercent,
                foulContactPercent: pitcherStatLine.foulContactPercent,
                pitchesPerPA: hitterStatLine.pitchesPerPA,

                swingAtStrikesPercent: hitterStatLine.swingAtStrikesPercent,
                swingAtBallsPercent: hitterStatLine.swingAtBallsPercent,
                inZoneContactPercent: hitterStatLine.inZoneContactPercent,
                outZoneContactPercent: hitterStatLine.outZoneContactPercent,

                avg: hitterStatLine.avg,
                obp: hitterStatLine.obp,
                slg: hitterStatLine.slg,
                ops: hitterStatLine.ops,
                babip: hitterStatLine.babip,

                singlePercent: hitterStatLine.singlePercent,
                doublePercent: hitterStatLine.doublePercent,
                triplePercent: hitterStatLine.triplePercent,
                homeRunPercent: hitterStatLine.homeRunPercent,

                groundBallPercent: hitterStatLine.groundBallPercent,
                flyBallPercent: hitterStatLine.flyBallPercent,
                ldPercent: hitterStatLine.ldPercent,

                teamRunsPerGame: hitterStatLine.runs / totalTeamGames,
                teamHitsPerGame: hitterStatLine.hits / totalTeamGames,
                teamHomeRunsPerGame: hitterStatLine.homeRuns / totalTeamGames,
                teamBBPerGame: hitterStatLine.bb / totalTeamGames,
                teamSOPerGame: hitterStatLine.so / totalTeamGames
            }

            const target = {
                inZonePercent: normalize(pitchEnvironment.pitch.inZonePercent),
                strikePercent: normalize(pitchEnvironment.pitch.strikePercent),
                ballPercent: normalize(pitchEnvironment.pitch.ballPercent),
                swingPercent: normalize(pitchEnvironment.pitch.swingPercent),
                foulContactPercent: normalize(pitchEnvironment.pitch.foulContactPercent),
                pitchesPerPA: pitchEnvironment.pitch.pitchesPerPA,

                swingAtStrikesPercent: normalize(pitchEnvironment.swing.swingAtStrikesPercent),
                swingAtBallsPercent: normalize(pitchEnvironment.swing.swingAtBallsPercent),
                inZoneContactPercent: normalize(pitchEnvironment.swing.inZoneContactPercent),
                outZoneContactPercent: normalize(pitchEnvironment.swing.outZoneContactPercent),

                avg: pitchEnvironment.outcome.avg,
                obp: pitchEnvironment.outcome.obp,
                slg: pitchEnvironment.outcome.slg,
                ops: pitchEnvironment.outcome.ops,
                babip: pitchEnvironment.outcome.babip,

                homeRunPercent: pitchEnvironment.outcome.homeRunPercent,
                doublePercent: pitchEnvironment.outcome.doublePercent,
                triplePercent: pitchEnvironment.outcome.triplePercent,
                singlePercent: Math.max(0, pitchEnvironment.outcome.avg - pitchEnvironment.outcome.doublePercent - pitchEnvironment.outcome.triplePercent - pitchEnvironment.outcome.homeRunPercent),

                groundBallPercent: pitchEnvironment.battedBall.contactRollInput.groundball / 100,
                flyBallPercent: pitchEnvironment.battedBall.contactRollInput.flyBall / 100,
                ldPercent: pitchEnvironment.battedBall.contactRollInput.lineDrive / 100,

                teamRunsPerGame: pitchEnvironment.team.runsPerGame,
                teamHitsPerGame: pitchEnvironment.team.hitsPerGame,
                teamHomeRunsPerGame: pitchEnvironment.team.homeRunsPerGame,
                teamBBPerGame: pitchEnvironment.team.bbPerGame,
                teamSOPerGame: pitchEnvironment.team.soPerGame
            }

            const diff = {
                inZonePercent: target.inZonePercent - actual.inZonePercent,
                strikePercent: target.strikePercent - actual.strikePercent,
                ballPercent: target.ballPercent - actual.ballPercent,
                swingPercent: target.swingPercent - actual.swingPercent,
                foulContactPercent: target.foulContactPercent - actual.foulContactPercent,
                pitchesPerPA: target.pitchesPerPA - actual.pitchesPerPA,

                swingAtStrikesPercent: target.swingAtStrikesPercent - actual.swingAtStrikesPercent,
                swingAtBallsPercent: target.swingAtBallsPercent - actual.swingAtBallsPercent,
                inZoneContactPercent: target.inZoneContactPercent - actual.inZoneContactPercent,
                outZoneContactPercent: target.outZoneContactPercent - actual.outZoneContactPercent,

                avg: target.avg - actual.avg,
                obp: target.obp - actual.obp,
                slg: target.slg - actual.slg,
                ops: target.ops - actual.ops,
                babip: target.babip - actual.babip,

                singlePercent: target.singlePercent - actual.singlePercent,
                doublePercent: target.doublePercent - actual.doublePercent,
                triplePercent: target.triplePercent - actual.triplePercent,
                homeRunPercent: target.homeRunPercent - actual.homeRunPercent,

                groundBallPercent: target.groundBallPercent - actual.groundBallPercent,
                flyBallPercent: target.flyBallPercent - actual.flyBallPercent,
                ldPercent: target.ldPercent - actual.ldPercent,

                teamRunsPerGame: target.teamRunsPerGame - actual.teamRunsPerGame,
                teamHitsPerGame: target.teamHitsPerGame - actual.teamHitsPerGame,
                teamHomeRunsPerGame: target.teamHomeRunsPerGame - actual.teamHomeRunsPerGame,
                teamBBPerGame: target.teamBBPerGame - actual.teamBBPerGame,
                teamSOPerGame: target.teamSOPerGame - actual.teamSOPerGame
            }

            const score =
                Math.abs(diff.pitchesPerPA) * 40 +
                Math.abs(diff.swingPercent) * 300 +
                Math.abs(diff.swingAtStrikesPercent) * 260 +
                Math.abs(diff.swingAtBallsPercent) * 260 +
                Math.abs(diff.inZoneContactPercent) * 320 +
                Math.abs(diff.outZoneContactPercent) * 320 +
                Math.abs(diff.foulContactPercent) * 140 +
                Math.abs(diff.avg) * 180 +
                Math.abs(diff.obp) * 180 +
                Math.abs(diff.slg) * 180 +
                Math.abs(diff.babip) * 160 +
                Math.abs(diff.homeRunPercent) * 120 +
                Math.abs(diff.teamRunsPerGame) * 20 +
                Math.abs(diff.teamHitsPerGame) * 14 +
                Math.abs(diff.teamHomeRunsPerGame) * 12 +
                Math.abs(diff.teamBBPerGame) * 10 +
                Math.abs(diff.teamSOPerGame) * 10

            return { actual, target, diff, score }
        }

        const isPitchEnvironmentCloseEnough = (diff: any): boolean => {
            return (
                Math.abs(diff.pitchesPerPA) <= 0.03 &&
                Math.abs(diff.swingPercent) <= 0.005 &&
                Math.abs(diff.swingAtStrikesPercent) <= 0.0075 &&
                Math.abs(diff.swingAtBallsPercent) <= 0.0075 &&
                Math.abs(diff.inZoneContactPercent) <= 0.010 &&
                Math.abs(diff.outZoneContactPercent) <= 0.010 &&
                Math.abs(diff.foulContactPercent) <= 0.008 &&
                Math.abs(diff.avg) <= 0.008 &&
                Math.abs(diff.obp) <= 0.008 &&
                Math.abs(diff.slg) <= 0.010 &&
                Math.abs(diff.babip) <= 0.010 &&
                Math.abs(diff.teamRunsPerGame) <= 0.15 &&
                Math.abs(diff.teamHitsPerGame) <= 0.15 &&
                Math.abs(diff.teamHomeRunsPerGame) <= 0.08 &&
                Math.abs(diff.teamBBPerGame) <= 0.10 &&
                Math.abs(diff.teamSOPerGame) <= 0.18
            )
        }

        const applyDirectedDiffs = (candidate: PitchEnvironmentTuning, diff: any, iteration: number): PitchEnvironmentTuning => {
            const next: PitchEnvironmentTuning = JSON.parse(JSON.stringify(candidate))
            const decay = Math.max(0.25, 1 - (iteration / 60))

            next.tuning.zoneSwingBase = round(clamp(
                next.tuning.zoneSwingBase + clamp((diff.swingAtStrikesPercent * 120) + (diff.swingPercent * 40), -2.0, 2.0) * decay,
                10,
                80
            ))

            next.tuning.chaseSwingBase = round(clamp(
                next.tuning.chaseSwingBase + clamp((diff.swingAtBallsPercent * 120) + (diff.swingPercent * 20), -2.0, 2.0) * decay,
                0,
                50
            ))

            next.tuning.zoneSwingPerStrike = round(clamp(
                next.tuning.zoneSwingPerStrike + clamp((diff.swingAtStrikesPercent * 45), -1.0, 1.0) * decay,
                0,
                40
            ))

            next.tuning.chaseSwingPerStrike = round(clamp(
                next.tuning.chaseSwingPerStrike + clamp((diff.swingAtBallsPercent * 35), -1.0, 1.0) * decay,
                0,
                30
            ))

            next.tuning.zoneContactBase = round(clamp(
                next.tuning.zoneContactBase + clamp((diff.inZoneContactPercent * 140), -2.0, 2.0) * decay,
                40,
                98
            ))

            next.tuning.chaseContactBase = round(clamp(
                next.tuning.chaseContactBase + clamp((diff.outZoneContactPercent * 140), -2.0, 2.0) * decay,
                20,
                90
            ))

            next.tuning.twoStrikeZoneContactBonus = round(clamp(
                next.tuning.twoStrikeZoneContactBonus + clamp((diff.inZoneContactPercent * 35), -0.5, 0.5) * decay,
                0,
                8
            ))

            next.tuning.twoStrikeChaseContactBonus = round(clamp(
                next.tuning.twoStrikeChaseContactBonus + clamp((diff.outZoneContactPercent * 35), -0.5, 0.5) * decay,
                0,
                8
            ))

            next.tuning.foulRateBase = round(clamp(
                next.tuning.foulRateBase + clamp((diff.foulContactPercent * 90) + (diff.pitchesPerPA * 6), -1.5, 1.5) * decay,
                20,
                80
            ))

            next.tuning.twoStrikeFoulBonus = round(clamp(
                next.tuning.twoStrikeFoulBonus + clamp((diff.pitchesPerPA * 1.25), -0.4, 0.4) * decay,
                0,
                10
            ))

            next.tuning.lineDriveOutToSingleWindow = round(clamp(
                next.tuning.lineDriveOutToSingleWindow + clamp((diff.babip * 450) + (diff.avg * 250), -5, 5) * decay,
                0,
                150
            ))

            next.tuning.lineDriveOutToSingleBoost = round(clamp(
                next.tuning.lineDriveOutToSingleBoost + clamp((diff.babip * 420) + (diff.avg * 220), -5, 5) * decay,
                0,
                150
            ))

            next.tuning.lineDriveOutcomeBoost = round(clamp(
                next.tuning.lineDriveOutcomeBoost + clamp((diff.babip * 90) + (diff.avg * 55), -2.5, 2.5) * decay,
                0,
                60
            ))

            next.tuning.groundballOutcomeBoost = round(clamp(
                next.tuning.groundballOutcomeBoost + clamp((diff.singlePercent * 40) + (diff.teamHitsPerGame * 0.4), -1.0, 1.0) * decay,
                0,
                12
            ))

            next.tuning.groundballDoublePenalty = round(clamp(
                next.tuning.groundballDoublePenalty - clamp((diff.doublePercent * 40), -0.75, 0.75) * decay,
                0,
                20
            ))

            next.tuning.groundballTriplePenalty = round(clamp(
                next.tuning.groundballTriplePenalty - clamp((diff.triplePercent * 60), -0.75, 0.75) * decay,
                0,
                30
            ))

            next.tuning.groundballHRPenalty = round(clamp(
                next.tuning.groundballHRPenalty - clamp((diff.homeRunPercent * 80) + (diff.teamHomeRunsPerGame * 0.5), -1.2, 1.2) * decay,
                0,
                30
            ))

            next.tuning.flyballHRPenalty = round(clamp(
                next.tuning.flyballHRPenalty - clamp((diff.homeRunPercent * 70) + (diff.teamHomeRunsPerGame * 0.5), -1.0, 1.0) * decay,
                0,
                20
            ))

            next.tuning.lineDriveSingleToDoubleFactor = round(clamp(
                next.tuning.lineDriveSingleToDoubleFactor + clamp(((diff.slg - diff.avg) * 1.25), -0.03, 0.03) * decay,
                0,
                1
            ), 3)

            next.tuning.fullPitchQualityBonus = round(clamp(
                next.tuning.fullPitchQualityBonus + clamp((diff.ops * 10), -0.6, 0.6) * decay,
                0,
                30
            ))

            next.tuning.fullFielderDefenseBonus = round(clamp(
                next.tuning.fullFielderDefenseBonus + clamp((diff.babip * 16), -0.4, 0.4) * decay,
                0,
                20
            ))

            return next
        }

        let candidate = seedPitchEnvironmentTuning()
        let bestCandidate: PitchEnvironmentTuning = JSON.parse(JSON.stringify(candidate))
        let bestResult = simulatePitchEnvironmentCandidate(candidate, 50)

        const maxIterations = options.maxIterations ?? 1000
        const gamesPerIteration = options.gamesPerIteration ?? 250

        for (let i = 0; i < maxIterations; i++) {
            if (isPitchEnvironmentCloseEnough(bestResult.diff)) {
                break
            }

            const nextCandidate = applyDirectedDiffs(bestCandidate, bestResult.diff, i)
            const result = simulatePitchEnvironmentCandidate(nextCandidate, gamesPerIteration)

            if (result.score <= bestResult.score) {
                bestResult = result
                bestCandidate = nextCandidate
            } else {
                const softened = applyDirectedDiffs(bestCandidate, {
                    ...bestResult.diff,
                    inZonePercent: bestResult.diff.inZonePercent * 0.5,
                    strikePercent: bestResult.diff.strikePercent * 0.5,
                    ballPercent: bestResult.diff.ballPercent * 0.5,
                    swingPercent: bestResult.diff.swingPercent * 0.5,
                    foulContactPercent: bestResult.diff.foulContactPercent * 0.5,
                    pitchesPerPA: bestResult.diff.pitchesPerPA * 0.5,
                    swingAtStrikesPercent: bestResult.diff.swingAtStrikesPercent * 0.5,
                    swingAtBallsPercent: bestResult.diff.swingAtBallsPercent * 0.5,
                    inZoneContactPercent: bestResult.diff.inZoneContactPercent * 0.5,
                    outZoneContactPercent: bestResult.diff.outZoneContactPercent * 0.5,
                    avg: bestResult.diff.avg * 0.5,
                    obp: bestResult.diff.obp * 0.5,
                    slg: bestResult.diff.slg * 0.5,
                    ops: bestResult.diff.ops * 0.5,
                    babip: bestResult.diff.babip * 0.5,
                    singlePercent: bestResult.diff.singlePercent * 0.5,
                    doublePercent: bestResult.diff.doublePercent * 0.5,
                    triplePercent: bestResult.diff.triplePercent * 0.5,
                    homeRunPercent: bestResult.diff.homeRunPercent * 0.5,
                    groundBallPercent: bestResult.diff.groundBallPercent * 0.5,
                    flyBallPercent: bestResult.diff.flyBallPercent * 0.5,
                    ldPercent: bestResult.diff.ldPercent * 0.5,
                    teamRunsPerGame: bestResult.diff.teamRunsPerGame * 0.5,
                    teamHitsPerGame: bestResult.diff.teamHitsPerGame * 0.5,
                    teamHomeRunsPerGame: bestResult.diff.teamHomeRunsPerGame * 0.5,
                    teamBBPerGame: bestResult.diff.teamBBPerGame * 0.5,
                    teamSOPerGame: bestResult.diff.teamSOPerGame * 0.5
                }, i)

                const softenedResult = simulatePitchEnvironmentCandidate(softened, gamesPerIteration)

                if (softenedResult.score <= bestResult.score) {
                    bestResult = softenedResult
                    bestCandidate = softened
                }
            }
        }

        return bestCandidate
    }

    private mergeHitResults(total: HitResultCount, current: HitResultCount): HitResultCount {
        total = total || {} as HitResultCount
        current = current || {} as HitResultCount

        for (const key of Object.keys(current)) {
            const typedKey = key as keyof HitResultCount

            if (typeof current[typedKey] === "number") {
                ;(total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
            }
        }

        return total
    }

    private mergePitchResults(total: PitchResultCount, current: PitchResultCount): PitchResultCount {
        total = total || {} as PitchResultCount
        current = current || {} as PitchResultCount

        for (const key of Object.keys(current)) {
            const typedKey = key as keyof PitchResultCount

            if (typeof current[typedKey] === "number") {
                ;(total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
            }
        }

        return total
    }

    private buildBaselinePlayer(id: string, position: Position): Player {
        return {
            _id: id,
            firstName: "Baseline",
            lastName: id,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: position,
            zodiacSign: "Aries",
            throws: Handedness.R,
            hits: Handedness.R,
            isRetired: false,
            stamina: 100,
            overallRating: 100,
            pitchRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                power: 100,
                vsL: { control: 100, movement: 100 },
                vsR: { control: 100, movement: 100 },
                pitches: [PitchType.FF, PitchType.CU, PitchType.SL, PitchType.FO]
            },
            hittingRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                speed: 100,
                steals: 100,
                arm: 100,
                defense: 100,
                vsL: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 },
                vsR: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 }
            },
            potentialOverallRating: 100,
            potentialPitchRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                power: 100,
                vsL: { control: 100, movement: 100 },
                vsR: { control: 100, movement: 100 },
                pitches: [PitchType.FF, PitchType.CU, PitchType.SL, PitchType.FO]
            },
            potentialHittingRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                speed: 100,
                steals: 100,
                arm: 100,
                defense: 100,
                vsL: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 },
                vsR: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 }
            },
            age: 27
        } as Player
    }

    private buildBaselinePlayers(): Player[] {
        return [
            this.buildBaselinePlayer("p", Position.PITCHER),
            this.buildBaselinePlayer("c", Position.CATCHER),
            this.buildBaselinePlayer("1b", Position.FIRST_BASE),
            this.buildBaselinePlayer("2b", Position.SECOND_BASE),
            this.buildBaselinePlayer("3b", Position.THIRD_BASE),
            this.buildBaselinePlayer("ss", Position.SHORTSTOP),
            this.buildBaselinePlayer("lf", Position.LEFT_FIELD),
            this.buildBaselinePlayer("cf", Position.CENTER_FIELD),
            this.buildBaselinePlayer("rf", Position.RIGHT_FIELD)
        ]
    }

    private buildBaselineLineup(players: Player[]): Lineup {
        const pitcher = players.find(p => p.primaryPosition === Position.PITCHER)!

        return {
            order: players.map(p => ({
                _id: p._id,
                position: p.primaryPosition
            })),
            rotation: new Array(5).fill(0).map(() => ({
                _id: pitcher._id,
                stamina: 1
            }))
        } as Lineup
    }

}


const ALL_PITCH_ZONES: readonly PitchZone[] = [
  PitchZone.LOW_AWAY, PitchZone.LOW_MIDDLE, PitchZone.LOW_INSIDE,
  PitchZone.MID_AWAY, PitchZone.MID_MIDDLE, PitchZone.MID_INSIDE,
  PitchZone.HIGH_AWAY, PitchZone.HIGH_MIDDLE, PitchZone.HIGH_INSIDE,
] as const

export {
    SimService, PlayerChange, Rolls, AtBatInfo, PlayerImporter
}


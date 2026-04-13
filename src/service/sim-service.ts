import { HomeAway, Position, Handedness, PitchType, PitchCall, SwingResult, PlayResult, Contact, ShallowDeep, OfficialPlayResult, BaseResult, DefenseCreditType, OfficialRunnerResult, PitchZone, ThrowResult } from "./enums.js"
import { StartGameCommand, GamePlayer, MatchupHandedness, Score, RunnerResult, DefensiveCredit, PitchLog, HalfInning, UpcomingMatchup, RunnerEvent, HitterChange, PitcherChange, SimPitchCommand, SimPitchResult, InningEndingEvent, Pitch, RollChart, Game, HitResultCount, HittingRatings, LeagueAverage, Lineup, PitchCount, PitchRatings, PitchResultCount, Play, Player, RotationPitcher, RunnerThrowCommand, StolenBaseByCount, Team, TeamInfo, ThrowRoll } from "./interfaces.js"
import { RollChartService } from "./roll-chart-service.js"


const APPLY_PLAYER_CHANGES = true
const PLAYER_CHANGE_SCALE = 0.75
const STANDARD_INNINGS = 9

const MIN_CHANGE = -.5
const MAX_CHANGE = .5


const DEFAULT_SEASON = 2025


class SimService {

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
        game.leagueAverages = command.leagueAverages //?? PlayerImporterService.pitchEnvironmentTargetToLeagueAverage(PlayerImporterService.getPitchEnvironmentTargetForSeason(DEFAULT_SEASON))

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
        const behavior = leagueAverage.swing.behaviorByCount?.find(b => b.balls === pitchCount.balls && b.strikes === pitchCount.strikes)

        let swingRate = inZone
            ? (behavior?.zoneSwingPercent ?? leagueAverage.swing.zoneSwingBase)
            : (behavior?.chaseSwingPercent ?? leagueAverage.swing.chaseSwingBase)

        if (inZone) {
            swingRate += pitchQualityChange * t.pitchQualityZoneSwingEffect * -1

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * t.disciplineZoneSwingEffect
            }
        } else {
            swingRate += pitchQualityChange * t.pitchQualityChaseSwingEffect

            if (APPLY_PLAYER_CHANGES) {
                swingRate += hitterChange.plateDisiplineChange * t.disciplineChaseSwingEffect * -1
            }
        }

        swingRate = Math.max(0, Math.min(100, swingRate))

        let die = Rolls.getRollUnrounded(gameRNG, 0, 100)

        if (die < swingRate) {

            let swingContactRate = inZone
                ? (behavior?.zoneContactPercent ?? leagueAverage.swing.zoneContactBase)
                : (behavior?.chaseContactPercent ?? leagueAverage.swing.chaseContactBase)

            swingContactRate += pitchQualityChange * t.pitchQualityContactEffect * -1

            if (APPLY_PLAYER_CHANGES) {
                swingContactRate += hitterChange.contactChange * t.contactSkillEffect * -1
            }

            swingContactRate = Math.max(0, Math.min(100, swingContactRate))

            let die2 = Rolls.getRollUnrounded(gameRNG, 0, 100)

            if (die2 < swingContactRate) {

                let foulRate = behavior?.foulContactPercent ?? leagueAverage.foulRate
                foulRate = Math.max(0, Math.min(100, foulRate))

                let die3 = Rolls.getRollUnrounded(gameRNG, 0, 100)

                if (die3 < foulRate) {
                    return SwingResult.FOUL
                }

                return SwingResult.FAIR
            }

            return SwingResult.STRIKE
        }

        return SwingResult.NO_SWING
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



const _getAverage = (array: number[]) => {
    return array.reduce((a, b) => a + b) / array.length
}


export {
    SimService, PlayerChange, Rolls, AtBatInfo, SimRolls, Matchup, RunnerActions, GameInfo, GamePlayers
}
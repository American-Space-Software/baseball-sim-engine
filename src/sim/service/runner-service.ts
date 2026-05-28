import { getAverage } from "../util.js"
import { BaseResult, Contact, DefenseCreditType, OfficialRunnerResult, PlayResult, Position, ShallowDeep, ThrowResult } from "./enums.js"
import { DefensiveCredit, GamePlayer, InningEndingEvent, PitchCount, PitchEnvironmentTarget, RunnerEvent, RunnerResult, RunnerThrowCommand, SimPitchCommand, SimPitchResult, StolenBaseByCount, TeamInfo, ThrowRoll } from "./interfaces.js"
import { AtBatInfo, PlayerChange, Rolls, SimRolls } from "./sim-service.js"

const PLAYER_CHANGE_SCALE = 0.75


class RunnerService {

    constructor(
        private gameRolls:SimRolls
    ) {}


    clearRunners(team:TeamInfo) {
        team.runner1BId = undefined
        team.runner2BId = undefined
        team.runner3BId = undefined
    }

    getTotalOuts(runnerEvents: RunnerEvent[]) {
        return runnerEvents.filter( re => re?.movement?.isOut == true).length
    }

    validateInningOver( allEvents:RunnerEvent[]) {

        if ( this.getTotalOuts( allEvents ) >= 3 ) {
            throw new InningEndingEvent()
        }

        return false
    }

    getThrowCount(runnerEvents:RunnerEvent[]) : number  {
        return runnerEvents.filter( re => re?.throw != undefined).length
    }   

    filterNonEvents(runnerEvents:RunnerEvent[], hitter:GamePlayer) {
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

            this.validateInningOver(allEvents)

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

            if (this.getThrowCount(command.runnerEvents) < 1) {
    
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

                    this.runnerIsOut(command.runnerResult, command.allEvents, command.defensiveCredits, throwTo, command.runnerEvent, this.getTotalOuts(command.runnerEvents), command.end)

                } else {

                    //Runner is safe. Move runner to base.
                    this.runnerToBase(command.runnerResult, command.runnerEvent, command.start, command.end, command.eventType, command.isForce)

                    //Was there an error? Lowest rolls
                    if (throwRoll.roll < 10) {

                        command.runnerEvent.isError = true

                        let roll = throwRoll.roll

                        //Was it on the throw or on the catch?
                        let armChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, getAverage([command.throwFrom.hittingRatings.arm, command.throwFrom.hittingRatings.defense]))
                        let receivingChange = PlayerChange.getChange(command.pitchEnvironmentTarget.avgRating, command.throwFrom.hittingRatings.defense)

                        roll = throwRoll.roll + (throwRoll.roll * (armChange * PLAYER_CHANGE_SCALE)) - (throwRoll.roll * (receivingChange * PLAYER_CHANGE_SCALE))


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

                        command.runnerEvents.push(...this.filterNonEvents(errorEvents, undefined))

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
        const stealAttemptAggressionScale = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.running?.stealAttemptAggressionScale ?? 0
        const stealAttemptAggressionMultiplier = Math.max(0, 1 + stealAttemptAggressionScale)

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

                    let greenLightAttempt = effectiveAttempt * successScale * stealAttemptAggressionMultiplier
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
        return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerSpeedChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerStealsChange * PLAYER_CHANGE_SCALE)), 0, 99)


    }

    getChanceRunnerSafe(pitchEnvironmentTarget:PitchEnvironmentTarget, armRating:number, runnerSpeed:number, defaultSuccess:number) {

        let fielderChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, armRating)
        let runnerChange = PlayerChange.getChange(pitchEnvironmentTarget.avgRating, runnerSpeed)

        //Take the default success rate and apply the fielder and runner's changes.
        //Return the % chance that the runner is out.

        return this.applyMinMaxToNumber(Math.round(defaultSuccess - (defaultSuccess * fielderChange * PLAYER_CHANGE_SCALE) + (defaultSuccess * runnerChange  * PLAYER_CHANGE_SCALE)), 0, 99)


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
        const advancementAggressionScale = pitchEnvironmentTarget.pitchEnvironmentTuning?.tuning?.running?.advancementAggressionScale ?? 0
        const advancementMultiplier = Math.max(0, 1 + advancementAggressionScale)

        const clampRate = (value: number | undefined): number => {
            return Math.max(0, Math.min(1, value ?? 0))
        }

        const shouldAdvance = (rate: number | undefined): boolean => {
            return Rolls.getRollUnrounded(gameRNG, 0, 1) < clampRate(clampRate(rate) * advancementMultiplier)
        }

        const getMinimumSafeChance = (minimumSafeChance: number): number => {
            const adjusted = minimumSafeChance - (advancementAggressionScale * 5)
            return Math.max(60, Math.min(99, Math.round(adjusted)))
        }

        const shouldRiskAdvance = (rate: number | undefined, chanceRunnerSafe: number, minimumSafeChance: number): boolean => {
            if (!shouldAdvance(rate)) return false

            const adjustedMinimum = getMinimumSafeChance(minimumSafeChance)

            if (chanceRunnerSafe < adjustedMinimum) {
                const desperationRate = Math.max(0, Math.min(1, (chanceRunnerSafe / adjustedMinimum) * 0.5))
                return Rolls.getRollUnrounded(gameRNG, 0, 1) <= desperationRate
            }

            return true
        }

        const DEFAULT_SUCCESS = 95

        try {
            switch (playResult) {
                case PlayResult.STRIKEOUT:
                    this.runnerIsOut(runnerResult, allEvents, defensiveCredits, defense.players.find(p => p.currentPosition == Position.CATCHER), hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                    break

                case PlayResult.OUT:
                    if (!contact) throw new Error("OUT requires contact")
                    if (!fielderPlayer) throw new Error("OUT requires fielderPlayer")

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToOF(fielderPlayer?.currentPosition) && (shallowDeep == ShallowDeep.DEEP)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallDeep)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
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
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallNormal)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS - 5)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
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
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)

                        if (runnerResult.third && runner3bRA && shouldAdvance(advancement?.runnerOnThirdToHomeOnFlyBallShallow)) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS - 30)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: runner3bRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
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
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        break
                    }

                    if (AtBatInfo.isInAir(contact) && AtBatInfo.isToInfielder(fielderPlayer.currentPosition)) {
                        this.runnerIsOut(runnerResult, allEvents, defensiveCredits, fielderPlayer, hitterRA, this.getTotalOuts(allEvents) + 1, BaseResult.HOME)
                        break
                    }

                    if (contact == Contact.GROUNDBALL) {
                        const outsBeforePlay = this.getTotalOuts(allEvents)

                        if (outsBeforePlay >= 2) {
                            const chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 1)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget,
                                defense,
                                pitcher,
                                offense,
                                pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
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
                                    gameRNG,
                                    runnerResult,
                                    allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner3bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits,
                                    start: BaseResult.THIRD,
                                    end: BaseResult.HOME,
                                    eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget,
                                    pitcher,
                                    offense,
                                    pitchIndex,
                                    defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else if (shouldAdvance(advancement?.runnerOnThirdToHomeOnGroundBall)) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner3B.hittingRatings.speed, DEFAULT_SUCCESS - 30)

                                this.runnerToBaseWithThrow({
                                    gameRNG,
                                    runnerResult,
                                    allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner3bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits,
                                    start: BaseResult.THIRD,
                                    end: BaseResult.HOME,
                                    eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                    eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                    pitchEnvironmentTarget,
                                    pitcher,
                                    offense,
                                    pitchIndex,
                                    defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe,
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
                                    gameRNG,
                                    runnerResult,
                                    allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner2bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits,
                                    start: BaseResult.SECOND,
                                    end: BaseResult.THIRD,
                                    eventType: OfficialRunnerResult.SECOND_TO_THIRD,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget,
                                    pitcher,
                                    offense,
                                    pitchIndex,
                                    defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else if (shouldAdvance(advancement?.runnerOnSecondToThirdOnGroundBall)) {
                                this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, false)
                            }
                        }

                        if (runner1B != undefined) {
                            runner1bRA.isForce = true

                            if (this.getThrowCount(events) < 1) {
                                let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 1)

                                this.runnerToBaseWithThrow({
                                    gameRNG,
                                    runnerResult,
                                    allEvents,
                                    runnerEvents: events,
                                    runnerEvent: runner1bRA,
                                    hitterEvent: hitterRA,
                                    defensiveCredits,
                                    start: BaseResult.FIRST,
                                    end: BaseResult.SECOND,
                                    eventType: OfficialRunnerResult.FIRST_TO_SECOND,
                                    eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                    pitchEnvironmentTarget,
                                    pitcher,
                                    offense,
                                    pitchIndex,
                                    defense,
                                    throwFrom: fielderPlayer,
                                    chanceRunnerSafe,
                                    isForce: true,
                                    isFieldersChoice: true
                                })
                            } else {
                                this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)
                            }
                        }

                        if (this.getThrowCount(events) > 0) {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 75)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget,
                                defense,
                                pitcher,
                                offense,
                                pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
                                isForce: true,
                                isFieldersChoice: true
                            })
                        } else {
                            let chanceRunnerSafe = this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, hitter.hittingRatings.speed, 1)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: hitterRA,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.HOME,
                                end: BaseResult.FIRST,
                                eventType: OfficialRunnerResult.HOME_TO_FIRST,
                                eventTypeOut: OfficialRunnerResult.FORCE_OUT,
                                pitchEnvironmentTarget,
                                defense,
                                pitcher,
                                offense,
                                pitchIndex,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
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
                    const outsBeforePlay = this.getTotalOuts(allEvents)

                    if (runnerResult.third != undefined) {
                        this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined))
                    }

                    if (runnerResult.second != undefined) {
                        this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.THIRD, OfficialRunnerResult.SECOND_TO_THIRD, runnerResult.first != undefined)

                        const chanceRunnerSafe = AtBatInfo.isToOF(fielderPlayer?.currentPosition) && shallowDeep != ShallowDeep.SHALLOW
                            ? this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner2B.hittingRatings.speed, 75)
                            : 0

                        const sendRunnerHome =
                            AtBatInfo.isToOF(fielderPlayer?.currentPosition) &&
                            shallowDeep != ShallowDeep.SHALLOW &&
                            (outsBeforePlay >= 2 || shouldRiskAdvance(advancement?.runnerOnSecondToHomeOnSingle, chanceRunnerSafe, 90))

                        if (sendRunnerHome) {
                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner2bRA))
                            clone.movement.start = BaseResult.THIRD
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.SECOND, OfficialRunnerResult.FIRST_TO_SECOND, true)

                        const chanceRunnerSafe = (fielderPlayer.currentPosition == Position.RIGHT_FIELD || fielderPlayer.currentPosition == Position.CENTER_FIELD)
                            ? this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 75)
                            : 0

                        const sendRunnerToThird =
                            (fielderPlayer.currentPosition == Position.RIGHT_FIELD || fielderPlayer.currentPosition == Position.CENTER_FIELD) &&
                            shouldRiskAdvance(advancement?.runnerOnFirstToThirdOnSingle, chanceRunnerSafe, outsBeforePlay === 1 ? 90 : 95)

                        if (sendRunnerToThird) {
                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
                            clone.movement.start = BaseResult.SECOND
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.SECOND,
                                end: BaseResult.THIRD,
                                eventType: OfficialRunnerResult.SECOND_TO_THIRD,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.FIRST, PlayResult.SINGLE, true)
                    break
                }

                case PlayResult.DOUBLE: {
                    const outsBeforePlay = this.getTotalOuts(allEvents)

                    this.runnerToBase(runnerResult, runner3bRA, BaseResult.THIRD, BaseResult.HOME, OfficialRunnerResult.THIRD_TO_HOME, (runnerResult.first != undefined && runnerResult.second != undefined))
                    this.runnerToBase(runnerResult, runner2bRA, BaseResult.SECOND, BaseResult.HOME, OfficialRunnerResult.SECOND_TO_HOME, false)

                    if (runnerResult.first != undefined) {
                        this.runnerToBase(runnerResult, runner1bRA, BaseResult.FIRST, BaseResult.THIRD, OfficialRunnerResult.FIRST_TO_THIRD, false)

                        const chanceRunnerSafe = shallowDeep != ShallowDeep.SHALLOW
                            ? this.getChanceRunnerSafe(pitchEnvironmentTarget, fielderPlayer.hittingRatings.arm, runner1B.hittingRatings.speed, 60)
                            : 0

                        const sendRunnerHome =
                            shallowDeep != ShallowDeep.SHALLOW &&
                            shouldRiskAdvance(advancement?.runnerOnFirstToHomeOnDouble, chanceRunnerSafe, outsBeforePlay >= 2 ? 95 : 90)

                        if (sendRunnerHome) {
                            let clone: RunnerEvent = JSON.parse(JSON.stringify(runner1bRA))
                            clone.movement.start = BaseResult.THIRD
                            clone.movement.end = undefined

                            events.push(clone)

                            this.runnerToBaseWithThrow({
                                gameRNG,
                                runnerResult,
                                allEvents,
                                runnerEvents: events,
                                runnerEvent: clone,
                                hitterEvent: hitterRA,
                                defensiveCredits,
                                start: BaseResult.THIRD,
                                end: BaseResult.HOME,
                                eventType: OfficialRunnerResult.THIRD_TO_HOME,
                                eventTypeOut: OfficialRunnerResult.TAGGED_OUT,
                                pitchEnvironmentTarget,
                                pitcher,
                                offense,
                                pitchIndex,
                                defense,
                                throwFrom: fielderPlayer,
                                chanceRunnerSafe,
                                isForce: false,
                                isFieldersChoice: false
                            })
                        }
                    }

                    this.runnerToBase(runnerResult, hitterRA, BaseResult.HOME, BaseResult.SECOND, PlayResult.DOUBLE, true)
                    break
                }

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

        return this.filterNonEvents(events, hitter)
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


        command.play.runner.events.push(...this.filterNonEvents(pitchEvents, undefined))


        this.validateInningOver( [].concat(command.halfInningRunnerEvents).concat(command.play.runner.events) )

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

export {
    RunnerService
}
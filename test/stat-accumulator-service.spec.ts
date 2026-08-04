import { strict as assert } from "assert"

import { describe, it } from "mocha"

import { PitchType, Position } from "../src/sim/service/enums.js"
import type { PlayerImportRaw } from "../src/sim/service/interfaces.js"
import { StatAccumulatorService } from "../src/importer/service/stat-accumulator-service.js"
import { StatClassificationService } from "../src/importer/service/stat-classification-service.js"

class StatAccumulatorServiceTestHarness {

    public readonly statClassificationService = new StatClassificationService()
    public readonly service = new StatAccumulatorService(this.statClassificationService)
    public readonly players = new Map<string, PlayerImportRaw>()

    public accumulate(gameData: any, filterPlayerIds?: Set<string>): void {
        this.service.accumulateGameIntoSeasonPlayerImports(
            2026,
            123456,
            gameData,
            this.players,
            filterPlayerIds
        )
    }

    public getPlayer(playerId: string): PlayerImportRaw {
        const player = this.players.get(playerId)

        if (!player) {
            throw new Error(`Expected player ${playerId} to exist.`)
        }

        return player
    }

    public buildPlay(overrides: any = {}): any {
        const play = {
            atBatIndex: 7,
            about: {
                atBatIndex: 7,
                inning: 3,
                halfInning: "top",
                isTopInning: true
            },
            count: {
                balls: 0,
                strikes: 0,
                outs: 0
            },
            matchup: {
                batter: {
                    id: 101,
                    fullName: "Test Batter"
                },
                pitcher: {
                    id: 201,
                    fullName: "Test Pitcher"
                },
                batSide: {
                    code: "R"
                },
                pitchHand: {
                    code: "L"
                }
            },
            result: {
                type: "atBat",
                event: "Single",
                eventType: "single",
                description: "Test Batter singles.",
                rbi: 0,
                awayScore: 0,
                homeScore: 0
            },
            playEvents: [
                {
                    index: 0,
                    playId: "pitch-1",
                    pitchNumber: 1,
                    isPitch: true,
                    type: "pitch",
                    details: {
                        code: "D",
                        isBall: false,
                        isStrike: false,
                        isInPlay: true,
                        call: {
                            code: "D"
                        },
                        type: {
                            code: "FF",
                            description: "Four-Seam Fastball"
                        }
                    },
                    count: {
                        balls: 0,
                        strikes: 0,
                        outs: 0
                    },
                    pitchData: {
                        startSpeed: 96.2,
                        zone: 5,
                        breaks: {
                            breakHorizontal: 5.2,
                            breakVertical: -12.3
                        }
                    },
                    hitData: {
                        launchSpeed: 102.4,
                        launchAngle: 14,
                        totalDistance: 224,
                        trajectory: "line_drive",
                        hardness: "hard",
                        location: "7",
                        coordinates: {
                            coordX: 72.1,
                            coordY: 103.4
                        }
                    }
                }
            ],
            runners: []
        }

        return this.merge(play, overrides)
    }

    private merge(target: any, source: any): any {
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            return source === undefined ? target : source
        }

        const result = {
            ...target
        }

        for (const [key, value] of Object.entries(source)) {
            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                target?.[key] &&
                typeof target[key] === "object" &&
                !Array.isArray(target[key])
            ) {
                result[key] = this.merge(target[key], value)
            } else {
                result[key] = value
            }
        }

        return result
    }
}

describe("StatAccumulatorService", function () {

    it("accumulates hitting and pitching results with handedness splits", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay()
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.firstName, "Test")
        assert.equal(batter.lastName, "Batter")
        assert.equal(batter.primaryRole, "hitter")
        assert.equal(batter.hitting.games, 1)
        assert.equal(batter.hitting.pa, 1)
        assert.equal(batter.hitting.ab, 1)
        assert.equal(batter.hitting.hits, 1)
        assert.equal(batter.hitting.doubles, 0)
        assert.equal(batter.hitting.triples, 0)
        assert.equal(batter.hitting.homeRuns, 0)
        assert.equal(batter.splits.hitting.vsL.pa, 1)
        assert.equal(batter.splits.hitting.vsL.ab, 1)
        assert.equal(batter.splits.hitting.vsL.hits, 1)
        assert.equal(batter.splits.hitting.vsR.pa, 0)

        assert.equal(pitcher.firstName, "Test")
        assert.equal(pitcher.lastName, "Pitcher")
        assert.equal(pitcher.primaryRole, "pitcher")
        assert.equal(pitcher.pitching.games, 1)
        assert.equal(pitcher.pitching.battersFaced, 1)
        assert.equal(pitcher.pitching.hitsAllowed, 1)
        assert.equal(pitcher.pitching.doublesAllowed, 0)
        assert.equal(pitcher.pitching.triplesAllowed, 0)
        assert.equal(pitcher.pitching.homeRunsAllowed, 0)
        assert.equal(pitcher.splits.pitching.vsR.battersFaced, 1)
        assert.equal(pitcher.splits.pitching.vsR.hitsAllowed, 1)
        assert.equal(pitcher.splits.pitching.vsL.battersFaced, 0)
    })

    it("does not count walks as at-bats", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    result: {
                        event: "Walk",
                        eventType: "walk"
                    },
                    playEvents: [
                        {
                            index: 0,
                            isPitch: true,
                            details: {
                                code: "B",
                                isBall: true,
                                isStrike: false,
                                isInPlay: false,
                                call: {
                                    code: "B"
                                },
                                type: {
                                    code: "FF"
                                }
                            },
                            count: {
                                balls: 1,
                                strikes: 0,
                                outs: 0
                            },
                            pitchData: {
                                startSpeed: 95,
                                zone: 11,
                                breaks: {
                                    breakHorizontal: 4,
                                    breakVertical: -10
                                }
                            }
                        }
                    ]
                })
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.hitting.pa, 1)
        assert.equal(batter.hitting.ab, 0)
        assert.equal(batter.hitting.bb, 1)
        assert.equal(batter.splits.hitting.vsL.pa, 1)
        assert.equal(batter.splits.hitting.vsL.ab, 0)
        assert.equal(batter.splits.hitting.vsL.bb, 1)

        assert.equal(pitcher.pitching.battersFaced, 1)
        assert.equal(pitcher.pitching.bbAllowed, 1)
        assert.equal(pitcher.splits.pitching.vsR.bbAllowed, 1)
    })

    it("accumulates pitch selection, swing, contact, and count behavior", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    playEvents: [
                        {
                            index: 0,
                            isPitch: true,
                            details: {
                                code: "C",
                                isBall: false,
                                isStrike: true,
                                isInPlay: false,
                                call: {
                                    code: "C"
                                },
                                type: {
                                    code: "FF"
                                }
                            },
                            count: {
                                balls: 0,
                                strikes: 1,
                                outs: 0
                            },
                            pitchData: {
                                startSpeed: 95,
                                zone: 5,
                                breaks: {
                                    breakHorizontal: 4,
                                    breakVertical: -10
                                }
                            }
                        },
                        {
                            index: 1,
                            isPitch: true,
                            details: {
                                code: "S",
                                isBall: false,
                                isStrike: true,
                                isInPlay: false,
                                call: {
                                    code: "S"
                                },
                                type: {
                                    code: "SL"
                                }
                            },
                            count: {
                                balls: 0,
                                strikes: 2,
                                outs: 0
                            },
                            pitchData: {
                                startSpeed: 87,
                                zone: 11,
                                breaks: {
                                    breakHorizontal: 8,
                                    breakVertical: -3
                                }
                            }
                        },
                        {
                            index: 2,
                            isPitch: true,
                            details: {
                                code: "D",
                                isBall: false,
                                isStrike: false,
                                isInPlay: true,
                                call: {
                                    code: "D"
                                },
                                type: {
                                    code: "FF"
                                }
                            },
                            count: {
                                balls: 0,
                                strikes: 2,
                                outs: 0
                            },
                            pitchData: {
                                startSpeed: 97,
                                zone: 5,
                                breaks: {
                                    breakHorizontal: 6,
                                    breakVertical: -12
                                }
                            },
                            hitData: {
                                launchSpeed: 100,
                                launchAngle: 12,
                                totalDistance: 210,
                                trajectory: "line_drive",
                                hardness: "hard",
                                location: "7",
                                coordinates: {
                                    coordX: 70,
                                    coordY: 100
                                }
                            }
                        }
                    ]
                })
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.hitting.pitchesSeen, 3)
        assert.equal(batter.hitting.strikesSeen, 3)
        assert.equal(batter.hitting.swings, 2)
        assert.equal(batter.hitting.swingAtStrikes, 1)
        assert.equal(batter.hitting.swingAtBalls, 1)
        assert.equal(batter.hitting.calledStrikes, 1)
        assert.equal(batter.hitting.swingingStrikes, 1)
        assert.equal(batter.hitting.inZonePitches, 2)
        assert.equal(batter.hitting.inZoneContact, 1)
        assert.equal(batter.hitting.outZoneContact, 0)
        assert.equal(batter.hitting.ballsInPlay, 1)

        assert.deepEqual(
            batter.hitting.inZoneByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 0),
            {
                balls: 0,
                strikes: 0,
                inZone: 1,
                total: 1
            }
        )

        assert.deepEqual(
            batter.hitting.inZoneByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 1),
            {
                balls: 0,
                strikes: 1,
                inZone: 0,
                total: 1
            }
        )

        assert.deepEqual(
            batter.hitting.inZoneByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 2),
            {
                balls: 0,
                strikes: 2,
                inZone: 1,
                total: 1
            }
        )

        const zeroZeroBehavior = batter.hitting.behaviorByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 0)
        const zeroOneBehavior = batter.hitting.behaviorByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 1)
        const zeroTwoBehavior = batter.hitting.behaviorByCount.find(bucket => bucket.balls === 0 && bucket.strikes === 2)

        assert.equal(zeroZeroBehavior?.zonePitches, 1)
        assert.equal(zeroZeroBehavior?.zoneSwings, 0)
        assert.equal(zeroOneBehavior?.chasePitches, 1)
        assert.equal(zeroOneBehavior?.chaseSwings, 1)
        assert.equal(zeroOneBehavior?.chaseMisses, 1)
        assert.equal(zeroTwoBehavior?.zonePitches, 1)
        assert.equal(zeroTwoBehavior?.zoneSwings, 1)
        assert.equal(zeroTwoBehavior?.zoneContact, 1)
        assert.equal(zeroTwoBehavior?.zoneBallsInPlay, 1)

        assert.equal(pitcher.pitching.pitchesThrown, 3)
        assert.equal(pitcher.pitching.strikesThrown, 3)
        assert.equal(pitcher.pitching.swingsInduced, 2)
        assert.equal(pitcher.pitching.swingAtStrikesAllowed, 1)
        assert.equal(pitcher.pitching.swingAtBallsAllowed, 1)
        assert.equal(pitcher.pitching.inZoneContactAllowed, 1)
        assert.equal(pitcher.pitching.outZoneContactAllowed, 0)
        assert.equal(pitcher.pitching.ballsInPlayAllowed, 1)

        assert.deepEqual(pitcher.pitching.pitchTypes[PitchType.FF], {
            count: 2,
            totalMph: 192,
            avgMph: 96,
            totalHorizontalBreak: 10,
            avgHorizontalBreak: 5,
            totalVerticalBreak: -22,
            avgVerticalBreak: -11
        })

        assert.deepEqual(pitcher.pitching.pitchTypes[PitchType.SL], {
            count: 1,
            totalMph: 87,
            avgMph: 87,
            totalHorizontalBreak: 8,
            avgHorizontalBreak: 8,
            totalVerticalBreak: -3,
            avgVerticalBreak: -3
        })
    })

    it("accumulates batted-ball physics and location buckets", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay()
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.hitting.ballsInPlay, 1)
        assert.equal(batter.hitting.lineDrives, 1)
        assert.deepEqual(batter.hitting.exitVelocity, {
            count: 1,
            totalExitVelo: 102.4,
            avgExitVelo: 102.4
        })
        assert.deepEqual(batter.hitting.launchAngle, {
            count: 1,
            totalLaunchAngle: 14,
            avgLaunchAngle: 14
        })
        assert.deepEqual(batter.hitting.distance, {
            count: 1,
            totalDistance: 224,
            avgDistance: 224
        })
        assert.deepEqual(batter.hitting.coordinates, {
            count: 1,
            totalCoordX: 72.1,
            avgCoordX: 72.1,
            totalCoordY: 103.4,
            avgCoordY: 103.4
        })
        assert.equal(batter.hitting.battedBallLocation["7"], 1)
        assert.equal(batter.hitting.battedBallHardness.hard, 1)
        assert.equal(batter.splits.hitting.vsL.exitVelocity, 102.4)

        assert.deepEqual((batter.hitting as any).outcomeByEvLa, [
            {
                evBin: 102,
                laBin: 14,
                count: 1,
                out: 0,
                single: 1,
                double: 0,
                triple: 0,
                hr: 0
            }
        ])

        assert.deepEqual((batter.hitting as any).xyByTrajectory, [
            {
                trajectory: "lineDrive",
                xBin: 70,
                yBin: 100,
                count: 1
            }
        ])

        assert.deepEqual((batter.hitting as any).xyByTrajectoryEvLa, [
            {
                trajectory: "lineDrive",
                evBin: 102,
                laBin: 14,
                xBin: 70,
                yBin: 100,
                count: 1
            }
        ])

        assert.deepEqual((batter.hitting as any).sprayByTrajectory, [
            {
                trajectory: "lineDrive",
                sprayBin: 30,
                count: 1
            }
        ])

        assert.deepEqual((batter.hitting as any).sprayByTrajectoryEvLa, [
            {
                trajectory: "lineDrive",
                evBin: 102,
                laBin: 14,
                sprayBin: 30,
                count: 1
            }
        ])

        assert.equal(pitcher.pitching.ballsInPlayAllowed, 1)
        assert.equal(pitcher.pitching.lineDrivesAllowed, 1)
        assert.deepEqual(pitcher.pitching.exitVelocityAllowed, {
            count: 1,
            totalExitVelo: 102.4,
            avgExitVelo: 102.4
        })
        assert.equal(pitcher.pitching.battedBallLocationAllowed["7"], 1)
        assert.equal(pitcher.pitching.battedBallHardnessAllowed.hard, 1)

        assert.deepEqual((pitcher.pitching as any).outcomeAllowedByEvLa, [
            {
                evBin: 102,
                laBin: 14,
                count: 1,
                out: 0,
                single: 1,
                double: 0,
                triple: 0,
                hr: 0
            }
        ])
    })

    it("charges runs to the responsible pitcher", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    runners: [
                        {
                            movement: {
                                originBase: "3B",
                                end: "score",
                                isOut: false
                            },
                            details: {
                                runner: {
                                    id: 301,
                                    fullName: "Scoring Runner"
                                },
                                responsiblePitcher: {
                                    id: 202,
                                    fullName: "Responsible Pitcher"
                                },
                                eventType: "single",
                                isScoringEvent: true,
                                earned: true
                            },
                            credits: []
                        }
                    ]
                })
            ]
        })

        const currentPitcher = harness.getPlayer("201")
        const responsiblePitcher = harness.getPlayer("202")

        assert.equal(currentPitcher.pitching.runsAllowed, 0)
        assert.equal(currentPitcher.pitching.earnedRunsAllowed, 0)

        assert.equal(responsiblePitcher.primaryRole, "pitcher")
        assert.equal(responsiblePitcher.pitching.runsAllowed, 1)
        assert.equal(responsiblePitcher.pitching.earnedRunsAllowed, 1)
        assert.equal(responsiblePitcher.splits.pitching.vsR.runsAllowed, 0)
        assert.equal(responsiblePitcher.splits.pitching.vsR.earnedRunsAllowed, 0)
    })

    it("accumulates stolen-base attempts and catcher results", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    result: {
                        event: "Stolen Base",
                        eventType: "stolen_base_2b"
                    },
                    runners: [
                        {
                            movement: {
                                originBase: "1B",
                                start: "1B",
                                end: "2B",
                                isOut: false
                            },
                            details: {
                                runner: {
                                    id: 301,
                                    fullName: "Test Runner"
                                },
                                eventType: "stolen_base_2b",
                                movementReason: "r_stolen_base"
                            },
                            credits: [
                                {
                                    player: {
                                        id: 401,
                                        fullName: "Test Catcher"
                                    },
                                    credit: "f_assist",
                                    position: {
                                        abbreviation: "C"
                                    }
                                }
                            ]
                        }
                    ]
                })
            ]
        })

        const runner = harness.getPlayer("301")
        const catcher = harness.getPlayer("401")

        assert.equal(runner.running.sb, 1)
        assert.equal(runner.running.cs, 0)
        assert.equal(runner.running.sbAttempts, 1)
        assert.equal(runner.running.sb2B, 1)
        assert.equal(runner.running.sb2BAttempts, 1)

        assert.equal(catcher.fielding.catcherStolenBasesAllowed, 1)
        assert.equal(catcher.fielding.assists, 1)
        assert.equal(catcher.fielding.throwsAttempted, 1)
        assert.equal(catcher.fielding.gamesAtPosition[Position.CATCHER], 1)
    })

    it("accumulates runner advancement opportunities and successes", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    runners: [
                        {
                            movement: {
                                originBase: "1B",
                                end: "3B",
                                isOut: false
                            },
                            details: {
                                runner: {
                                    id: 301,
                                    fullName: "Advancing Runner"
                                },
                                eventType: "single",
                                movementReason: "r_adv_play"
                            },
                            credits: []
                        }
                    ]
                })
            ]
        })

        const runner = harness.getPlayer("301")

        assert.equal(runner.running.firstToThirdOpportunities, 1)
        assert.equal(runner.running.firstToThird, 1)
        assert.equal(runner.running.extraBaseOpportunities, 1)
        assert.equal(runner.running.extraBaseTaken, 1)
    })

    it("accumulates fielding credits and defensive innings", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            liveData: {
                boxscore: {
                    teams: {
                        home: {
                            pitchers: [
                                201
                            ],
                            players: {
                                ID201: {
                                    person: {
                                        id: 201,
                                        fullName: "Test Pitcher"
                                    },
                                    allPositions: [
                                        {
                                            abbreviation: "P"
                                        }
                                    ],
                                    stats: {
                                        pitching: {
                                            gamesPlayed: 1,
                                            gamesStarted: 1
                                        }
                                    }
                                },
                                ID401: {
                                    person: {
                                        id: 401,
                                        fullName: "Test Shortstop"
                                    },
                                    allPositions: [
                                        {
                                            abbreviation: "SS"
                                        }
                                    ],
                                    stats: {
                                        fielding: {}
                                    }
                                }
                            }
                        },
                        away: {
                            pitchers: [],
                            players: {}
                        }
                    }
                },
                plays: {
                    allPlays: [
                        harness.buildPlay({
                            result: {
                                event: "Groundout",
                                eventType: "field_out"
                            },
                            playEvents: [
                                {
                                    index: 0,
                                    isPitch: true,
                                    details: {
                                        code: "D",
                                        isBall: false,
                                        isStrike: false,
                                        isInPlay: true,
                                        call: {
                                            code: "D"
                                        },
                                        type: {
                                            code: "FF"
                                        }
                                    },
                                    count: {
                                        balls: 0,
                                        strikes: 0,
                                        outs: 0
                                    },
                                    pitchData: {
                                        startSpeed: 95,
                                        zone: 5,
                                        breaks: {
                                            breakHorizontal: 5,
                                            breakVertical: -10
                                        }
                                    },
                                    hitData: {
                                        launchSpeed: 88,
                                        launchAngle: -5,
                                        totalDistance: 120,
                                        trajectory: "ground_ball",
                                        hardness: "medium",
                                        location: "6",
                                        coordinates: {
                                            coordX: 90,
                                            coordY: 140
                                        }
                                    }
                                }
                            ],
                            runners: [
                                {
                                    movement: {
                                        originBase: null,
                                        end: null,
                                        isOut: true
                                    },
                                    details: {
                                        runner: {
                                            id: 101,
                                            fullName: "Test Batter"
                                        },
                                        eventType: "field_out"
                                    },
                                    credits: [
                                        {
                                            player: {
                                                id: 401,
                                                fullName: "Test Shortstop"
                                            },
                                            credit: "f_fielded_ball",
                                            position: {
                                                abbreviation: "SS"
                                            }
                                        },
                                        {
                                            player: {
                                                id: 401,
                                                fullName: "Test Shortstop"
                                            },
                                            credit: "f_assist",
                                            position: {
                                                abbreviation: "SS"
                                            }
                                        }
                                    ]
                                }
                            ]
                        })
                    ]
                }
            }
        })

        const pitcher = harness.getPlayer("201")
        const shortstop = harness.getPlayer("401")

        assert.equal(pitcher.pitching.outs, 1)
        assert.equal(pitcher.splits.pitching.vsR.outs, 1)
        assert.equal(pitcher.fielding.inningsAtPosition[Position.PITCHER], 0.333)

        assert.equal(shortstop.fielding.gamesAtPosition[Position.SHORTSTOP], 1)
        assert.equal(shortstop.fielding.inningsAtPosition[Position.SHORTSTOP], 0.333)
        assert.equal(shortstop.fielding.fieldedBalls, 1)
        assert.equal(shortstop.fielding.groundBallsFielded, 1)
        assert.equal(shortstop.fielding.assists, 1)
        assert.equal(shortstop.fielding.chances, 1)
        assert.equal(shortstop.fielding.throwsAttempted, 1)
        assert.equal(shortstop.fielding.successfulThrowOuts, 1)

        assert.equal(shortstop.fielding.positionStats[Position.SHORTSTOP]?.fieldedBalls, 1)
        assert.equal(shortstop.fielding.positionStats[Position.SHORTSTOP]?.groundBallsFielded, 1)
        assert.equal(shortstop.fielding.positionStats[Position.SHORTSTOP]?.assists, 1)
        assert.equal(shortstop.fielding.positionStats[Position.SHORTSTOP]?.throwsAttempted, 1)
        assert.equal(shortstop.fielding.positionStats[Position.SHORTSTOP]?.successfulThrowOuts, 1)
    })

    it("does not accumulate the same plate appearance twice", function () {
        const harness = new StatAccumulatorServiceTestHarness()
        const play = harness.buildPlay()

        harness.accumulate({
            allPlays: [
                play,
                play
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.hitting.pa, 1)
        assert.equal(batter.hitting.hits, 1)
        assert.equal(batter.hitting.pitchesSeen, 1)

        assert.equal(pitcher.pitching.battersFaced, 1)
        assert.equal(pitcher.pitching.hitsAllowed, 1)
        assert.equal(pitcher.pitching.pitchesThrown, 1)
    })

    it("counts a player's hitting and pitching games only once per game", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    atBatIndex: 1,
                    about: {
                        atBatIndex: 1
                    }
                }),
                harness.buildPlay({
                    atBatIndex: 2,
                    about: {
                        atBatIndex: 2
                    }
                })
            ]
        })

        const batter = harness.getPlayer("101")
        const pitcher = harness.getPlayer("201")

        assert.equal(batter.hitting.games, 1)
        assert.equal(batter.hitting.pa, 2)

        assert.equal(pitcher.pitching.games, 1)
        assert.equal(pitcher.pitching.battersFaced, 2)
    })

    it("only accumulates requested players when a filter is supplied", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate(
            {
                allPlays: [
                    harness.buildPlay()
                ]
            },
            new Set([
                "101"
            ])
        )

        assert.equal(harness.players.has("101"), true)
        assert.equal(harness.players.has("201"), false)

        const batter = harness.getPlayer("101")

        assert.equal(batter.hitting.pa, 1)
        assert.equal(batter.hitting.hits, 1)
        assert.equal(batter.hitting.pitchesSeen, 1)
    })

    it("increments pickoff attempts faced for the runner on the targeted base", function () {
        const harness = new StatAccumulatorServiceTestHarness()

        harness.accumulate({
            allPlays: [
                harness.buildPlay({
                    matchup: {
                        postOnFirst: {
                            id: 301
                        }
                    },
                    playEvents: [
                        {
                            index: 0,
                            type: "pickoff",
                            isPitch: false,
                            details: {
                                code: "1"
                            }
                        }
                    ]
                })
            ]
        })

        const runner = harness.getPlayer("301")

        assert.equal(runner.running.pickoffAttemptsFaced, 1)
    })


})
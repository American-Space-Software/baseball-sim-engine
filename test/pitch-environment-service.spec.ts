import { strict as assert } from "assert"

import { describe, it } from "mocha"

import { PitchEnvironmentService } from "../src/importer/service/pitch-environment-service.js"

import type { StatExport } from "baseball-database"
import type { PlayerImportRaw } from "../src/sim/service/interfaces.js"


describe("PitchEnvironmentService", function () {

    describe("getPitchEnvironmentTargetForSeason", function () {

        it("rejects an empty player collection", function () {
            assert.throws(
                () => PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                    2026,
                    new Map(),
                    0.046
                ),
                /No player import rows found for season 2026/
            )
        })

        it("rejects a non-finite home field advantage", function () {
            assert.throws(
                () => PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                    2026,
                    new Map([
                        [
                            "player-a",
                            createPlayer(
                                "player-a"
                            )
                        ]
                    ]),
                    Number.NaN
                ),
                /Invalid home field advantage for season 2026/
            )
        })

        it("builds the current pitch environment target from player imports", function () {
            const target = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                2026,
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ]),
                0.046
            )

            assert.equal(
                target.avgRating,
                100
            )

            assert.equal(
                target.season,
                2026
            )

            assert.equal(
                target.homeFieldAdvantage,
                0.046
            )

            assert.deepEqual(
                target.pitch,
                {
                    inZonePercent: 62.5,
                    strikePercent: 65,
                    ballPercent: 35,
                    swingPercent: 50,
                    pitchesPerPA: 4,
                    inZoneByCount: [
                        {
                            balls: 0,
                            strikes: 0,
                            inZone: 60
                        },
                        {
                            balls: 0,
                            strikes: 1,
                            inZone: 0
                        },
                        {
                            balls: 0,
                            strikes: 2,
                            inZone: 0
                        },
                        {
                            balls: 1,
                            strikes: 0,
                            inZone: 0
                        },
                        {
                            balls: 1,
                            strikes: 1,
                            inZone: 0
                        },
                        {
                            balls: 1,
                            strikes: 2,
                            inZone: 0
                        },
                        {
                            balls: 2,
                            strikes: 0,
                            inZone: 0
                        },
                        {
                            balls: 2,
                            strikes: 1,
                            inZone: 0
                        },
                        {
                            balls: 2,
                            strikes: 2,
                            inZone: 0
                        },
                        {
                            balls: 3,
                            strikes: 0,
                            inZone: 0
                        },
                        {
                            balls: 3,
                            strikes: 1,
                            inZone: 0
                        },
                        {
                            balls: 3,
                            strikes: 2,
                            inZone: 0
                        }
                    ]
                }
            )

            assert.equal(
                target.swing.swingAtStrikesPercent,
                60
            )

            assert.equal(
                target.swing.swingAtBallsPercent,
                33.3
            )

            assert.equal(
                target.swing.inZoneContactPercent,
                80
            )

            assert.equal(
                target.swing.outZoneContactPercent,
                60
            )

            assert.deepEqual(
                target.swing.behaviorByCount[0],
                {
                    balls: 0,
                    strikes: 0,
                    zoneSwingPercent: 50,
                    chaseSwingPercent: 25,
                    zoneContactPercent: 80,
                    chaseContactPercent: 50,
                    foulContactPercent: 27.6,
                    inPlayPercentOfContact: 72.4,
                    inPlayPercentOfFairContact: 100
                }
            )

            assert.deepEqual(
                target.battedBall.contactRollInput,
                {
                    groundball: 43,
                    flyBall: 36,
                    lineDrive: 21
                }
            )

            assert.deepEqual(
                target.battedBall.powerRollInput,
                {
                    out: 643,
                    singles: 214,
                    doubles: 72,
                    triples: 14,
                    hr: 57
                }
            )

            assert.equal(
                target.battedBall.evLaModel.groundBall.count,
                100
            )

            assert.equal(
                target.battedBall.evLaModel.groundBall.evMean,
                90
            )

            assert.equal(
                target.battedBall.evLaModel.groundBall.laMean,
                0
            )

            assert.equal(
                (target.battedBall.outcomeModel.groundBall.out as any).prior,
                0.6
            )

            assert.equal(
                (target.battedBall.outcomeModel.groundBall.single as any).prior,
                0.3
            )

            assert.equal(
                (target.battedBall.sprayModel.groundBall as any).count,
                100
            )

            assert.equal(
                (target.battedBall.sprayModel.groundBall as any).mean,
                0
            )

            assert.equal(
                (target.battedBall.depthModel.groundBall as any).count,
                100
            )

            assert.equal(
                target.battedBall.depthModel.groundBall.mean,
                120
            )

            assert.equal(
                target.running.extraBaseTakenRate,
                0.4
            )

            assert.deepEqual(
                target.running.advancement,
                {
                    runnerOnFirstToThirdOnSingle: 0.5,
                    runnerOnFirstToHomeOnDouble: 0.25,
                    runnerOnSecondToHomeOnSingle: 0.6,
                    runnerOnSecondToHomeOnDouble: 0.7,
                    runnerOnThirdToHomeOnFlyBallShallow: 0.2,
                    runnerOnThirdToHomeOnFlyBallNormal: 0.5,
                    runnerOnThirdToHomeOnFlyBallDeep: 0.8,
                    runnerOnSecondToThirdOnGroundBall: 0.4,
                    runnerOnThirdToHomeOnGroundBall: 0.3
                }
            )

            assert.equal(
                target.running.steal.length,
                12
            )

            assert.deepEqual(
                target.fielderChance.vsR,
                {
                    pitcher: 0,
                    catcher: 0,
                    first: 0,
                    second: 0,
                    third: 0,
                    shortstop: 100,
                    leftField: 0,
                    centerField: 0,
                    rightField: 0
                }
            )

            assert.deepEqual(
                target.fielderChance.vsL,
                target.fielderChance.vsR
            )

            assert.deepEqual(
                target.outcome,
                {
                    avg: 0.278,
                    obp: 0.35,
                    slg: 0.489,
                    ops: 0.839,
                    babip: 0.318,
                    homeRunPercent: 0.04,
                    doublePercent: 0.05,
                    triplePercent: 0.01,
                    bbPercent: 0.08,
                    soPercent: 0.2,
                    hbpPercent: 0.02
                }
            )

            assert.deepEqual(
                target.team,
                {
                    runsPerGame: 4.5,
                    hitsPerGame: 8.33,
                    homeRunsPerGame: 1.33,
                    bbPerGame: 2.67,
                    soPerGame: 6.67,
                    sbPerGame: 0.9,
                    sbAttemptsPerGame: 1.2
                }
            )
        })

        it("builds the current import reference from player imports", function () {
            const target = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                2026,
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ]),
                0.046
            )

            assert.deepEqual(
                {
                    games: target.importReference.hitter.games,
                    pa: target.importReference.hitter.pa,
                    ab: target.importReference.hitter.ab,
                    hits: target.importReference.hitter.hits,
                    doubles: target.importReference.hitter.doubles,
                    triples: target.importReference.hitter.triples,
                    homeRuns: target.importReference.hitter.homeRuns,
                    bb: target.importReference.hitter.bb,
                    so: target.importReference.hitter.so,
                    hbp: target.importReference.hitter.hbp,
                    pitchesSeen: target.importReference.hitter.pitchesSeen
                },
                {
                    games: 162,
                    pa: 1000,
                    ab: 900,
                    hits: 250,
                    doubles: 50,
                    triples: 10,
                    homeRuns: 40,
                    bb: 80,
                    so: 200,
                    hbp: 20,
                    pitchesSeen: 4000
                }
            )

            assert.equal(
                target.importReference.hitter.physics.exitVelocity.count,
                100
            )

            assert.equal(
                target.importReference.hitter.physics.exitVelocity.avg,
                90
            )

            assert.equal(
                target.importReference.hitter.physics.byTrajectory.groundBall.count,
                100
            )

            assert.equal(
                target.importReference.hitter.physics.byTrajectory.groundBall.avgDistance,
                120
            )

            assert.deepEqual(
                {
                    games: target.importReference.pitcher.games,
                    starts: target.importReference.pitcher.starts,
                    battersFaced: target.importReference.pitcher.battersFaced,
                    outs: target.importReference.pitcher.outs,
                    runsAllowed: target.importReference.pitcher.runsAllowed,
                    hitsAllowed: target.importReference.pitcher.hitsAllowed,
                    homeRunsAllowed: target.importReference.pitcher.homeRunsAllowed,
                    bbAllowed: target.importReference.pitcher.bbAllowed,
                    so: target.importReference.pitcher.so
                },
                {
                    games: 32,
                    starts: 32,
                    battersFaced: 1000,
                    outs: 810,
                    runsAllowed: 135,
                    hitsAllowed: 250,
                    homeRunsAllowed: 40,
                    bbAllowed: 80,
                    so: 200
                }
            )

            assert.equal(
                target.importReference.pitcher.physics.velocity.count,
                100
            )

            assert.equal(
                target.importReference.pitcher.physics.velocity.avg,
                95
            )

            assert.equal(
                target.importReference.pitcher.physics.byPitchType.FF.count,
                100
            )

            assert.equal(
                target.importReference.pitcher.physics.byPitchType.FF.avgVelocity,
                95
            )

            assert.deepEqual(
                target.importReference.fielding,
                {
                    errors: 3,
                    assists: 10,
                    putouts: 27,
                    chances: 40,
                    doublePlays: 4,
                    doublePlayOpportunities: 8,
                    outfieldAssists: 2,
                    catcherCaughtStealing: 4,
                    catcherStolenBasesAllowed: 10,
                    passedBalls: 1,
                    throwsAttempted: 20,
                    successfulThrowOuts: 5
                }
            )

            assert.deepEqual(
                target.importReference.running,
                {
                    sb: 27,
                    cs: 9,
                    sbAttempts: 36,
                    timesOnFirst: 300,
                    extraBaseTaken: 40,
                    extraBaseOpportunities: 100
                }
            )

            assert.deepEqual(
                target.importReference.splits.hitting.vsL,
                {
                    pa: 400,
                    ab: 360,
                    hits: 100,
                    doubles: 20,
                    triples: 4,
                    homeRuns: 16,
                    bb: 32,
                    so: 80,
                    hbp: 8,
                    exitVelocity: 90
                }
            )

            assert.deepEqual(
                target.importReference.splits.hitting.vsR,
                {
                    pa: 600,
                    ab: 540,
                    hits: 150,
                    doubles: 30,
                    triples: 6,
                    homeRuns: 24,
                    bb: 48,
                    so: 120,
                    hbp: 12,
                    exitVelocity: 92
                }
            )

            assert.deepEqual(
                target.importReference.splits.pitching.vsL,
                {
                    battersFaced: 400,
                    outs: 324,
                    hitsAllowed: 100,
                    doublesAllowed: 20,
                    triplesAllowed: 4,
                    homeRunsAllowed: 16,
                    bbAllowed: 32,
                    so: 80,
                    hbpAllowed: 8,
                    runsAllowed: 54,
                    earnedRunsAllowed: 50
                }
            )

            assert.deepEqual(
                target.importReference.splits.pitching.vsR,
                {
                    battersFaced: 600,
                    outs: 486,
                    hitsAllowed: 150,
                    doublesAllowed: 30,
                    triplesAllowed: 6,
                    homeRunsAllowed: 24,
                    bbAllowed: 48,
                    so: 120,
                    hbpAllowed: 12,
                    runsAllowed: 81,
                    earnedRunsAllowed: 75
                }
            )
        })

        it("aggregates multiple player imports before deriving the target", function () {
            const onePlayer = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                2026,
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ]),
                0.046
            )

            const twoPlayers = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                2026,
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ],
                    [
                        "player-b",
                        createPlayer(
                            "player-b"
                        )
                    ]
                ]),
                0.046
            )

            assert.deepEqual(
                twoPlayers.pitch,
                onePlayer.pitch
            )

            assert.deepEqual(
                twoPlayers.swing,
                onePlayer.swing
            )

            assert.deepEqual(
                twoPlayers.battedBall.contactRollInput,
                onePlayer.battedBall.contactRollInput
            )

            assert.deepEqual(
                twoPlayers.battedBall.powerRollInput,
                onePlayer.battedBall.powerRollInput
            )

            assert.deepEqual(
                twoPlayers.running,
                onePlayer.running
            )

            assert.deepEqual(
                twoPlayers.fielderChance,
                onePlayer.fielderChance
            )

            assert.deepEqual(
                twoPlayers.outcome,
                onePlayer.outcome
            )

            assert.deepEqual(
                twoPlayers.team,
                onePlayer.team
            )

            assert.equal(
                twoPlayers.battedBall.evLaModel.groundBall.count,
                onePlayer.battedBall.evLaModel.groundBall.count * 2
            )

            assert.equal(
                (twoPlayers.battedBall.sprayModel.groundBall as any).count,
                (onePlayer.battedBall.sprayModel.groundBall as any).count * 2
            )

            assert.equal(
                (twoPlayers.battedBall.depthModel.groundBall as any).count,
                (onePlayer.battedBall.depthModel.groundBall as any).count * 2
            )

            assert.equal(
                twoPlayers.importReference.hitter.physics.exitVelocity.count,
                onePlayer.importReference.hitter.physics.exitVelocity.count * 2
            )

            assert.equal(
                twoPlayers.importReference.pitcher.physics.velocity.count,
                onePlayer.importReference.pitcher.physics.velocity.count * 2
            )

            assert.equal(
                twoPlayers.importReference.pitcher.physics.byPitchType.FF.count,
                onePlayer.importReference.pitcher.physics.byPitchType.FF.count * 2
            )
        })

        it("builds the same target from extracted pitch environment stats", function () {
            const players = new Map([
                [
                    "player-a",
                    createPlayer(
                        "player-a"
                    )
                ],
                [
                    "player-b",
                    createPlayer(
                        "player-b"
                    )
                ]
            ])

            const direct = PitchEnvironmentService.getPitchEnvironmentTargetForSeason(
                2026,
                players,
                0.046
            )

            const stats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                players
            )

            const fromStats = PitchEnvironmentService.getPitchEnvironmentTargetForStats(
                2026,
                stats,
                0.046
            )

            assert.deepEqual(
                fromStats,
                direct
            )
        })

        it("adds pitch environment stats", function () {
            const playerAStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ])
            )

            const playerBStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-b",
                        createPlayer(
                            "player-b"
                        )
                    ]
                ])
            )

            const combined = PitchEnvironmentService.clonePitchEnvironmentStats(
                playerAStats
            )

            PitchEnvironmentService.addPitchEnvironmentStats(
                combined,
                playerBStats
            )

            const expected = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ],
                    [
                        "player-b",
                        createPlayer(
                            "player-b"
                        )
                    ]
                ])
            )

            assert.deepEqual(
                combined,
                expected
            )
        })

        it("subtracts pitch environment stats", function () {
            const playerAStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ])
            )

            const playerBStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-b",
                        createPlayer(
                            "player-b"
                        )
                    ]
                ])
            )

            const combined = PitchEnvironmentService.clonePitchEnvironmentStats(
                playerAStats
            )

            PitchEnvironmentService.addPitchEnvironmentStats(
                combined,
                playerBStats
            )

            PitchEnvironmentService.subtractPitchEnvironmentStats(
                combined,
                playerAStats
            )

            assert.deepEqual(
                combined,
                playerBStats
            )
        })

        it("does not mutate source stats while adding or subtracting", function () {
            const playerAStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-a",
                        createPlayer(
                            "player-a"
                        )
                    ]
                ])
            )

            const playerBStats = PitchEnvironmentService.getPitchEnvironmentStatsForPlayers(
                new Map([
                    [
                        "player-b",
                        createPlayer(
                            "player-b"
                        )
                    ]
                ])
            )

            const originalA = PitchEnvironmentService.clonePitchEnvironmentStats(
                playerAStats
            )

            const originalB = PitchEnvironmentService.clonePitchEnvironmentStats(
                playerBStats
            )

            const combined = PitchEnvironmentService.clonePitchEnvironmentStats(
                playerAStats
            )

            PitchEnvironmentService.addPitchEnvironmentStats(
                combined,
                playerBStats
            )

            PitchEnvironmentService.subtractPitchEnvironmentStats(
                combined,
                playerBStats
            )

            assert.deepEqual(
                playerAStats,
                originalA
            )

            assert.deepEqual(
                playerBStats,
                originalB
            )

            assert.deepEqual(
                combined,
                originalA
            )
        })

        it("builds pitch environment stats directly from a stat export", function () {
            const stats = PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
                2026,
                createPitchEnvironmentStatExport()
            )

            assert.deepEqual(
                {
                    pa: stats.hitterTotals.pa,
                    ab: stats.hitterTotals.ab,
                    hits: stats.hitterTotals.hits,
                    singles: stats.hitterTotals.hits - stats.hitterTotals.doubles - stats.hitterTotals.triples - stats.hitterTotals.homeRuns,
                    doubles: stats.hitterTotals.doubles,
                    triples: stats.hitterTotals.triples,
                    homeRuns: stats.hitterTotals.homeRuns,
                    bb: stats.hitterTotals.bb,
                    so: stats.hitterTotals.so,
                    hbp: stats.hitterTotals.hbp,
                    pitchesSeen: stats.hitterTotals.pitchesSeen,
                    strikesSeen: stats.hitterTotals.strikesSeen,
                    swings: stats.hitterTotals.swings,
                    swingAtStrikes: stats.hitterTotals.swingAtStrikes,
                    inZonePitches: stats.hitterTotals.inZonePitches,
                    inZoneContact: stats.hitterTotals.inZoneContact,
                    ballsInPlay: stats.hitterTotals.ballsInPlay
                },
                {
                    pa: 2,
                    ab: 2,
                    hits: 1,
                    singles: 1,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 0,
                    bb: 0,
                    so: 1,
                    hbp: 0,
                    pitchesSeen: 2,
                    strikesSeen: 2,
                    swings: 2,
                    swingAtStrikes: 2,
                    inZonePitches: 2,
                    inZoneContact: 1,
                    ballsInPlay: 1
                }
            )

            assert.deepEqual(
                {
                    battersFaced: stats.pitcherTotals.battersFaced,
                    hitsAllowed: stats.pitcherTotals.hitsAllowed,
                    doublesAllowed: stats.pitcherTotals.doublesAllowed,
                    triplesAllowed: stats.pitcherTotals.triplesAllowed,
                    homeRunsAllowed: stats.pitcherTotals.homeRunsAllowed,
                    bbAllowed: stats.pitcherTotals.bbAllowed,
                    so: stats.pitcherTotals.so,
                    hbpAllowed: stats.pitcherTotals.hbpAllowed,
                    pitchesThrown: stats.pitcherTotals.pitchesThrown,
                    strikesThrown: stats.pitcherTotals.strikesThrown,
                    swingsInduced: stats.pitcherTotals.swingsInduced,
                    swingAtStrikesAllowed: stats.pitcherTotals.swingAtStrikesAllowed,
                    inZoneContactAllowed: stats.pitcherTotals.inZoneContactAllowed,
                    ballsInPlayAllowed: stats.pitcherTotals.ballsInPlayAllowed
                },
                {
                    battersFaced: 2,
                    hitsAllowed: 1,
                    doublesAllowed: 0,
                    triplesAllowed: 0,
                    homeRunsAllowed: 0,
                    bbAllowed: 0,
                    so: 1,
                    hbpAllowed: 0,
                    pitchesThrown: 2,
                    strikesThrown: 2,
                    swingsInduced: 2,
                    swingAtStrikesAllowed: 2,
                    inZoneContactAllowed: 1,
                    ballsInPlayAllowed: 1
                }
            )

            assert.equal(
                stats.hitterTotals.lineDrives,
                1
            )

            assert.equal(
                stats.pitcherTotals.lineDrivesAllowed,
                1
            )

            assert.equal(
                stats.hittingPhysicsTotals.exitVelocity.count,
                1
            )

            assert.equal(
                stats.hittingPhysicsTotals.exitVelocity.total,
                90
            )

            assert.equal(
                stats.pitchingPhysicsTotals.byPitchType.FF.count,
                2
            )

            assert.equal(
                stats.pitchingPhysicsTotals.byPitchType.FF.totalVelocity,
                190
            )

            assert.deepEqual(
                stats.inZoneByCountMap.get("0-0"),
                {
                    balls: 0,
                    strikes: 0,
                    inZone: 2,
                    total: 2
                }
            )

            assert.deepEqual(
                stats.behaviorByCountMap.get("0-0"),
                {
                    balls: 0,
                    strikes: 0,
                    zonePitches: 2,
                    chasePitches: 0,
                    zoneSwings: 2,
                    chaseSwings: 0,
                    zoneContact: 1,
                    chaseContact: 0,
                    zoneMisses: 1,
                    chaseMisses: 0,
                    zoneFouls: 0,
                    chaseFouls: 0,
                    zoneBallsInPlay: 1,
                    chaseBallsInPlay: 0
                }
            )

            assert.deepEqual(
                stats.outcomeByEvLaMap.get("90:10"),
                {
                    evBin: 90,
                    laBin: 10,
                    count: 1,
                    out: 0,
                    single: 1,
                    double: 0,
                    triple: 0,
                    hr: 0
                }
            )
        })

        it("collapses different players in a stat export into one league aggregate", function () {
            const statExport = createPitchEnvironmentStatExport()

            assert.notEqual(
                statExport.plateAppearances[0].batterId,
                statExport.plateAppearances[1].batterId
            )

            assert.notEqual(
                statExport.plateAppearances[0].pitcherId,
                statExport.plateAppearances[1].pitcherId
            )

            const stats = PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
                2026,
                statExport
            )

            assert.equal(
                stats.hitterTotals.pa,
                2
            )

            assert.equal(
                stats.pitcherTotals.battersFaced,
                2
            )
        })

        it("does not mutate the stat export while building pitch environment stats", function () {
            const statExport = createPitchEnvironmentStatExport()
            const original = structuredClone(
                statExport
            )

            PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
                2026,
                statExport
            )

            assert.deepEqual(
                statExport,
                original
            )
        })

        it("adds and subtracts daily stat export aggregates", function () {
            const dayOne = PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
                2026,
                createPitchEnvironmentStatExport(
                    1001,
                    "2026-07-01"
                )
            )

            const dayTwo = PitchEnvironmentService.getPitchEnvironmentStatsForStatExport(
                2026,
                createPitchEnvironmentStatExport(
                    1002,
                    "2026-07-02"
                )
            )

            const rolling = PitchEnvironmentService.clonePitchEnvironmentStats(
                dayOne
            )

            PitchEnvironmentService.addPitchEnvironmentStats(
                rolling,
                dayTwo
            )

            assert.equal(
                rolling.hitterTotals.pa,
                4
            )

            assert.equal(
                rolling.pitcherTotals.battersFaced,
                4
            )

            assert.equal(
                rolling.hittingPhysicsTotals.exitVelocity.count,
                2
            )

            PitchEnvironmentService.subtractPitchEnvironmentStats(
                rolling,
                dayOne
            )

            assert.deepEqual(
                rolling,
                dayTwo
            )
        })


    })

})


function createPlayer(playerId: string): PlayerImportRaw {
    return {
        playerId,
        firstName: "Test",
        lastName: "Player",
        hitting: {
            games: 162,
            pa: 1000,
            ab: 900,
            runs: 0,
            hits: 250,
            singles: 150,
            doubles: 50,
            triples: 10,
            homeRuns: 40,
            rbi: 0,
            bb: 80,
            so: 200,
            hbp: 20,
            gidp: 0,
            sf: 0,
            groundBalls: 300,
            flyBalls: 200,
            lineDrives: 150,
            popups: 50,
            pitchesSeen: 4000,
            ballsSeen: 1400,
            strikesSeen: 2600,
            swings: 2000,
            swingAtBalls: 500,
            swingAtStrikes: 1500,
            calledStrikes: 1100,
            swingingStrikes: 500,
            inZonePitches: 2500,
            inZoneContact: 1200,
            outZoneContact: 300,
            fouls: 500,
            ballsInPlay: 1000,
            inZoneByCount: [
                {
                    balls: 0,
                    strikes: 0,
                    inZone: 60,
                    total: 100
                }
            ],
            behaviorByCount: [
                {
                    balls: 0,
                    strikes: 0,
                    zonePitches: 60,
                    chasePitches: 40,
                    zoneSwings: 30,
                    chaseSwings: 10,
                    zoneContact: 24,
                    chaseContact: 5,
                    zoneMisses: 6,
                    chaseMisses: 5,
                    zoneFouls: 6,
                    chaseFouls: 2,
                    zoneBallsInPlay: 18,
                    chaseBallsInPlay: 3
                }
            ],
            outcomeByEvLa: [
                {
                    evBin: 90,
                    laBin: 0,
                    count: 100,
                    out: 60,
                    single: 30,
                    double: 5,
                    triple: 3,
                    hr: 2
                }
            ],
            xyByTrajectory: [
                {
                    trajectory: "groundBall",
                    xBin: -10,
                    yBin: 100,
                    count: 100
                }
            ],
            exitVelocity: {
                count: 100,
                totalExitVelo: 9000,
                avgExitVelo: 90
            },
            launchAngle: {
                count: 100,
                totalLaunchAngle: 1200,
                avgLaunchAngle: 12
            },
            distance: {
                count: 100,
                totalDistance: 25000,
                avgDistance: 250
            },
            physicsByTrajectory: {
                groundBall: {
                    exitVelocity: {
                        count: 100,
                        totalExitVelo: 9000,
                        avgExitVelo: 90
                    },
                    launchAngle: {
                        count: 100,
                        totalLaunchAngle: 0,
                        avgLaunchAngle: 0
                    },
                    distance: {
                        count: 100,
                        totalDistance: 12000,
                        avgDistance: 120
                    }
                }
            }
        },
        pitching: {
            games: 32,
            starts: 32,
            battersFaced: 1000,
            outs: 810,
            runsAllowed: 135,
            earnedRunsAllowed: 125,
            hitsAllowed: 250,
            doublesAllowed: 50,
            triplesAllowed: 10,
            homeRunsAllowed: 40,
            bbAllowed: 80,
            so: 200,
            hbpAllowed: 20,
            groundBallsAllowed: 300,
            flyBallsAllowed: 200,
            lineDrivesAllowed: 150,
            popupsAllowed: 50,
            pitchesThrown: 4000,
            ballsThrown: 1400,
            strikesThrown: 2600,
            swingsInduced: 2000,
            swingAtBallsAllowed: 500,
            swingAtStrikesAllowed: 1500,
            inZoneContactAllowed: 1200,
            outZoneContactAllowed: 300,
            foulsAllowed: 500,
            ballsInPlayAllowed: 1000,
            pitchTypes: {
                FF: {
                    count: 100,
                    totalMph: 9500,
                    avgMph: 95,
                    totalHorizontalBreak: 500,
                    avgHorizontalBreak: 5,
                    totalVerticalBreak: 1200,
                    avgVerticalBreak: 12
                }
            }
        },
        running: {
            sb: 27,
            cs: 9,
            sbAttempts: 36,
            sb2B: 24,
            cs2B: 8,
            sb2BAttempts: 32,
            sb3B: 3,
            cs3B: 1,
            sb3BAttempts: 4,
            timesOnFirst: 300,
            timesOnSecond: 150,
            timesOnThird: 80,
            firstToThird: 50,
            firstToThirdOpportunities: 100,
            firstToHome: 25,
            firstToHomeOpportunities: 100,
            secondToHomeOnSingle: 60,
            secondToHomeOnSingleOpportunities: 100,
            secondToHomeOnDouble: 70,
            secondToHomeOnDoubleOpportunities: 100,
            extraBaseTaken: 40,
            extraBaseOpportunities: 100,
            pickedOff: 2,
            pickoffAttemptsFaced: 20,
            advancedOnGroundOut: 10,
            advancedOnFlyOut: 15,
            tagUps: 12,
            thirdToHomeOnFlyBallShallow: 20,
            thirdToHomeOnFlyBallShallowOpportunities: 100,
            thirdToHomeOnFlyBallNormal: 50,
            thirdToHomeOnFlyBallNormalOpportunities: 100,
            thirdToHomeOnFlyBallDeep: 80,
            thirdToHomeOnFlyBallDeepOpportunities: 100,
            secondToThirdOnGroundBall: 40,
            secondToThirdOnGroundBallOpportunities: 100,
            thirdToHomeOnGroundBall: 30,
            thirdToHomeOnGroundBallOpportunities: 100,
            heldOnBase: 100
        },
        fielding: {
            errors: 3,
            assists: 10,
            putouts: 27,
            chances: 40,
            doublePlays: 4,
            doublePlayOpportunities: 8,
            outfieldAssists: 2,
            catcherCaughtStealing: 4,
            catcherStolenBasesAllowed: 10,
            passedBalls: 1,
            throwsAttempted: 20,
            successfulThrowOuts: 5,
            groundBallsFielded: 0,
            flyBallsFielded: 0,
            lineDrivesFielded: 0,
            popupsFielded: 0,
            positionStats: {
                SS: {
                    fieldedBalls: 100
                }
            }
        },
        splits: {
            hitting: {
                vsL: {
                    pa: 400,
                    ab: 360,
                    hits: 100,
                    doubles: 20,
                    triples: 4,
                    homeRuns: 16,
                    bb: 32,
                    so: 80,
                    hbp: 8,
                    exitVelocity: 90
                },
                vsR: {
                    pa: 600,
                    ab: 540,
                    hits: 150,
                    doubles: 30,
                    triples: 6,
                    homeRuns: 24,
                    bb: 48,
                    so: 120,
                    hbp: 12,
                    exitVelocity: 92
                }
            },
            pitching: {
                vsL: {
                    battersFaced: 400,
                    outs: 324,
                    runsAllowed: 54,
                    earnedRunsAllowed: 50,
                    hitsAllowed: 100,
                    doublesAllowed: 20,
                    triplesAllowed: 4,
                    homeRunsAllowed: 16,
                    bbAllowed: 32,
                    so: 80,
                    hbpAllowed: 8
                },
                vsR: {
                    battersFaced: 600,
                    outs: 486,
                    runsAllowed: 81,
                    earnedRunsAllowed: 75,
                    hitsAllowed: 150,
                    doublesAllowed: 30,
                    triplesAllowed: 6,
                    homeRunsAllowed: 24,
                    bbAllowed: 48,
                    so: 120,
                    hbpAllowed: 12
                }
            }
        }
    } as unknown as PlayerImportRaw
}

function createPitchEnvironmentStatExport(gamePk = 1001, gameDate = "2026-07-01"): StatExport {
    return {
        games: [
            {
                gamePk,
                gameDate
            }
        ],
        appearances: [
            {
                gamePk,
                playerId: 101,
                teamId: 10,
                appearedAsBatter: true,
                appearedAsPitcher: false,
                startedAsPitcher: false
            },
            {
                gamePk,
                playerId: 201,
                teamId: 20,
                appearedAsBatter: false,
                appearedAsPitcher: true,
                startedAsPitcher: true
            },
            {
                gamePk,
                playerId: 102,
                teamId: 20,
                appearedAsBatter: true,
                appearedAsPitcher: false,
                startedAsPitcher: false
            },
            {
                gamePk,
                playerId: 202,
                teamId: 10,
                appearedAsBatter: false,
                appearedAsPitcher: true,
                startedAsPitcher: true
            }
        ],
        plateAppearances: [
            {
                gamePk,
                atBatIndex: 0,
                inning: 1,
                halfInning: "top",
                isTopInning: true,
                battingTeamId: 10,
                fieldingTeamId: 20,
                batterId: 101,
                pitcherId: 201,
                batSideCode: "R",
                pitchHandCode: "R",
                balls: 0,
                strikes: 0,
                outs: 0,
                resultType: "atBat",
                event: "Single",
                eventType: "single",
                description: "Single",
                rbi: 0,
                awayScore: 0,
                homeScore: 0
            },
            {
                gamePk,
                atBatIndex: 1,
                inning: 1,
                halfInning: "bottom",
                isTopInning: false,
                battingTeamId: 20,
                fieldingTeamId: 10,
                batterId: 102,
                pitcherId: 202,
                batSideCode: "L",
                pitchHandCode: "R",
                balls: 0,
                strikes: 0,
                outs: 0,
                resultType: "atBat",
                event: "Strikeout",
                eventType: "strikeout",
                description: "Strikeout",
                rbi: 0,
                awayScore: 0,
                homeScore: 0
            }
        ],
        pitches: [
            {
                gamePk,
                atBatIndex: 0,
                eventIndex: 0,
                plateAppearanceId: `${gamePk}:0`,
                batterId: 101,
                pitcherId: 201,
                playId: `${gamePk}-0-0`,
                pitchNumber: 1,
                description: "In play, no out",
                code: "X",
                pitchTypeCode: "FF",
                pitchTypeDescription: "Four-Seam Fastball",
                callCode: "X",
                callDescription: "In play, no out",
                isInPlay: true,
                isStrike: true,
                isBall: false,
                isScoringPlay: false,
                hasReview: false,
                balls: 0,
                strikes: 0,
                outs: 0,
                startSpeed: 95,
                endSpeed: 87,
                zone: 5,
                breakHorizontal: 5,
                breakVertical: 12,
                launchSpeed: 90,
                launchAngle: 10,
                totalDistance: 220,
                trajectory: "line_drive",
                hardness: "medium",
                hitLocation: "6",
                hitCoordinateX: 120,
                hitCoordinateY: 80
            },
            {
                gamePk,
                atBatIndex: 1,
                eventIndex: 0,
                plateAppearanceId: `${gamePk}:1`,
                batterId: 102,
                pitcherId: 202,
                playId: `${gamePk}-1-0`,
                pitchNumber: 1,
                description: "Swinging Strike",
                code: "S",
                pitchTypeCode: "FF",
                pitchTypeDescription: "Four-Seam Fastball",
                callCode: "S",
                callDescription: "Swinging Strike",
                isInPlay: false,
                isStrike: true,
                isBall: false,
                isScoringPlay: false,
                hasReview: false,
                balls: 0,
                strikes: 1,
                outs: 0,
                startSpeed: 95,
                endSpeed: 87,
                zone: 5,
                breakHorizontal: 5,
                breakVertical: 12,
                launchSpeed: null,
                launchAngle: null,
                totalDistance: null,
                trajectory: null,
                hardness: null,
                hitLocation: null,
                hitCoordinateX: null,
                hitCoordinateY: null
            }
        ],
        runnerMovements: [],
        fieldingCredits: [],
        defensiveEvents: []
    } as unknown as StatExport
}
import { Position, PitchType, Handedness } from "../../sim/service/enums.js"
import { Game, HitResultCount, HitterStatLine, HittingRatings,  Lineup, PitchEnvironmentTarget, PitchEnvironmentTuning, PitchRatings, PitchResultCount, PitchTypeMovementStat, Player, PlayerFromStatsCommand, PlayerImportBaseline, PlayerImportRaw, RotationPitcher, Team } from "../../sim/service/interfaces.js"
import { SimService } from "../../sim/service/sim-service.js"
import { StatService } from "../../sim/service/stat-service.js"
import { v4 as uuidv4 } from 'uuid'


import { DownloaderService } from "./downloader-service.js"



class PlayerImporterService {

    constructor(
        private simService: SimService, 
        private statService: StatService,
        private downloaderService:DownloaderService
    ) { }

    static getPitchEnvironmentTargetForSeason(season: number, players: Map<string, PlayerImportRaw>): PitchEnvironmentTarget {
        const allPlayers = Array.from(players.values())

        if (allPlayers.length === 0) {
            throw new Error(`No player import rows found for season ${season}`)
        }

        const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0
        const round = (num: number, digits: number): number => Number(num.toFixed(digits))
        const scaleTo = (value: number, fromDenominator: number, toDenominator: number): number => Math.round(safeDiv(value * toDenominator, fromDenominator))
        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

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

            sb2B: 0,
            cs2B: 0,
            sb2BAttempts: 0,

            sb3B: 0,
            cs3B: 0,
            sb3BAttempts: 0,

            timesOnFirst: 0,
            timesOnSecond: 0,
            timesOnThird: 0,

            firstToThird: 0,
            firstToThirdOpportunities: 0,

            firstToHome: 0,
            firstToHomeOpportunities: 0,

            secondToHomeOnSingle: 0,
            secondToHomeOnSingleOpportunities: 0,

            secondToHomeOnDouble: 0,
            secondToHomeOnDoubleOpportunities: 0,

            extraBaseTaken: 0,
            extraBaseOpportunities: 0,

            pickedOff: 0,
            pickoffAttemptsFaced: 0,

            advancedOnGroundOut: 0,
            advancedOnFlyOut: 0,
            tagUps: 0,

            thirdToHomeOnFlyBallShallow: 0,
            thirdToHomeOnFlyBallShallowOpportunities: 0,

            thirdToHomeOnFlyBallNormal: 0,
            thirdToHomeOnFlyBallNormalOpportunities: 0,

            thirdToHomeOnFlyBallDeep: 0,
            thirdToHomeOnFlyBallDeepOpportunities: 0,

            secondToThirdOnGroundBall: 0,
            secondToThirdOnGroundBallOpportunities: 0,

            thirdToHomeOnGroundBall: 0,
            thirdToHomeOnGroundBallOpportunities: 0,

            heldOnBase: 0
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

        const inZoneByCountSeed = this.createInZoneByCountSeed()
        const behaviorByCountSeed = this.createBehaviorByCountSeed()

        const inZoneByCountMap = new Map<string, { balls: number, strikes: number, inZone: number, total: number }>()
        for (const bucket of inZoneByCountSeed) {
            inZoneByCountMap.set(`${bucket.balls}-${bucket.strikes}`, bucket)
        }

        const behaviorByCountMap = new Map<string, { balls: number, strikes: number, zonePitches: number, chasePitches: number, zoneSwings: number, chaseSwings: number, zoneContact: number, chaseContact: number, zoneMisses: number, chaseMisses: number, zoneFouls: number, chaseFouls: number, zoneBallsInPlay: number, chaseBallsInPlay: number }>()
        for (const bucket of behaviorByCountSeed) {
            behaviorByCountMap.set(`${bucket.balls}-${bucket.strikes}`, bucket)
        }

        const outcomeByEvLaMap = new Map<string, { evBin: number, laBin: number, count: number, out: number, single: number, double: number, triple: number, hr: number }>()
        const xyByTrajectoryMap = new Map<string, { trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup", xBin: number, yBin: number, count: number }>()
        const xyByTrajectoryEvLaMap = new Map<string, { trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup", evBin: number, laBin: number, xBin: number, yBin: number, count: number }>()
        const sprayByTrajectoryMap = new Map<string, { trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup", sprayBin: number, count: number }>()
        const sprayByTrajectoryEvLaMap = new Map<string, { trajectory: "groundBall" | "flyBall" | "lineDrive" | "popup", evBin: number, laBin: number, sprayBin: number, count: number }>()

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

        const createMomentStat = () => ({ count: 0, total: 0, totalSquared: 0, avg: 0 })
        const createTrajectoryMoment = () => ({
            count: 0,
            totalExitVelocity: 0,
            totalExitVelocitySquared: 0,
            avgExitVelocity: 0,
            totalLaunchAngle: 0,
            totalLaunchAngleSquared: 0,
            avgLaunchAngle: 0,
            totalDistance: 0,
            totalDistanceSquared: 0,
            avgDistance: 0
        })

        const hittingPhysicsTotals = {
            exitVelocity: createMomentStat(),
            launchAngle: createMomentStat(),
            distance: createMomentStat(),
            byTrajectory: {
                groundBall: createTrajectoryMoment(),
                flyBall: createTrajectoryMoment(),
                lineDrive: createTrajectoryMoment(),
                popup: createTrajectoryMoment()
            }
        }

        const pitchingPhysicsTotals = {
            velocity: createMomentStat(),
            horizontalBreak: createMomentStat(),
            verticalBreak: createMomentStat(),
            byPitchType: {} as Record<string, { count: number, total: number, totalSquared: number, avg: number, totalHorizontalBreak: number, totalHorizontalBreakSquared: number, avgHorizontalBreak: number, totalVerticalBreak: number, totalVerticalBreakSquared: number, avgVerticalBreak: number }>
        }

        for (const player of allPlayers) {
            this.accumulatePitchEnvironmentTotalsForPlayer(player, hitterTotals, pitcherTotals, runningTotals, fieldingTotals, splitHittingTotals, splitPitchingTotals)
            this.accumulatePitchEnvironmentCountBuckets(player, inZoneByCountMap, behaviorByCountMap)
            this.accumulatePitchEnvironmentBattedBallBuckets(player, outcomeByEvLaMap, xyByTrajectoryMap, xyByTrajectoryEvLaMap, sprayByTrajectoryMap, sprayByTrajectoryEvLaMap)
            this.accumulatePitchEnvironmentPhysics(player, hittingPhysicsTotals, pitchingPhysicsTotals)
            this.accumulatePitchEnvironmentPositionSeeds(player, positionSeeds)
        }

        this.finalizePitchEnvironmentPhysicsTotals(hittingPhysicsTotals, pitchingPhysicsTotals)

        const finalizedOutcomeByEvLa = this.finalizeOutcomeByEvLa(outcomeByEvLaMap)

        const finalizedXyByTrajectory = Array.from(xyByTrajectoryMap.values()).sort((a, b) => {
            if (a.trajectory !== b.trajectory) return a.trajectory.localeCompare(b.trajectory)
            if (a.xBin !== b.xBin) return a.xBin - b.xBin
            return a.yBin - b.yBin
        })

        const finalizedXyByTrajectoryEvLa = Array.from(xyByTrajectoryEvLaMap.values()).sort((a, b) => {
            if (a.trajectory !== b.trajectory) return a.trajectory.localeCompare(b.trajectory)
            if (a.evBin !== b.evBin) return a.evBin - b.evBin
            if (a.laBin !== b.laBin) return a.laBin - b.laBin
            if (a.xBin !== b.xBin) return a.xBin - b.xBin
            return a.yBin - b.yBin
        })

        const finalizedSprayByTrajectory = Array.from(sprayByTrajectoryMap.values()).sort((a, b) => {
            if (a.trajectory !== b.trajectory) return a.trajectory.localeCompare(b.trajectory)
            return a.sprayBin - b.sprayBin
        })

        const finalizedSprayByTrajectoryEvLa = Array.from(sprayByTrajectoryEvLaMap.values()).sort((a, b) => {
            if (a.trajectory !== b.trajectory) return a.trajectory.localeCompare(b.trajectory)
            if (a.evBin !== b.evBin) return a.evBin - b.evBin
            if (a.laBin !== b.laBin) return a.laBin - b.laBin
            return a.sprayBin - b.sprayBin
        })

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
                return { key, scaled, floorValue, remainder: scaled - floorValue }
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

        const stealSuccessRate = round(safeDiv(runningTotals.sb, runningTotals.sbAttempts), 3)
        const extraBaseTakenRate = round(safeDiv(runningTotals.extraBaseTaken, runningTotals.extraBaseOpportunities), 3)
        const exactPitchesPerPA = safeDiv(hitterTotals.pitchesSeen, hitterTotals.pa)

        const baseAttempt2BChancePercent = safeDiv(runningTotals.sbAttempts * 0.9, runningTotals.timesOnFirst * exactPitchesPerPA) * 100
        const baseAttempt3BChancePercent = safeDiv(runningTotals.sbAttempts * 0.1, Math.max(1, runningTotals.timesOnFirst * 0.35) * exactPitchesPerPA) * 100

        const attempt2BSuccessPercent = round(stealSuccessRate * 100, 1)
        const attempt3BSuccessPercent = round(clamp((stealSuccessRate + 0.08) * 100, 0, 100), 1)

        const stealCountShape = [
            { balls: 0, strikes: 0, weight: 32 },
            { balls: 0, strikes: 1, weight: 42 },
            { balls: 0, strikes: 2, weight: 18 },
            { balls: 1, strikes: 0, weight: 32 },
            { balls: 1, strikes: 1, weight: 42 },
            { balls: 1, strikes: 2, weight: 20 },
            { balls: 2, strikes: 0, weight: 49 },
            { balls: 2, strikes: 1, weight: 53 },
            { balls: 2, strikes: 2, weight: 25 },
            { balls: 3, strikes: 0, weight: 1 },
            { balls: 3, strikes: 1, weight: 14 },
            { balls: 3, strikes: 2, weight: 29 }
        ]

        const averageStealWeight = safeDiv(stealCountShape.reduce((sum, bucket) => sum + bucket.weight, 0), stealCountShape.length)

        const finalizedStealByCount = stealCountShape.map(bucket => {
            const multiplier = safeDiv(bucket.weight, averageStealWeight)

            return {
                balls: bucket.balls,
                strikes: bucket.strikes,
                attempt2BChance: round(clamp(baseAttempt2BChancePercent * multiplier, 0, 100), 3),
                attempt2BSuccess: attempt2BSuccessPercent,
                attempt3BChance: round(clamp(baseAttempt3BChancePercent * multiplier, 0, 100), 3),
                attempt3BSuccess: attempt3BSuccessPercent
            }
        })

        const finalizedInZoneByCount = inZoneByCountSeed.map(bucket => ({
            balls: bucket.balls,
            strikes: bucket.strikes,
            inZone: round(safeDiv(bucket.inZone, bucket.total) * 100, 0)
        }))

        const finalizedBehaviorByCount = behaviorByCountSeed.map(bucket => {
            const zoneSwingPercent = round(safeDiv(bucket.zoneSwings, bucket.zonePitches) * 100, 1)
            const chaseSwingPercent = round(safeDiv(bucket.chaseSwings, bucket.chasePitches) * 100, 1)
            const zoneContactPercent = round(safeDiv(bucket.zoneContact, bucket.zoneSwings) * 100, 1)
            const chaseContactPercent = round(safeDiv(bucket.chaseContact, bucket.chaseSwings) * 100, 1)
            const totalFouls = bucket.zoneFouls + bucket.chaseFouls
            const totalContact = bucket.zoneContact + bucket.chaseContact
            const foulContactPercent = round(safeDiv(totalFouls, totalContact) * 100, 1)
            const totalBallsInPlay = bucket.zoneBallsInPlay + bucket.chaseBallsInPlay
            const fairContact = Math.max(0, totalContact - totalFouls)
            const inPlayPercentOfContact = round(safeDiv(totalBallsInPlay, totalContact) * 100, 1)
            const inPlayPercentOfFairContact = round(safeDiv(totalBallsInPlay, fairContact) * 100, 1)

            return {
                balls: bucket.balls,
                strikes: bucket.strikes,
                zoneSwingPercent,
                chaseSwingPercent,
                zoneContactPercent,
                chaseContactPercent,
                foulContactPercent,
                inPlayPercentOfContact,
                inPlayPercentOfFairContact
            }
        })

        const measuredInZoneContactPercent = round(safeDiv(hitterTotals.inZoneContact, hitterTotals.swingAtStrikes) * 100, 1)
        const measuredOutZoneContactPercent = round(safeDiv(hitterTotals.outZoneContact, hitterTotals.swingAtBalls) * 100, 1)

        const target: PitchEnvironmentTarget = {
            avgRating: 100,
            season,

            pitch: {
                inZonePercent: round(safeDiv(hitterTotals.inZonePitches, hitterTotals.pitchesSeen) * 100, 1),
                strikePercent: round(safeDiv(hitterTotals.strikesSeen, hitterTotals.pitchesSeen) * 100, 1),
                ballPercent: round(safeDiv(hitterTotals.ballsSeen, hitterTotals.pitchesSeen) * 100, 1),
                swingPercent: round(safeDiv(hitterTotals.swings, hitterTotals.pitchesSeen) * 100, 1),
                pitchesPerPA: round(exactPitchesPerPA, 2),
                inZoneByCount: finalizedInZoneByCount
            },

            swing: {
                swingAtStrikesPercent: round(safeDiv(hitterTotals.swingAtStrikes, hitterTotals.inZonePitches) * 100, 1),
                swingAtBallsPercent: round(safeDiv(hitterTotals.swingAtBalls, hitterTotals.pitchesSeen - hitterTotals.inZonePitches) * 100, 1),
                inZoneContactPercent: measuredInZoneContactPercent,
                outZoneContactPercent: measuredOutZoneContactPercent,
                zoneSwingBase: round(safeDiv(hitterTotals.swingAtStrikes, hitterTotals.inZonePitches) * 100, 1),
                chaseSwingBase: round(safeDiv(hitterTotals.swingAtBalls, hitterTotals.pitchesSeen - hitterTotals.inZonePitches) * 100, 1),
                zoneContactBase: measuredInZoneContactPercent,
                chaseContactBase: measuredOutZoneContactPercent,
                behaviorByCount: finalizedBehaviorByCount
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
                },
                outcomeByEvLa: finalizedOutcomeByEvLa,
                xy: {
                    byTrajectory: finalizedXyByTrajectory,
                    byTrajectoryEvLa: finalizedXyByTrajectoryEvLa
                },
                spray: {
                    byTrajectory: finalizedSprayByTrajectory,
                    byTrajectoryEvLa: finalizedSprayByTrajectoryEvLa
                }
            },

            running: {
                steal: finalizedStealByCount,
                extraBaseTakenRate,
                advancement: {
                    runnerOnFirstToThirdOnSingle: round(safeDiv(runningTotals.firstToThird, runningTotals.firstToThirdOpportunities), 3),
                    runnerOnFirstToHomeOnDouble: round(safeDiv(runningTotals.firstToHome, runningTotals.firstToHomeOpportunities), 3),
                    runnerOnSecondToHomeOnSingle: round(safeDiv(runningTotals.secondToHomeOnSingle, runningTotals.secondToHomeOnSingleOpportunities), 3),
                    runnerOnSecondToHomeOnDouble: round(safeDiv(runningTotals.secondToHomeOnDouble, runningTotals.secondToHomeOnDoubleOpportunities), 3),
                    runnerOnThirdToHomeOnFlyBallShallow: round(safeDiv(runningTotals.thirdToHomeOnFlyBallShallow, runningTotals.thirdToHomeOnFlyBallShallowOpportunities), 3),
                    runnerOnThirdToHomeOnFlyBallNormal: round(safeDiv(runningTotals.thirdToHomeOnFlyBallNormal, runningTotals.thirdToHomeOnFlyBallNormalOpportunities), 3),
                    runnerOnThirdToHomeOnFlyBallDeep: round(safeDiv(runningTotals.thirdToHomeOnFlyBallDeep, runningTotals.thirdToHomeOnFlyBallDeepOpportunities), 3),
                    runnerOnSecondToThirdOnGroundBall: round(safeDiv(runningTotals.secondToThirdOnGroundBall, runningTotals.secondToThirdOnGroundBallOpportunities), 3),
                    runnerOnThirdToHomeOnGroundBall: round(safeDiv(runningTotals.thirdToHomeOnGroundBall, runningTotals.thirdToHomeOnGroundBallOpportunities), 3)
                }
            },

            fielderChance: {
                vsR: derivedFielderChance,
                vsL: derivedFielderChance,
                shallowDeep: {
                    shallow: 20,
                    normal: 60,
                    deep: 20
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
                soPerGame: round(safeDiv(hitterTotals.so, totalTeamGames), 2),
                sbPerGame: round(safeDiv(runningTotals.sb, totalTeamGames), 2),
                sbAttemptsPerGame: round(safeDiv(runningTotals.sbAttempts, totalTeamGames), 2)
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
                    ballsInPlay: scaleTo(hitterTotals.ballsInPlay, hitterTotals.pa, 1000),
                    physics: {
                        exitVelocity: {
                            count: hittingPhysicsTotals.exitVelocity.count,
                            total: hittingPhysicsTotals.exitVelocity.total,
                            totalSquared: hittingPhysicsTotals.exitVelocity.totalSquared,
                            avg: hittingPhysicsTotals.exitVelocity.avg
                        },
                        launchAngle: {
                            count: hittingPhysicsTotals.launchAngle.count,
                            total: hittingPhysicsTotals.launchAngle.total,
                            totalSquared: hittingPhysicsTotals.launchAngle.totalSquared,
                            avg: hittingPhysicsTotals.launchAngle.avg
                        },
                        distance: {
                            count: hittingPhysicsTotals.distance.count,
                            total: hittingPhysicsTotals.distance.total,
                            totalSquared: hittingPhysicsTotals.distance.totalSquared,
                            avg: hittingPhysicsTotals.distance.avg
                        },
                        byTrajectory: {
                            groundBall: { ...hittingPhysicsTotals.byTrajectory.groundBall },
                            flyBall: { ...hittingPhysicsTotals.byTrajectory.flyBall },
                            lineDrive: { ...hittingPhysicsTotals.byTrajectory.lineDrive },
                            popup: { ...hittingPhysicsTotals.byTrajectory.popup }
                        }
                    }
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
                    ballsInPlayAllowed: scaleTo(pitcherTotals.ballsInPlayAllowed, pitcherTotals.battersFaced, 1000),
                    physics: {
                        velocity: {
                            count: pitchingPhysicsTotals.velocity.count,
                            total: pitchingPhysicsTotals.velocity.total,
                            totalSquared: pitchingPhysicsTotals.velocity.totalSquared,
                            avg: pitchingPhysicsTotals.velocity.avg
                        },
                        horizontalBreak: {
                            count: pitchingPhysicsTotals.horizontalBreak.count,
                            total: pitchingPhysicsTotals.horizontalBreak.total,
                            totalSquared: pitchingPhysicsTotals.horizontalBreak.totalSquared,
                            avg: pitchingPhysicsTotals.horizontalBreak.avg
                        },
                        verticalBreak: {
                            count: pitchingPhysicsTotals.verticalBreak.count,
                            total: pitchingPhysicsTotals.verticalBreak.total,
                            totalSquared: pitchingPhysicsTotals.verticalBreak.totalSquared,
                            avg: pitchingPhysicsTotals.verticalBreak.avg
                        },
                        byPitchType: { ...pitchingPhysicsTotals.byPitchType }
                    }
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

    private static createInZoneByCountSeed(): { balls: number, strikes: number, inZone: number, total: number }[] {
        return [
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
    }

    private static createBehaviorByCountSeed(): { balls: number, strikes: number, zonePitches: number, chasePitches: number, zoneSwings: number, chaseSwings: number, zoneContact: number, chaseContact: number, zoneMisses: number, chaseMisses: number, zoneFouls: number, chaseFouls: number, zoneBallsInPlay: number, chaseBallsInPlay: number }[] {
        return [
            { balls: 0, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 0, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 0, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 }
        ]
    }

    private static accumulatePitchEnvironmentTotalsForPlayer(player: PlayerImportRaw, hitterTotals: any, pitcherTotals: any, runningTotals: any, fieldingTotals: any, splitHittingTotals: any, splitPitchingTotals: any): void {
        if (player.hitting) {
            const h = player.hitting
            hitterTotals.pa += h.pa
            hitterTotals.ab += h.ab
            hitterTotals.hits += h.hits
            hitterTotals.doubles += h.doubles
            hitterTotals.triples += h.triples
            hitterTotals.homeRuns += h.homeRuns
            hitterTotals.bb += h.bb
            hitterTotals.so += h.so
            hitterTotals.hbp += h.hbp
            hitterTotals.groundBalls += h.groundBalls
            hitterTotals.flyBalls += h.flyBalls
            hitterTotals.lineDrives += h.lineDrives
            hitterTotals.popups += h.popups
            hitterTotals.pitchesSeen += h.pitchesSeen
            hitterTotals.ballsSeen += h.ballsSeen
            hitterTotals.strikesSeen += h.strikesSeen
            hitterTotals.swings += h.swings
            hitterTotals.swingAtBalls += h.swingAtBalls
            hitterTotals.swingAtStrikes += h.swingAtStrikes
            hitterTotals.calledStrikes += h.calledStrikes
            hitterTotals.swingingStrikes += h.swingingStrikes
            hitterTotals.inZonePitches += h.inZonePitches
            hitterTotals.inZoneContact += h.inZoneContact
            hitterTotals.outZoneContact += h.outZoneContact
            hitterTotals.fouls += h.fouls
            hitterTotals.ballsInPlay += h.ballsInPlay
        }

        if (player.pitching) {
            const p = player.pitching
            pitcherTotals.battersFaced += p.battersFaced
            pitcherTotals.outs += p.outs
            pitcherTotals.hitsAllowed += p.hitsAllowed
            pitcherTotals.doublesAllowed += p.doublesAllowed
            pitcherTotals.triplesAllowed += p.triplesAllowed
            pitcherTotals.homeRunsAllowed += p.homeRunsAllowed
            pitcherTotals.bbAllowed += p.bbAllowed
            pitcherTotals.so += p.so
            pitcherTotals.hbpAllowed += p.hbpAllowed
            pitcherTotals.groundBallsAllowed += p.groundBallsAllowed
            pitcherTotals.flyBallsAllowed += p.flyBallsAllowed
            pitcherTotals.lineDrivesAllowed += p.lineDrivesAllowed
            pitcherTotals.popupsAllowed += p.popupsAllowed
            pitcherTotals.pitchesThrown += p.pitchesThrown
            pitcherTotals.ballsThrown += p.ballsThrown
            pitcherTotals.strikesThrown += p.strikesThrown
            pitcherTotals.swingsInduced += p.swingsInduced
            pitcherTotals.swingAtBallsAllowed += p.swingAtBallsAllowed
            pitcherTotals.swingAtStrikesAllowed += p.swingAtStrikesAllowed
            pitcherTotals.inZoneContactAllowed += p.inZoneContactAllowed
            pitcherTotals.outZoneContactAllowed += p.outZoneContactAllowed
            pitcherTotals.foulsAllowed += p.foulsAllowed
            pitcherTotals.ballsInPlayAllowed += p.ballsInPlayAllowed
        }

        if (player.running) {
            const r = player.running
            runningTotals.sb += r.sb
            runningTotals.cs += r.cs
            runningTotals.sbAttempts += r.sbAttempts

            runningTotals.sb2B += r.sb2B
            runningTotals.cs2B += r.cs2B
            runningTotals.sb2BAttempts += r.sb2BAttempts

            runningTotals.sb3B += r.sb3B
            runningTotals.cs3B += r.cs3B
            runningTotals.sb3BAttempts += r.sb3BAttempts

            runningTotals.timesOnFirst += r.timesOnFirst
            runningTotals.timesOnSecond += r.timesOnSecond
            runningTotals.timesOnThird += r.timesOnThird

            runningTotals.firstToThird += r.firstToThird
            runningTotals.firstToThirdOpportunities += r.firstToThirdOpportunities

            runningTotals.firstToHome += r.firstToHome
            runningTotals.firstToHomeOpportunities += r.firstToHomeOpportunities

            runningTotals.secondToHomeOnSingle += r.secondToHomeOnSingle
            runningTotals.secondToHomeOnSingleOpportunities += r.secondToHomeOnSingleOpportunities

            runningTotals.secondToHomeOnDouble += r.secondToHomeOnDouble
            runningTotals.secondToHomeOnDoubleOpportunities += r.secondToHomeOnDoubleOpportunities

            runningTotals.extraBaseTaken += r.extraBaseTaken
            runningTotals.extraBaseOpportunities += r.extraBaseOpportunities

            runningTotals.pickedOff += r.pickedOff
            runningTotals.pickoffAttemptsFaced += r.pickoffAttemptsFaced

            runningTotals.advancedOnGroundOut += r.advancedOnGroundOut
            runningTotals.advancedOnFlyOut += r.advancedOnFlyOut
            runningTotals.tagUps += r.tagUps

            runningTotals.thirdToHomeOnFlyBallShallow += r.thirdToHomeOnFlyBallShallow
            runningTotals.thirdToHomeOnFlyBallShallowOpportunities += r.thirdToHomeOnFlyBallShallowOpportunities

            runningTotals.thirdToHomeOnFlyBallNormal += r.thirdToHomeOnFlyBallNormal
            runningTotals.thirdToHomeOnFlyBallNormalOpportunities += r.thirdToHomeOnFlyBallNormalOpportunities

            runningTotals.thirdToHomeOnFlyBallDeep += r.thirdToHomeOnFlyBallDeep
            runningTotals.thirdToHomeOnFlyBallDeepOpportunities += r.thirdToHomeOnFlyBallDeepOpportunities

            runningTotals.secondToThirdOnGroundBall += r.secondToThirdOnGroundBall
            runningTotals.secondToThirdOnGroundBallOpportunities += r.secondToThirdOnGroundBallOpportunities

            runningTotals.thirdToHomeOnGroundBall += r.thirdToHomeOnGroundBall
            runningTotals.thirdToHomeOnGroundBallOpportunities += r.thirdToHomeOnGroundBallOpportunities

            runningTotals.heldOnBase += r.heldOnBase
        }

        if (player.fielding) {
            const f = player.fielding
            fieldingTotals.errors += f.errors
            fieldingTotals.assists += f.assists
            fieldingTotals.putouts += f.putouts
            fieldingTotals.chances += f.chances
            fieldingTotals.doublePlays += f.doublePlays
            fieldingTotals.doublePlayOpportunities += f.doublePlayOpportunities
            fieldingTotals.outfieldAssists += f.outfieldAssists
            fieldingTotals.catcherCaughtStealing += f.catcherCaughtStealing
            fieldingTotals.catcherStolenBasesAllowed += f.catcherStolenBasesAllowed
            fieldingTotals.passedBalls += f.passedBalls
            fieldingTotals.throwsAttempted += f.throwsAttempted
            fieldingTotals.successfulThrowOuts += f.successfulThrowOuts
        }

        if (player.splits?.hitting) {
            const vsL = player.splits.hitting.vsL
            const vsR = player.splits.hitting.vsR

            splitHittingTotals.vsL.pa += vsL.pa
            splitHittingTotals.vsL.ab += vsL.ab
            splitHittingTotals.vsL.hits += vsL.hits
            splitHittingTotals.vsL.doubles += vsL.doubles
            splitHittingTotals.vsL.triples += vsL.triples
            splitHittingTotals.vsL.homeRuns += vsL.homeRuns
            splitHittingTotals.vsL.bb += vsL.bb
            splitHittingTotals.vsL.so += vsL.so
            splitHittingTotals.vsL.hbp += vsL.hbp
            splitHittingTotals.vsL.exitVelocityWeighted += vsL.exitVelocity * vsL.pa

            splitHittingTotals.vsR.pa += vsR.pa
            splitHittingTotals.vsR.ab += vsR.ab
            splitHittingTotals.vsR.hits += vsR.hits
            splitHittingTotals.vsR.doubles += vsR.doubles
            splitHittingTotals.vsR.triples += vsR.triples
            splitHittingTotals.vsR.homeRuns += vsR.homeRuns
            splitHittingTotals.vsR.bb += vsR.bb
            splitHittingTotals.vsR.so += vsR.so
            splitHittingTotals.vsR.hbp += vsR.hbp
            splitHittingTotals.vsR.exitVelocityWeighted += vsR.exitVelocity * vsR.pa
        }

        if (player.splits?.pitching) {
            const vsL = player.splits.pitching.vsL
            const vsR = player.splits.pitching.vsR

            splitPitchingTotals.vsL.battersFaced += vsL.battersFaced
            splitPitchingTotals.vsL.outs += vsL.outs
            splitPitchingTotals.vsL.hitsAllowed += vsL.hitsAllowed
            splitPitchingTotals.vsL.doublesAllowed += vsL.doublesAllowed
            splitPitchingTotals.vsL.triplesAllowed += vsL.triplesAllowed
            splitPitchingTotals.vsL.homeRunsAllowed += vsL.homeRunsAllowed
            splitPitchingTotals.vsL.bbAllowed += vsL.bbAllowed
            splitPitchingTotals.vsL.so += vsL.so
            splitPitchingTotals.vsL.hbpAllowed += vsL.hbpAllowed

            splitPitchingTotals.vsR.battersFaced += vsR.battersFaced
            splitPitchingTotals.vsR.outs += vsR.outs
            splitPitchingTotals.vsR.hitsAllowed += vsR.hitsAllowed
            splitPitchingTotals.vsR.doublesAllowed += vsR.doublesAllowed
            splitPitchingTotals.vsR.triplesAllowed += vsR.triplesAllowed
            splitPitchingTotals.vsR.homeRunsAllowed += vsR.homeRunsAllowed
            splitPitchingTotals.vsR.bbAllowed += vsR.bbAllowed
            splitPitchingTotals.vsR.so += vsR.so
            splitPitchingTotals.vsR.hbpAllowed += vsR.hbpAllowed
        }
    }

    private static accumulatePitchEnvironmentCountBuckets(player: PlayerImportRaw, inZoneByCountMap: Map<string, any>, behaviorByCountMap: Map<string, any>): void {
        this.accumulateInZoneByCountBuckets(player, inZoneByCountMap)
        this.accumulateBehaviorByCountBuckets(player, behaviorByCountMap)
    }

    private static accumulatePitchEnvironmentBattedBallBuckets(player: PlayerImportRaw, outcomeByEvLaMap: Map<string, any>, xyByTrajectoryMap: Map<string, any>, xyByTrajectoryEvLaMap: Map<string, any>, sprayByTrajectoryMap: Map<string, any>, sprayByTrajectoryEvLaMap: Map<string, any>): void {

        for (const bucket of player.hitting.outcomeByEvLa ?? []) {
            const key = `${bucket.evBin}:${bucket.laBin}`
            let existing = outcomeByEvLaMap.get(key)
            if (!existing) {
                existing = { ...bucket }
                outcomeByEvLaMap.set(key, existing)
            } else {
                existing.count += bucket.count
                existing.out += bucket.out
                existing.single += bucket.single
                existing.double += bucket.double
                existing.triple += bucket.triple
                existing.hr += bucket.hr
            }
        }

        for (const bucket of player.hitting.xyByTrajectory ?? []) {
            const key = `${bucket.trajectory}:${bucket.xBin}:${bucket.yBin}`
            let existing = xyByTrajectoryMap.get(key)
            if (!existing) {
                existing = { ...bucket }
                xyByTrajectoryMap.set(key, existing)
            } else {
                existing.count += bucket.count
            }
        }

        for (const bucket of player.hitting.xyByTrajectoryEvLa ?? []) {
            const key = `${bucket.trajectory}:${bucket.evBin}:${bucket.laBin}:${bucket.xBin}:${bucket.yBin}`
            let existing = xyByTrajectoryEvLaMap.get(key)
            if (!existing) {
                existing = { ...bucket }
                xyByTrajectoryEvLaMap.set(key, existing)
            } else {
                existing.count += bucket.count
            }
        }

        for (const bucket of player.hitting.sprayByTrajectory ?? []) {
            const key = `${bucket.trajectory}:${bucket.sprayBin}`
            let existing = sprayByTrajectoryMap.get(key)
            if (!existing) {
                existing = { ...bucket }
                sprayByTrajectoryMap.set(key, existing)
            } else {
                existing.count += bucket.count
            }
        }

        for (const bucket of player.hitting.sprayByTrajectoryEvLa ?? []) {
            const key = `${bucket.trajectory}:${bucket.evBin}:${bucket.laBin}:${bucket.sprayBin}`
            let existing = sprayByTrajectoryEvLaMap.get(key)
            if (!existing) {
                existing = { ...bucket }
                sprayByTrajectoryEvLaMap.set(key, existing)
            } else {
                existing.count += bucket.count
            }
        }
    }

    private static accumulatePitchEnvironmentPhysics(player: PlayerImportRaw, hittingPhysicsTotals: any, pitchingPhysicsTotals: any): void {
        const addMomentStat = (target: { count: number, total: number, totalSquared: number, avg: number }, stat?: { count?: number, totalExitVelo?: number, avgExitVelo?: number, totalLaunchAngle?: number, avgLaunchAngle?: number, totalDistance?: number, avgDistance?: number }, totalKey?: "totalExitVelo" | "totalLaunchAngle" | "totalDistance", avgKey?: "avgExitVelo" | "avgLaunchAngle" | "avgDistance"): void => {
            if (!stat || !totalKey || !avgKey) return

            const count = Number(stat.count ?? 0)
            const total = Number(stat[totalKey] ?? 0)
            const avg = Number(stat[avgKey] ?? 0)

            if (count <= 0 || !Number.isFinite(total) || !Number.isFinite(avg)) return

            target.count += count
            target.total += total
            target.totalSquared += count * avg * avg
            target.avg = target.count > 0 ? Number((target.total / target.count).toFixed(3)) : 0
        }

        const addTrajectoryPhysics = (target: { count: number, totalExitVelocity: number, totalExitVelocitySquared: number, avgExitVelocity: number, totalLaunchAngle: number, totalLaunchAngleSquared: number, avgLaunchAngle: number, totalDistance: number, totalDistanceSquared: number, avgDistance: number }, stat?: { exitVelocity?: { count?: number, totalExitVelo?: number, avgExitVelo?: number }, launchAngle?: { count?: number, totalLaunchAngle?: number, avgLaunchAngle?: number }, distance?: { count?: number, totalDistance?: number, avgDistance?: number } }): void => {
            if (!stat) return

            const evCount = Number(stat.exitVelocity?.count ?? 0)
            const evTotal = Number(stat.exitVelocity?.totalExitVelo ?? 0)
            const evAvg = Number(stat.exitVelocity?.avgExitVelo ?? 0)

            const laCount = Number(stat.launchAngle?.count ?? 0)
            const laTotal = Number(stat.launchAngle?.totalLaunchAngle ?? 0)
            const laAvg = Number(stat.launchAngle?.avgLaunchAngle ?? 0)

            const distCount = Number(stat.distance?.count ?? 0)
            const distTotal = Number(stat.distance?.totalDistance ?? 0)
            const distAvg = Number(stat.distance?.avgDistance ?? 0)

            target.count += Math.max(evCount, laCount, distCount)

            if (evCount > 0 && Number.isFinite(evTotal) && Number.isFinite(evAvg)) {
                target.totalExitVelocity += evTotal
                target.totalExitVelocitySquared += evCount * evAvg * evAvg
            }

            if (laCount > 0 && Number.isFinite(laTotal) && Number.isFinite(laAvg)) {
                target.totalLaunchAngle += laTotal
                target.totalLaunchAngleSquared += laCount * laAvg * laAvg
            }

            if (distCount > 0 && Number.isFinite(distTotal) && Number.isFinite(distAvg)) {
                target.totalDistance += distTotal
                target.totalDistanceSquared += distCount * distAvg * distAvg
            }
        }

        const addPitchTypeMoments = (pitchTypeKey: string, stat?: PitchTypeMovementStat): void => {
            if (!stat) return

            const count = Number(stat.count ?? 0)
            if (count <= 0) return

            const totalMph = Number(stat.totalMph ?? 0)
            const avgMph = Number(stat.avgMph ?? 0)
            const totalHorizontalBreak = Number(stat.totalHorizontalBreak ?? 0)
            const avgHorizontalBreak = Number(stat.avgHorizontalBreak ?? 0)
            const totalVerticalBreak = Number(stat.totalVerticalBreak ?? 0)
            const avgVerticalBreak = Number(stat.avgVerticalBreak ?? 0)

            const current = pitchingPhysicsTotals.byPitchType[pitchTypeKey] ?? {
                count: 0,
                total: 0,
                totalSquared: 0,
                avg: 0,
                totalHorizontalBreak: 0,
                totalHorizontalBreakSquared: 0,
                avgHorizontalBreak: 0,
                totalVerticalBreak: 0,
                totalVerticalBreakSquared: 0,
                avgVerticalBreak: 0
            }

            current.count += count
            current.total += totalMph
            current.totalSquared += count * avgMph * avgMph
            current.totalHorizontalBreak += totalHorizontalBreak
            current.totalHorizontalBreakSquared += count * avgHorizontalBreak * avgHorizontalBreak
            current.totalVerticalBreak += totalVerticalBreak
            current.totalVerticalBreakSquared += count * avgVerticalBreak * avgVerticalBreak

            current.avg = current.count > 0 ? Number((current.total / current.count).toFixed(3)) : 0
            current.avgHorizontalBreak = current.count > 0 ? Number((current.totalHorizontalBreak / current.count).toFixed(3)) : 0
            current.avgVerticalBreak = current.count > 0 ? Number((current.totalVerticalBreak / current.count).toFixed(3)) : 0

            pitchingPhysicsTotals.byPitchType[pitchTypeKey] = current

            pitchingPhysicsTotals.velocity.count += count
            pitchingPhysicsTotals.velocity.total += totalMph
            pitchingPhysicsTotals.velocity.totalSquared += count * avgMph * avgMph

            pitchingPhysicsTotals.horizontalBreak.count += count
            pitchingPhysicsTotals.horizontalBreak.total += totalHorizontalBreak
            pitchingPhysicsTotals.horizontalBreak.totalSquared += count * avgHorizontalBreak * avgHorizontalBreak

            pitchingPhysicsTotals.verticalBreak.count += count
            pitchingPhysicsTotals.verticalBreak.total += totalVerticalBreak
            pitchingPhysicsTotals.verticalBreak.totalSquared += count * avgVerticalBreak * avgVerticalBreak
        }

        addMomentStat(hittingPhysicsTotals.exitVelocity, player.hitting.exitVelocity, "totalExitVelo", "avgExitVelo")
        addMomentStat(hittingPhysicsTotals.launchAngle, player.hitting.launchAngle, "totalLaunchAngle", "avgLaunchAngle")
        addMomentStat(hittingPhysicsTotals.distance, player.hitting.distance, "totalDistance", "avgDistance")

        addTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.groundBall, player.hitting.physicsByTrajectory?.groundBall)
        addTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.flyBall, player.hitting.physicsByTrajectory?.flyBall)
        addTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.lineDrive, player.hitting.physicsByTrajectory?.lineDrive)
        addTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.popup, player.hitting.physicsByTrajectory?.popup)

        for (const [pitchTypeKey, pitchTypeStat] of Object.entries(player.pitching.pitchTypes ?? {})) {
            addPitchTypeMoments(pitchTypeKey, pitchTypeStat as PitchTypeMovementStat)
        }
    }

    private static accumulatePitchEnvironmentPositionSeeds(player: PlayerImportRaw, positionSeeds: any): void {
        for (const pos in player.fielding?.gamesAtPosition ?? {}) {
            positionSeeds[pos] = (positionSeeds[pos] ?? 0) + player.fielding.gamesAtPosition[pos]
        }
    }    

    private static accumulateInZoneByCountBuckets(player: PlayerImportRaw, inZoneByCountMap: Map<string, { balls: number, strikes: number, inZone: number, total: number }>): void {
        for (const rawBucket of player.hitting.inZoneByCount ?? []) {
            const balls = Number(rawBucket?.balls ?? 0)
            const strikes = Number(rawBucket?.strikes ?? 0)

            if (balls < 0 || balls > 3 || strikes < 0 || strikes > 2) continue

            const bucket = inZoneByCountMap.get(`${balls}-${strikes}`)
            if (!bucket) continue

            bucket.inZone += Number(rawBucket?.inZone ?? 0)
            bucket.total += Number(rawBucket?.total ?? 0)
        }
    }

    private static accumulateBehaviorByCountBuckets(player: PlayerImportRaw, behaviorByCountMap: Map<string, { balls: number, strikes: number, zonePitches: number, chasePitches: number, zoneSwings: number, chaseSwings: number, zoneContact: number, chaseContact: number, zoneMisses: number, chaseMisses: number, zoneFouls: number, chaseFouls: number, zoneBallsInPlay: number, chaseBallsInPlay: number }>): void {
        for (const rawBucket of player.hitting.behaviorByCount ?? []) {
            const balls = Number(rawBucket?.balls ?? 0)
            const strikes = Number(rawBucket?.strikes ?? 0)

            if (balls < 0 || balls > 3 || strikes < 0 || strikes > 2) continue

            const bucket = behaviorByCountMap.get(`${balls}-${strikes}`)
            if (!bucket) continue

            bucket.zonePitches += Number(rawBucket?.zonePitches ?? 0)
            bucket.chasePitches += Number(rawBucket?.chasePitches ?? 0)
            bucket.zoneSwings += Number(rawBucket?.zoneSwings ?? 0)
            bucket.chaseSwings += Number(rawBucket?.chaseSwings ?? 0)
            bucket.zoneContact += Number(rawBucket?.zoneContact ?? 0)
            bucket.chaseContact += Number(rawBucket?.chaseContact ?? 0)
            bucket.zoneMisses += Number(rawBucket?.zoneMisses ?? 0)
            bucket.chaseMisses += Number(rawBucket?.chaseMisses ?? 0)
            bucket.zoneFouls += Number(rawBucket?.zoneFouls ?? 0)
            bucket.chaseFouls += Number(rawBucket?.chaseFouls ?? 0)
            bucket.zoneBallsInPlay += Number(rawBucket?.zoneBallsInPlay ?? 0)
            bucket.chaseBallsInPlay += Number(rawBucket?.chaseBallsInPlay ?? 0)
        }
    }

    private static finalizePitchEnvironmentPhysicsTotals(hittingPhysicsTotals: any, pitchingPhysicsTotals: any): void {
        const finalizeMomentStat = (target: { count: number, total: number, totalSquared: number, avg: number }) => {
            target.avg = target.count > 0 ? Number((target.total / target.count).toFixed(3)) : 0
            target.total = Number(target.total.toFixed(3))
            target.totalSquared = Number(target.totalSquared.toFixed(3))
            return target
        }

        const finalizeTrajectoryPhysics = (target: { count: number, totalExitVelocity: number, totalExitVelocitySquared: number, avgExitVelocity: number, totalLaunchAngle: number, totalLaunchAngleSquared: number, avgLaunchAngle: number, totalDistance: number, totalDistanceSquared: number, avgDistance: number }) => {
            target.avgExitVelocity = target.count > 0 ? Number((target.totalExitVelocity / target.count).toFixed(3)) : 0
            target.avgLaunchAngle = target.count > 0 ? Number((target.totalLaunchAngle / target.count).toFixed(3)) : 0
            target.avgDistance = target.count > 0 ? Number((target.totalDistance / target.count).toFixed(3)) : 0
            target.totalExitVelocity = Number(target.totalExitVelocity.toFixed(3))
            target.totalExitVelocitySquared = Number(target.totalExitVelocitySquared.toFixed(3))
            target.totalLaunchAngle = Number(target.totalLaunchAngle.toFixed(3))
            target.totalLaunchAngleSquared = Number(target.totalLaunchAngleSquared.toFixed(3))
            target.totalDistance = Number(target.totalDistance.toFixed(3))
            target.totalDistanceSquared = Number(target.totalDistanceSquared.toFixed(3))
            return target
        }

        finalizeMomentStat(hittingPhysicsTotals.exitVelocity)
        finalizeMomentStat(hittingPhysicsTotals.launchAngle)
        finalizeMomentStat(hittingPhysicsTotals.distance)

        finalizeTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.groundBall)
        finalizeTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.flyBall)
        finalizeTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.lineDrive)
        finalizeTrajectoryPhysics(hittingPhysicsTotals.byTrajectory.popup)

        finalizeMomentStat(pitchingPhysicsTotals.velocity)
        finalizeMomentStat(pitchingPhysicsTotals.horizontalBreak)
        finalizeMomentStat(pitchingPhysicsTotals.verticalBreak)

        for (const pitchTypeKey of Object.keys(pitchingPhysicsTotals.byPitchType)) {
            const stat = pitchingPhysicsTotals.byPitchType[pitchTypeKey]
            stat.avg = stat.count > 0 ? Number((stat.total / stat.count).toFixed(3)) : 0
            stat.avgHorizontalBreak = stat.count > 0 ? Number((stat.totalHorizontalBreak / stat.count).toFixed(3)) : 0
            stat.avgVerticalBreak = stat.count > 0 ? Number((stat.totalVerticalBreak / stat.count).toFixed(3)) : 0
            stat.total = Number(stat.total.toFixed(3))
            stat.totalSquared = Number(stat.totalSquared.toFixed(3))
            stat.totalHorizontalBreak = Number(stat.totalHorizontalBreak.toFixed(3))
            stat.totalHorizontalBreakSquared = Number(stat.totalHorizontalBreakSquared.toFixed(3))
            stat.totalVerticalBreak = Number(stat.totalVerticalBreak.toFixed(3))
            stat.totalVerticalBreakSquared = Number(stat.totalVerticalBreakSquared.toFixed(3))
        }
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

            playerImportBaseline,
            leagueImportBaseline,
            pitchEnvironmentTarget: pitchEnvironment
        }
    }

    // public async exportPitchEnvironmentTargetForSeasons(baseDataDir: string, seasons: number[]): Promise<Record<number, PitchEnvironmentTarget>> {

    //     const results: Record<number, PitchEnvironmentTarget> = {}

    //     for (const season of seasons) {

    //         const seasonDir = path.join(baseDataDir, String(season))

    //         const resultsPath = path.join(seasonDir, "_results.json")
    //         const outputPath = path.join(seasonDir, "_pitch_environment_tuning.json")

    //         const raw = await fs.promises.readFile(resultsPath, "utf8")
    //         const parsed = JSON.parse(raw)

    //         const players = new Map<string, PlayerImportRaw>()

    //         if (Array.isArray(parsed)) {
    //             for (const row of parsed) {
    //                 if (row?.playerId) {
    //                     players.set(String(row.playerId), row as PlayerImportRaw)
    //                 }
    //             }
    //         } else if (parsed && Array.isArray(parsed.players)) {
    //             for (const row of parsed.players) {
    //                 if (row?.playerId) {
    //                     players.set(String(row.playerId), row as PlayerImportRaw)
    //                 }
    //             }
    //         } else if (parsed && typeof parsed === "object") {
    //             for (const [playerId, row] of Object.entries(parsed)) {
    //                 if ((row as any)?.playerId) {
    //                     players.set(String((row as any).playerId), row as PlayerImportRaw)
    //                 } else if (row && typeof row === "object") {
    //                     players.set(String(playerId), { ...(row as any), playerId: String(playerId) } as PlayerImportRaw)
    //                 }
    //             }
    //         }

    //         if (players.size === 0) {
    //             throw new Error(`No player import rows found in ${resultsPath}`)
    //         }

    //         const pitchEnvironmentTarget = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
    //         const rng = seedrandom(String(season))
    //         const pitchEnvironmentTuning = await this.getTuningsForPitchEnvironment(pitchEnvironmentTarget, rng, defaultTuningConfig)

    //         const fullPitchEnvironmentTarget: PitchEnvironmentTarget = {
    //             ...pitchEnvironmentTarget,
    //             pitchEnvironmentTuning
    //         } as PitchEnvironmentTarget

    //         await fs.promises.writeFile(outputPath, JSON.stringify(fullPitchEnvironmentTarget, null, 2) + "\n", "utf8")

    //         results[season] = fullPitchEnvironmentTarget
    //     }

    //     return results
    // }
    
    public getPlayerImportBaseline(pitchEnvironment: PitchEnvironmentTarget, rng: Function): PlayerImportBaseline {

        const importReference = pitchEnvironment.importReference

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

            this.simService.initGame(game)

            const startedGame = this.simService.startGame({
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

                pitchEnvironmentTarget: pitchEnvironment,
                date: new Date()
            })

            while (!startedGame.isComplete) {
                this.simService.simPitch(startedGame, rng)
            }

            this.simService.finishGame(startedGame)

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


    public buildStartedBaselineGame(pitchEnvironment: PitchEnvironmentTarget, gameId: string = "baseline-game"): Game {
        
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
            _id: `${gameId}-away`,
            name: "Away",
            abbrev: "AWAY",
            colors: {
                color1: "#ff0000",
                color2: "#ffffff"
            }
        }

        const homeTeam: Team = {
            _id: `${gameId}-home`,
            name: "Home",
            abbrev: "HOME",
            colors: {
                color1: "#0000ff",
                color2: "#ffffff"
            }
        }

        const game: Game = { _id: gameId } as Game

        this.simService.initGame(game)

        return this.simService.startGame({
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

            pitchEnvironmentTarget: pitchEnvironment,
            date: new Date()
        })
    }    

    public evaluatePitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, games: number = 50): { actual: any, target: any, diff: any, score: number } {
        const normalize = (v: number): number => v / 100
        const safeDiv = (a: number, b: number): number => b > 0 ? a / b : 0

        let totalHit: HitResultCount = {} as HitResultCount
        let totalPitch: PitchResultCount = {} as PitchResultCount

        for (let i = 0; i < games; i++) {
            const startedGame = this.buildStartedBaselineGame(pitchEnvironment, `eval-${i}`)

            while (!startedGame.isComplete) {
                this.simService.simPitch(startedGame, rng)
            }

            this.simService.finishGame(startedGame)

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

        const sb = (totalHit as any).sb ?? hitterStatLine.sb ?? 0
        const cs = (totalHit as any).cs ?? hitterStatLine.cs ?? 0
        const sbAttempts = (totalHit as any).sbAttempts ?? hitterStatLine.sbAttempts ?? (sb + cs)
        const timesOnFirst = (totalHit as any).timesOnFirst ?? hitterStatLine.timesOnFirst ?? 0

        const actual = {
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

            bbPercent: hitterStatLine.bbPercent,
            soPercent: hitterStatLine.soPercent,
            hbpPercent: hitterStatLine.hbpPercent,

            singlePercent: hitterStatLine.singlePercent,
            doublePercent: hitterStatLine.doublePercent,
            triplePercent: hitterStatLine.triplePercent,
            homeRunPercent: hitterStatLine.homeRunPercent,

            teamRunsPerGame: hitterStatLine.runs / totalTeamGames,
            teamHitsPerGame: hitterStatLine.hits / totalTeamGames,
            teamHomeRunsPerGame: hitterStatLine.homeRuns / totalTeamGames,
            teamBBPerGame: hitterStatLine.bb / totalTeamGames,
            teamSOPerGame: hitterStatLine.so / totalTeamGames,
            teamSBAttemptPerGame: hitterStatLine.sbAttempts / totalTeamGames,
            teamSBPerGame: sb / totalTeamGames,
            teamSBAttemptsPerGame: sbAttempts / totalTeamGames,
        }

        const target = {
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

            bbPercent: pitchEnvironment.outcome.bbPercent,
            soPercent: pitchEnvironment.outcome.soPercent,
            hbpPercent: pitchEnvironment.outcome.hbpPercent,

            singlePercent: pitchEnvironment.outcome.avg - pitchEnvironment.outcome.doublePercent - pitchEnvironment.outcome.triplePercent - pitchEnvironment.outcome.homeRunPercent,
            doublePercent: pitchEnvironment.outcome.doublePercent,
            triplePercent: pitchEnvironment.outcome.triplePercent,
            homeRunPercent: pitchEnvironment.outcome.homeRunPercent,

            teamRunsPerGame: pitchEnvironment.team.runsPerGame,
            teamHitsPerGame: pitchEnvironment.team.hitsPerGame,
            teamHomeRunsPerGame: pitchEnvironment.team.homeRunsPerGame,
            teamBBPerGame: pitchEnvironment.team.bbPerGame,
            teamSOPerGame: pitchEnvironment.team.soPerGame,
            teamSBPerGame: pitchEnvironment.team.sbPerGame,
            teamSBAttemptsPerGame: pitchEnvironment.team.sbAttemptsPerGame
        }

        const diff = {
            pitchesPerPA: actual.pitchesPerPA - target.pitchesPerPA,
            swingAtStrikesPercent: actual.swingAtStrikesPercent - target.swingAtStrikesPercent,
            swingAtBallsPercent: actual.swingAtBallsPercent - target.swingAtBallsPercent,
            inZoneContactPercent: actual.inZoneContactPercent - target.inZoneContactPercent,
            outZoneContactPercent: actual.outZoneContactPercent - target.outZoneContactPercent,

            avg: actual.avg - target.avg,
            obp: actual.obp - target.obp,
            slg: actual.slg - target.slg,
            babip: actual.babip - target.babip,
            ops: actual.ops - target.ops,

            bbPercent: actual.bbPercent - target.bbPercent,
            singlePercent: actual.singlePercent - target.singlePercent,
            homeRunPercent: actual.homeRunPercent - target.homeRunPercent,

            teamRunsPerGame: actual.teamRunsPerGame - target.teamRunsPerGame,
            teamHitsPerGame: actual.teamHitsPerGame - target.teamHitsPerGame,
            teamHomeRunsPerGame: actual.teamHomeRunsPerGame - target.teamHomeRunsPerGame,
            teamBBPerGame: actual.teamBBPerGame - target.teamBBPerGame,
            teamSBPerGame: actual.teamSBPerGame - target.teamSBPerGame,
            teamSBAttemptsPerGame: actual.teamSBAttemptsPerGame - target.teamSBAttemptsPerGame,
        }

        const sq = (v: number): number => v * v

        const score =
            sq(diff.teamRunsPerGame) * 600000 +
            sq(diff.ops ?? 0) * 120000000 +
            sq(diff.obp) * 90000000 +
            sq(diff.slg) * 100000000 +
            sq(diff.avg) * 100000000 +
            sq(diff.babip) * 90000000 +
            sq(diff.teamSBPerGame) * 1000000 +
            sq(diff.teamSBAttemptsPerGame) * 450000

        return { actual, target, diff, score }
    }

    public seedPitchEnvironmentTuning(pitchEnvironment: PitchEnvironmentTarget): PitchEnvironmentTuning {

        return {
            _id: uuidv4(),
            tuning: {
                contactQuality: {
                    evScale: -2.75,
                    laScale: -2.125,
                    distanceScale: -3,
                    homeRunOutcomeScale: 0,
                },
                swing: {
                    pitchQualityZoneSwingEffect: -4,
                    pitchQualityChaseSwingEffect: -4,
                    disciplineZoneSwingEffect: 2,
                    disciplineChaseSwingEffect: 3
                },
                contact: {
                    pitchQualityContactEffect: -8,
                    contactSkillEffect: -4
                },
                running: {
                    stealAttemptAggressionScale: 1.49
                },
                meta: {
                    fullPitchQualityBonus: 0,
                    fullTeamDefenseBonus: 6,
                    fullFielderDefenseBonus: 4
                }
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

    public isPitchEnvironmentCloseEnough(diff: any): boolean {
        return (
            Math.abs(diff.teamRunsPerGame) <= 0.20 &&
            Math.abs(diff.ops) <= 0.010 &&
            Math.abs(diff.obp) <= 0.008 &&
            Math.abs(diff.slg) <= 0.010 &&
            Math.abs(diff.avg) <= 0.008 &&
            Math.abs(diff.babip) <= 0.010 &&

            Math.abs(diff.teamHitsPerGame) <= 0.15 &&
            Math.abs(diff.teamHomeRunsPerGame) <= 0.08 &&
            Math.abs(diff.teamBBPerGame) <= 0.10 &&
            Math.abs(diff.teamSOPerGame) <= 0.18 &&

            Math.abs(diff.pitchesPerPA) <= 0.03 &&
            Math.abs(diff.swingPercent) <= 0.005 &&
            Math.abs(diff.swingAtStrikesPercent) <= 0.0075 &&
            Math.abs(diff.swingAtBallsPercent) <= 0.0075 &&
            Math.abs(diff.inZoneContactPercent) <= 0.010 &&
            Math.abs(diff.outZoneContactPercent) <= 0.010 &&
            Math.abs(diff.foulContactPercent) <= 0.008
        )
    }

    private static finalizeOutcomeByEvLa(outcomeByEvLaMap: Map<string, { evBin: number, laBin: number, count: number, out: number, single: number, double: number, triple: number, hr: number }>): { evBin: number, laBin: number, count: number, out: number, single: number, double: number, triple: number, hr: number }[] {

        const buckets = Array.from(outcomeByEvLaMap.values()).sort((a, b) => {
            if (a.evBin !== b.evBin) return a.evBin - b.evBin
            return a.laBin - b.laBin
        })

        const safeRate = (num: number, den: number): number => den > 0 ? num / den : 0

        const global = buckets.reduce((acc, bucket) => {
            acc.count += bucket.count
            acc.out += bucket.out
            acc.single += bucket.single
            acc.double += bucket.double
            acc.triple += bucket.triple
            acc.hr += bucket.hr
            return acc
        }, {
            count: 0,
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0
        })

        const byEv = new Map<number, { count: number, bucketCount: number, out: number, single: number, double: number, triple: number, hr: number }>()
        const byLa = new Map<number, { count: number, bucketCount: number, out: number, single: number, double: number, triple: number, hr: number }>()

        for (const bucket of buckets) {
            const evEntry = byEv.get(bucket.evBin) ?? {
                count: 0,
                bucketCount: 0,
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0
            }

            evEntry.count += bucket.count
            evEntry.bucketCount++
            evEntry.out += bucket.out
            evEntry.single += bucket.single
            evEntry.double += bucket.double
            evEntry.triple += bucket.triple
            evEntry.hr += bucket.hr
            byEv.set(bucket.evBin, evEntry)

            const laEntry = byLa.get(bucket.laBin) ?? {
                count: 0,
                bucketCount: 0,
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0
            }

            laEntry.count += bucket.count
            laEntry.bucketCount++
            laEntry.out += bucket.out
            laEntry.single += bucket.single
            laEntry.double += bucket.double
            laEntry.triple += bucket.triple
            laEntry.hr += bucket.hr
            byLa.set(bucket.laBin, laEntry)
        }

        const globalRates = {
            out: safeRate(global.out, global.count),
            single: safeRate(global.single, global.count),
            double: safeRate(global.double, global.count),
            triple: safeRate(global.triple, global.count),
            hr: safeRate(global.hr, global.count)
        }

        const averageBucketCount = buckets.length > 0 ? global.count / buckets.length : 1
        const globalWeight = Math.sqrt(Math.max(1, averageBucketCount))

        return buckets.map(bucket => {
            const evTotals = byEv.get(bucket.evBin) ?? {
                count: 0,
                bucketCount: 0,
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0
            }

            const laTotals = byLa.get(bucket.laBin) ?? {
                count: 0,
                bucketCount: 0,
                out: 0,
                single: 0,
                double: 0,
                triple: 0,
                hr: 0
            }

            const evContextCount = Math.max(0, evTotals.count - bucket.count)
            const laContextCount = Math.max(0, laTotals.count - bucket.count)

            const evRates = evContextCount > 0
                ? {
                    out: safeRate(evTotals.out - bucket.out, evContextCount),
                    single: safeRate(evTotals.single - bucket.single, evContextCount),
                    double: safeRate(evTotals.double - bucket.double, evContextCount),
                    triple: safeRate(evTotals.triple - bucket.triple, evContextCount),
                    hr: safeRate(evTotals.hr - bucket.hr, evContextCount)
                }
                : globalRates

            const laRates = laContextCount > 0
                ? {
                    out: safeRate(laTotals.out - bucket.out, laContextCount),
                    single: safeRate(laTotals.single - bucket.single, laContextCount),
                    double: safeRate(laTotals.double - bucket.double, laContextCount),
                    triple: safeRate(laTotals.triple - bucket.triple, laContextCount),
                    hr: safeRate(laTotals.hr - bucket.hr, laContextCount)
                }
                : globalRates

            const exactRates = {
                out: safeRate(bucket.out, bucket.count),
                single: safeRate(bucket.single, bucket.count),
                double: safeRate(bucket.double, bucket.count),
                triple: safeRate(bucket.triple, bucket.count),
                hr: safeRate(bucket.hr, bucket.count)
            }

            const exactWeight = Math.sqrt(Math.max(1, bucket.count))
            const evWeight = Math.sqrt(Math.max(1, evContextCount / Math.max(1, evTotals.bucketCount - 1)))
            const laWeight = Math.sqrt(Math.max(1, laContextCount / Math.max(1, laTotals.bucketCount - 1)))

            let outRate =
                (exactRates.out * exactWeight) +
                (evRates.out * evWeight) +
                (laRates.out * laWeight) +
                (globalRates.out * globalWeight)

            let singleRate =
                (exactRates.single * exactWeight) +
                (evRates.single * evWeight) +
                (laRates.single * laWeight) +
                (globalRates.single * globalWeight)

            let doubleRate =
                (exactRates.double * exactWeight) +
                (evRates.double * evWeight) +
                (laRates.double * laWeight) +
                (globalRates.double * globalWeight)

            let tripleRate =
                (exactRates.triple * exactWeight) +
                (evRates.triple * evWeight) +
                (laRates.triple * laWeight) +
                (globalRates.triple * globalWeight)

            let hrRate =
                (exactRates.hr * exactWeight) +
                (evRates.hr * evWeight) +
                (laRates.hr * laWeight) +
                (globalRates.hr * globalWeight)

            const totalRate = outRate + singleRate + doubleRate + tripleRate + hrRate

            if (totalRate <= 0) {
                return {
                    evBin: bucket.evBin,
                    laBin: bucket.laBin,
                    count: bucket.count,
                    out: bucket.count,
                    single: 0,
                    double: 0,
                    triple: 0,
                    hr: 0
                }
            }

            outRate /= totalRate
            singleRate /= totalRate
            doubleRate /= totalRate
            tripleRate /= totalRate
            hrRate /= totalRate

            const out = Math.round(outRate * bucket.count)
            const single = Math.round(singleRate * bucket.count)
            const double = Math.round(doubleRate * bucket.count)
            const triple = Math.round(tripleRate * bucket.count)
            const hr = Math.max(0, bucket.count - out - single - double - triple)

            return {
                evBin: bucket.evBin,
                laBin: bucket.laBin,
                count: bucket.count,
                out,
                single,
                double,
                triple,
                hr
            }
        })
    }

    public printPitchEnvironmentIterationDiagnostics(stage: string, iteration: number, maxIterations: number, gamesPerIteration: number, candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number }): void {
        const parts = String(stage).split("-")
        const baseStage = parts[0]
        const bracketLabel = parts.length > 1 ? parts.slice(1).join("-") : ""

        if (
            baseStage !== "seed" &&
            baseStage !== "probe" &&
            baseStage !== "confirm" &&
            baseStage !== "trial" &&
            baseStage !== "accepted" &&
            baseStage !== "accepted-softened" &&
            baseStage !== "stopped" &&
            baseStage !== "close-enough" &&
            baseStage !== "baseline" &&
            baseStage !== "final"
        ) {
            return
        }

        const r = (n: number, d: number = 3): number => {
            const value = Number(n ?? 0)
            if (!Number.isFinite(value)) return 0
            return Number(value.toFixed(d))
        }

        const signed = (n: number, d: number = 3): string => {
            const value = Number(n ?? 0)
            if (!Number.isFinite(value)) return "+0"
            const rounded = Number(value.toFixed(d))
            return rounded >= 0 ? `+${rounded}` : `${rounded}`
        }

        const stageToken =
            baseStage === "seed" ? "seed" :
            baseStage === "trial" ? "try" :
            baseStage === "confirm" ? "conf" :
            baseStage === "accepted" ? "acc" :
            baseStage === "final" ? "final" :
            baseStage

        const labelToken = bracketLabel ? `:${bracketLabel}` : ""

        const stageGuess = (() => {
            const diff = result.diff ?? {}
            const pitchError =
                Math.abs(Number(diff.pitchesPerPA ?? 0)) +
                Math.abs(Number(diff.swingAtStrikesPercent ?? 0)) +
                Math.abs(Number(diff.swingAtBallsPercent ?? 0)) +
                Math.abs(Number(diff.inZoneContactPercent ?? 0)) +
                Math.abs(Number(diff.outZoneContactPercent ?? 0))

            if (pitchError > 0.085) return "pitch"
            if (Math.abs(Number(diff.teamSBAttemptsPerGame ?? 0)) > 0.10 || Math.abs(Number(diff.teamSBPerGame ?? 0)) > 0.08) return "run"
            if (Number(diff.homeRunPercent ?? 0) < -0.004 || Number(diff.teamHomeRunsPerGame ?? 0) < -0.14) return "slg-hr"
            if (Number(diff.slg ?? 0) > 0.014 || Math.abs(Number(diff.homeRunPercent ?? 0)) > 0.004) return "slg"
            if (Number(diff.teamHitsPerGame ?? 0) > 0.60 || Number(diff.avg ?? 0) > 0.005 || Number(diff.babip ?? 0) > 0.007) return "avg"
            if (Number(diff.bbPercent ?? 0) < -0.006 || Number(diff.teamBBPerGame ?? 0) < -0.20) return "bb"
            if (Math.abs(Number(diff.ops ?? 0)) > 0.014) return "ops"
            if (Math.abs(Number(diff.teamRunsPerGame ?? 0)) > 0.25) return "runs"
            return "done"
        })()

        const tuning = candidate?.tuning

        console.log(
            `L${iteration} ${stageToken}${labelToken} | ` +
            `G=${gamesPerIteration} ` +
            `S=${r(result.score, 1)} ` +
            `next=${stageGuess} ` +

            `P/PA=${r(result.actual.pitchesPerPA)}(${signed(result.diff.pitchesPerPA)}) ` +
            `ZSw=${r(result.actual.swingAtStrikesPercent)}(${signed(result.diff.swingAtStrikesPercent)}) ` +
            `Ch=${r(result.actual.swingAtBallsPercent)}(${signed(result.diff.swingAtBallsPercent)}) ` +
            `ZCt=${r(result.actual.inZoneContactPercent)}(${signed(result.diff.inZoneContactPercent)}) ` +
            `ChCt=${r(result.actual.outZoneContactPercent)}(${signed(result.diff.outZoneContactPercent)}) ` +

            `AVG=${r(result.actual.avg)}(${signed(result.diff.avg)}) ` +
            `OBP=${r(result.actual.obp)}(${signed(result.diff.obp)}) ` +
            `SLG=${r(result.actual.slg)}(${signed(result.diff.slg)}) ` +
            `OPS=${r(result.actual.ops)}(${signed(result.diff.ops)}) ` +
            `BABIP=${r(result.actual.babip)}(${signed(result.diff.babip)}) ` +

            `BB%=${r(result.actual.bbPercent)}(${signed(result.diff.bbPercent)}) ` +
            `SO%=${r(result.actual.soPercent)}(${signed(result.diff.soPercent)}) ` +
            `1B%=${r(result.actual.singlePercent)}(${signed(result.diff.singlePercent)}) ` +
            `HR%=${r(result.actual.homeRunPercent)}(${signed(result.diff.homeRunPercent)}) ` +

            `R/G=${r(result.actual.teamRunsPerGame)}(${signed(result.diff.teamRunsPerGame)}) ` +
            `H/G=${r(result.actual.teamHitsPerGame)}(${signed(result.diff.teamHitsPerGame)}) ` +
            `HR/G=${r(result.actual.teamHomeRunsPerGame)}(${signed(result.diff.teamHomeRunsPerGame)}) ` +
            `BB/G=${r(result.actual.teamBBPerGame)}(${signed(result.diff.teamBBPerGame)}) ` +
            `SB/G=${r(result.actual.teamSBPerGame)}(${signed(result.diff.teamSBPerGame)}) ` +
            `SBA/G=${r(result.actual.teamSBAttemptsPerGame)}(${signed(result.diff.teamSBAttemptsPerGame)}) ` +

            `T[ev=${r(tuning?.contactQuality?.evScale ?? 0, 2)} la=${r(tuning?.contactQuality?.laScale ?? 0, 2)} dist=${r(tuning?.contactQuality?.distanceScale ?? 0, 2)} hrOut=${r(tuning?.contactQuality?.homeRunOutcomeScale ?? 1, 2)} ` +
            `pqZ=${r(tuning?.swing?.pitchQualityZoneSwingEffect ?? 0, 2)} pqCh=${r(tuning?.swing?.pitchQualityChaseSwingEffect ?? 0, 2)} ` +
            `dZ=${r(tuning?.swing?.disciplineZoneSwingEffect ?? 0, 2)} dCh=${r(tuning?.swing?.disciplineChaseSwingEffect ?? 0, 2)} ` +
            `pCt=${r(tuning?.contact?.pitchQualityContactEffect ?? 0, 2)} cSk=${r(tuning?.contact?.contactSkillEffect ?? 0, 2)} ` +
            `sb=${r(tuning?.running?.stealAttemptAggressionScale ?? 1, 2)} ` +
            `meta=${r(tuning?.meta?.fullPitchQualityBonus ?? 0, 1)}/${r(tuning?.meta?.fullTeamDefenseBonus ?? 0, 1)}/${r(tuning?.meta?.fullFielderDefenseBonus ?? 0, 1)}]`
        )
    }

    private mergeHitResults(total: HitResultCount, current: HitResultCount): HitResultCount {
        total = total || {} as HitResultCount
        current = current || {} as HitResultCount

        for (const key of Object.keys(current)) {
            const typedKey = key as keyof HitResultCount

            if (typeof current[typedKey] === "number") {
                ; (total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
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
                ; (total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
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

export {
    PlayerImporterService
}
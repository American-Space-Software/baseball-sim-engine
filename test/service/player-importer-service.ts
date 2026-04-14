import { Position, PitchType, Handedness } from "../../src/service/enums.js"
import { Game, HitResultCount, HitterStatLine, HittingRatings, LeagueAverage, Lineup, PitchEnvironmentTarget, PitchEnvironmentTuning, PitchRatings, PitchResultCount, PitchTypeMovementStat, Player, PlayerFromStatsCommand, PlayerImportBaseline, PlayerImportRaw, RotationPitcher, Team } from "../../src/service/interfaces.js"
import { SimService } from "../../src/service/sim-service.js"
import { StatService } from "../../src/service/stat-service.js"
import { v4 as uuidv4 } from 'uuid'

import fs from "fs"
import path from "path"
import seedrandom from "seedrandom"
import { DownloaderService } from "./downloader-service.js"

const defaultTuningConfig = {
    maxIterations: 100,
    minIterations: 40,
    maxStallIterations: 25,
    gamesPerIteration: 70,
    printDiagnostics: true
}


class PlayerImporterService {

    constructor(
        private simService: SimService, 
        private statService: StatService,
        private downloaderService:DownloaderService
    ) { }

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
        if (!target.pitchEnvironmentTuning?.tuning) {
            throw new Error("Missing pitchEnvironmentTuning.tuning on target")
        }

        return JSON.parse(JSON.stringify({
            ...this.buildLeagueAverageRatings(100),

            foulRate: target.pitch.foulContactPercent,

            pitchQuality: 50,

            contactTypeRollInput: target.battedBall.contactRollInput,
            powerRollInput: target.battedBall.powerRollInput,

            fielderChanceL: target.fielderChance.vsL,
            fielderChanceR: target.fielderChance.vsR,

            shallowDeepChance: target.fielderChance.shallowDeep,

            inZoneByCount: target.pitch.inZoneByCount,
            steal: target.steal,

            swing: {
                zoneSwingBase: target.swing.zoneSwingBase,
                chaseSwingBase: target.swing.chaseSwingBase,
                zoneContactBase: target.swing.zoneContactBase,
                chaseContactBase: target.swing.chaseContactBase,
                behaviorByCount: target.swing.behaviorByCount
            },

            tuning: { ...target.pitchEnvironmentTuning.tuning }
        }))
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

        const behaviorByCountSeed = [
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

        const inZoneByCountMap = new Map<string, { balls: number, strikes: number, inZone: number, total: number }>()
        for (const bucket of inZoneByCountSeed) {
            inZoneByCountMap.set(`${bucket.balls}-${bucket.strikes}`, bucket)
        }

        const behaviorByCountMap = new Map<string, { balls: number, strikes: number, zonePitches: number, chasePitches: number, zoneSwings: number, chaseSwings: number, zoneContact: number, chaseContact: number, zoneMisses: number, chaseMisses: number, zoneFouls: number, chaseFouls: number, zoneBallsInPlay: number, chaseBallsInPlay: number }>()
        for (const bucket of behaviorByCountSeed) {
            behaviorByCountMap.set(`${bucket.balls}-${bucket.strikes}`, bucket)
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
        const leagueAverages = PlayerImporterService.pitchEnvironmentTargetToLeagueAverage(pitchEnvironment)

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


    public async exportPitchEnvironmentTargetForSeasons(baseDataDir: string, seasons: number[]): Promise<Record<number, PitchEnvironmentTarget>> {

        const results: Record<number, PitchEnvironmentTarget> = {}

        for (const season of seasons) {

            const seasonDir = path.join(baseDataDir, String(season))

            const resultsPath = path.join(seasonDir, "_results.json")
            const outputPath = path.join(seasonDir, "_pitch_environment_tuning.json")

            const raw = await fs.promises.readFile(resultsPath, "utf8")
            const parsed = JSON.parse(raw)

            const players = new Map<string, PlayerImportRaw>()

            if (Array.isArray(parsed)) {
                for (const row of parsed) {
                    if (row?.playerId) {
                        players.set(String(row.playerId), row as PlayerImportRaw)
                    }
                }
            } else if (parsed && Array.isArray(parsed.players)) {
                for (const row of parsed.players) {
                    if (row?.playerId) {
                        players.set(String(row.playerId), row as PlayerImportRaw)
                    }
                }
            } else if (parsed && typeof parsed === "object") {
                for (const [playerId, row] of Object.entries(parsed)) {
                    if ((row as any)?.playerId) {
                        players.set(String((row as any).playerId), row as PlayerImportRaw)
                    } else if (row && typeof row === "object") {
                        players.set(String(playerId), { ...(row as any), playerId: String(playerId) } as PlayerImportRaw)
                    }
                }
            }

            if (players.size === 0) {
                throw new Error(`No player import rows found in ${resultsPath}`)
            }

            const pitchEnvironmentTarget = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
            const rng = seedrandom(String(season))
            const pitchEnvironmentTuning = this.getTuningsForPitchEnvironment(pitchEnvironmentTarget, rng, defaultTuningConfig)

            const fullPitchEnvironmentTarget: PitchEnvironmentTarget = {
                ...pitchEnvironmentTarget,
                pitchEnvironmentTuning
            } as PitchEnvironmentTarget

            await fs.promises.writeFile(outputPath, JSON.stringify(fullPitchEnvironmentTarget, null, 2) + "\n", "utf8")

            results[season] = fullPitchEnvironmentTarget
        }

        return results
    }
    
    public getPlayerImportBaseline(pitchEnvironment: PitchEnvironmentTarget, rng: Function): PlayerImportBaseline {

        const importReference = pitchEnvironment.importReference

        const leagueAverages = PlayerImporterService.pitchEnvironmentTargetToLeagueAverage(pitchEnvironment)

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

                leagueAverages,
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

    public getTuningsForPitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, options?: any): PitchEnvironmentTuning {
        let candidate = this.seedPitchEnvironmentTuning(pitchEnvironment)

        const maxIterations = options?.maxIterations ?? 1000
        const minIterations = options?.minIterations ?? Math.min(40, maxIterations)
        const gamesPerIteration = options?.gamesPerIteration ?? 250
        const printDiagnostics = options?.printDiagnostics ?? true
        const maxStallIterations = options?.maxStallIterations ?? 25

        const clamp = (num: number, min: number, max: number): number => Math.max(min, Math.min(max, num))
        const round = (num: number, digits: number = 2): number => Number(num.toFixed(digits))

        const knobs = [
            { key: "pitchQualityZoneSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "pitchQualityChaseSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "disciplineZoneSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "disciplineChaseSwingEffect", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "pitchQualityContactEffect", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "contactSkillEffect", step: 0.25, min: 0, max: 25, digits: 2 },
            { key: "fullPitchQualityBonus", step: 0.2, min: 0, max: 20, digits: 2 },
            { key: "fullTeamDefenseBonus", step: 0.2, min: 0, max: 20, digits: 2 },
            { key: "fullFielderDefenseBonus", step: 0.2, min: 0, max: 20, digits: 2 },
            { key: "groundballDoublePenalty", step: 0.2, min: 0, max: 12, digits: 2 },
            { key: "groundballTriplePenalty", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "groundballHRPenalty", step: 0.25, min: 0, max: 20, digits: 2 },
            { key: "groundballOutcomeBoost", step: 0.2, min: 0, max: 12, digits: 2 },
            { key: "flyballOutcomeBoost", step: 0.15, min: 0, max: 8, digits: 2 },
            { key: "lineDriveOutcomeBoost", step: 0.5, min: 0, max: 60, digits: 2 },
            { key: "flyballHRPenalty", step: 0.15, min: 0, max: 20, digits: 2 },
            { key: "lineDriveOutToSingleWindow", step: 1.0, min: 0, max: 150, digits: 2 },
            { key: "lineDriveOutToSingleBoost", step: 1.5, min: 0, max: 150, digits: 2 },
            { key: "lineDriveSingleToDoubleFactor", step: 0.015, min: 0, max: 1, digits: 3 }
        ]

        const evaluateCandidate = (candidateToEvaluate: PitchEnvironmentTuning): { actual: any, target: any, diff: any, score: number } => {
            const candidatePitchEnvironment: PitchEnvironmentTarget = JSON.parse(JSON.stringify({
                ...pitchEnvironment,
                pitchEnvironmentTuning: candidateToEvaluate
            }))
            const evaluationRng = new seedrandom(4)
            return this.evaluatePitchEnvironment(candidatePitchEnvironment, evaluationRng, gamesPerIteration)
        }

        let bestCandidate: PitchEnvironmentTuning = JSON.parse(JSON.stringify(candidate))
        let bestResult = evaluateCandidate(bestCandidate)
        let stallIterations = 0

        if (printDiagnostics) {
            this.printPitchEnvironmentIterationDiagnostics("seed", -1, bestCandidate, bestResult)
        }

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            if (iteration >= minIterations && this.isPitchEnvironmentCloseEnough(bestResult.diff)) {
                if (printDiagnostics) {
                    this.printPitchEnvironmentIterationDiagnostics("close-enough", iteration, bestCandidate, bestResult)
                }
                break
            }

            const decay = Math.max(0.35, 1 - (iteration / 120))

            let iterationBestCandidate: PitchEnvironmentTuning | undefined
            let iterationBestResult: { actual: any, target: any, diff: any, score: number } | undefined

            for (const knob of knobs) {
                for (const direction of [-1, 1]) {
                    const trial: PitchEnvironmentTuning = JSON.parse(JSON.stringify(bestCandidate))
                    trial._id = uuidv4()

                    const currentValue = (trial.tuning as any)[knob.key] as number
                    const rawStep = knob.step * direction * decay
                    const nextValue = round(clamp(currentValue + rawStep, knob.min, knob.max), knob.digits)

                    if (nextValue === currentValue) {
                        continue
                    }

                    ;(trial.tuning as any)[knob.key] = nextValue

                    const trialResult = evaluateCandidate(trial)

                    if (printDiagnostics) {
                        this.printPitchEnvironmentIterationDiagnostics(`${knob.key}${direction > 0 ? "+" : "-"}`, iteration, trial, trialResult)
                    }

                    if (!iterationBestResult || trialResult.score < iterationBestResult.score) {
                        iterationBestCandidate = trial
                        iterationBestResult = trialResult
                    }
                }
            }

            if (iterationBestCandidate && iterationBestResult && iterationBestResult.score < bestResult.score) {
                bestCandidate = iterationBestCandidate
                bestResult = iterationBestResult
                stallIterations = 0

                if (printDiagnostics) {
                    this.printPitchEnvironmentIterationDiagnostics("accepted", iteration, bestCandidate, bestResult)
                }

                continue
            }

            stallIterations++

            if (printDiagnostics) {
                this.printPitchEnvironmentIterationDiagnostics(`stall-${stallIterations}`, iteration, bestCandidate, bestResult)
            }

            if (iteration + 1 < minIterations) {
                continue
            }

            if (stallIterations >= maxStallIterations) {
                if (printDiagnostics) {
                    this.printPitchEnvironmentIterationDiagnostics("stopped", iteration, bestCandidate, bestResult)
                }
                break
            }
        }

        console.log(`FINAL_TUNING_ID=${bestCandidate._id}`)

        return bestCandidate
    }

    public buildStartedBaselineGame(pitchEnvironment: PitchEnvironmentTarget, gameId: string = "baseline-game"): Game {
        
        const leagueAverages = PlayerImporterService.pitchEnvironmentTargetToLeagueAverage(pitchEnvironment)

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

            leagueAverages,
            date: new Date()
        })
    }    

    public evaluatePitchEnvironment(pitchEnvironment: PitchEnvironmentTarget, rng: Function, games: number = 50): { actual: any, target: any, diff: any, score: number } {
        const normalize = (v: number): number => v / 100

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

            bbPercent: hitterStatLine.bbPercent,
            soPercent: hitterStatLine.soPercent,
            hbpPercent: hitterStatLine.hbpPercent,

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

            bbPercent: pitchEnvironment.outcome.bbPercent,
            soPercent: pitchEnvironment.outcome.soPercent,
            hbpPercent: pitchEnvironment.outcome.hbpPercent,

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

            bbPercent: target.bbPercent - actual.bbPercent,
            soPercent: target.soPercent - actual.soPercent,
            hbpPercent: target.hbpPercent - actual.hbpPercent,

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

        const abs = (n: number): number => Math.abs(n)
        const lowSide = (n: number): number => Math.max(0, n)
        const highSide = (n: number): number => Math.max(0, -n)

        const contactShapeGap = Math.abs(diff.inZoneContactPercent - diff.outZoneContactPercent)
        const contactShapeDirectionPenalty =
            Math.max(0, actual.inZoneContactPercent - target.inZoneContactPercent) * Math.max(0, target.outZoneContactPercent - actual.outZoneContactPercent)

        const singleBabipCouplingPenalty =
            lowSide(diff.singlePercent) * 900 +
            lowSide(diff.babip) * 1100 +
            lowSide(diff.singlePercent) * lowSide(diff.babip) * 4000

        const disguisedPowerPenalty =
            Math.max(0, actual.slg - target.slg) * (
                lowSide(diff.avg) * 900 +
                lowSide(diff.babip) * 1100 +
                lowSide(diff.singlePercent) * 1200
            )

        const processMismatchPenalty =
            contactShapeGap * 700 +
            contactShapeDirectionPenalty * 2200 +
            Math.max(0, actual.inZoneContactPercent - target.inZoneContactPercent) * 260 +
            Math.max(0, target.outZoneContactPercent - actual.outZoneContactPercent) * 320 +
            Math.max(0, target.swingAtStrikesPercent - actual.swingAtStrikesPercent) * 180 +
            Math.max(0, target.swingAtBallsPercent - actual.swingAtBallsPercent) * 180

        const primaryScore =
            abs(diff.avg) * 650 +
            abs(diff.obp) * 760 +
            abs(diff.slg) * 820 +
            abs(diff.ops) * 420 +
            abs(diff.babip) * 760 +
            abs(diff.bbPercent) * 360 +
            abs(diff.soPercent) * 300 +
            abs(diff.homeRunPercent) * 360 +
            abs(diff.teamRunsPerGame) * 145

        const secondaryScore =
            abs(diff.teamHitsPerGame) * 55 +
            abs(diff.teamHomeRunsPerGame) * 46 +
            abs(diff.teamBBPerGame) * 30 +
            abs(diff.teamSOPerGame) * 22 +
            abs(diff.singlePercent) * 180 +
            abs(diff.doublePercent) * 65 +
            abs(diff.triplePercent) * 20

        const processScore =
            abs(diff.pitchesPerPA) * 80 +
            abs(diff.swingPercent) * 40 +
            abs(diff.swingAtStrikesPercent) * 55 +
            abs(diff.swingAtBallsPercent) * 55 +
            abs(diff.inZoneContactPercent) * 65 +
            abs(diff.outZoneContactPercent) * 75 +
            abs(diff.foulContactPercent) * 18 +
            abs(diff.inZonePercent) * 8 +
            abs(diff.strikePercent) * 8 +
            abs(diff.ballPercent) * 8

        const shapePenalty =
            abs(diff.groundBallPercent) * 16 +
            abs(diff.flyBallPercent) * 16 +
            abs(diff.ldPercent) * 16

        const offenseFloorPenalty =
            lowSide(diff.avg) * 1200 +
            lowSide(diff.obp) * 1300 +
            lowSide(diff.slg) * 1450 +
            lowSide(diff.ops) * 700 +
            lowSide(diff.babip) * 1400 +
            lowSide(diff.singlePercent) * 1600 +
            lowSide(diff.homeRunPercent) * 700 +
            lowSide(diff.teamRunsPerGame) * 280 +
            lowSide(diff.teamHitsPerGame) * 180

        const strikeoutPenalty =
            highSide(diff.soPercent) * 520 +
            highSide(diff.teamSOPerGame) * 48

        const falseProgressPenalty =
            Math.max(0, target.pitchesPerPA - actual.pitchesPerPA) * (
                lowSide(diff.avg) * 240 +
                lowSide(diff.slg) * 320 +
                lowSide(diff.babip) * 260 +
                lowSide(diff.teamRunsPerGame) * 90
            )

        const score =
            primaryScore +
            secondaryScore +
            processScore +
            shapePenalty +
            offenseFloorPenalty +
            strikeoutPenalty +
            falseProgressPenalty +
            processMismatchPenalty +
            singleBabipCouplingPenalty +
            disguisedPowerPenalty

        return { actual, target, diff, score }
    }

    private seedPitchEnvironmentTuning(pitchEnvironment: PitchEnvironmentTarget): PitchEnvironmentTuning {
        const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0
        const clamp = (num: number, min: number, max: number): number => Math.max(min, Math.min(max, num))
        const round = (num: number, digits: number = 2): number => Number(num.toFixed(digits))

        return {
            _id: uuidv4(),
            tuning: {
                pitchQualityZoneSwingEffect: 5,
                pitchQualityChaseSwingEffect: 6,

                disciplineZoneSwingEffect: 6.25,
                disciplineChaseSwingEffect: 8.25,

                pitchQualityContactEffect: 8.5,
                contactSkillEffect: 12,

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


    private isPitchEnvironmentCloseEnough(diff: any): boolean {
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

    private printPitchEnvironmentIterationDiagnostics(stage: string, iteration: number, candidate: PitchEnvironmentTuning, result: { actual: any, target: any, diff: any, score: number }): void {
        if (
            stage !== "seed" &&
            stage !== "accepted" &&
            stage !== "accepted-softened" &&
            stage !== "stopped" &&
            stage !== "close-enough"
        ) {
            return
        }

        const r = (n: number, d: number = 3): number => Number(n.toFixed(d))

        console.log(
            `L${iteration} ${stage[0]} | ` +
            `S=${r(result.score, 1)} ` +
            `id=${candidate._id} ` +
            `P=${r(result.actual.pitchesPerPA)}(${r(result.diff.pitchesPerPA)}) ` +
            `Zs=${r(result.actual.swingAtStrikesPercent)}(${r(result.diff.swingAtStrikesPercent)}) ` +
            `Cs=${r(result.actual.swingAtBallsPercent)}(${r(result.diff.swingAtBallsPercent)}) ` +
            `Zc=${r(result.actual.inZoneContactPercent)}(${r(result.diff.inZoneContactPercent)}) ` +
            `Cc=${r(result.actual.outZoneContactPercent)}(${r(result.diff.outZoneContactPercent)}) ` +
            `A=${r(result.actual.avg)}(${r(result.diff.avg)}) ` +
            `S=${r(result.actual.slg)}(${r(result.diff.slg)}) ` +
            `B=${r(result.actual.babip)}(${r(result.diff.babip)}) ` +
            `R=${r(result.actual.teamRunsPerGame)}(${r(result.diff.teamRunsPerGame)}) ` 
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
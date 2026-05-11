import assert from "assert"
import {
    StatService,
    simService,
    BaseResult,
    Contact,
    PlayResult,
    Position,
    ShallowDeep,
    ThrowResult,
    PitchCall
} from "../src/sim/index.js"
import seedrandom from "seedrandom"
import type {
    PitchEnvironmentTarget,
    PitchEnvironmentTuning,
    Game,
    GamePlayer,
    RunnerEvent,
    RunnerResult
} from "../src/sim/index.js"

import { PlayerImporterService } from "../src/importer/service/player-importer-service.js"
import { importPitchEnvironmentTarget } from "../src/importer/index.js"
import { DownloaderService } from "../src/importer/service/downloader-service.js"

const statService = new StatService()
let pitchEnvironment: PitchEnvironmentTarget
let tunedPitchEnvironment: PitchEnvironmentTarget

const season = 2025
const baseDataDir = "data"

const playerImporterService = new PlayerImporterService(simService, statService, {} as any)
const downloaderservice = new DownloaderService("data", 1000)

const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))

const evaluationSeed = 4
const evaluationGames = 70

const options = {
    workers: 25,
    gamesPerIteration: evaluationGames
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const makeTuning = (overrides?: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    return {
        contactQuality: {
            evScale: overrides?.contactQuality?.evScale ?? 0,
            laScale: overrides?.contactQuality?.laScale ?? 0,
            distanceScale: overrides?.contactQuality?.distanceScale ?? 0,
            outOutcomeScale: overrides?.contactQuality?.outOutcomeScale ?? 0,
            singleOutcomeScale: overrides?.contactQuality?.singleOutcomeScale ?? 0,
            doubleOutcomeScale: overrides?.contactQuality?.doubleOutcomeScale ?? 0,
            tripleOutcomeScale: overrides?.contactQuality?.tripleOutcomeScale ?? 0,
            homeRunOutcomeScale: overrides?.contactQuality?.homeRunOutcomeScale ?? 0,
        },
        swing: {
            pitchQualityZoneSwingEffect: overrides?.swing?.pitchQualityZoneSwingEffect ?? 0,
            pitchQualityChaseSwingEffect: overrides?.swing?.pitchQualityChaseSwingEffect ?? 0,
            disciplineZoneSwingEffect: overrides?.swing?.disciplineZoneSwingEffect ?? 0,
            disciplineChaseSwingEffect: overrides?.swing?.disciplineChaseSwingEffect ?? 0,
            walkRateScale: overrides?.swing?.walkRateScale ?? 0,            
        },
        contact: {
            pitchQualityContactEffect: overrides?.contact?.pitchQualityContactEffect ?? 0,
            contactSkillEffect: overrides?.contact?.contactSkillEffect ?? 0
        },
        running: {
            stealAttemptAggressionScale: overrides?.running?.stealAttemptAggressionScale ?? 1,
            advancementAggressionScale: overrides?.running?.advancementAggressionScale ?? 1
        },
        meta: {
            fullPitchQualityBonus: overrides?.meta?.fullPitchQualityBonus ?? 0,
            fullTeamDefenseBonus: overrides?.meta?.fullTeamDefenseBonus ?? 0,
            fullFielderDefenseBonus: overrides?.meta?.fullFielderDefenseBonus ?? 0
        }
    }
}


const makeDisabledMetaTuning = (overrides?: Partial<PitchEnvironmentTuning["tuning"]>): PitchEnvironmentTuning["tuning"] => {
    return makeTuning({
        ...overrides,
        meta: {
            fullPitchQualityBonus: overrides?.meta?.fullPitchQualityBonus ?? -0,
            fullTeamDefenseBonus: overrides?.meta?.fullTeamDefenseBonus ?? -0,
            fullFielderDefenseBonus: overrides?.meta?.fullFielderDefenseBonus ?? -0
        }
    })
}


const HIGH_OFFENSE_TUNING: PitchEnvironmentTuning["tuning"] = makeTuning({
    contactQuality: {
        evScale: 0,
        laScale: 0,
        distanceScale: 0,
        singleOutcomeScale: 0,
        doubleOutcomeScale: 0.35,
        tripleOutcomeScale: 0.15,
        homeRunOutcomeScale: 1.25,
        outOutcomeScale: -0.35
    },
    swing: {
        pitchQualityZoneSwingEffect: 0,
        pitchQualityChaseSwingEffect: 0,
        disciplineZoneSwingEffect: 0,
        disciplineChaseSwingEffect: 0,
        walkRateScale: 0.1
    },
    contact: {
        pitchQualityContactEffect: 0,
        contactSkillEffect: 0
    },
    running: {
        stealAttemptAggressionScale: 1.6,
        advancementAggressionScale: 1.2
    },
    meta: {
        fullPitchQualityBonus: 0,
        fullTeamDefenseBonus: -100,
        fullFielderDefenseBonus: -100
    }
})

const LOW_OFFENSE_TUNING: PitchEnvironmentTuning["tuning"] = makeTuning({
    contactQuality: {
        evScale: 0,
        laScale: 0,
        distanceScale: 0,
        singleOutcomeScale: 0,
        doubleOutcomeScale: -0.35,
        tripleOutcomeScale: -0.15,
        homeRunOutcomeScale: -0.75,
        outOutcomeScale: 0.35
    },
    swing: {
        pitchQualityZoneSwingEffect: 0,
        pitchQualityChaseSwingEffect: 0,
        disciplineZoneSwingEffect: 0,
        disciplineChaseSwingEffect: 0,
        walkRateScale: -0.1
    },
    contact: {
        pitchQualityContactEffect: 0,
        contactSkillEffect: 0
    },
    running: {
        stealAttemptAggressionScale: 0.1,
        advancementAggressionScale: 0.4
    },
    meta: {
        fullPitchQualityBonus: 0,
        fullTeamDefenseBonus: 100,
        fullFielderDefenseBonus: 100
    }
})

const rngSequence = (values: number[]): (() => number) => {
    let index = 0

    return () => {
        const value = values[Math.min(index, values.length - 1)]
        index++
        return value
    }
}

describe("Baseball Sim Engine", async () => {


    it("should calculate pitch environment target for season", async () => {
        pitchEnvironment = PlayerImporterService.getPitchEnvironmentTargetForSeason(season, players)
        // console.log("PITCH ENVIRONMENT TARGET", JSON.stringify(pitchEnvironment))
        assert.ok(pitchEnvironment)
    })
    
    it("generated contact quality outcome models should print weighted expected offense from contact mix", () => {
        const testPitchEnvironment = clone(pitchEnvironment)

        testPitchEnvironment.pitchEnvironmentTuning = {
            tuning: makeDisabledMetaTuning()
        } as PitchEnvironmentTuning

        const sampleCount = 5000

        const contactWeights = [
            {
                contact: Contact.GROUNDBALL,
                name: "GROUNDBALL",
                trajectory: "groundBall",
                weight: testPitchEnvironment.battedBall.contactRollInput.groundball
            },
            {
                contact: Contact.LINE_DRIVE,
                name: "LINE_DRIVE",
                trajectory: "lineDrive",
                weight: testPitchEnvironment.battedBall.contactRollInput.lineDrive
            },
            {
                contact: Contact.FLY_BALL,
                name: "FLY_BALL",
                trajectory: "flyBall",
                weight: testPitchEnvironment.battedBall.contactRollInput.flyBall
            }
        ]

        const totalWeight = contactWeights.reduce((sum, row) => sum + row.weight, 0)

        const percentile = (values: number[], pct: number): number => {
            if (values.length === 0) return 0

            const sorted = [...values].sort((a, b) => a - b)
            const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * pct)))

            return sorted[index]
        }

        const getStdDev = (count: number, totalSquared: number, avg: number): number => {
            if (count <= 1) return 0
            return Math.sqrt(Math.max(0, (totalSquared / count) - (avg * avg)))
        }

        const emptySummary = () => ({
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0,
            count: 0,
            weightedEv: 0,
            weightedLa: 0
        })

        const bumpSummary = (summary: any, bucket: any): void => {
            const total =
                bucket.out +
                bucket.single +
                bucket.double +
                bucket.triple +
                bucket.hr

            summary.out += bucket.out
            summary.single += bucket.single
            summary.double += bucket.double
            summary.triple += bucket.triple
            summary.hr += bucket.hr
            summary.count += total
            summary.weightedEv += bucket.evBin * total
            summary.weightedLa += bucket.laBin * total
        }

        const printOutcomeSummary = (row: any) => {
            const total = row.out + row.single + row.double + row.triple + row.hr
            const bip = row.out + row.single + row.double + row.triple

            return {
                total,
                avgEv: total > 0 ? row.weightedEv / total : 0,
                avgLa: total > 0 ? row.weightedLa / total : 0,
                out: total > 0 ? row.out / total : 0,
                single: total > 0 ? row.single / total : 0,
                double: total > 0 ? row.double / total : 0,
                triple: total > 0 ? row.triple / total : 0,
                hr: total > 0 ? row.hr / total : 0,
                avg: total > 0 ? (row.single + row.double + row.triple + row.hr) / total : 0,
                slg: total > 0 ? (row.single + (row.double * 2) + (row.triple * 3) + (row.hr * 4)) / total : 0,
                babip: bip > 0 ? (row.single + row.double + row.triple) / bip : 0
            }
        }

        console.log("\n=== HITTER IMPORT REFERENCE TOTALS ===")
        console.log({
            hitter: {
                pa: testPitchEnvironment.importReference.hitter.pa,
                ab: testPitchEnvironment.importReference.hitter.ab,
                hits: testPitchEnvironment.importReference.hitter.hits,
                doubles: testPitchEnvironment.importReference.hitter.doubles,
                triples: testPitchEnvironment.importReference.hitter.triples,
                homeRuns: testPitchEnvironment.importReference.hitter.homeRuns,
                bb: testPitchEnvironment.importReference.hitter.bb,
                so: testPitchEnvironment.importReference.hitter.so,
                groundBalls: testPitchEnvironment.importReference.hitter.groundBalls,
                flyBalls: testPitchEnvironment.importReference.hitter.flyBalls,
                lineDrives: testPitchEnvironment.importReference.hitter.lineDrives,
                popups: testPitchEnvironment.importReference.hitter.popups,
                ballsInPlay: testPitchEnvironment.importReference.hitter.ballsInPlay
            },
            targetOutcome: testPitchEnvironment.outcome,
            contactRollInput: testPitchEnvironment.battedBall.contactRollInput,
            powerRollInput: testPitchEnvironment.battedBall.powerRollInput
        })

        console.log("\n=== HITTER PHYSICS BY TRAJECTORY ===")
        for (const row of contactWeights) {
            const physics = testPitchEnvironment.importReference.hitter.physics.byTrajectory[row.trajectory]

            console.log(`[${row.name}]`, {
                contactRollWeight: row.weight,
                contactRollShare: row.weight / totalWeight,
                count: physics.count,
                avgExitVelocity: physics.avgExitVelocity,
                avgLaunchAngle: physics.avgLaunchAngle,
                avgDistance: physics.avgDistance,
                exitVelocityStdDev: getStdDev(physics.count, physics.totalExitVelocitySquared, physics.avgExitVelocity),
                launchAngleStdDev: getStdDev(physics.count, physics.totalLaunchAngleSquared, physics.avgLaunchAngle),
                distanceStdDev: getStdDev(physics.count, physics.totalDistanceSquared, physics.avgDistance)
            })
        }

        const rawTableTotals = emptySummary()
        const rawByBand = new Map<string, any>()

        const bumpRawBand = (name: string, bucket: any): void => {
            if (!rawByBand.has(name)) {
                rawByBand.set(name, emptySummary())
            }

            bumpSummary(rawByBand.get(name)!, bucket)
        }

        const getShapeByLaunchAngle = (laBin: number): string => {
            if (laBin < 0) return "laShapeGroundBall"
            if (laBin < 24) return "laShapeLineDrive"
            return "laShapeFlyBall"
        }

        const getNearestPhysicsTrajectory = (bucket: any): string => {
            let bestName = ""
            let bestDistance = Number.POSITIVE_INFINITY

            for (const row of contactWeights) {
                const physics = testPitchEnvironment.importReference.hitter.physics.byTrajectory[row.trajectory]

                const evStdDev = Math.max(1, getStdDev(physics.count, physics.totalExitVelocitySquared, physics.avgExitVelocity))
                const laStdDev = Math.max(1, getStdDev(physics.count, physics.totalLaunchAngleSquared, physics.avgLaunchAngle))

                const evZ = (bucket.evBin - physics.avgExitVelocity) / evStdDev
                const laZ = (bucket.laBin - physics.avgLaunchAngle) / laStdDev

                const distance = (evZ * evZ) + (laZ * laZ)

                if (distance < bestDistance) {
                    bestDistance = distance
                    bestName = row.name
                }
            }

            return bestName
        }

        for (const bucket of testPitchEnvironment.battedBall.outcomeByEvLa) {
            bumpSummary(rawTableTotals, bucket)

            bumpRawBand("all", bucket)
            bumpRawBand(getShapeByLaunchAngle(bucket.laBin), bucket)
            bumpRawBand(`nearestPhysics:${getNearestPhysicsTrajectory(bucket)}`, bucket)

            if (bucket.evBin >= 95) {
                bumpRawBand("ev95Plus", bucket)
            }

            if (bucket.evBin >= 98) {
                bumpRawBand("ev98Plus", bucket)
            }

            if (bucket.evBin >= 100) {
                bumpRawBand("ev100Plus", bucket)
            }

            if (bucket.evBin >= 102) {
                bumpRawBand("ev102Plus", bucket)
            }

            if (bucket.evBin >= 95 && bucket.laBin >= 20 && bucket.laBin <= 40) {
                bumpRawBand("hrShape", bucket)
            }

            if (bucket.evBin >= 100 && bucket.laBin >= 20 && bucket.laBin <= 40) {
                bumpRawBand("ev100PlusHrShape", bucket)
            }

            for (const row of contactWeights) {
                const physics = testPitchEnvironment.importReference.hitter.physics.byTrajectory[row.trajectory]
                const evStdDev = Math.max(1, getStdDev(physics.count, physics.totalExitVelocitySquared, physics.avgExitVelocity))
                const laStdDev = Math.max(1, getStdDev(physics.count, physics.totalLaunchAngleSquared, physics.avgLaunchAngle))

                const evZ = Math.abs((bucket.evBin - physics.avgExitVelocity) / evStdDev)
                const laZ = Math.abs((bucket.laBin - physics.avgLaunchAngle) / laStdDev)

                if (evZ <= 1 && laZ <= 1) {
                    bumpRawBand(`within1StdDev:${row.name}`, bucket)
                }

                if (evZ <= 2 && laZ <= 2) {
                    bumpRawBand(`within2StdDev:${row.name}`, bucket)
                }

                if (evZ <= 3 && laZ <= 3) {
                    bumpRawBand(`within3StdDev:${row.name}`, bucket)
                }
            }
        }

        const rawTotal =
            rawTableTotals.out +
            rawTableTotals.single +
            rawTableTotals.double +
            rawTableTotals.triple +
            rawTableTotals.hr

        console.log("\n=== RAW OUTCOME TABLE TOTALS ===")
        console.log(printOutcomeSummary(rawTableTotals))

        console.log("\n=== RAW OUTCOME TABLE BY LA SHAPE / PHYSICS FIT ===")
        for (const [key, row] of Array.from(rawByBand.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`[${key}]`, printOutcomeSummary(row))
        }

        const rawEvDistribution = new Map<number, any>()
        const rawLaDistribution = new Map<number, any>()

        for (const bucket of testPitchEnvironment.battedBall.outcomeByEvLa) {
            if (!rawEvDistribution.has(bucket.evBin)) {
                rawEvDistribution.set(bucket.evBin, emptySummary())
            }

            if (!rawLaDistribution.has(bucket.laBin)) {
                rawLaDistribution.set(bucket.laBin, emptySummary())
            }

            bumpSummary(rawEvDistribution.get(bucket.evBin)!, bucket)
            bumpSummary(rawLaDistribution.get(bucket.laBin)!, bucket)
        }

        console.log("\n=== RAW EV DISTRIBUTION TAIL ===")
        Array.from(rawEvDistribution.entries())
            .sort((a, b) => a[0] - b[0])
            .filter(([evBin]) => evBin >= 90)
            .forEach(([evBin, row]) => {
                const summary = printOutcomeSummary(row)

                console.log(`[RAW EV ${evBin}]`, {
                    share: summary.total / rawTotal,
                    ...summary
                })
            })

        console.log("\n=== RAW LA DISTRIBUTION KEY BANDS ===")
        Array.from(rawLaDistribution.entries())
            .sort((a, b) => a[0] - b[0])
            .filter(([laBin]) => laBin >= -20 && laBin <= 50)
            .forEach(([laBin, row]) => {
                const summary = printOutcomeSummary(row)

                console.log(`[RAW LA ${laBin}]`, {
                    share: summary.total / rawTotal,
                    ...summary
                })
            })

        const generatedTotals = {
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0,
            weightedEv: 0,
            weightedLa: 0,
            weightedDistance: 0
        }

        const generatedByContact = new Map<string, any>()
        const generatedByPhysicsBand = new Map<string, any>()
        const generatedHrShapeTail = new Map<string, number>()

        const bumpGeneratedBand = (name: string, out: number, single: number, double: number, triple: number, hr: number, hitQuality: any): void => {
            if (!generatedByPhysicsBand.has(name)) {
                generatedByPhysicsBand.set(name, {
                    out: 0,
                    single: 0,
                    double: 0,
                    triple: 0,
                    hr: 0,
                    count: 0,
                    weightedEv: 0,
                    weightedLa: 0
                })
            }

            const row = generatedByPhysicsBand.get(name)!

            row.out += out
            row.single += single
            row.double += double
            row.triple += triple
            row.hr += hr
            row.count += 1
            row.weightedEv += hitQuality.exitVelocity
            row.weightedLa += hitQuality.launchAngle
        }

        for (const row of contactWeights) {
            const rng = seedrandom(`weighted-contact-quality-model-${row.name}`)
            const physics = testPitchEnvironment.importReference.hitter.physics.byTrajectory[row.trajectory]

            let contactOut = 0
            let contactSingle = 0
            let contactDouble = 0
            let contactTriple = 0
            let contactHr = 0
            let contactEv = 0
            let contactLa = 0
            let contactDistance = 0

            const sampledEvs: number[] = []
            const sampledLas: number[] = []
            const sampledDistances: number[] = []

            const evLaCounts = new Map<string, {
                count: number
                out: number
                single: number
                double: number
                triple: number
                hr: number
            }>()

            const tailCounts = {
                ev90Plus: 0,
                ev95Plus: 0,
                ev98Plus: 0,
                ev100Plus: 0,
                ev102Plus: 0,
                hrShape: 0,
                ev95PlusHrShape: 0,
                ev100PlusHrShape: 0,
                within1StdDev: 0,
                within2StdDev: 0,
                within3StdDev: 0
            }

            for (let i = 0; i < sampleCount; i++) {
                const hitQuality = (simService as any).gameRolls.getHitQuality(
                    rng,
                    testPitchEnvironment,
                    0,
                    false,
                    row.contact
                )

                const model = (simService as any).getOutcomeModelForContactQuality(
                    testPitchEnvironment,
                    hitQuality,
                    row.contact,
                    0
                )

                const modelTotal = model.out + model.single + model.double + model.triple + model.hr

                const out = model.out / modelTotal
                const single = model.single / modelTotal
                const double = model.double / modelTotal
                const triple = model.triple / modelTotal
                const hr = model.hr / modelTotal

                contactOut += out
                contactSingle += single
                contactDouble += double
                contactTriple += triple
                contactHr += hr
                contactEv += hitQuality.exitVelocity
                contactLa += hitQuality.launchAngle
                contactDistance += hitQuality.distance

                sampledEvs.push(hitQuality.exitVelocity)
                sampledLas.push(hitQuality.launchAngle)
                sampledDistances.push(hitQuality.distance)

                const evBin = Math.floor(hitQuality.exitVelocity / 2) * 2
                const laBin = Math.floor(hitQuality.launchAngle / 2) * 2
                const evLaKey = `${evBin}:${laBin}`

                const evStdDev = Math.max(1, getStdDev(physics.count, physics.totalExitVelocitySquared, physics.avgExitVelocity))
                const laStdDev = Math.max(1, getStdDev(physics.count, physics.totalLaunchAngleSquared, physics.avgLaunchAngle))
                const evZ = Math.abs((hitQuality.exitVelocity - physics.avgExitVelocity) / evStdDev)
                const laZ = Math.abs((hitQuality.launchAngle - physics.avgLaunchAngle) / laStdDev)

                if (evZ <= 1 && laZ <= 1) tailCounts.within1StdDev++
                if (evZ <= 2 && laZ <= 2) tailCounts.within2StdDev++
                if (evZ <= 3 && laZ <= 3) tailCounts.within3StdDev++

                if (evBin >= 90) tailCounts.ev90Plus++
                if (evBin >= 95) tailCounts.ev95Plus++
                if (evBin >= 98) tailCounts.ev98Plus++
                if (evBin >= 100) tailCounts.ev100Plus++
                if (evBin >= 102) tailCounts.ev102Plus++
                if (evBin >= 95 && laBin >= 20 && laBin <= 40) tailCounts.hrShape++
                if (evBin >= 95 && laBin >= 20 && laBin <= 40) tailCounts.ev95PlusHrShape++
                if (evBin >= 100 && laBin >= 20 && laBin <= 40) tailCounts.ev100PlusHrShape++

                bumpGeneratedBand(`${row.name}:all`, out, single, double, triple, hr, hitQuality)

                if (evZ <= 1 && laZ <= 1) {
                    bumpGeneratedBand(`${row.name}:within1StdDev`, out, single, double, triple, hr, hitQuality)
                }

                if (evZ <= 2 && laZ <= 2) {
                    bumpGeneratedBand(`${row.name}:within2StdDev`, out, single, double, triple, hr, hitQuality)
                }

                if (evZ <= 3 && laZ <= 3) {
                    bumpGeneratedBand(`${row.name}:within3StdDev`, out, single, double, triple, hr, hitQuality)
                }

                if (evBin >= 95 && laBin >= 20 && laBin <= 40) {
                    generatedHrShapeTail.set(`${row.name}:${evBin}:${laBin}`, (generatedHrShapeTail.get(`${row.name}:${evBin}:${laBin}`) ?? 0) + 1)
                }

                if (!evLaCounts.has(evLaKey)) {
                    evLaCounts.set(evLaKey, {
                        count: 0,
                        out: 0,
                        single: 0,
                        double: 0,
                        triple: 0,
                        hr: 0
                    })
                }

                const bucketRow = evLaCounts.get(evLaKey)!
                bucketRow.count++
                bucketRow.out += out
                bucketRow.single += single
                bucketRow.double += double
                bucketRow.triple += triple
                bucketRow.hr += hr
            }

            contactOut /= sampleCount
            contactSingle /= sampleCount
            contactDouble /= sampleCount
            contactTriple /= sampleCount
            contactHr /= sampleCount
            contactEv /= sampleCount
            contactLa /= sampleCount
            contactDistance /= sampleCount

            const share = row.weight / totalWeight

            generatedTotals.out += contactOut * share
            generatedTotals.single += contactSingle * share
            generatedTotals.double += contactDouble * share
            generatedTotals.triple += contactTriple * share
            generatedTotals.hr += contactHr * share
            generatedTotals.weightedEv += contactEv * share
            generatedTotals.weightedLa += contactLa * share
            generatedTotals.weightedDistance += contactDistance * share

            generatedByContact.set(row.name, {
                share,
                out: contactOut,
                single: contactSingle,
                double: contactDouble,
                triple: contactTriple,
                hr: contactHr,
                avgEv: contactEv,
                avgLa: contactLa,
                avgDistance: contactDistance,
                evP50: percentile(sampledEvs, 0.50),
                evP75: percentile(sampledEvs, 0.75),
                evP90: percentile(sampledEvs, 0.90),
                evP95: percentile(sampledEvs, 0.95),
                evP99: percentile(sampledEvs, 0.99),
                laP50: percentile(sampledLas, 0.50),
                laP75: percentile(sampledLas, 0.75),
                laP90: percentile(sampledLas, 0.90),
                laP95: percentile(sampledLas, 0.95),
                laP99: percentile(sampledLas, 0.99),
                distanceP50: percentile(sampledDistances, 0.50),
                distanceP75: percentile(sampledDistances, 0.75),
                distanceP90: percentile(sampledDistances, 0.90),
                distanceP95: percentile(sampledDistances, 0.95),
                distanceP99: percentile(sampledDistances, 0.99),
                tailShares: {
                    ev90Plus: tailCounts.ev90Plus / sampleCount,
                    ev95Plus: tailCounts.ev95Plus / sampleCount,
                    ev98Plus: tailCounts.ev98Plus / sampleCount,
                    ev100Plus: tailCounts.ev100Plus / sampleCount,
                    ev102Plus: tailCounts.ev102Plus / sampleCount,
                    hrShape: tailCounts.hrShape / sampleCount,
                    ev95PlusHrShape: tailCounts.ev95PlusHrShape / sampleCount,
                    ev100PlusHrShape: tailCounts.ev100PlusHrShape / sampleCount,
                    within1StdDev: tailCounts.within1StdDev / sampleCount,
                    within2StdDev: tailCounts.within2StdDev / sampleCount,
                    within3StdDev: tailCounts.within3StdDev / sampleCount
                },
                topEvLa: Array.from(evLaCounts.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 25)
                    .map(([key, value]) => {
                        const total = value.count

                        return {
                            key,
                            count: value.count,
                            out: value.out / total,
                            single: value.single / total,
                            double: value.double / total,
                            triple: value.triple / total,
                            hr: value.hr / total
                        }
                    })
            })
        }

        console.log("\n=== GENERATED CONTACT MODEL BY CONTACT TYPE ===")

        for (const [key, row] of generatedByContact.entries()) {
            const bip = row.out + row.single + row.double + row.triple

            console.log(`[${key}]`, {
                share: Number(row.share.toFixed(3)),
                avgEv: Number(row.avgEv.toFixed(3)),
                avgLa: Number(row.avgLa.toFixed(3)),
                avgDistance: Number(row.avgDistance.toFixed(3)),
                evP50: Number(row.evP50.toFixed(3)),
                evP75: Number(row.evP75.toFixed(3)),
                evP90: Number(row.evP90.toFixed(3)),
                evP95: Number(row.evP95.toFixed(3)),
                evP99: Number(row.evP99.toFixed(3)),
                laP50: Number(row.laP50.toFixed(3)),
                laP75: Number(row.laP75.toFixed(3)),
                laP90: Number(row.laP90.toFixed(3)),
                laP95: Number(row.laP95.toFixed(3)),
                laP99: Number(row.laP99.toFixed(3)),
                distanceP50: Number(row.distanceP50.toFixed(3)),
                distanceP75: Number(row.distanceP75.toFixed(3)),
                distanceP90: Number(row.distanceP90.toFixed(3)),
                distanceP95: Number(row.distanceP95.toFixed(3)),
                distanceP99: Number(row.distanceP99.toFixed(3)),
                tailShares: row.tailShares,
                out: Number(row.out.toFixed(3)),
                single: Number(row.single.toFixed(3)),
                double: Number(row.double.toFixed(3)),
                triple: Number(row.triple.toFixed(3)),
                hr: Number(row.hr.toFixed(3)),
                avgOnContact: Number((row.single + row.double + row.triple + row.hr).toFixed(3)),
                slgOnContact: Number((row.single + (row.double * 2) + (row.triple * 3) + (row.hr * 4)).toFixed(3)),
                babip: Number(((row.single + row.double + row.triple) / bip).toFixed(3)),
                topEvLa: row.topEvLa
            })
        }

        console.log("\n=== GENERATED MODEL BY PHYSICS STDDEV BAND ===")
        for (const [key, row] of Array.from(generatedByPhysicsBand.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`[${key}]`, printOutcomeSummary(row))
        }

        console.log("\n=== GENERATED HR-SHAPE BUCKET FREQUENCY ===")
        Array.from(generatedHrShapeTail.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .forEach(([key, count]) => {
                console.log(`[GENERATED HR SHAPE] ${key} N=${count} PCT=${(count / sampleCount).toFixed(4)}`)
            })

        const generatedBip =
            generatedTotals.out +
            generatedTotals.single +
            generatedTotals.double +
            generatedTotals.triple

        const generatedBabip =
            generatedBip > 0
                ? (
                    generatedTotals.single +
                    generatedTotals.double +
                    generatedTotals.triple
                ) / generatedBip
                : 0

        const generatedAvg =
            generatedTotals.single +
            generatedTotals.double +
            generatedTotals.triple +
            generatedTotals.hr

        const generatedSlg =
            generatedTotals.single +
            (generatedTotals.double * 2) +
            (generatedTotals.triple * 3) +
            (generatedTotals.hr * 4)

        console.log("\n=== GENERATED CONTACT MODEL TOTAL ===")
        console.log({
            avgEv: Number(generatedTotals.weightedEv.toFixed(3)),
            avgLa: Number(generatedTotals.weightedLa.toFixed(3)),
            avgDistance: Number(generatedTotals.weightedDistance.toFixed(3)),
            out: Number(generatedTotals.out.toFixed(3)),
            single: Number(generatedTotals.single.toFixed(3)),
            double: Number(generatedTotals.double.toFixed(3)),
            triple: Number(generatedTotals.triple.toFixed(3)),
            hr: Number(generatedTotals.hr.toFixed(3)),
            avgOnContact: Number(generatedAvg.toFixed(3)),
            slgOnContact: Number(generatedSlg.toFixed(3)),
            babip: Number(generatedBabip.toFixed(3))
        })

        const gameRng = seedrandom("live-contact-diagnostic")
        const games = evaluationGames

        const liveResultCounts = {
            out: 0,
            single: 0,
            double: 0,
            triple: 0,
            hr: 0
        }

        const liveByContact = new Map<string, any>()
        const liveEvLa = new Map<string, any>()

        for (let gameIndex = 0; gameIndex < games; gameIndex++) {
            const game = playerImporterService.buildStartedBaselineGame(
                clone(testPitchEnvironment),
                `live-contact-diagnostic-${gameIndex}`
            )

            while (!game.isComplete) {
                simService.simPitch(game, gameRng)
            }

            for (const play of game.halfInnings.flatMap(halfInning => halfInning.plays)) {
                const pitch = play.pitchLog?.pitches?.find((p: any) => p.contactQuality)

                if (!pitch?.contactQuality) continue

                const finalContact = String(play.contact)

                if (!liveByContact.has(finalContact)) {
                    liveByContact.set(finalContact, {
                        out: 0,
                        single: 0,
                        double: 0,
                        triple: 0,
                        hr: 0,
                        total: 0,
                        ev: 0,
                        la: 0,
                        distance: 0,
                        ev95Plus: 0,
                        ev98Plus: 0,
                        ev100Plus: 0,
                        ev100PlusHrShape: 0
                    })
                }

                const row = liveByContact.get(finalContact)!
                row.total++
                row.ev += pitch.contactQuality.exitVelocity
                row.la += pitch.contactQuality.launchAngle
                row.distance += pitch.contactQuality.distance

                const evBin = Math.floor(pitch.contactQuality.exitVelocity / 2) * 2
                const laBin = Math.floor(pitch.contactQuality.launchAngle / 2) * 2
                const evLaKey = `${evBin}:${laBin}`

                if (evBin >= 95) row.ev95Plus++
                if (evBin >= 98) row.ev98Plus++
                if (evBin >= 100) row.ev100Plus++
                if (evBin >= 100 && laBin >= 20 && laBin <= 40) row.ev100PlusHrShape++

                if (!liveEvLa.has(evLaKey)) {
                    liveEvLa.set(evLaKey, {
                        count: 0,
                        out: 0,
                        single: 0,
                        double: 0,
                        triple: 0,
                        hr: 0
                    })
                }

                const liveBucket = liveEvLa.get(evLaKey)!
                liveBucket.count++

                if (play.result === PlayResult.OUT) {
                    liveResultCounts.out++
                    row.out++
                    liveBucket.out++
                }

                if (play.result === PlayResult.SINGLE) {
                    liveResultCounts.single++
                    row.single++
                    liveBucket.single++
                }

                if (play.result === PlayResult.DOUBLE) {
                    liveResultCounts.double++
                    row.double++
                    liveBucket.double++
                }

                if (play.result === PlayResult.TRIPLE) {
                    liveResultCounts.triple++
                    row.triple++
                    liveBucket.triple++
                }

                if (play.result === PlayResult.HR) {
                    liveResultCounts.hr++
                    row.hr++
                    liveBucket.hr++
                }
            }
        }

        const liveTotal =
            liveResultCounts.out +
            liveResultCounts.single +
            liveResultCounts.double +
            liveResultCounts.triple +
            liveResultCounts.hr

        console.log("\n=== LIVE IN-GAME BIP RESULTS ===")
        console.log({
            out: liveResultCounts.out / liveTotal,
            single: liveResultCounts.single / liveTotal,
            double: liveResultCounts.double / liveTotal,
            triple: liveResultCounts.triple / liveTotal,
            hr: liveResultCounts.hr / liveTotal
        })

        console.log("\n=== LIVE IN-GAME RESULTS BY FINAL CONTACT ===")

        for (const [key, row] of liveByContact.entries()) {
            const bip = row.out + row.single + row.double + row.triple

            console.log(`[${key}]`, {
                total: row.total,
                avgEv: row.ev / row.total,
                avgLa: row.la / row.total,
                avgDistance: row.distance / row.total,
                ev95PlusShare: row.ev95Plus / row.total,
                ev98PlusShare: row.ev98Plus / row.total,
                ev100PlusShare: row.ev100Plus / row.total,
                ev100PlusHrShapeShare: row.ev100PlusHrShape / row.total,
                out: row.out / row.total,
                single: row.single / row.total,
                double: row.double / row.total,
                triple: row.triple / row.total,
                hr: row.hr / row.total,
                avgOnContact: (row.single + row.double + row.triple + row.hr) / row.total,
                slgOnContact: (row.single + (row.double * 2) + (row.triple * 3) + (row.hr * 4)) / row.total,
                babip: bip > 0 ? (row.single + row.double + row.triple) / bip : 0
            })
        }

        console.log("\n=== LIVE TOP EV/LA BUCKETS ===")

        Array.from(liveEvLa.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 50)
            .forEach(([key, row]) => {
                console.log(`[${key}]`, {
                    count: row.count,
                    out: row.out / row.count,
                    single: row.single / row.count,
                    double: row.double / row.count,
                    triple: row.triple / row.count,
                    hr: row.hr / row.count
                })
            })

        console.log("\n=== SOURCE OF LOW BASELINE SUMMARY ===")
        console.log({
            rawTableHr: rawTableTotals.hr / rawTotal,
            generatedHr: generatedTotals.hr,
            liveHr: liveResultCounts.hr / liveTotal,

            rawTableSingle: rawTableTotals.single / rawTotal,
            generatedSingle: generatedTotals.single,
            liveSingle: liveResultCounts.single / liveTotal,

            rawTableOut: rawTableTotals.out / rawTotal,
            generatedOut: generatedTotals.out,
            liveOut: liveResultCounts.out / liveTotal,

            rawTableAvgOnContact:
                (
                    rawTableTotals.single +
                    rawTableTotals.double +
                    rawTableTotals.triple +
                    rawTableTotals.hr
                ) / rawTotal,

            generatedAvgOnContact: generatedAvg,

            rawTableSlgOnContact:
                (
                    rawTableTotals.single +
                    (rawTableTotals.double * 2) +
                    (rawTableTotals.triple * 3) +
                    (rawTableTotals.hr * 4)
                ) / rawTotal,

            generatedSlgOnContact: generatedSlg,

            liveAvgOnContact:
                (
                    liveResultCounts.single +
                    liveResultCounts.double +
                    liveResultCounts.triple +
                    liveResultCounts.hr
                ) / liveTotal,

            liveSlgOnContact:
                (
                    liveResultCounts.single +
                    (liveResultCounts.double * 2) +
                    (liveResultCounts.triple * 3) +
                    (liveResultCounts.hr * 4)
                ) / liveTotal
        })

        assert.ok(generatedBabip > 0)
    })

})

const evaluateManualTuning = (name: string, tuning: PitchEnvironmentTuning["tuning"]) => {
    const testPitchEnvironment: PitchEnvironmentTarget = clone(pitchEnvironment)

    testPitchEnvironment.pitchEnvironmentTuning = {
        _id: `manual-${name}`,
        tuning
    }

    const evaluation = playerImporterService.evaluatePitchEnvironment(
        testPitchEnvironment,
        seedrandom(`manual-${name}-${evaluationGames}`),
        evaluationGames
    )

    const rng = seedrandom(`manual-${name}-run-conversion-${evaluationGames}`)

    let games = 0
    let halfInnings = 0
    let totalRuns = 0
    let totalHits = 0
    let totalHomeRuns = 0
    let totalWalks = 0
    let totalStrikeouts = 0
    let totalOuts = 0
    let totalPlateAppearances = 0
    let totalLeftOnBase = 0
    let totalRunnerOuts = 0
    let totalRunnerScoredEvents = 0

    const baseState = new Map<string, { pa: number, runs: number, hits: number, walks: number, homeRuns: number, outs: number }>()
    const outState = new Map<number, { pa: number, runs: number, hits: number, walks: number, homeRuns: number }>()

    const getBaseKey = (runnerResult: any): string => {
        const first = runnerResult?.start?.first ? "1" : "0"
        const second = runnerResult?.start?.second ? "1" : "0"
        const third = runnerResult?.start?.third ? "1" : "0"

        return `${first}${second}${third}`
    }

    const addBaseState = (key: string, play: any, runs: number) => {
        if (!baseState.has(key)) {
            baseState.set(key, { pa: 0, runs: 0, hits: 0, walks: 0, homeRuns: 0, outs: 0 })
        }

        const row = baseState.get(key)!
        row.pa++
        row.runs += runs

        if (
            play.result === PlayResult.SINGLE ||
            play.result === PlayResult.DOUBLE ||
            play.result === PlayResult.TRIPLE ||
            play.result === PlayResult.HR
        ) {
            row.hits++
        }

        if (play.result === PlayResult.BB) row.walks++
        if (play.result === PlayResult.HR) row.homeRuns++
        if (play.result === PlayResult.OUT || play.result === PlayResult.STRIKEOUT) row.outs++
    }

    const addOutState = (outs: number, play: any, runs: number) => {
        if (!outState.has(outs)) {
            outState.set(outs, { pa: 0, runs: 0, hits: 0, walks: 0, homeRuns: 0 })
        }

        const row = outState.get(outs)!
        row.pa++
        row.runs += runs

        if (
            play.result === PlayResult.SINGLE ||
            play.result === PlayResult.DOUBLE ||
            play.result === PlayResult.TRIPLE ||
            play.result === PlayResult.HR
        ) {
            row.hits++
        }

        if (play.result === PlayResult.BB) row.walks++
        if (play.result === PlayResult.HR) row.homeRuns++
    }

    for (let gameIndex = 0; gameIndex < evaluationGames; gameIndex++) {
        const game = playerImporterService.buildStartedBaselineGame(
            clone(testPitchEnvironment),
            `manual-${name}-run-conversion-${gameIndex}`
        )

        while (!game.isComplete) {
            simService.simPitch(game, rng)
        }

        games++
        totalRuns += game.score.away + game.score.home

        for (const halfInning of game.halfInnings) {
            halfInnings++

            const plays = halfInning.plays ?? []
            const finalPlay = plays[plays.length - 1]
            const finalEnd = finalPlay?.runner?.result?.end

            if (finalEnd) {
                if (finalEnd.first) totalLeftOnBase++
                if (finalEnd.second) totalLeftOnBase++
                if (finalEnd.third) totalLeftOnBase++
            }

            for (const play of plays) {
                const runnerStart = play.runner?.result?.start
                const runnerEnd = play.runner?.result?.end
                const playRuns = runnerEnd?.scored?.length ?? 0
                const outsBefore = Math.min(2, totalOuts % 3)
                const baseKey = getBaseKey(play.runner?.result)

                totalPlateAppearances++
                totalRunnerScoredEvents += playRuns

                addBaseState(baseKey, play, playRuns)
                addOutState(outsBefore, play, playRuns)

                if (
                    play.result === PlayResult.SINGLE ||
                    play.result === PlayResult.DOUBLE ||
                    play.result === PlayResult.TRIPLE ||
                    play.result === PlayResult.HR
                ) {
                    totalHits++
                }

                if (play.result === PlayResult.HR) totalHomeRuns++
                if (play.result === PlayResult.BB) totalWalks++
                if (play.result === PlayResult.STRIKEOUT) totalStrikeouts++

                const runnerOuts = runnerEnd?.out?.length ?? 0
                totalRunnerOuts += runnerOuts
                totalOuts += runnerOuts

                if (!runnerEnd?.out?.includes(play.hitterId) && (play.result === PlayResult.OUT || play.result === PlayResult.STRIKEOUT)) {
                    totalOuts++
                }

                if (runnerStart && runnerEnd) {
                    void runnerStart
                }
            }
        }
    }

    const formatMap = (map: Map<any, any>) => {
        return Array.from(map.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .map(([key, row]) => ({
                key,
                pa: row.pa,
                runs: row.runs,
                runsPerPA: row.pa > 0 ? row.runs / row.pa : 0,
                hits: row.hits,
                walks: row.walks,
                homeRuns: row.homeRuns,
                outs: row.outs
            }))
    }

    console.log(`[MANUAL ${name.toUpperCase()}]`, {
        runs: evaluation.actual.teamRunsPerGame,
        avg: evaluation.actual.avg,
        obp: evaluation.actual.obp,
        slg: evaluation.actual.slg,
        ops: evaluation.actual.ops,
        babip: evaluation.actual.babip,
        pitchesPerPA: evaluation.actual.pitchesPerPA,
        zSwing: evaluation.actual.swingAtStrikesPercent,
        chase: evaluation.actual.swingAtBallsPercent,
        zContact: evaluation.actual.inZoneContactPercent,
        chaseContact: evaluation.actual.outZoneContactPercent,
        bbPercent: evaluation.actual.bbPercent,
        soPercent: evaluation.actual.soPercent,
        homeRunPercent: evaluation.actual.homeRunPercent,
        teamHomeRunsPerGame: evaluation.actual.teamHomeRunsPerGame,
        teamHitsPerGame: evaluation.actual.teamHitsPerGame,
        teamBBPerGame: evaluation.actual.teamBBPerGame,
        targetRuns: evaluation.target.teamRunsPerGame,
        targetHomeRunPercent: evaluation.target.homeRunPercent,
        targetTeamHomeRunsPerGame: evaluation.target.teamHomeRunsPerGame
    })

    console.log(`[MANUAL ${name.toUpperCase()} RUN CONVERSION]`, {
        games,
        teamRunsPerGame: totalRuns / games / 2,
        teamHitsPerGame: totalHits / games / 2,
        teamHomeRunsPerGame: totalHomeRuns / games / 2,
        teamBBPerGame: totalWalks / games / 2,
        teamSOPerGame: totalStrikeouts / games / 2,
        leftOnBasePerTeamGame: totalLeftOnBase / games / 2,
        runnerOutsPerTeamGame: totalRunnerOuts / games / 2,
        scoredRunnerEventsPerTeamGame: totalRunnerScoredEvents / games / 2,
        paPerTeamGame: totalPlateAppearances / games / 2,
        runsPerHit: totalHits > 0 ? totalRuns / totalHits : 0,
        runsPerTimesOnBase: (totalHits + totalWalks) > 0 ? totalRuns / (totalHits + totalWalks) : 0
    })

    console.log(`[MANUAL ${name.toUpperCase()} BASE STATE]`, formatMap(baseState))
    console.log(`[MANUAL ${name.toUpperCase()} OUT STATE]`, formatMap(outState))

    return evaluation
}
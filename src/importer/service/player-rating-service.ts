import { PitchType, Position } from "../../sim/service/enums.js"
import { Game, GamePlayer, HitResultCount, HittingRatings, PitchEnvironmentTarget, PitchRatings, PitchResultCount, PitchTypeMovementStat, Player, PlayerFromStatsCommand, PlayerImportRaw, RatingTuning } from "../../sim/service/interfaces.js"
import { clamp, getAverage, safeDiv } from "../util.js"


import { v4 as uuidv4 } from 'uuid'
import { BaselineGameService } from "./baseline-game-service.js"
import { SimService } from "../../sim/service/sim-service.js"
import { StatService } from "../../sim/service/stat-service.js"


class PlayerRatingService {

    constructor(
        private simService: SimService, 
        private statService: StatService, 
        private baselineGameService: BaselineGameService) { }

    static createPlayerFromImportRaw(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw): PlayerFromStatsCommand {
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
            pitchEnvironmentTarget: pitchEnvironment
        }
    }

    static buildHittingRatings(command: PlayerFromStatsCommand): HittingRatings {
        const env = command.pitchEnvironmentTarget
        const avgRating = env.avgRating

        if (command.hitter.pa <= 0) {
            return this.emptyHittingRatings(env, command)
        }

        const hitter = command.hitter
        const vsR = command.splits.hitting.vsR
        const vsL = command.splits.hitting.vsL

        const leagueHitter = env.importReference.hitter
        const leagueRunning = env.importReference.running

        const leagueAvg = env.outcome.avg
        const leagueObp = env.outcome.obp
        const leagueSlg = env.outcome.slg
        const leagueOps = env.outcome.ops
        const leagueBBRate = env.outcome.bbPercent
        const leagueGapRate = env.outcome.doublePercent + env.outcome.triplePercent
        const leagueHRRate = env.outcome.homeRunPercent
        const leagueEV = leagueHitter.physics.exitVelocity.avg

        const avg = safeDiv(hitter.hits, hitter.ab, leagueAvg)
        const obp = this.getHitterObp(hitter, leagueObp)
        const slg = this.getHitterSlg(hitter, leagueSlg)
        const ops = obp + slg
        const bbRate = safeDiv(hitter.bb, hitter.pa, leagueBBRate)
        const gapRate = safeDiv(hitter.doubles + hitter.triples, hitter.pa, leagueGapRate)
        const hrRate = safeDiv(hitter.homeRuns, hitter.pa, leagueHRRate)
        const ev = hitter.exitVelocity?.avgExitVelo ?? leagueEV

        const zoneContactRate = safeDiv(hitter.inZoneContact, hitter.swingAtStrikes, env.swing.inZoneContactPercent / 100)
        const chaseSwingRate = safeDiv(hitter.swingAtBalls, hitter.pitchesSeen - hitter.inZonePitches, env.swing.swingAtBallsPercent / 100)

        const contact = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(avg, leagueAvg, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(obp, leagueObp, avgRating),
                this.getHigherIsBetterDelta(slg, leagueSlg, avgRating),
                this.getHigherIsBetterDelta(ops, leagueOps, avgRating),
                this.getHigherIsBetterDelta(ev, leagueEV, avgRating),
                this.getHigherIsBetterDelta(zoneContactRate, env.swing.inZoneContactPercent / 100, avgRating)
            ])
        ]))

        const plateDiscipline = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(bbRate, leagueBBRate, avgRating),
            this.getLowerIsBetterDelta(chaseSwingRate, env.swing.swingAtBallsPercent / 100, avgRating)
        ]))

        const gapPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(gapRate, leagueGapRate, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(slg, leagueSlg, avgRating),
                this.getHigherIsBetterDelta(ops, leagueOps, avgRating),
                this.getHigherIsBetterDelta(ev, leagueEV, avgRating)
            ])
        ]))

        const homerunPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(hrRate, leagueHRRate, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(slg, leagueSlg, avgRating),
                this.getHigherIsBetterDelta(ops, leagueOps, avgRating),
                this.getHigherIsBetterDelta(ev, leagueEV, avgRating)
            ])
        ]))

        const speed = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(safeDiv(command.running.sbAttempts ?? 0, hitter.pa), safeDiv(leagueRunning.sbAttempts, leagueHitter.pa), avgRating),
            this.getHigherIsBetterDelta(safeDiv(command.running.sb ?? 0, command.running.sbAttempts ?? 0), safeDiv(leagueRunning.sb, leagueRunning.sbAttempts), avgRating)
        ]))

        const steals = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(safeDiv(command.running.sb ?? 0, hitter.pa), safeDiv(leagueRunning.sb, leagueHitter.pa), avgRating),
            this.getHigherIsBetterDelta(safeDiv(command.running.sb ?? 0, command.running.sbAttempts ?? 0), safeDiv(leagueRunning.sb, leagueRunning.sbAttempts), avgRating)
        ]))

        const { defense, arm } = this.getFieldingRatings(env, command)

        return {
            speed,
            steals,
            defense,
            arm,
            contactProfile: this.getHitterContactProfile(command, env),
            vsR: {
                plateDiscipline: this.applyHittingSplit(env, plateDiscipline, vsR, hitter, "plateDiscipline"),
                contact: this.applyHittingSplit(env, contact, vsR, hitter, "contact"),
                gapPower: this.applyHittingSplit(env, gapPower, vsR, hitter, "gapPower"),
                homerunPower: this.applyHittingSplit(env, homerunPower, vsR, hitter, "homerunPower")
            },
            vsL: {
                plateDiscipline: this.applyHittingSplit(env, plateDiscipline, vsL, hitter, "plateDiscipline"),
                contact: this.applyHittingSplit(env, contact, vsL, hitter, "contact"),
                gapPower: this.applyHittingSplit(env, gapPower, vsL, hitter, "gapPower"),
                homerunPower: this.applyHittingSplit(env, homerunPower, vsL, hitter, "homerunPower")
            }
        }
    }

    private static applyHittingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "plateDiscipline" | "contact" | "gapPower" | "homerunPower"): number {
        if (!split || split.pa <= 0 || overall.pa <= 0) return baseRating

        const avgRating = env.avgRating
        const reliability = safeDiv(split.pa, overall.pa)

        const splitAvg = safeDiv(split.hits, split.ab, safeDiv(overall.hits, overall.ab))
        const overallAvg = safeDiv(overall.hits, overall.ab)

        const splitObp = this.getHitterObp(split, this.getHitterObp(overall))
        const overallObp = this.getHitterObp(overall)

        const splitSlg = this.getHitterSlg(split, this.getHitterSlg(overall))
        const overallSlg = this.getHitterSlg(overall)

        const splitOps = splitObp + splitSlg
        const overallOps = overallObp + overallSlg

        const splitBB = safeDiv(split.bb, split.pa, safeDiv(overall.bb, overall.pa))
        const overallBB = safeDiv(overall.bb, overall.pa)

        const splitGap = safeDiv(split.doubles + split.triples, split.pa, safeDiv(overall.doubles + overall.triples, overall.pa))
        const overallGap = safeDiv(overall.doubles + overall.triples, overall.pa)

        const splitHR = safeDiv(split.homeRuns, split.pa, safeDiv(overall.homeRuns, overall.pa))
        const overallHR = safeDiv(overall.homeRuns, overall.pa)

        const splitEV = split.exitVelocity > 0 ? split.exitVelocity : overall.exitVelocity?.avgExitVelo
        const overallEV = overall.exitVelocity?.avgExitVelo

        let delta = 0

        if (ratingType === "plateDiscipline") {
            delta = this.getHigherIsBetterDelta(splitBB, overallBB, avgRating)
        }

        if (ratingType === "contact") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitAvg, overallAvg, avgRating),
                this.averageDeltas([
                    this.getHigherIsBetterDelta(splitObp, overallObp, avgRating),
                    this.getHigherIsBetterDelta(splitSlg, overallSlg, avgRating),
                    this.getHigherIsBetterDelta(splitOps, overallOps, avgRating),
                    this.getHigherIsBetterDelta(splitEV, overallEV, avgRating)
                ])
            ])
        }

        if (ratingType === "gapPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitGap, overallGap, avgRating),
                this.averageDeltas([
                    this.getHigherIsBetterDelta(splitSlg, overallSlg, avgRating),
                    this.getHigherIsBetterDelta(splitOps, overallOps, avgRating),
                    this.getHigherIsBetterDelta(splitEV, overallEV, avgRating)
                ])
            ])
        }

        if (ratingType === "homerunPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitHR, overallHR, avgRating),
                this.averageDeltas([
                    this.getHigherIsBetterDelta(splitSlg, overallSlg, avgRating),
                    this.getHigherIsBetterDelta(splitOps, overallOps, avgRating),
                    this.getHigherIsBetterDelta(splitEV, overallEV, avgRating)
                ])
            ])
        }

        return this.rating(env, baseRating + (delta * reliability))
    }

    static buildPitchRatings(command: PlayerFromStatsCommand): PitchRatings {
        const env = command.pitchEnvironmentTarget
        const avgRating = env.avgRating

        if (command.pitcher.battersFaced <= 0) {
            return this.emptyPitchRatings(env)
        }

        const pitcher = command.pitcher
        const leaguePitcher = env.importReference.pitcher
        const vsR = command.splits.pitching.vsR
        const vsL = command.splits.pitching.vsL

        const powerScale = avgRating * 2

        const soRate = safeDiv(pitcher.so, pitcher.battersFaced, env.outcome.soPercent)
        const bbRate = safeDiv(pitcher.bbAllowed, pitcher.battersFaced, env.outcome.bbPercent)
        const hrRate = safeDiv(pitcher.homeRunsAllowed, pitcher.battersFaced, env.outcome.homeRunPercent)

        const leagueZoneContactAllowed = env.swing.inZoneContactPercent / 100
        const leagueChaseContactAllowed = env.swing.outZoneContactPercent / 100

        const zoneContactAllowed = safeDiv(
            pitcher.inZoneContactAllowed,
            pitcher.swingAtStrikesAllowed,
            leagueZoneContactAllowed
        )

        const chaseContactAllowed = safeDiv(
            pitcher.outZoneContactAllowed,
            pitcher.swingAtBallsAllowed,
            leagueChaseContactAllowed
        )

        const playerFastball = this.getFastballVelocity(command)
        const leagueFastball = this.getLeagueFastballVelocity(env)
        const playerMovement = this.getPitchMovement(command)
        const leagueMovement = this.getLeaguePitchMovement(env)

        const power = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(soRate, env.outcome.soPercent, powerScale),
            this.getHigherIsBetterDelta(playerFastball, leagueFastball, powerScale),
            this.averageDeltas([
                this.getLowerIsBetterDelta(zoneContactAllowed, leagueZoneContactAllowed, avgRating),
                this.getLowerIsBetterDelta(chaseContactAllowed, leagueChaseContactAllowed, avgRating)
            ])
        ]))

        const control = this.rating(env, avgRating + this.sumDeltas([
            this.getLowerIsBetterDelta(bbRate, env.outcome.bbPercent, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(
                    safeDiv(pitcher.strikesThrown, pitcher.pitchesThrown),
                    safeDiv(leaguePitcher.strikesThrown, leaguePitcher.pitchesThrown),
                    avgRating
                ),
                this.getHigherIsBetterDelta(
                    safeDiv(pitcher.pitchesThrown - pitcher.ballsThrown, pitcher.pitchesThrown),
                    safeDiv(leaguePitcher.pitchesThrown - leaguePitcher.ballsThrown, leaguePitcher.pitchesThrown),
                    avgRating
                )
            ])
        ]))

        const movement = this.rating(env, avgRating + this.sumDeltas([
            this.getLowerIsBetterDelta(hrRate, env.outcome.homeRunPercent, avgRating),
            this.averageDeltas([
                this.getLowerIsBetterDelta(zoneContactAllowed, leagueZoneContactAllowed, avgRating),
                this.getLowerIsBetterDelta(chaseContactAllowed, leagueChaseContactAllowed, avgRating),
                this.getHigherIsBetterDelta(playerMovement, leagueMovement, avgRating)
            ])
        ]))

        return {
            power,
            contactProfile: this.getPitcherContactProfile(command, env),
            vsR: {
                control: this.applyPitchingSplit(env, control, vsR, pitcher, "control"),
                movement: this.applyPitchingSplit(env, movement, vsR, pitcher, "movement")
            },
            vsL: {
                control: this.applyPitchingSplit(env, control, vsL, pitcher, "control"),
                movement: this.applyPitchingSplit(env, movement, vsL, pitcher, "movement")
            },
            pitches: this.getPitchTypes(command)
        }
    }

    private static getHitterObp(hitter: any, fallback = 0): number {
        return safeDiv((hitter.hits ?? 0) + (hitter.bb ?? 0) + (hitter.hbp ?? 0), hitter.pa ?? 0, fallback)
    }

    private static getHitterSlg(hitter: any, fallback = 0): number {
        const singles = (hitter.hits ?? 0) - (hitter.doubles ?? 0) - (hitter.triples ?? 0) - (hitter.homeRuns ?? 0)
        const totalBases = singles + ((hitter.doubles ?? 0) * 2) + ((hitter.triples ?? 0) * 3) + ((hitter.homeRuns ?? 0) * 4)

        return safeDiv(totalBases, hitter.ab ?? 0, fallback)
    }

    private static sumDeltas(values: number[]): number {
        return values
            .filter(value => Number.isFinite(value))
            .reduce((sum, value) => sum + value, 0)
    }

    static createPlayerFromStatsCommand(command: PlayerFromStatsCommand): { hittingRatings: HittingRatings, pitchRatings: PitchRatings } {
        const ratings = {
            hittingRatings: this.buildHittingRatings(command),
            pitchRatings: this.buildPitchRatings(command)
        }

        const ratingTuning = (command as any).ratingTuning as RatingTuning | undefined

        if (!ratingTuning) {
            return ratings
        }

        return this.applyRatingTuning(command.pitchEnvironmentTarget, ratings, ratingTuning)
    }

    private static applyRatingTuning(env: PitchEnvironmentTarget, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, ratingTuning: RatingTuning): { hittingRatings: HittingRatings, pitchRatings: PitchRatings } {
        const next = JSON.parse(JSON.stringify(ratings))
        const avgRating = Number(env.avgRating ?? 100)

        next.hittingRatings.vsR.contact = this.scaleRating(env, next.hittingRatings.vsR.contact, avgRating, ratingTuning.hitting.contactScale)
        next.hittingRatings.vsL.contact = this.scaleRating(env, next.hittingRatings.vsL.contact, avgRating, ratingTuning.hitting.contactScale)

        next.hittingRatings.vsR.plateDiscipline = this.scaleRating(env, next.hittingRatings.vsR.plateDiscipline, avgRating, ratingTuning.hitting.plateDisciplineScale)
        next.hittingRatings.vsL.plateDiscipline = this.scaleRating(env, next.hittingRatings.vsL.plateDiscipline, avgRating, ratingTuning.hitting.plateDisciplineScale)

        next.hittingRatings.vsR.gapPower = this.scaleRating(env, next.hittingRatings.vsR.gapPower, avgRating, ratingTuning.hitting.gapPowerScale)
        next.hittingRatings.vsL.gapPower = this.scaleRating(env, next.hittingRatings.vsL.gapPower, avgRating, ratingTuning.hitting.gapPowerScale)

        next.hittingRatings.vsR.homerunPower = this.scaleRating(env, next.hittingRatings.vsR.homerunPower, avgRating, ratingTuning.hitting.homerunPowerScale)
        next.hittingRatings.vsL.homerunPower = this.scaleRating(env, next.hittingRatings.vsL.homerunPower, avgRating, ratingTuning.hitting.homerunPowerScale)

        next.hittingRatings.speed = this.scaleRating(env, next.hittingRatings.speed, avgRating, ratingTuning.running.speedScale)
        next.hittingRatings.steals = this.scaleRating(env, next.hittingRatings.steals, avgRating, ratingTuning.running.stealsScale)
        next.hittingRatings.defense = this.scaleRating(env, next.hittingRatings.defense, avgRating, ratingTuning.fielding.defenseScale)
        next.hittingRatings.arm = this.scaleRating(env, next.hittingRatings.arm, avgRating, ratingTuning.fielding.armScale)

        this.applyHittingSplitScale(env, next.hittingRatings, avgRating, ratingTuning.hitting.splitScale)

        next.pitchRatings.power = this.scaleRating(env, next.pitchRatings.power, avgRating, ratingTuning.pitching.powerScale)
        next.pitchRatings.vsR.control = this.scaleRating(env, next.pitchRatings.vsR.control, avgRating, ratingTuning.pitching.controlScale)
        next.pitchRatings.vsL.control = this.scaleRating(env, next.pitchRatings.vsL.control, avgRating, ratingTuning.pitching.controlScale)
        next.pitchRatings.vsR.movement = this.scaleRating(env, next.pitchRatings.vsR.movement, avgRating, ratingTuning.pitching.movementScale)
        next.pitchRatings.vsL.movement = this.scaleRating(env, next.pitchRatings.vsL.movement, avgRating, ratingTuning.pitching.movementScale)

        this.applyPitchingSplitScale(env, next.pitchRatings, avgRating, ratingTuning.pitching.splitScale)

        return next
    }

    private static applyHittingSplitScale(env: PitchEnvironmentTarget, ratings: HittingRatings, avgRating: number, splitScale: number): void {
        const keys = ["plateDiscipline", "contact", "gapPower", "homerunPower"] as const
        const multiplier = 1 + Number(splitScale ?? 0)

        for (const key of keys) {
            const midpoint = (Number(ratings.vsR[key]) + Number(ratings.vsL[key])) / 2

            ratings.vsR[key] = this.rating(env, midpoint + ((Number(ratings.vsR[key]) - midpoint) * multiplier))
            ratings.vsL[key] = this.rating(env, midpoint + ((Number(ratings.vsL[key]) - midpoint) * multiplier))
        }
    }

    private static applyPitchingSplitScale(env: PitchEnvironmentTarget, ratings: PitchRatings, avgRating: number, splitScale: number): void {
        const keys = ["control", "movement"] as const
        const multiplier = 1 + Number(splitScale ?? 0)

        for (const key of keys) {
            const midpoint = (Number(ratings.vsR[key]) + Number(ratings.vsL[key])) / 2

            ratings.vsR[key] = this.rating(env, midpoint + ((Number(ratings.vsR[key]) - midpoint) * multiplier))
            ratings.vsL[key] = this.rating(env, midpoint + ((Number(ratings.vsL[key]) - midpoint) * multiplier))
        }
    }

    private static scaleRating(env: PitchEnvironmentTarget, rating: number, avgRating: number, scale: number): number {
        return this.rating(
            env,
            Number(rating) * (1 + Number(scale ?? 0))
        )
    }


    private static applyPitchingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "control" | "movement"): number {
        if (!split || split.battersFaced <= 0 || overall.battersFaced <= 0) return baseRating

        const avgRating = env.avgRating
        const splitBB = safeDiv(split.bbAllowed, split.battersFaced, safeDiv(overall.bbAllowed, overall.battersFaced))
        const overallBB = safeDiv(overall.bbAllowed, overall.battersFaced)
        const splitHR = safeDiv(split.homeRunsAllowed, split.battersFaced, safeDiv(overall.homeRunsAllowed, overall.battersFaced))
        const overallHR = safeDiv(overall.homeRunsAllowed, overall.battersFaced)
        const splitSO = safeDiv(split.so, split.battersFaced, safeDiv(overall.so, overall.battersFaced))
        const overallSO = safeDiv(overall.so, overall.battersFaced)

        if (ratingType === "control") {
            return this.rating(env, baseRating + this.averageDeltas([this.getLowerIsBetterDelta(splitBB, overallBB, avgRating), this.getHigherIsBetterDelta(splitSO, overallSO, avgRating)]))
        }

        return this.rating(env, baseRating + this.averageDeltas([this.getLowerIsBetterDelta(splitHR, overallHR, avgRating), this.getHigherIsBetterDelta(splitSO, overallSO, avgRating)]))
    }

    private static getHitterContactProfile(command: PlayerFromStatsCommand, env: PitchEnvironmentTarget) {
        const total = command.hitter.groundBalls + command.hitter.flyBalls + command.hitter.lineDrives

        if (total <= 0) {
            return {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            }
        }

        return this.allocateToHundred({
            groundball: command.hitter.groundBalls,
            flyBall: command.hitter.flyBalls,
            lineDrive: command.hitter.lineDrives
        })
    }

    private static getPitcherContactProfile(command: PlayerFromStatsCommand, env: PitchEnvironmentTarget) {
        const total = command.pitcher.groundBallsAllowed + command.pitcher.flyBallsAllowed + command.pitcher.lineDrivesAllowed

        if (total <= 0) {
            return {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            }
        }

        return this.allocateToHundred({
            groundball: command.pitcher.groundBallsAllowed,
            flyBall: command.pitcher.flyBallsAllowed,
            lineDrive: command.pitcher.lineDrivesAllowed
        })
    }

    private static getPitchTypes(command: PlayerFromStatsCommand): PitchType[] {
        const pitchTypes = command.pitcher.pitchTypes ?? {}
        const validPitchTypes = new Set(Object.values(PitchType) as PitchType[])

        const pitches = Object.entries(pitchTypes)
            .filter(([pitchType, stat]) => {
                return validPitchTypes.has(pitchType as PitchType) &&
                    !!stat &&
                    Number((stat as any).count ?? 0) > 0
            })
            .sort((a, b) => Number((b[1] as any).count ?? 0) - Number((a[1] as any).count ?? 0))
            .slice(0, 5)
            .map(([pitchType]) => pitchType as PitchType)

        return pitches.length > 0 ? pitches : [PitchType.FF]
    }

    private static getFastballVelocity(command: PlayerFromStatsCommand): number {
        const pitchTypes = command.pitcher.pitchTypes ?? {}
        const fastballs = [pitchTypes[PitchType.FF], pitchTypes[PitchType.SI], pitchTypes[PitchType.FC]].filter((p): p is PitchTypeMovementStat => !!p && p.count > 0)

        if (fastballs.length === 0) return 0

        return Math.max(...fastballs.map(p => p.avgMph))
    }

    private static getLeagueFastballVelocity(env: PitchEnvironmentTarget): number {
        const pitchTypes = env.importReference.pitcher.physics.byPitchType ?? {}
        const fastballs = [pitchTypes[PitchType.FF], pitchTypes[PitchType.SI], pitchTypes[PitchType.FC]].filter(p => !!p && p.count > 0)

        if (fastballs.length === 0) return env.importReference.pitcher.physics.velocity.avg

        return Math.max(...fastballs.map(p => p.avgVelocity))
    }

    private static getPitchMovement(command: PlayerFromStatsCommand): number {
        const entries = Object.values(command.pitcher.pitchTypes ?? {}).filter((p): p is PitchTypeMovementStat => !!p && p.count > 0)
        const total = entries.reduce((sum, p) => sum + p.count, 0)

        if (total <= 0) return 0

        return entries.reduce((sum, p) => sum + ((Math.abs(p.avgHorizontalBreak) + Math.abs(p.avgVerticalBreak)) * p.count), 0) / total
    }

    private static getLeaguePitchMovement(env: PitchEnvironmentTarget): number {
        const entries = Object.values(env.importReference.pitcher.physics.byPitchType ?? {}).filter(p => !!p && p.count > 0)
        const total = entries.reduce((sum, p) => sum + p.count, 0)

        if (total <= 0) {
            return Math.abs(env.importReference.pitcher.physics.horizontalBreak.avg) + Math.abs(env.importReference.pitcher.physics.verticalBreak.avg)
        }

        return entries.reduce((sum, p) => sum + ((Math.abs(p.avgHorizontalBreak) + Math.abs(p.avgVerticalBreak)) * p.count), 0) / total
    }

    private static emptyHittingRatings(env: PitchEnvironmentTarget, command?: PlayerFromStatsCommand): HittingRatings {
        const low = env.avgRating / 2
        const avgRating = env.avgRating

        const fieldingRatings = command
            ? this.getFieldingRatings(env, command)
            : { defense: avgRating, arm: avgRating }

        return {
            speed: avgRating,
            steals: avgRating,
            defense: fieldingRatings.defense,
            arm: fieldingRatings.arm,
            contactProfile: {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            },
            vsR: {
                plateDiscipline: low,
                contact: low,
                gapPower: low,
                homerunPower: low
            },
            vsL: {
                plateDiscipline: low,
                contact: low,
                gapPower: low,
                homerunPower: low
            }
        }
    }

    private static emptyPitchRatings(env: PitchEnvironmentTarget): PitchRatings {
        const low = env.avgRating / 2

        return {
            power: low,
            contactProfile: {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            },
            vsR: {
                control: low,
                movement: low
            },
            vsL: {
                control: low,
                movement: low
            },
            pitches: [
                PitchType.FF
            ]
        }
    }

    private static getFieldingRatings(env: PitchEnvironmentTarget, command: PlayerFromStatsCommand): { defense: number, arm: number } {
        const avgRating = env.avgRating
        const leagueFielding = env.importReference.fielding

        const fieldingChances =
            (command.fielding.errors ?? 0) +
            (command.fielding.assists ?? 0) +
            (command.fielding.putouts ?? 0)

        if (fieldingChances <= 0) {
            return {
                defense: avgRating,
                arm: avgRating
            }
        }

        const leagueFieldingPct = safeDiv(
            leagueFielding.chances - leagueFielding.errors,
            leagueFielding.chances
        )

        const fieldingPct = safeDiv(
            fieldingChances - (command.fielding.errors ?? 0),
            fieldingChances,
            leagueFieldingPct
        )

        const assistShare = safeDiv(
            command.fielding.assists ?? 0,
            fieldingChances,
            safeDiv(leagueFielding.assists, leagueFielding.chances)
        )

        const defense = this.rating(
            env,
            avgRating + this.getHigherIsBetterDelta(fieldingPct, leagueFieldingPct, avgRating)
        )

        const arm = this.rating(
            env,
            avgRating + this.averageDeltas([
                this.getHigherIsBetterDelta(
                    assistShare,
                    safeDiv(leagueFielding.assists, leagueFielding.chances),
                    avgRating
                ),
                this.getHigherIsBetterDelta(
                    safeDiv(command.fielding.outfieldAssists ?? 0, fieldingChances),
                    safeDiv(leagueFielding.outfieldAssists, leagueFielding.chances),
                    avgRating
                ),
                this.getHigherIsBetterDelta(
                    safeDiv(
                        command.fielding.catcherCaughtStealing ?? 0,
                        (command.fielding.catcherCaughtStealing ?? 0) + (command.fielding.catcherStolenBasesAllowed ?? 0)
                    ),
                    safeDiv(
                        leagueFielding.catcherCaughtStealing,
                        leagueFielding.catcherCaughtStealing + leagueFielding.catcherStolenBasesAllowed
                    ),
                    avgRating
                )
            ])
        )

        return {
            defense,
            arm
        }
    }

    private static allocateToHundred(values: { groundball: number, flyBall: number, lineDrive: number }): { groundball: number, flyBall: number, lineDrive: number } {
        const total = values.groundball + values.flyBall + values.lineDrive

        if (total <= 0) {
            return {
                groundball: 0,
                flyBall: 0,
                lineDrive: 0
            }
        }

        const exact = [
            { key: "groundball" as const, value: (values.groundball / total) * 100 },
            { key: "flyBall" as const, value: (values.flyBall / total) * 100 },
            { key: "lineDrive" as const, value: (values.lineDrive / total) * 100 }
        ]

        const rounded = exact.map(item => ({
            key: item.key,
            value: Math.floor(item.value),
            remainder: item.value - Math.floor(item.value)
        }))

        let remaining = 100 - rounded.reduce((sum, item) => sum + item.value, 0)

        rounded.sort((a, b) => b.remainder - a.remainder)

        for (const item of rounded) {
            if (remaining <= 0) break
            item.value++
            remaining--
        }

        return {
            groundball: rounded.find(item => item.key === "groundball")?.value ?? 0,
            flyBall: rounded.find(item => item.key === "flyBall")?.value ?? 0,
            lineDrive: rounded.find(item => item.key === "lineDrive")?.value ?? 0
        }
    }

    private static averageDeltas(values: number[]): number {
        const finite = values.filter(value => Number.isFinite(value))

        if (finite.length === 0) return 0

        return getAverage(finite)
    }

    private static rating(env: PitchEnvironmentTarget, value: number): number {
        return Math.round(clamp(value, env.avgRating / 2, env.avgRating * 2))
    }

    static getHigherIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (!Number.isFinite(playerRate) || !Number.isFinite(baselineRate) || !Number.isFinite(scale)) return 0
        if (playerRate <= 0 || baselineRate <= 0 || scale <= 0) return 0

        const ratio = playerRate / baselineRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    static getLowerIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (!Number.isFinite(playerRate) || !Number.isFinite(baselineRate) || !Number.isFinite(scale)) return 0
        if (playerRate <= 0 || baselineRate <= 0 || scale <= 0) return 0

        const ratio = baselineRate / playerRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    static seedRatingTuning(): RatingTuning {
        return {
            _id: uuidv4(),

            hitting: {
                contactScale: 0,
                plateDisciplineScale: 0,
                gapPowerScale: 0,
                homerunPowerScale: 0,
                splitScale: 0
            },

            pitching: {
                powerScale: 0,
                controlScale: 0,
                movementScale: 0,
                splitScale: 0
            },

            running: {
                speedScale: 0,
                stealsScale: 0
            },

            fielding: {
                defenseScale: 0,
                armScale: 0
            }
        }
    }

    public printRatingIterationDiagnostics(stage: string, iteration: number, maxIterations: number, gamesPerIteration: number, candidate: RatingTuning, result: { actual: any, target: any, diff: any, score: number }): void {
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

        const stageToken =
            baseStage === "seed" ? "seed" :
            baseStage === "trial" ? "try" :
            baseStage === "confirm" ? "conf" :
            baseStage === "accepted" ? "acc" :
            baseStage === "final" ? "final" :
            baseStage

        const labelToken = bracketLabel ? `:${bracketLabel}` : ""

        console.log(
            `R${iteration} ${stageToken}${labelToken} | ` +
            `G=${gamesPerIteration} ` +
            `S=${r(result.score, 1)} ` +
            `players=${result.actual?.players?.length ?? 0} ` +
            `T[` +
            `hCt=${r(candidate.hitting.contactScale, 2)} ` +
            `hDisc=${r(candidate.hitting.plateDisciplineScale, 2)} ` +
            `hGap=${r(candidate.hitting.gapPowerScale, 2)} ` +
            `hHR=${r(candidate.hitting.homerunPowerScale, 2)} ` +
            `hSplit=${r(candidate.hitting.splitScale, 2)} ` +
            `pPow=${r(candidate.pitching.powerScale, 2)} ` +
            `pCtrl=${r(candidate.pitching.controlScale, 2)} ` +
            `pMov=${r(candidate.pitching.movementScale, 2)} ` +
            `pSplit=${r(candidate.pitching.splitScale, 2)} ` +
            `spd=${r(candidate.running.speedScale, 2)} ` +
            `stl=${r(candidate.running.stealsScale, 2)} ` +
            `def=${r(candidate.fielding.defenseScale, 2)} ` +
            `arm=${r(candidate.fielding.armScale, 2)}]`
        )
    }

    public isRatingCloseEnough(diff: any): boolean {
        return false
    }    

    public evaluatePlayerRatings(pitchEnvironment: PitchEnvironmentTarget, ratingTuning: RatingTuning, players: PlayerImportRaw[], rng: Function, gamesPerPlayer: number = 30): { actual: any, target: any, diff: any, score: number } {
        const results = players.map(playerImportRaw => this.evaluatePlayerRating(pitchEnvironment, ratingTuning, playerImportRaw, rng, gamesPerPlayer))
        const validResults = results.filter(result => Number.isFinite(Number(result.score)))

        const hitterResults = this.getRatingResultBlocks(validResults, "hitter")
        const pitcherResults = this.getRatingResultBlocks(validResults, "pitcher")

        const hitterActual = this.averageRatingMetricBlock(hitterResults.map(result => result.actual))
        const hitterTarget = this.averageRatingMetricBlock(hitterResults.map(result => result.target))
        const hitterDiff = this.getRatingEvaluationDiff(hitterActual, hitterTarget)

        const pitcherActual = this.averageRatingMetricBlock(pitcherResults.map(result => result.actual))
        const pitcherTarget = this.averageRatingMetricBlock(pitcherResults.map(result => result.target))
        const pitcherDiff = this.getRatingEvaluationDiff(pitcherActual, pitcherTarget)

        const score = validResults.length > 0
            ? validResults.reduce((sum, result) => sum + Number(result.score), 0) / validResults.length
            : Number.MAX_SAFE_INTEGER

        return {
            actual: {
                playerCount: results.length,
                hitterCount: hitterResults.length,
                pitcherCount: pitcherResults.length,
                twoWayCount: results.filter(result => result.role === "twoWay").length,
                hitterScore: this.averageScore(hitterResults),
                pitcherScore: this.averageScore(pitcherResults),
                hitter: hitterActual,
                pitcher: pitcherActual
            },
            target: {
                hitter: hitterTarget,
                pitcher: pitcherTarget
            },
            diff: {
                hitter: hitterDiff,
                pitcher: pitcherDiff
            },
            score
        }
    }

    private evaluatePlayerRating(pitchEnvironment: PitchEnvironmentTarget, ratingTuning: RatingTuning, playerImportRaw: PlayerImportRaw, rng: Function, gamesPerPlayer: number): any {
        const command = PlayerRatingService.createPlayerFromImportRaw(pitchEnvironment, playerImportRaw)

        ;(command as any).ratingTuning = ratingTuning

        const ratings = PlayerRatingService.createPlayerFromStatsCommand(command)
        const role = this.getPlayerEvaluationRole(playerImportRaw)

        if (role === "pitcher") {
            return this.evaluatePitcherRating(pitchEnvironment, playerImportRaw, ratings, rng, gamesPerPlayer)
        }

        if (role === "twoWay") {
            const hitterResult = this.evaluateHitterRating(pitchEnvironment, playerImportRaw, ratings, rng, gamesPerPlayer)
            const pitcherResult = this.evaluatePitcherRating(pitchEnvironment, playerImportRaw, ratings, rng, gamesPerPlayer)

            return {
                playerId: playerImportRaw.playerId,
                name: `${playerImportRaw.firstName} ${playerImportRaw.lastName}`,
                role,
                actual: {
                    hitter: hitterResult.actual,
                    pitcher: pitcherResult.actual
                },
                target: {
                    hitter: hitterResult.target,
                    pitcher: pitcherResult.target
                },
                diff: {
                    hitter: hitterResult.diff,
                    pitcher: pitcherResult.diff
                },
                score: (hitterResult.score + pitcherResult.score) / 2,
                ratings
            }
        }

        return this.evaluateHitterRating(pitchEnvironment, playerImportRaw, ratings, rng, gamesPerPlayer)
    }

    private evaluateHitterRating(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, rng: Function, gamesPerPlayer: number): any {
        const player = this.buildPlayerFromImportRawAndRatings(playerImportRaw, ratings, false)
        const actual = this.simHitterForRatingEvaluation(pitchEnvironment, playerImportRaw, player, rng, gamesPerPlayer)
        const target = this.getHitterRatingTarget(playerImportRaw)
        const diff = this.getRatingEvaluationDiff(actual, target)
        const score = this.scoreHitterRatingEvaluationDiff(diff)

        return {
            playerId: playerImportRaw.playerId,
            name: `${playerImportRaw.firstName} ${playerImportRaw.lastName}`,
            role: "hitter",
            actual,
            target,
            diff,
            score,
            ratings
        }
    }

    private evaluatePitcherRating(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, rng: Function, gamesPerPlayer: number): any {
        const player = this.buildPlayerFromImportRawAndRatings(playerImportRaw, ratings, true)
        
        
        
        
        const actual = this.simPitcherForRatingEvaluation(pitchEnvironment, playerImportRaw, player, rng, gamesPerPlayer)
        const target = this.getPitcherRatingTarget(playerImportRaw)
        const diff = this.getRatingEvaluationDiff(actual, target)
        const score = this.scorePitcherRatingEvaluationDiff(diff)

        return {
            playerId: playerImportRaw.playerId,
            name: `${playerImportRaw.firstName} ${playerImportRaw.lastName}`,
            role: "pitcher",
            actual,
            target,
            diff,
            score,
            ratings
        }
    }

    private simHitterForRatingEvaluation(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, player: Player, rng: Function, gamesPerPlayer: number): any {
        let total: HitResultCount = {} as HitResultCount

        for (let i = 0; i < gamesPerPlayer; i++) {
            const game = this.baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `rating-hitter-${playerImportRaw.playerId}-${i}`)

            while (!game.isComplete) {
                this.simService.simPitch(game, rng)
            }

            this.simService.finishGame(game)

            const gamePlayer = this.findGamePlayer(game, player._id)

            if (gamePlayer?.hitResult) {
                total = this.baselineGameService.mergeHitResults(total, gamePlayer.hitResult)
            }
        }

        return this.getHitterRatingActual(total)
    }

    private simPitcherForRatingEvaluation(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, player: Player, rng: Function, gamesPerPlayer: number): any {
        let total: PitchResultCount = {} as PitchResultCount

        for (let i = 0; i < gamesPerPlayer; i++) {
            const game = this.baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `rating-pitcher-${playerImportRaw.playerId}-${i}`)

            while (!game.isComplete) {
                this.simService.simPitch(game, rng)
            }

            this.simService.finishGame(game)

            const gamePlayer = this.findGamePlayer(game, player._id)

            if (gamePlayer?.pitchResult) {
                total = this.baselineGameService.mergePitchResults(total, gamePlayer.pitchResult)
            }
        }

        return this.getPitcherRatingActual(total)
    }

    private buildPlayerFromImportRawAndRatings(playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, forcePitcher: boolean = false): Player {
        const isPitcher = forcePitcher || playerImportRaw.primaryPosition === Position.PITCHER
        const isStarter = Number(playerImportRaw.pitching?.starts ?? 0) > 0

        return {
            _id: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: isPitcher ? Position.PITCHER : playerImportRaw.primaryPosition,
            secondaryPositions: playerImportRaw.secondaryPositions ?? [],
            zodiacSign: "Aries",
            throws: playerImportRaw.throws,
            hits: playerImportRaw.bats,
            isRetired: false,
            stamina: isPitcher ? 1 : 0,
            maxPitchCount: isPitcher ? (isStarter ? 100 : 30) : 0,
            overallRating: 100,
            hittingRatings: ratings.hittingRatings,
            pitchRatings: ratings.pitchRatings,
            age: playerImportRaw.age
        } as Player
    }

    private getPlayerEvaluationRole(playerImportRaw: PlayerImportRaw): "hitter" | "pitcher" | "twoWay" {
        const hasHitting = Number(playerImportRaw.hitting?.pa ?? 0) > 0
        const hasPitching = Number(playerImportRaw.pitching?.battersFaced ?? 0) > 0

        if (hasHitting && hasPitching) return "twoWay"
        if (hasPitching) return "pitcher"

        return "hitter"
    }

    private getHitterRatingActual(total: HitResultCount): any {
        const pa = Number((total as any).pa ?? 0)
        const ab = Number((total as any).atBats ?? (total as any).ab ?? 0)
        const hits = Number((total as any).hits ?? 0)
        const bb = Number((total as any).bb ?? 0)
        const so = Number((total as any).so ?? 0)
        const hbp = Number((total as any).hbp ?? 0)
        const doubles = Number((total as any).doubles ?? 0)
        const triples = Number((total as any).triples ?? 0)
        const hr = Number((total as any).homeRuns ?? (total as any).hr ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            pa,
            avg: safeDiv(hits, ab),
            obp: safeDiv(hits + bb + hbp, pa),
            slg: safeDiv(totalBases, ab),
            ops: safeDiv(hits + bb + hbp, pa) + safeDiv(totalBases, ab),
            babip: safeDiv(hits - hr, ballsInPlay),
            singlePercent: safeDiv(singles, pa),
            doublePercent: safeDiv(doubles, pa),
            triplePercent: safeDiv(triples, pa),
            homeRunPercent: safeDiv(hr, pa),
            xbhPercent: safeDiv(doubles + triples + hr, pa),
            soPercent: safeDiv(so, pa),
            bbPercent: safeDiv(bb, pa)
        }
    }

    private getPitcherRatingActual(total: PitchResultCount): any {
        const bf = Number((total as any).battersFaced ?? 0)
        const outs = Number((total as any).outs ?? 0)
        const er = Number((total as any).er ?? (total as any).earnedRuns ?? 0)
        const hits = Number((total as any).hits ?? 0)
        const bb = Number((total as any).bb ?? 0)
        const hbp = Number((total as any).hbp ?? 0)
        const so = Number((total as any).so ?? 0)
        const doubles = Number((total as any).doubles ?? 0)
        const triples = Number((total as any).triples ?? 0)
        const hr = Number((total as any).homeRuns ?? (total as any).hr ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const ab = Math.max(0, bf - bb - hbp)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            battersFaced: bf,
            era: safeDiv(er * 27, outs),
            avg: safeDiv(hits, ab),
            obp: safeDiv(hits + bb + hbp, bf),
            slg: safeDiv(totalBases, ab),
            ops: safeDiv(hits + bb + hbp, bf) + safeDiv(totalBases, ab),
            babip: safeDiv(hits - hr, ballsInPlay),
            singlePercent: safeDiv(singles, bf),
            doublePercent: safeDiv(doubles, bf),
            triplePercent: safeDiv(triples, bf),
            homeRunPercent: safeDiv(hr, bf),
            xbhPercent: safeDiv(doubles + triples + hr, bf),
            soPercent: safeDiv(so, bf),
            bbPercent: safeDiv(bb, bf)
        }
    }

    private getHitterRatingTarget(playerImportRaw: PlayerImportRaw): any {
        const h = playerImportRaw.hitting
        const pa = Number(h.pa ?? 0)
        const ab = Number(h.ab ?? 0)
        const hits = Number(h.hits ?? 0)
        const bb = Number(h.bb ?? 0)
        const so = Number(h.so ?? 0)
        const hbp = Number(h.hbp ?? 0)
        const doubles = Number(h.doubles ?? 0)
        const triples = Number(h.triples ?? 0)
        const hr = Number(h.homeRuns ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            pa,
            avg: safeDiv(hits, ab),
            obp: safeDiv(hits + bb + hbp, pa),
            slg: safeDiv(totalBases, ab),
            ops: safeDiv(hits + bb + hbp, pa) + safeDiv(totalBases, ab),
            babip: safeDiv(hits - hr, ballsInPlay),
            singlePercent: safeDiv(singles, pa),
            doublePercent: safeDiv(doubles, pa),
            triplePercent: safeDiv(triples, pa),
            homeRunPercent: safeDiv(hr, pa),
            xbhPercent: safeDiv(doubles + triples + hr, pa),
            soPercent: safeDiv(so, pa),
            bbPercent: safeDiv(bb, pa)
        }
    }

    private getPitcherRatingTarget(playerImportRaw: PlayerImportRaw): any {
        const p = playerImportRaw.pitching
        const bf = Number(p.battersFaced ?? 0)
        const outs = Number(p.outs ?? 0)
        const er = Number(p.earnedRunsAllowed ?? 0)
        const hits = Number(p.hitsAllowed ?? 0)
        const bb = Number(p.bbAllowed ?? 0)
        const hbp = Number(p.hbpAllowed ?? 0)
        const so = Number(p.so ?? 0)
        const doubles = Number(p.doublesAllowed ?? 0)
        const triples = Number(p.triplesAllowed ?? 0)
        const hr = Number(p.homeRunsAllowed ?? 0)
        const singles = Math.max(0, hits - doubles - triples - hr)
        const ab = Math.max(0, bf - bb - hbp)
        const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
        const ballsInPlay = Math.max(0, ab - so - hr)

        return {
            battersFaced: bf,
            era: safeDiv(er * 27, outs),
            avg: safeDiv(hits, ab),
            obp: safeDiv(hits + bb + hbp, bf),
            slg: safeDiv(totalBases, ab),
            ops: safeDiv(hits + bb + hbp, bf) + safeDiv(totalBases, ab),
            babip: safeDiv(hits - hr, ballsInPlay),
            singlePercent: safeDiv(singles, bf),
            doublePercent: safeDiv(doubles, bf),
            triplePercent: safeDiv(triples, bf),
            homeRunPercent: safeDiv(hr, bf),
            xbhPercent: safeDiv(doubles + triples + hr, bf),
            soPercent: safeDiv(so, bf),
            bbPercent: safeDiv(bb, bf)
        }
    }

    private getRatingEvaluationDiff(actual: any, target: any): any {
        const diff: any = {}

        for (const key of Object.keys(target)) {
            if (Number.isFinite(Number(actual[key])) && Number.isFinite(Number(target[key]))) {
                diff[key] = Number(actual[key]) - Number(target[key])
            }
        }

        return diff
    }

    private scorePitcherRatingEvaluationDiff(diff: any): number {
        const sq = (value: any): number => {
            const n = Number(value ?? 0)
            return Number.isFinite(n) ? n * n : 0
        }

        return (
            sq(diff.era) * 250000 +
            sq(diff.avg) * 30000000 +
            sq(diff.obp) * 30000000 +
            sq(diff.slg) * 25000000 +
            sq(diff.babip) * 30000000 +
            sq(diff.singlePercent) * 15000000 +
            sq(diff.doublePercent) * 20000000 +
            sq(diff.triplePercent) * 120000000 +
            sq(diff.homeRunPercent) * 60000000 +
            sq(diff.soPercent) * 60000000 +
            sq(diff.bbPercent) * 60000000
        )
    }

    private scoreHitterRatingEvaluationDiff(diff: any): number {
        const sq = (value: any): number => {
            const n = Number(value ?? 0)
            return Number.isFinite(n) ? n * n : 0
        }

        return (
            sq(diff.avg) * 100000000 +
            sq(diff.obp) * 90000000 +
            sq(diff.slg) * 70000000 +
            sq(diff.ops) * 40000000 +
            sq(diff.babip) * 70000000 +
            sq(diff.singlePercent) * 30000000 +
            sq(diff.doublePercent) * 50000000 +
            sq(diff.triplePercent) * 200000000 +
            sq(diff.homeRunPercent) * 80000000 +
            sq(diff.soPercent) * 60000000 +
            sq(diff.bbPercent) * 60000000
        )
    }

    private getRatingResultBlocks(results: any[], block: "hitter" | "pitcher"): any[] {
        const blocks: any[] = []

        for (const result of results) {
            if (block === "hitter" && result.role === "hitter") {
                blocks.push(result)
            }

            if (block === "pitcher" && result.role === "pitcher") {
                blocks.push(result)
            }

            if (result.role === "twoWay" && result.actual?.[block] && result.target?.[block]) {
                blocks.push({
                    playerId: result.playerId,
                    name: result.name,
                    role: block,
                    actual: result.actual[block],
                    target: result.target[block],
                    diff: result.diff?.[block] ?? this.getRatingEvaluationDiff(result.actual[block], result.target[block]),
                    score: Number(result.score)
                })
            }
        }

        return blocks
    }

    private averageRatingMetricBlock(blocks: any[]): any {
        const keys = new Set<string>()

        for (const block of blocks) {
            for (const key of Object.keys(block ?? {})) {
                keys.add(key)
            }
        }

        const averaged: any = {}

        for (const key of keys) {
            const values = blocks
                .map(block => Number(block?.[key]))
                .filter(value => Number.isFinite(value))

            averaged[key] = values.length > 0
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : 0
        }

        return averaged
    }

    private findGamePlayer(game: Game, playerId: string): GamePlayer | undefined {
        return game.away.players.find(p => p._id === playerId) ??
            game.home.players.find(p => p._id === playerId)
    }

    private averageScore(results: any[]): number {
        const scores = results.map(result => Number(result.score)).filter(score => Number.isFinite(score))
        return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
    }

}

export { PlayerRatingService }
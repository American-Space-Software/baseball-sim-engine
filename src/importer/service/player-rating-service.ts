import { PitchType, Position } from "../../sim/service/enums.js"
import { Game, GamePlayer, HitResultCount, HittingRatings, PitchEnvironmentTarget, PitchRatings, PitchResultCount, PitchTypeMovementStat, Player, PlayerFromStatsCommand, PlayerImportRaw, RatingTuning } from "../../sim/service/interfaces.js"
import { clamp, getAverage, safeDiv } from "../util.js"


import { v4 as uuidv4 } from 'uuid'
import { BaselineGameService } from "./baseline-game-service.js"
import { GameInfo, SimService } from "../../sim/service/sim-service.js"
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

        const leagueAvg = env.outcome.avg
        const leagueBBRate = env.outcome.bbPercent
        const leagueSORate = env.outcome.soPercent
        const leagueEV = leagueHitter.physics.exitVelocity.avg

        const avg = safeDiv(hitter.hits, hitter.ab, leagueAvg)
        const bbRate = safeDiv(hitter.bb, hitter.pa, leagueBBRate)
        const soRate = safeDiv(hitter.so, hitter.pa, leagueSORate)
        const ev = hitter.exitVelocity?.avgExitVelo ?? leagueEV
        const chaseSwingRate = safeDiv(hitter.swingAtBalls, hitter.pitchesSeen - hitter.inZonePitches, env.swing.swingAtBallsPercent / 100)
        const babip = safeDiv(hitter.hits - hitter.homeRuns, hitter.ab - hitter.so - hitter.homeRuns, env.outcome.babip)

        const playerPowerOutcomeCount = this.getHitterPowerOutcomeCount(hitter)
        const leaguePowerOutcomeCount = this.getHitterPowerOutcomeCount(leagueHitter)

        const playerGap = Number(hitter.doubles ?? 0) + Number(hitter.triples ?? 0)
        const leagueGap = Number(leagueHitter.doubles ?? 0) + Number(leagueHitter.triples ?? 0)
        const playerHR = Number(hitter.homeRuns ?? 0)
        const leagueHR = Number(leagueHitter.homeRuns ?? 0)

        const playerXBH = playerGap + playerHR
        const leagueXBH = leagueGap + leagueHR

        const gapRate = safeDiv(playerGap, playerPowerOutcomeCount, safeDiv(leagueGap, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent))
        const leagueGapRate = safeDiv(leagueGap, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent)

        const hrRate = safeDiv(playerHR, playerPowerOutcomeCount, safeDiv(leagueHR, leaguePowerOutcomeCount, env.outcome.homeRunPercent))
        const leagueHRRate = safeDiv(leagueHR, leaguePowerOutcomeCount, env.outcome.homeRunPercent)

        const xbhRate = safeDiv(playerXBH, playerPowerOutcomeCount, safeDiv(leagueXBH, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent + env.outcome.homeRunPercent))
        const leagueXBHRate = safeDiv(leagueXBH, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent + env.outcome.homeRunPercent)

        const hrShareOfXBH = safeDiv(playerHR, playerXBH, safeDiv(leagueHR, leagueXBH))
        const leagueHRShareOfXBH = safeDiv(leagueHR, leagueXBH)

        const gapShareOfXBH = safeDiv(playerGap, playerXBH, safeDiv(leagueGap, leagueXBH))
        const leagueGapShareOfXBH = safeDiv(leagueGap, leagueXBH)

        const contact = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(avg, leagueAvg, avgRating),
            this.getHigherIsBetterDelta(babip, env.outcome.babip, avgRating),
            this.averageDeltas([
                this.getLowerIsBetterDelta(soRate, leagueSORate, avgRating * 0.5)
            ])
        ]))

        const plateDiscipline = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(bbRate, leagueBBRate, avgRating),
            this.getLowerIsBetterDelta(chaseSwingRate, env.swing.swingAtBallsPercent / 100, avgRating)
        ]))

        const gapPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(gapRate, leagueGapRate, avgRating * 0.6),
            this.getHigherIsBetterDelta(xbhRate, leagueXBHRate, avgRating * 0.35),
            this.getHigherIsBetterDelta(gapShareOfXBH, leagueGapShareOfXBH, avgRating * 0.45)
        ]))

        const homerunPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(hrRate, leagueHRRate, avgRating * 1.25),
            this.getHigherIsBetterDelta(hrShareOfXBH, leagueHRShareOfXBH, avgRating * 0.75),
            this.getHigherIsBetterDelta(ev, leagueEV, avgRating * 0.15)
        ]))

        const { speed, steals } = this.getRunningRatings(env, command)
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

    private static getRunningRatings(env: PitchEnvironmentTarget, command: PlayerFromStatsCommand): { speed: number, steals: number } {
        const avgRating = env.avgRating
        const hitter = command.hitter
        const running = command.running
        const leagueHitter = env.importReference.hitter
        const leagueRunning = env.importReference.running

        const playerPA = Number(hitter.pa ?? 0)
        const leaguePA = Number(leagueHitter.pa ?? 0)

        const playerPowerOutcomeCount = this.getHitterPowerOutcomeCount(hitter)
        const leaguePowerOutcomeCount = this.getHitterPowerOutcomeCount(leagueHitter)

        const playerSbAttempts = Number(running.sbAttempts ?? 0)
        const playerSb = Number(running.sb ?? 0)
        const playerCs = Math.max(0, playerSbAttempts - playerSb)

        const leagueSbAttempts = Number(leagueRunning.sbAttempts ?? 0)
        const leagueSb = Number(leagueRunning.sb ?? 0)
        const leagueCs = Math.max(0, leagueSbAttempts - leagueSb)

        const playerTriplesRate = safeDiv(Number(hitter.triples ?? 0), playerPowerOutcomeCount)
        const leagueTriplesRate = safeDiv(Number(leagueHitter.triples ?? 0), leaguePowerOutcomeCount)

        const playerAttemptRate = safeDiv(playerSbAttempts, playerPA)
        const leagueAttemptRate = safeDiv(leagueSbAttempts, leaguePA)

        const playerStealRate = safeDiv(playerSb, playerPA)
        const leagueStealRate = safeDiv(leagueSb, leaguePA)

        const playerSuccessRate = safeDiv(playerSb, playerSb + playerCs)
        const leagueSuccessRate = safeDiv(leagueSb, leagueSb + leagueCs)

        const speed = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(playerTriplesRate, leagueTriplesRate, avgRating),
            this.getHigherIsBetterDelta(playerAttemptRate, leagueAttemptRate, avgRating * 0.5),
            this.getHigherIsBetterDelta(playerSuccessRate, leagueSuccessRate, avgRating * 0.35)
        ]))

        const steals = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(playerStealRate, leagueStealRate, avgRating),
            this.getHigherIsBetterDelta(playerAttemptRate, leagueAttemptRate, avgRating),
            this.getHigherIsBetterDelta(playerSuccessRate, leagueSuccessRate, avgRating * 0.75)
        ]))

        return {
            speed,
            steals
        }
    }

    private static getHitterPowerOutcomeCount(hitter: any): number {
        return Math.max(0, Number(hitter.ab ?? 0) - Number(hitter.so ?? 0))
    }

    private static applyHittingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "plateDiscipline" | "contact" | "gapPower" | "homerunPower"): number {
        if (!split || split.pa <= 0 || overall.pa <= 0) return baseRating

        const avgRating = env.avgRating
        const reliability = safeDiv(split.pa, overall.pa)

        const splitAvg = safeDiv(split.hits, split.ab, safeDiv(overall.hits, overall.ab))
        const overallAvg = safeDiv(overall.hits, overall.ab)

        const splitBB = safeDiv(split.bb, split.pa, safeDiv(overall.bb, overall.pa))
        const overallBB = safeDiv(overall.bb, overall.pa)

        const splitSO = safeDiv(split.so, split.pa, safeDiv(overall.so, overall.pa))
        const overallSO = safeDiv(overall.so, overall.pa)

        const splitBabip = safeDiv(split.hits - split.homeRuns, split.ab - split.so - split.homeRuns, safeDiv(overall.hits - overall.homeRuns, overall.ab - overall.so - overall.homeRuns))
        const overallBabip = safeDiv(overall.hits - overall.homeRuns, overall.ab - overall.so - overall.homeRuns)

        const splitGap = Number(split.doubles ?? 0) + Number(split.triples ?? 0)
        const overallGap = Number(overall.doubles ?? 0) + Number(overall.triples ?? 0)

        const splitHR = Number(split.homeRuns ?? 0)
        const overallHR = Number(overall.homeRuns ?? 0)

        const splitXBH = splitGap + splitHR
        const overallXBH = overallGap + overallHR

        const splitGapRate = safeDiv(splitGap, this.getHitterPowerOutcomeCount(split), safeDiv(overallGap, this.getHitterPowerOutcomeCount(overall)))
        const overallGapRate = safeDiv(overallGap, this.getHitterPowerOutcomeCount(overall))

        const splitHRRate = safeDiv(splitHR, this.getHitterPowerOutcomeCount(split), safeDiv(overallHR, this.getHitterPowerOutcomeCount(overall)))
        const overallHRRate = safeDiv(overallHR, this.getHitterPowerOutcomeCount(overall))

        const splitXBHRate = safeDiv(splitXBH, this.getHitterPowerOutcomeCount(split), safeDiv(overallXBH, this.getHitterPowerOutcomeCount(overall)))
        const overallXBHRate = safeDiv(overallXBH, this.getHitterPowerOutcomeCount(overall))

        const splitHRShareOfXBH = safeDiv(splitHR, splitXBH, safeDiv(overallHR, overallXBH))
        const overallHRShareOfXBH = safeDiv(overallHR, overallXBH)

        const splitGapShareOfXBH = safeDiv(splitGap, splitXBH, safeDiv(overallGap, overallXBH))
        const overallGapShareOfXBH = safeDiv(overallGap, overallXBH)

        const splitEV = split.exitVelocity > 0 ? split.exitVelocity : overall.exitVelocity?.avgExitVelo
        const overallEV = overall.exitVelocity?.avgExitVelo

        let delta = 0

        if (ratingType === "plateDiscipline") {
            delta = this.getHigherIsBetterDelta(splitBB, overallBB, avgRating)
        }

        if (ratingType === "contact") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitAvg, overallAvg, avgRating),
                this.getHigherIsBetterDelta(splitBabip, overallBabip, avgRating),
                this.averageDeltas([
                    this.getLowerIsBetterDelta(splitSO, overallSO, avgRating * 0.5)
                ])
            ])
        }

        if (ratingType === "gapPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitGapRate, overallGapRate, avgRating * 0.6),
                this.getHigherIsBetterDelta(splitXBHRate, overallXBHRate, avgRating * 0.35),
                this.getHigherIsBetterDelta(splitGapShareOfXBH, overallGapShareOfXBH, avgRating * 0.45)
            ])
        }

        if (ratingType === "homerunPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitHRRate, overallHRRate, avgRating * 1.25),
                this.getHigherIsBetterDelta(splitHRShareOfXBH, overallHRShareOfXBH, avgRating * 0.75),
                this.getHigherIsBetterDelta(splitEV, overallEV, avgRating * 0.15)
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

        const pitcherPowerOutcomeCount = this.getPitcherPowerOutcomeCount(pitcher)
        const leaguePitcherPowerOutcomeCount = this.getPitcherPowerOutcomeCount(leaguePitcher)

        const leagueGapAllowedRate = safeDiv(
            leaguePitcher.doublesAllowed + leaguePitcher.triplesAllowed,
            leaguePitcherPowerOutcomeCount,
            env.outcome.doublePercent + env.outcome.triplePercent
        )

        const leagueHRAllowedRate = safeDiv(
            leaguePitcher.homeRunsAllowed,
            leaguePitcherPowerOutcomeCount,
            env.outcome.homeRunPercent
        )

        const gapAllowedRate = safeDiv(
            pitcher.doublesAllowed + pitcher.triplesAllowed,
            pitcherPowerOutcomeCount,
            leagueGapAllowedRate
        )

        const hrAllowedRate = safeDiv(
            pitcher.homeRunsAllowed,
            pitcherPowerOutcomeCount,
            leagueHRAllowedRate
        )

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
            this.averageDeltas([
                this.getLowerIsBetterDelta(gapAllowedRate, leagueGapAllowedRate, avgRating),
                this.getLowerIsBetterDelta(hrAllowedRate, leagueHRAllowedRate, avgRating)
            ]),
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
        const n = Number(rating)
        const s = Number(scale ?? 0)

        if (!Number.isFinite(n)) return this.rating(env, avgRating)
        if (!Number.isFinite(s)) return this.rating(env, n)

        return this.rating(
            env,
            avgRating + ((n - avgRating) * (1 + s))
        )
    }

    private static getPitcherPowerOutcomeCount(pitcher: any): number {
        const battersFaced = Number(pitcher.battersFaced ?? 0)
        const walks = Number(pitcher.bbAllowed ?? pitcher.bb ?? 0)
        const hbp = Number(pitcher.hbpAllowed ?? pitcher.hbp ?? 0)
        const strikeouts = Number(pitcher.so ?? 0)
        const atBats = Number(pitcher.atBats ?? pitcher.ab ?? Math.max(0, battersFaced - walks - hbp))

        return Math.max(0, atBats - strikeouts)
    }    

    private static applyPitchingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "control" | "movement"): number {
        if (!split || split.battersFaced <= 0 || overall.battersFaced <= 0) return baseRating

        const avgRating = env.avgRating
        const reliability = safeDiv(split.battersFaced, overall.battersFaced)

        const splitBB = safeDiv(split.bbAllowed, split.battersFaced, safeDiv(overall.bbAllowed, overall.battersFaced))
        const overallBB = safeDiv(overall.bbAllowed, overall.battersFaced)

        const splitSO = safeDiv(split.so, split.battersFaced, safeDiv(overall.so, overall.battersFaced))
        const overallSO = safeDiv(overall.so, overall.battersFaced)

        const splitGapAllowedRate = safeDiv(
            split.doublesAllowed + split.triplesAllowed,
            this.getPitcherPowerOutcomeCount(split),
            safeDiv(overall.doublesAllowed + overall.triplesAllowed, this.getPitcherPowerOutcomeCount(overall))
        )

        const overallGapAllowedRate = safeDiv(
            overall.doublesAllowed + overall.triplesAllowed,
            this.getPitcherPowerOutcomeCount(overall)
        )

        const splitHRAllowedRate = safeDiv(
            split.homeRunsAllowed,
            this.getPitcherPowerOutcomeCount(split),
            safeDiv(overall.homeRunsAllowed, this.getPitcherPowerOutcomeCount(overall))
        )

        const overallHRAllowedRate = safeDiv(
            overall.homeRunsAllowed,
            this.getPitcherPowerOutcomeCount(overall)
        )

        let delta = 0

        if (ratingType === "control") {
            delta = this.averageDeltas([
                this.getLowerIsBetterDelta(splitBB, overallBB, avgRating),
                this.getHigherIsBetterDelta(splitSO, overallSO, avgRating)
            ])
        }

        if (ratingType === "movement") {
            delta = this.averageDeltas([
                this.getLowerIsBetterDelta(splitGapAllowedRate, overallGapAllowedRate, avgRating),
                this.getLowerIsBetterDelta(splitHRAllowedRate, overallHRAllowedRate, avgRating)
            ])
        }

        return this.rating(env, baseRating + (delta * reliability))
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

        const errors = Number(command.fielding.errors ?? 0)
        const assists = Number(command.fielding.assists ?? 0)
        const putouts = Number(command.fielding.putouts ?? 0)
        const chances = errors + assists + putouts

        if (chances <= 0) {
            return {
                defense: avgRating,
                arm: avgRating
            }
        }

        const leagueChances = Number(leagueFielding.chances ?? 0)
        const leagueErrors = Number(leagueFielding.errors ?? 0)
        const leagueAssists = Number(leagueFielding.assists ?? 0)
        const leaguePutouts = Number(leagueFielding.putouts ?? 0)

        const fieldingPct = safeDiv(chances - errors, chances)
        const leagueFieldingPct = safeDiv(leagueChances - leagueErrors, leagueChances)

        const assistShare = safeDiv(assists, chances)
        const leagueAssistShare = safeDiv(leagueAssists, leagueChances)

        const putoutShare = safeDiv(putouts, chances)
        const leaguePutoutShare = safeDiv(leaguePutouts, leagueChances)

        const playerOutfieldAssistShare = safeDiv(Number(command.fielding.outfieldAssists ?? 0), chances)
        const leagueOutfieldAssistShare = safeDiv(Number(leagueFielding.outfieldAssists ?? 0), leagueChances)

        const playerCatcherCaughtStealing = Number(command.fielding.catcherCaughtStealing ?? 0)
        const playerCatcherStolenBasesAllowed = Number(command.fielding.catcherStolenBasesAllowed ?? 0)
        const leagueCatcherCaughtStealing = Number(leagueFielding.catcherCaughtStealing ?? 0)
        const leagueCatcherStolenBasesAllowed = Number(leagueFielding.catcherStolenBasesAllowed ?? 0)

        const catcherThrowRate = safeDiv(
            playerCatcherCaughtStealing,
            playerCatcherCaughtStealing + playerCatcherStolenBasesAllowed
        )

        const leagueCatcherThrowRate = safeDiv(
            leagueCatcherCaughtStealing,
            leagueCatcherCaughtStealing + leagueCatcherStolenBasesAllowed
        )

        const defense = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(fieldingPct, leagueFieldingPct, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(assistShare, leagueAssistShare, avgRating * 0.5),
                this.getHigherIsBetterDelta(putoutShare, leaguePutoutShare, avgRating * 0.5)
            ])
        ]))

        const arm = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(assistShare, leagueAssistShare, avgRating),
            this.getHigherIsBetterDelta(playerOutfieldAssistShare, leagueOutfieldAssistShare, avgRating),
            this.getHigherIsBetterDelta(catcherThrowRate, leagueCatcherThrowRate, avgRating)
        ]))

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
        const n = Number(value)

        if (!Number.isFinite(n)) return env.avgRating

        const avgRating = Number(env.avgRating ?? 100)
        const minRating = Math.round(avgRating * 0.3)
        const maxRating = Math.round(avgRating * 1.7)

        return clamp(Math.round(n), minRating, maxRating)
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

    public evaluatePlayerRatings(pitchEnvironment: PitchEnvironmentTarget, ratingTuning: RatingTuning, players: PlayerImportRaw[], rng: Function, gamesPerPlayer: number = 30): { actual: any, target: any, diff: any, score: number, results: any[] } {
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
            score,
            results
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
                ratings,
                diagnostic: {
                    hitter: hitterResult.diagnostic,
                    pitcher: pitcherResult.diagnostic
                }
            }
        }

        return this.evaluateHitterRating(pitchEnvironment, playerImportRaw, ratings, rng, gamesPerPlayer)
    }

    private evaluateHitterRating(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, rng: Function, gamesPerPlayer: number): any {
        const player = this.buildPlayerFromImportRawAndRatings(playerImportRaw, ratings, false)
        const simulation = this.simHitterForRatingEvaluation(pitchEnvironment, playerImportRaw, player, rng, gamesPerPlayer)
        const actual = simulation.actual
        const targetHandedness = this.getEvaluationHitterTargetHandedness(pitchEnvironment, player)
        const target = this.getHitterRatingTarget(playerImportRaw, targetHandedness)
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
            ratings,
            diagnostic: simulation.diagnostic
        }
    }

    private getEvaluationHitterTargetHandedness(pitchEnvironment: PitchEnvironmentTarget, player: Player): "vsR" | "vsL" | undefined {
        const game = this.baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `target-handedness-${player._id}`)
        const gamePlayer = this.findGamePlayer(game, player._id)

        if (!gamePlayer) {
            return undefined
        }

        const offense = game.away.players.find((p: GamePlayer) => p._id === player._id) ? game.away : game.home
        const defense = offense === game.away ? game.home : game.away
        const pitcher = defense.players.find((p: GamePlayer) => p._id === defense.currentPitcherId)

        if (!pitcher) {
            return undefined
        }

        return pitcher.throws === "L" ? "vsL" : "vsR"
    }

    private evaluatePitcherRating(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, rng: Function, gamesPerPlayer: number): any {
        const player = this.buildPlayerFromImportRawAndRatings(playerImportRaw, ratings, true)
        const simulation = this.simPitcherForRatingEvaluation(pitchEnvironment, playerImportRaw, player, rng, gamesPerPlayer)
        const actual = simulation.actual
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
            ratings,
            diagnostic: simulation.diagnostic
        }
    }

    private simHitterForRatingEvaluation(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, player: Player, rng: Function, gamesPerPlayer: number): any {
        let total: HitResultCount = {} as HitResultCount
        const diagnostic = this.createHitterEvaluationDiagnostic(playerImportRaw, player)

        for (let i = 0; i < gamesPerPlayer; i++) {
            const game = this.baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `rating-hitter-${playerImportRaw.playerId}-${i}`)

            this.addPreGameHitterEvaluationDiagnostic(pitchEnvironment, diagnostic, game, player)

            while (!game.isComplete) {
                this.simService.simPitch(game, rng)
            }

            this.simService.finishGame(game)

            const gamePlayer = this.findGamePlayer(game, player._id)

            if (gamePlayer?.hitResult) {
                total = this.baselineGameService.mergeHitResults(total, gamePlayer.hitResult)
                diagnostic.gameHitResults.push({
                    gameIndex: i,
                    hitResult: gamePlayer.hitResult
                })
            }

            this.addPostGameHitterEvaluationDiagnostic(diagnostic, game, player._id)
        }

        diagnostic.totalHitResult = total
        diagnostic.actual = this.getHitterRatingActual(total)

        return {
            actual: diagnostic.actual,
            diagnostic
        }
    }

    private simPitcherForRatingEvaluation(pitchEnvironment: PitchEnvironmentTarget, playerImportRaw: PlayerImportRaw, player: Player, rng: Function, gamesPerPlayer: number): any {
        let total: PitchResultCount = {} as PitchResultCount
        const diagnostic = this.createPitcherEvaluationDiagnostic(playerImportRaw, player)

        for (let i = 0; i < gamesPerPlayer; i++) {
            const game = this.baselineGameService.buildStartedBaselineGameWithPlayer(pitchEnvironment, player, `rating-pitcher-${playerImportRaw.playerId}-${i}`)

            while (!game.isComplete) {
                this.simService.simPitch(game, rng)
            }

            this.simService.finishGame(game)

            const gamePlayer = this.findGamePlayer(game, player._id)

            if (gamePlayer?.pitchResult) {
                total = this.baselineGameService.mergePitchResults(total, gamePlayer.pitchResult)
                diagnostic.gamePitchResults.push({
                    gameIndex: i,
                    pitchResult: gamePlayer.pitchResult
                })
            }
        }

        diagnostic.totalPitchResult = total
        diagnostic.actual = this.getPitcherRatingActual(total)

        return {
            actual: diagnostic.actual,
            diagnostic
        }
    }

    private createHitterEvaluationDiagnostic(playerImportRaw: PlayerImportRaw, player: Player): any {
        return {
            playerId: playerImportRaw.playerId,
            name: `${playerImportRaw.firstName} ${playerImportRaw.lastName}`,
            role: "hitter",
            insertedPlayer: {
                id: player._id,
                primaryPosition: player.primaryPosition,
                hits: player.hits,
                throws: player.throws,
                hittingRatings: player.hittingRatings
            },
            activeMatchup: undefined,
            gameHitResults: [],
            totalHitResult: {},
            actual: undefined,
            pitchCounts: {
                pitches: 0,
                swings: 0,
                noSwings: 0,
                contactedPitches: 0,
                fairContacts: 0,
                foulContacts: 0,
                whiffs: 0,
                calledStrikes: 0,
                balls: 0,
                hbp: 0,
                inZone: 0,
                outZone: 0
            },
            plateAppearanceCounts: {
                pa: 0,
                inPlay: 0,
                strikeouts: 0,
                walks: 0,
                hbp: 0,
                other: 0
            },
            finalPlayResults: {
                out: 0,
                singles: 0,
                doubles: 0,
                triples: 0,
                homeRuns: 0,
                errors: 0,
                strikeouts: 0,
                walks: 0,
                hbp: 0,
                other: 0
            },
            contactTypes: {
                groundBalls: 0,
                lineDrives: 0,
                flyBalls: 0,
                missing: 0
            }
        }
    }

    private createPitcherEvaluationDiagnostic(playerImportRaw: PlayerImportRaw, player: Player): any {
        return {
            playerId: playerImportRaw.playerId,
            name: `${playerImportRaw.firstName} ${playerImportRaw.lastName}`,
            role: "pitcher",
            insertedPlayer: {
                id: player._id,
                primaryPosition: player.primaryPosition,
                hits: player.hits,
                throws: player.throws,
                pitchRatings: player.pitchRatings
            },
            gamePitchResults: [],
            totalPitchResult: {},
            actual: undefined
        }
    }

    private addPreGameHitterEvaluationDiagnostic(pitchEnvironment: PitchEnvironmentTarget, diagnostic: any, game: Game, player: Player): void {
        if (diagnostic.activeMatchup) return

        const gamePlayer = this.findGamePlayer(game, player._id)

        if (!gamePlayer) {
            diagnostic.activeMatchup = {
                error: `Player not found in evaluation game: ${player._id}`
            }
            return
        }

        const offense = game.away.players.find((p: GamePlayer) => p._id === player._id) ? game.away : game.home
        const defense = offense === game.away ? game.home : game.away
        const pitcher = defense.players.find((p: GamePlayer) => p._id === defense.currentPitcherId)

        if (!pitcher) {
            diagnostic.activeMatchup = {
                error: "Current pitcher not found in evaluation game."
            }
            return
        }

        const hitterChange = pitcher.throws === "L" ? gamePlayer.hitterChange.vsL : gamePlayer.hitterChange.vsR
        const hitterBatSide = gamePlayer.hits === "S"
            ? pitcher.throws === "L" ? "R" : "L"
            : gamePlayer.hits
        const pitcherChange = hitterBatSide === "L" ? pitcher.pitcherChange.vsL : pitcher.pitcherChange.vsR

        diagnostic.activeMatchup = {
            hitter: {
                id: gamePlayer._id,
                name: gamePlayer.fullName,
                position: gamePlayer.currentPosition,
                hits: gamePlayer.hits,
                ratings: gamePlayer.hittingRatings,
                hitterChange
            },
            pitcher: {
                id: pitcher._id,
                name: pitcher.fullName,
                throws: pitcher.throws,
                ratings: pitcher.pitchRatings,
                pitcherChange
            }
        }
    }

    private addPostGameHitterEvaluationDiagnostic(diagnostic: any, game: Game, playerId: string): void {
        const targetPlays = (GameInfo.getPlays(game) as any[]).filter(play => play.hitterId === playerId)

        for (const play of targetPlays) {
            diagnostic.plateAppearanceCounts.pa++

            const pitches = play.pitchLog?.pitches ?? []
            const terminalPitch = pitches[pitches.length - 1]

            if (terminalPitch?.result === "IN_PLAY") diagnostic.plateAppearanceCounts.inPlay++
            else if (play.result === "STRIKEOUT") diagnostic.plateAppearanceCounts.strikeouts++
            else if (play.result === "BB") diagnostic.plateAppearanceCounts.walks++
            else if (play.result === "HIT_BY_PITCH") diagnostic.plateAppearanceCounts.hbp++
            else diagnostic.plateAppearanceCounts.other++

            this.addPlayResultToHitterEvaluationDiagnostic(diagnostic, play)
            this.addContactTypeToHitterEvaluationDiagnostic(diagnostic, play)

            for (const pitch of pitches) {
                diagnostic.pitchCounts.pitches++

                if (pitch.inZone) diagnostic.pitchCounts.inZone++
                else diagnostic.pitchCounts.outZone++

                if (pitch.swing) diagnostic.pitchCounts.swings++
                else diagnostic.pitchCounts.noSwings++

                if (pitch.result === "BALL") diagnostic.pitchCounts.balls++
                if (pitch.result === "HBP") diagnostic.pitchCounts.hbp++

                if (pitch.result === "STRIKE" && !pitch.swing) {
                    diagnostic.pitchCounts.calledStrikes++
                }

                if (pitch.swing && !pitch.con && pitch.result === "STRIKE") {
                    diagnostic.pitchCounts.whiffs++
                }

                if (pitch.con) {
                    diagnostic.pitchCounts.contactedPitches++

                    if (pitch.result === "IN_PLAY") {
                        diagnostic.pitchCounts.fairContacts++
                    } else if (pitch.result === "FOUL") {
                        diagnostic.pitchCounts.foulContacts++
                    }
                }
            }
        }
    }

    private addPlayResultToHitterEvaluationDiagnostic(diagnostic: any, play: any): void {
        switch (play.result) {
            case "OUT":
                diagnostic.finalPlayResults.out++
                break
            case "SINGLE":
                diagnostic.finalPlayResults.singles++
                break
            case "DOUBLE":
                diagnostic.finalPlayResults.doubles++
                break
            case "TRIPLE":
                diagnostic.finalPlayResults.triples++
                break
            case "HR":
                diagnostic.finalPlayResults.homeRuns++
                break
            case "ERROR":
                diagnostic.finalPlayResults.errors++
                break
            case "STRIKEOUT":
                diagnostic.finalPlayResults.strikeouts++
                break
            case "BB":
                diagnostic.finalPlayResults.walks++
                break
            case "HIT_BY_PITCH":
                diagnostic.finalPlayResults.hbp++
                break
            default:
                diagnostic.finalPlayResults.other++
                break
        }
    }

    private addContactTypeToHitterEvaluationDiagnostic(diagnostic: any, play: any): void {
        switch (play.contact) {
            case "GROUNDBALL":
                diagnostic.contactTypes.groundBalls++
                break
            case "LINE_DRIVE":
                diagnostic.contactTypes.lineDrives++
                break
            case "FLY_BALL":
                diagnostic.contactTypes.flyBalls++
                break
            default:
                diagnostic.contactTypes.missing++
                break
        }
    }

    private buildPlayerFromImportRawAndRatings(playerImportRaw: PlayerImportRaw, ratings: { hittingRatings: HittingRatings, pitchRatings: PitchRatings }, forcePitcher: boolean = false): Player {
        const isPitcher = forcePitcher
        const isStarter = Number(playerImportRaw.pitching?.starts ?? 0) > 0
        const primaryPosition = isPitcher
            ? Position.PITCHER
            : playerImportRaw.primaryPosition === Position.PITCHER
                ? Position.FIRST_BASE
                : playerImportRaw.primaryPosition

        return {
            _id: playerImportRaw.playerId,
            firstName: playerImportRaw.firstName,
            lastName: playerImportRaw.lastName,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition,
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

    private getHitterRatingTarget(playerImportRaw: PlayerImportRaw, handedness?: "vsR" | "vsL"): any {
        const h = handedness === "vsR"
            ? playerImportRaw.splits?.hitting?.vsR ?? playerImportRaw.hitting
            : handedness === "vsL"
                ? playerImportRaw.splits?.hitting?.vsL ?? playerImportRaw.hitting
                : playerImportRaw.hitting

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
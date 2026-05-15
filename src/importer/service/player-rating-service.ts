import { PitchType, Position } from "../../sim/service/enums.js"
import { HittingRatings, PitchEnvironmentTarget, PitchRatings, PitchTypeMovementStat, PlayerFromStatsCommand, PlayerImportBaseline, PlayerImportRaw } from "../../sim/service/interfaces.js"

class PlayerRatingService {

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



    // static getImportBaselineForPlayer(pitchEnvironment: PitchEnvironmentTarget, playerImportBaseline: PlayerImportBaseline, playerImportRaw: PlayerImportRaw): PlayerImportBaseline {

    //     const importReference = pitchEnvironment.importReference

    //     const blendedRate = (playerNumerator: number, playerDenominator: number, referenceNumerator: number, referenceDenominator: number, fallback: number): number => {
    //         const totalDenominator = playerDenominator + referenceDenominator
    //         if (totalDenominator <= 0) return fallback
    //         return (playerNumerator + referenceNumerator) / totalDenominator
    //     }

    //     const blendedContactProfile = (playerGroundballs: number, playerFlyballs: number, playerPopups: number, playerLineDrives: number, referenceGroundballs: number, referenceFlyballs: number, referencePopups: number, referenceLineDrives: number, fallback: { groundball: number, flyBall: number, lineDrive: number }) => {
    //         const gb = playerGroundballs + referenceGroundballs
    //         const fb = (playerFlyballs + playerPopups) + (referenceFlyballs + referencePopups)
    //         const ld = playerLineDrives + referenceLineDrives

    //         const total = gb + fb + ld

    //         if (total <= 0) {
    //             return fallback
    //         }

    //         return {
    //             groundball: gb / total,
    //             flyBall: fb / total,
    //             lineDrive: ld / total
    //         }
    //     }

    //     return {
    //         hitting: {
    //             plateDisciplineBBPercent: blendedRate(
    //                 playerImportRaw.hitting.bb,
    //                 playerImportRaw.hitting.pa,
    //                 importReference.hitter.bb,
    //                 importReference.hitter.pa,
    //                 playerImportBaseline.hitting.plateDisciplineBBPercent
    //             ),

    //             contactSOPercent: blendedRate(
    //                 playerImportRaw.hitting.so,
    //                 playerImportRaw.hitting.pa,
    //                 importReference.hitter.so,
    //                 importReference.hitter.pa,
    //                 playerImportBaseline.hitting.contactSOPercent
    //             ),

    //             gapPowerPercent: blendedRate(
    //                 playerImportRaw.hitting.doubles + playerImportRaw.hitting.triples,
    //                 playerImportRaw.hitting.pa,
    //                 importReference.hitter.doubles + importReference.hitter.triples,
    //                 importReference.hitter.pa,
    //                 playerImportBaseline.hitting.gapPowerPercent
    //             ),

    //             homerunPowerPercent: blendedRate(
    //                 playerImportRaw.hitting.homeRuns,
    //                 playerImportRaw.hitting.pa,
    //                 importReference.hitter.homeRuns,
    //                 importReference.hitter.pa,
    //                 playerImportBaseline.hitting.homerunPowerPercent
    //             ),

    //             speedExtraBaseTakenPercent: blendedRate(
    //                 playerImportRaw.running.extraBaseTaken,
    //                 playerImportRaw.running.extraBaseOpportunities,
    //                 importReference.running.extraBaseTaken,
    //                 importReference.running.extraBaseOpportunities,
    //                 playerImportBaseline.hitting.speedExtraBaseTakenPercent
    //             ),

    //             stealsAttemptPercent: blendedRate(
    //                 playerImportRaw.running.sbAttempts,
    //                 playerImportRaw.running.timesOnFirst,
    //                 importReference.running.sbAttempts,
    //                 importReference.running.timesOnFirst,
    //                 playerImportBaseline.hitting.stealsAttemptPercent
    //             ),

    //             stealsSuccessPercent: blendedRate(
    //                 playerImportRaw.running.sb,
    //                 playerImportRaw.running.sbAttempts,
    //                 importReference.running.sb,
    //                 importReference.running.sbAttempts,
    //                 playerImportBaseline.hitting.stealsSuccessPercent
    //             ),

    //             defenseErrorPercent: blendedRate(
    //                 playerImportRaw.fielding.errors,
    //                 playerImportRaw.fielding.chances,
    //                 importReference.fielding.errors,
    //                 importReference.fielding.chances,
    //                 playerImportBaseline.hitting.defenseErrorPercent
    //             ),

    //             defenseFieldingPlayPercent: blendedRate(
    //                 playerImportRaw.fielding.putouts + playerImportRaw.fielding.assists,
    //                 playerImportRaw.fielding.chances,
    //                 importReference.fielding.putouts + importReference.fielding.assists,
    //                 importReference.fielding.chances,
    //                 playerImportBaseline.hitting.defenseFieldingPlayPercent
    //             ),

    //             armThrowOutPercent: blendedRate(
    //                 playerImportRaw.fielding.successfulThrowOuts,
    //                 playerImportRaw.fielding.throwsAttempted,
    //                 importReference.fielding.successfulThrowOuts,
    //                 importReference.fielding.throwsAttempted,
    //                 playerImportBaseline.hitting.armThrowOutPercent
    //             ),

    //             defenseDoublePlayPercent: blendedRate(
    //                 playerImportRaw.fielding.doublePlays,
    //                 playerImportRaw.fielding.doublePlayOpportunities,
    //                 importReference.fielding.doublePlays,
    //                 importReference.fielding.doublePlayOpportunities,
    //                 playerImportBaseline.hitting.defenseDoublePlayPercent
    //             ),

    //             catcherCaughtStealingPercent: blendedRate(
    //                 playerImportRaw.fielding.catcherCaughtStealing,
    //                 playerImportRaw.fielding.catcherCaughtStealing + playerImportRaw.fielding.catcherStolenBasesAllowed,
    //                 importReference.fielding.catcherCaughtStealing,
    //                 importReference.fielding.catcherCaughtStealing + importReference.fielding.catcherStolenBasesAllowed,
    //                 playerImportBaseline.hitting.catcherCaughtStealingPercent ?? playerImportBaseline.hitting.armThrowOutPercent
    //             ),

    //             catcherPassedBallPercent: blendedRate(
    //                 playerImportRaw.fielding.passedBalls,
    //                 playerImportRaw.fielding.chances,
    //                 importReference.fielding.passedBalls,
    //                 importReference.fielding.chances,
    //                 playerImportBaseline.hitting.catcherPassedBallPercent ?? playerImportBaseline.hitting.defenseErrorPercent
    //             ),

    //             outfieldAssistPercent: blendedRate(
    //                 playerImportRaw.fielding.outfieldAssists,
    //                 playerImportRaw.fielding.throwsAttempted,
    //                 importReference.fielding.outfieldAssists,
    //                 importReference.fielding.throwsAttempted,
    //                 playerImportBaseline.hitting.outfieldAssistPercent ?? playerImportBaseline.hitting.armThrowOutPercent
    //             ),

    //             contactProfile: blendedContactProfile(
    //                 playerImportRaw.hitting.groundBalls,
    //                 playerImportRaw.hitting.flyBalls,
    //                 playerImportRaw.hitting.popups,
    //                 playerImportRaw.hitting.lineDrives,

    //                 importReference.hitter.groundBalls,
    //                 importReference.hitter.flyBalls,
    //                 importReference.hitter.popups,
    //                 importReference.hitter.lineDrives,

    //                 playerImportBaseline.hitting.contactProfile
    //             )
    //         },

    //         pitching: {
    //             powerSOPercent: blendedRate(
    //                 playerImportRaw.pitching.so,
    //                 playerImportRaw.pitching.battersFaced,
    //                 importReference.pitcher.so,
    //                 importReference.pitcher.battersFaced,
    //                 playerImportBaseline.pitching.powerSOPercent
    //             ),

    //             controlBBPercent: blendedRate(
    //                 playerImportRaw.pitching.bbAllowed,
    //                 playerImportRaw.pitching.battersFaced,
    //                 importReference.pitcher.bbAllowed,
    //                 importReference.pitcher.battersFaced,
    //                 playerImportBaseline.pitching.controlBBPercent
    //             ),

    //             movementHRPercent: blendedRate(
    //                 playerImportRaw.pitching.homeRunsAllowed,
    //                 playerImportRaw.pitching.battersFaced,
    //                 importReference.pitcher.homeRunsAllowed,
    //                 importReference.pitcher.battersFaced,
    //                 playerImportBaseline.pitching.movementHRPercent
    //             ),

    //             contactProfile: blendedContactProfile(
    //                 playerImportRaw.pitching.groundBallsAllowed,
    //                 playerImportRaw.pitching.flyBallsAllowed,
    //                 playerImportRaw.pitching.popupsAllowed,
    //                 playerImportRaw.pitching.lineDrivesAllowed,

    //                 importReference.pitcher.groundBallsAllowed,
    //                 importReference.pitcher.flyBallsAllowed,
    //                 importReference.pitcher.popupsAllowed,
    //                 importReference.pitcher.lineDrivesAllowed,

    //                 playerImportBaseline.pitching.contactProfile
    //             )
    //         }
    //     }
    // }

    // public getPlayerImportBaseline(pitchEnvironment: PitchEnvironmentTarget, rng: Function): PlayerImportBaseline {

    //     const importReference = pitchEnvironment.importReference

    //     const safeDiv = (num: number, den: number): number => den > 0 ? num / den : 0

    //     const baselineCommand: PlayerFromStatsCommand = {
    //         season: pitchEnvironment.season,

    //         playerId: "baseline",
    //         firstName: "Baseline",
    //         lastName: "Baseline",

    //         age: 27,

    //         primaryPosition: Position.CENTER_FIELD,
    //         secondaryPositions: [],

    //         throws: Handedness.R,
    //         hits: Handedness.R,

    //         primaryRole: "twoWay",

    //         hitter: { ...importReference.hitter },
    //         pitcher: { ...importReference.pitcher },

    //         fielding: { ...importReference.fielding },
    //         running: { ...importReference.running },

    //         splits: {
    //             hitting: {
    //                 vsL: { ...importReference.splits.hitting.vsL },
    //                 vsR: { ...importReference.splits.hitting.vsR }
    //             },
    //             pitching: {
    //                 vsL: { ...importReference.splits.pitching.vsL },
    //                 vsR: { ...importReference.splits.pitching.vsR }
    //             }
    //         },

    //         playerImportBaseline: {} as PlayerImportBaseline,
    //         leagueImportBaseline: {} as PlayerImportBaseline,
    //         pitchEnvironmentTarget: pitchEnvironment
    //     }

    //     let totalHit: HitResultCount = {} as HitResultCount

    //     const NUM_GAMES = 250

    //     for (let i = 0; i < NUM_GAMES; i++) {
    //         const awayPlayers = this.buildBaselinePlayers()
    //         const homePlayers = this.buildBaselinePlayers()

    //         const awayLineup = this.buildBaselineLineup(awayPlayers)
    //         const homeLineup = this.buildBaselineLineup(homePlayers)

    //         const awayStartingPitcher: RotationPitcher = {
    //             _id: awayPlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
    //             stamina: 1
    //         }

    //         const homeStartingPitcher: RotationPitcher = {
    //             _id: homePlayers.find(p => p.primaryPosition === Position.PITCHER)!._id,
    //             stamina: 1
    //         }

    //         const awayTeam: Team = {
    //             _id: `baseline-away-${i}`,
    //             name: "Away",
    //             abbrev: "AWAY",
    //             colors: {
    //                 color1: "#ff0000",
    //                 color2: "#ffffff"
    //             }
    //         }

    //         const homeTeam: Team = {
    //             _id: `baseline-home-${i}`,
    //             name: "Home",
    //             abbrev: "HOME",
    //             colors: {
    //                 color1: "#0000ff",
    //                 color2: "#ffffff"
    //             }
    //         }

    //         const game: Game = { _id: `baseline-${i}` } as Game

    //         this.simService.initGame(game)

    //         const startedGame = this.simService.startGame({
    //             game,
    //             away: awayTeam,
    //             awayTeamOptions: {},
    //             awayPlayers,
    //             awayLineup,
    //             awayStartingPitcher,

    //             home: homeTeam,
    //             homeTeamOptions: {},
    //             homePlayers,
    //             homeLineup,
    //             homeStartingPitcher,

    //             pitchEnvironmentTarget: pitchEnvironment,
    //             date: new Date()
    //         })

    //         while (!startedGame.isComplete) {
    //             this.simService.simPitch(startedGame, rng)
    //         }

    //         this.simService.finishGame(startedGame)

    //         const allPlayers = [
    //             ...startedGame.away.players,
    //             ...startedGame.home.players
    //         ]

    //         for (const p of allPlayers) {
    //             totalHit = this.mergeHitResults(totalHit, p.hitResult)
    //         }
    //     }

    //     const stats: HitterStatLine = this.statService.hitResultToHitterStatLine(totalHit)

    //     const baseline: PlayerImportBaseline = {
    //         hitting: {
    //             plateDisciplineBBPercent: stats.bbPercent ?? safeDiv(stats.bb, stats.pa),
    //             contactSOPercent: stats.soPercent ?? safeDiv(stats.so, stats.pa),
    //             gapPowerPercent: (stats.doublePercent ?? safeDiv(stats.doubles, stats.pa)) + (stats.triplePercent ?? safeDiv(stats.triples, stats.pa)),
    //             homerunPowerPercent: stats.homeRunPercent ?? safeDiv(stats.homeRuns, stats.pa),

    //             speedExtraBaseTakenPercent: safeDiv((totalHit as any).extraBaseTaken ?? 0, (totalHit as any).extraBaseOpportunities ?? 0),
    //             stealsAttemptPercent: safeDiv(stats.sbAttempts, (totalHit as any).timesOnFirst ?? 0),
    //             stealsSuccessPercent: safeDiv(stats.sb, stats.sbAttempts),

    //             defenseErrorPercent: safeDiv(stats.e, stats.po + stats.assists + stats.e),
    //             defenseFieldingPlayPercent: safeDiv(stats.po + stats.assists, stats.po + stats.assists + stats.e),
    //             armThrowOutPercent: safeDiv(stats.outfieldAssists + stats.csDefense, stats.outfieldAssists + stats.csDefense + stats.passedBalls),
    //             defenseDoublePlayPercent: safeDiv(stats.doublePlays, (totalHit as any).doublePlayOpportunities ?? stats.doublePlays),

    //             catcherCaughtStealingPercent: safeDiv(stats.csDefense, stats.csDefense + stats.sb),
    //             catcherPassedBallPercent: safeDiv(stats.passedBalls, stats.passedBalls + stats.csDefense + stats.sb),
    //             outfieldAssistPercent: safeDiv(stats.outfieldAssists, (totalHit as any).throwsAttempted ?? stats.outfieldAssists),

    //             contactProfile: {
    //                 groundball: stats.groundBallPercent ?? 0,
    //                 flyBall: stats.flyBallPercent ?? 0,
    //                 lineDrive: stats.ldPercent ?? 0
    //             }
    //         },
    //         pitching: {
    //             powerSOPercent: stats.soPercent ?? safeDiv(stats.so, stats.pa),
    //             controlBBPercent: stats.bbPercent ?? safeDiv(stats.bb, stats.pa),
    //             movementHRPercent: stats.homeRunPercent ?? safeDiv(stats.homeRuns, stats.pa),
    //             contactProfile: {
    //                 groundball: stats.groundBallPercent ?? 0,
    //                 flyBall: stats.flyBallPercent ?? 0,
    //                 lineDrive: stats.ldPercent ?? 0
    //             }
    //         }
    //     }

    //     return baseline
    // }


}

export { PlayerRatingService }
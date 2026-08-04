import {
    PitchType,
    Position
} from "../../sim/service/enums.js"

class StatClassificationService {

    private readonly inZone = new Set([
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9
    ])

    private readonly plateAppearanceEvents = new Set([
        "single",
        "double",
        "triple",
        "home_run",
        "walk",
        "intent_walk",
        "hit_by_pitch",
        "strikeout",
        "strikeout_double_play",
        "field_out",
        "force_out",
        "grounded_into_double_play",
        "double_play",
        "fielders_choice",
        "field_error",
        "sac_fly",
        "sac_bunt",
        "fielders_choice_out",
        "other_out"
    ])

    private readonly nonAtBatEvents = new Set([
        "walk",
        "intent_walk",
        "hit_by_pitch",
        "sac_fly",
        "sac_bunt",
        "catcher_interf"
    ])

    private readonly hitEvents = new Set([
        "single",
        "double",
        "triple",
        "home_run"
    ])

    private readonly defensivePositions = new Set<Position>([
        Position.PITCHER,
        Position.CATCHER,
        Position.FIRST_BASE,
        Position.SECOND_BASE,
        Position.THIRD_BASE,
        Position.SHORTSTOP,
        Position.LEFT_FIELD,
        Position.CENTER_FIELD,
        Position.RIGHT_FIELD
    ])

    private readonly infieldPositions = new Set<Position>([
        Position.PITCHER,
        Position.CATCHER,
        Position.FIRST_BASE,
        Position.SECOND_BASE,
        Position.THIRD_BASE,
        Position.SHORTSTOP
    ])

    private readonly simpleLocationPositions: Record<string, Position> = {
        "1": Position.PITCHER,
        "2": Position.CATCHER,
        "3": Position.FIRST_BASE,
        "4": Position.SECOND_BASE,
        "5": Position.THIRD_BASE,
        "6": Position.SHORTSTOP,
        "7": Position.LEFT_FIELD,
        "8": Position.CENTER_FIELD,
        "9": Position.RIGHT_FIELD
    }

    public isInZone(zone: number | null | undefined): boolean {
        return Number.isFinite(zone) &&
            this.inZone.has(
                Number(zone)
            )
    }

    public isPlateAppearance(eventType: string): boolean {
        return this.plateAppearanceEvents.has(
            eventType
        )
    }

    public isAtBat(eventType: string): boolean {
        return this.isPlateAppearance(
            eventType
        ) &&
            !this.nonAtBatEvents.has(
                eventType
            )
    }

    public isHit(eventType: string): boolean {
        return this.hitEvents.has(
            eventType
        )
    }

    public isWalk(eventType: string): boolean {
        return eventType === "walk" ||
            eventType === "intent_walk"
    }

    public isStrikeout(eventType: string): boolean {
        return eventType.includes(
            "strikeout"
        )
    }

    public isBall(callCode: string, isBall?: boolean): boolean {
        return isBall === true ||
            callCode === "*B"
    }

    public isStrikeOutcome(isStrike: boolean, isInPlay: boolean): boolean {
        return isStrike ||
            isInPlay
    }

    public isSwing(callCode: string, isInPlay: boolean): boolean {
        return callCode === "S" ||
            callCode === "F" ||
            callCode === "T" ||
            callCode === "W" ||
            isInPlay
    }

    public isContact(callCode: string, isInPlay: boolean): boolean {
        return callCode === "F" ||
            callCode === "T" ||
            isInPlay
    }

    public isFoul(callCode: string): boolean {
        return callCode === "F" ||
            callCode === "T"
    }

    public isSwingingStrike(callCode: string): boolean {
        return callCode === "S" ||
            callCode === "W"
    }

    public isCalledStrike(callCode: string): boolean {
        return callCode === "C"
    }

    public isDefensivePosition(position: Position): boolean {
        return this.defensivePositions.has(
            position
        )
    }

    public isInfieldPosition(position: Position): boolean {
        return this.infieldPositions.has(
            position
        )
    }

    public getPositionForHitLocation(location: string): Position | undefined {
        return this.simpleLocationPositions[
            location
        ]
    }

    public getHitLocationForPosition(position: Position): string | undefined {
        return Object.entries(
            this.simpleLocationPositions
        ).find(([, value]) =>
            value === position
        )?.[0]
    }

    public mapPositionAbbreviation(abbreviation: string): Position | undefined {
        switch (abbreviation.trim()) {
            case "P":
                return Position.PITCHER
            case "C":
                return Position.CATCHER
            case "1B":
                return Position.FIRST_BASE
            case "2B":
                return Position.SECOND_BASE
            case "3B":
                return Position.THIRD_BASE
            case "SS":
                return Position.SHORTSTOP
            case "LF":
                return Position.LEFT_FIELD
            case "CF":
                return Position.CENTER_FIELD
            case "RF":
                return Position.RIGHT_FIELD
            default:
                return undefined
        }
    }

    public mapPitchType(code: string): PitchType | undefined {
        switch (code) {
            case "FF":
                return PitchType.FF
            case "CU":
                return PitchType.CU
            case "CH":
                return PitchType.CH
            case "FC":
                return PitchType.FC
            case "FO":
                return PitchType.FO
            case "KN":
                return PitchType.KN
            case "KC":
                return PitchType.KC
            case "SC":
                return PitchType.SC
            case "SI":
                return PitchType.SI
            case "SL":
                return PitchType.SL
            case "SV":
                return PitchType.SV
            case "FS":
                return PitchType.FS
            case "ST":
                return PitchType.ST
            default:
                return undefined
        }
    }

    public mapTrajectory(trajectory: string): BattedBallTrajectory | undefined {
        switch (trajectory) {
            case "ground_ball":
                return "groundBall"
            case "fly_ball":
                return "flyBall"
            case "line_drive":
                return "lineDrive"
            case "popup":
                return "popup"
            default:
                return undefined
        }
    }

    public getEvLaOutcome(eventType: string): EvLaOutcome | undefined {
        switch (eventType) {
            case "single":
                return "single"
            case "double":
                return "double"
            case "triple":
                return "triple"
            case "home_run":
                return "hr"
            case "field_out":
            case "force_out":
            case "grounded_into_double_play":
            case "double_play":
            case "fielders_choice":
            case "fielders_choice_out":
            case "other_out":
            case "sac_fly":
            case "sac_bunt":
                return "out"
            default:
                return undefined
        }
    }

    public getFlyBallDepth(coordY: number | undefined, totalDistance: number | undefined): FlyBallDepth {
        if (Number.isFinite(totalDistance)) {
            if (Number(totalDistance) < 250) {
                return "shallow"
            }

            if (Number(totalDistance) > 320) {
                return "deep"
            }

            return "normal"
        }

        if (Number.isFinite(coordY)) {
            if (Number(coordY) < 180) {
                return "shallow"
            }

            if (Number(coordY) > 260) {
                return "deep"
            }
        }

        return "normal"
    }

    public getSprayBin(coordX: number | undefined, coordY: number | undefined): number | undefined {
        if (
            !Number.isFinite(coordX) ||
            !Number.isFinite(coordY)
        ) {
            return undefined
        }

        const angleDegrees = Math.atan2(
            Number(coordX),
            Number(coordY)
        ) * (
            180 /
            Math.PI
        )

        return Math.floor(
            angleDegrees /
            10
        ) * 10
    }

    public isGroundBallOut(eventType: string, trajectory: string): boolean {
        if (trajectory !== "ground_ball") {
            return false
        }

        return eventType === "field_out" ||
            eventType === "force_out" ||
            eventType === "grounded_into_double_play" ||
            eventType === "double_play" ||
            eventType === "fielders_choice" ||
            eventType === "fielders_choice_out" ||
            eventType === "other_out"
    }

    public isFlyBallOut(eventType: string, trajectory: string): boolean {
        const isFlyBall =
            trajectory === "fly_ball" ||
            eventType === "sac_fly"

        if (!isFlyBall) {
            return false
        }

        return eventType === "field_out" ||
            eventType === "sac_fly" ||
            eventType === "other_out"
    }

    public isDoublePlay(eventType: string, outsOnPlay: number): boolean {
        return (
            eventType === "grounded_into_double_play" ||
            eventType === "double_play"
        ) &&
            outsOnPlay >= 2
    }
}

type BattedBallTrajectory =
    "groundBall" |
    "flyBall" |
    "lineDrive" |
    "popup"

type EvLaOutcome =
    "out" |
    "single" |
    "double" |
    "triple" |
    "hr"

type FlyBallDepth =
    "shallow" |
    "normal" |
    "deep"

export {
    StatClassificationService
}

export type {
    BattedBallTrajectory,
    EvLaOutcome,
    FlyBallDepth
}
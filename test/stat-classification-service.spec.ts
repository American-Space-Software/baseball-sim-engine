import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    PitchType,
    Position
} from "../src/sim/service/enums.js"

import { StatClassificationService } from "../src/importer/service/stat-classification-service.js"

describe("StatClassificationService", function () {

    const service = new StatClassificationService()

    describe("plate appearance classification", function () {

        it("identifies plate appearance events", function () {
            assert.equal(
                service.isPlateAppearance("single"),
                true
            )

            assert.equal(
                service.isPlateAppearance("walk"),
                true
            )

            assert.equal(
                service.isPlateAppearance("strikeout_double_play"),
                true
            )

            assert.equal(
                service.isPlateAppearance("sac_fly"),
                true
            )

            assert.equal(
                service.isPlateAppearance("pitching_substitution"),
                false
            )
        })

        it("identifies at-bat events", function () {
            assert.equal(
                service.isAtBat("single"),
                true
            )

            assert.equal(
                service.isAtBat("field_out"),
                true
            )

            assert.equal(
                service.isAtBat("strikeout"),
                true
            )

            assert.equal(
                service.isAtBat("walk"),
                false
            )

            assert.equal(
                service.isAtBat("intent_walk"),
                false
            )

            assert.equal(
                service.isAtBat("hit_by_pitch"),
                false
            )

            assert.equal(
                service.isAtBat("sac_fly"),
                false
            )

            assert.equal(
                service.isAtBat("sac_bunt"),
                false
            )

            assert.equal(
                service.isAtBat("catcher_interf"),
                false
            )
        })

        it("identifies hit events", function () {
            assert.equal(
                service.isHit("single"),
                true
            )

            assert.equal(
                service.isHit("double"),
                true
            )

            assert.equal(
                service.isHit("triple"),
                true
            )

            assert.equal(
                service.isHit("home_run"),
                true
            )

            assert.equal(
                service.isHit("field_error"),
                false
            )
        })

        it("identifies walk events", function () {
            assert.equal(
                service.isWalk("walk"),
                true
            )

            assert.equal(
                service.isWalk("intent_walk"),
                true
            )

            assert.equal(
                service.isWalk("hit_by_pitch"),
                false
            )
        })

        it("identifies strikeout events", function () {
            assert.equal(
                service.isStrikeout("strikeout"),
                true
            )

            assert.equal(
                service.isStrikeout("strikeout_double_play"),
                true
            )

            assert.equal(
                service.isStrikeout("field_out"),
                false
            )
        })
    })

    describe("pitch classification", function () {

        it("identifies pitches in the strike zone", function () {
            for (let zone = 1; zone <= 9; zone++) {
                assert.equal(
                    service.isInZone(zone),
                    true
                )
            }

            assert.equal(
                service.isInZone(0),
                false
            )

            assert.equal(
                service.isInZone(10),
                false
            )

            assert.equal(
                service.isInZone(undefined),
                false
            )

            assert.equal(
                service.isInZone(null),
                false
            )
        })

        it("identifies balls", function () {
            assert.equal(
                service.isBall("B", true),
                true
            )

            assert.equal(
                service.isBall("*B"),
                true
            )

            assert.equal(
                service.isBall("C", false),
                false
            )
        })

        it("identifies strike outcomes", function () {
            assert.equal(
                service.isStrikeOutcome(true, false),
                true
            )

            assert.equal(
                service.isStrikeOutcome(false, true),
                true
            )

            assert.equal(
                service.isStrikeOutcome(false, false),
                false
            )
        })

        it("identifies swings", function () {
            for (const callCode of [
                "S",
                "F",
                "T",
                "W"
            ]) {
                assert.equal(
                    service.isSwing(callCode, false),
                    true
                )
            }

            assert.equal(
                service.isSwing("X", true),
                true
            )

            assert.equal(
                service.isSwing("C", false),
                false
            )

            assert.equal(
                service.isSwing("B", false),
                false
            )
        })

        it("identifies contact", function () {
            assert.equal(
                service.isContact("F", false),
                true
            )

            assert.equal(
                service.isContact("T", false),
                true
            )

            assert.equal(
                service.isContact("X", true),
                true
            )

            assert.equal(
                service.isContact("S", false),
                false
            )

            assert.equal(
                service.isContact("W", false),
                false
            )
        })

        it("identifies foul pitches", function () {
            assert.equal(
                service.isFoul("F"),
                true
            )

            assert.equal(
                service.isFoul("T"),
                true
            )

            assert.equal(
                service.isFoul("S"),
                false
            )
        })

        it("identifies swinging strikes", function () {
            assert.equal(
                service.isSwingingStrike("S"),
                true
            )

            assert.equal(
                service.isSwingingStrike("W"),
                true
            )

            assert.equal(
                service.isSwingingStrike("T"),
                false
            )

            assert.equal(
                service.isSwingingStrike("C"),
                false
            )
        })

        it("identifies called strikes", function () {
            assert.equal(
                service.isCalledStrike("C"),
                true
            )

            assert.equal(
                service.isCalledStrike("S"),
                false
            )
        })
    })

    describe("position classification", function () {

        it("identifies defensive positions", function () {
            for (const position of [
                Position.PITCHER,
                Position.CATCHER,
                Position.FIRST_BASE,
                Position.SECOND_BASE,
                Position.THIRD_BASE,
                Position.SHORTSTOP,
                Position.LEFT_FIELD,
                Position.CENTER_FIELD,
                Position.RIGHT_FIELD
            ]) {
                assert.equal(
                    service.isDefensivePosition(position),
                    true
                )
            }

            assert.equal(
                service.isDefensivePosition(Position.DESIGNATED_HITTER),
                false
            )
        })

        it("identifies infield positions", function () {
            for (const position of [
                Position.PITCHER,
                Position.CATCHER,
                Position.FIRST_BASE,
                Position.SECOND_BASE,
                Position.THIRD_BASE,
                Position.SHORTSTOP
            ]) {
                assert.equal(
                    service.isInfieldPosition(position),
                    true
                )
            }

            assert.equal(
                service.isInfieldPosition(Position.LEFT_FIELD),
                false
            )

            assert.equal(
                service.isInfieldPosition(Position.CENTER_FIELD),
                false
            )

            assert.equal(
                service.isInfieldPosition(Position.RIGHT_FIELD),
                false
            )
        })

        it("maps hit locations to positions", function () {
            assert.equal(
                service.getPositionForHitLocation("1"),
                Position.PITCHER
            )

            assert.equal(
                service.getPositionForHitLocation("2"),
                Position.CATCHER
            )

            assert.equal(
                service.getPositionForHitLocation("6"),
                Position.SHORTSTOP
            )

            assert.equal(
                service.getPositionForHitLocation("8"),
                Position.CENTER_FIELD
            )

            assert.equal(
                service.getPositionForHitLocation(""),
                undefined
            )
        })

        it("maps positions to hit locations", function () {
            assert.equal(
                service.getHitLocationForPosition(Position.PITCHER),
                "1"
            )

            assert.equal(
                service.getHitLocationForPosition(Position.SHORTSTOP),
                "6"
            )

            assert.equal(
                service.getHitLocationForPosition(Position.RIGHT_FIELD),
                "9"
            )

            assert.equal(
                service.getHitLocationForPosition(Position.DESIGNATED_HITTER),
                undefined
            )
        })

        it("maps position abbreviations", function () {
            assert.equal(
                service.mapPositionAbbreviation("P"),
                Position.PITCHER
            )

            assert.equal(
                service.mapPositionAbbreviation("C"),
                Position.CATCHER
            )

            assert.equal(
                service.mapPositionAbbreviation("1B"),
                Position.FIRST_BASE
            )

            assert.equal(
                service.mapPositionAbbreviation("2B"),
                Position.SECOND_BASE
            )

            assert.equal(
                service.mapPositionAbbreviation("3B"),
                Position.THIRD_BASE
            )

            assert.equal(
                service.mapPositionAbbreviation("SS"),
                Position.SHORTSTOP
            )

            assert.equal(
                service.mapPositionAbbreviation("LF"),
                Position.LEFT_FIELD
            )

            assert.equal(
                service.mapPositionAbbreviation("CF"),
                Position.CENTER_FIELD
            )

            assert.equal(
                service.mapPositionAbbreviation("RF"),
                Position.RIGHT_FIELD
            )

            assert.equal(
                service.mapPositionAbbreviation("  CF  "),
                Position.CENTER_FIELD
            )

            assert.equal(
                service.mapPositionAbbreviation("DH"),
                undefined
            )
        })
    })

    describe("pitch type classification", function () {

        it("maps supported MLB pitch codes", function () {
            const expected = new Map<string, PitchType>([
                [
                    "FF",
                    PitchType.FF
                ],
                [
                    "CU",
                    PitchType.CU
                ],
                [
                    "CH",
                    PitchType.CH
                ],
                [
                    "FC",
                    PitchType.FC
                ],
                [
                    "FO",
                    PitchType.FO
                ],
                [
                    "KN",
                    PitchType.KN
                ],
                [
                    "KC",
                    PitchType.KC
                ],
                [
                    "SC",
                    PitchType.SC
                ],
                [
                    "SI",
                    PitchType.SI
                ],
                [
                    "SL",
                    PitchType.SL
                ],
                [
                    "SV",
                    PitchType.SV
                ],
                [
                    "FS",
                    PitchType.FS
                ],
                [
                    "ST",
                    PitchType.ST
                ]
            ])

            for (const [code, pitchType] of expected) {
                assert.equal(
                    service.mapPitchType(code),
                    pitchType
                )
            }
        })

        it("returns undefined for unsupported pitch codes", function () {
            assert.equal(
                service.mapPitchType("EP"),
                undefined
            )

            assert.equal(
                service.mapPitchType(""),
                undefined
            )
        })
    })

    describe("batted-ball classification", function () {

        it("maps batted-ball trajectories", function () {
            assert.equal(
                service.mapTrajectory("ground_ball"),
                "groundBall"
            )

            assert.equal(
                service.mapTrajectory("fly_ball"),
                "flyBall"
            )

            assert.equal(
                service.mapTrajectory("line_drive"),
                "lineDrive"
            )

            assert.equal(
                service.mapTrajectory("popup"),
                "popup"
            )

            assert.equal(
                service.mapTrajectory("bunt_grounder"),
                undefined
            )
        })

        it("maps EV and launch-angle outcomes", function () {
            assert.equal(
                service.getEvLaOutcome("single"),
                "single"
            )

            assert.equal(
                service.getEvLaOutcome("double"),
                "double"
            )

            assert.equal(
                service.getEvLaOutcome("triple"),
                "triple"
            )

            assert.equal(
                service.getEvLaOutcome("home_run"),
                "hr"
            )

            for (const eventType of [
                "field_out",
                "force_out",
                "grounded_into_double_play",
                "double_play",
                "fielders_choice",
                "fielders_choice_out",
                "other_out",
                "sac_fly",
                "sac_bunt"
            ]) {
                assert.equal(
                    service.getEvLaOutcome(eventType),
                    "out"
                )
            }

            assert.equal(
                service.getEvLaOutcome("walk"),
                undefined
            )
        })

        it("classifies fly-ball depth by distance", function () {
            assert.equal(
                service.getFlyBallDepth(undefined, 249),
                "shallow"
            )

            assert.equal(
                service.getFlyBallDepth(undefined, 250),
                "normal"
            )

            assert.equal(
                service.getFlyBallDepth(undefined, 320),
                "normal"
            )

            assert.equal(
                service.getFlyBallDepth(undefined, 321),
                "deep"
            )
        })

        it("classifies fly-ball depth by coordinate when distance is unavailable", function () {
            assert.equal(
                service.getFlyBallDepth(179, undefined),
                "shallow"
            )

            assert.equal(
                service.getFlyBallDepth(180, undefined),
                "normal"
            )

            assert.equal(
                service.getFlyBallDepth(260, undefined),
                "normal"
            )

            assert.equal(
                service.getFlyBallDepth(261, undefined),
                "deep"
            )

            assert.equal(
                service.getFlyBallDepth(undefined, undefined),
                "normal"
            )
        })

        it("prefers distance when both depth inputs exist", function () {
            assert.equal(
                service.getFlyBallDepth(100, 300),
                "normal"
            )

            assert.equal(
                service.getFlyBallDepth(300, 200),
                "shallow"
            )
        })

        it("creates ten-degree spray bins", function () {
            assert.equal(
                service.getSprayBin(0, 100),
                0
            )

            assert.equal(
                service.getSprayBin(100, 100),
                40
            )

            assert.equal(
                service.getSprayBin(-100, 100),
                -50
            )

            assert.equal(
                service.getSprayBin(undefined, 100),
                undefined
            )

            assert.equal(
                service.getSprayBin(100, undefined),
                undefined
            )
        })
    })

    describe("out classification", function () {

        it("identifies ground-ball outs", function () {
            for (const eventType of [
                "field_out",
                "force_out",
                "grounded_into_double_play",
                "double_play",
                "fielders_choice",
                "fielders_choice_out",
                "other_out"
            ]) {
                assert.equal(
                    service.isGroundBallOut(
                        eventType,
                        "ground_ball"
                    ),
                    true
                )
            }

            assert.equal(
                service.isGroundBallOut(
                    "single",
                    "ground_ball"
                ),
                false
            )

            assert.equal(
                service.isGroundBallOut(
                    "field_out",
                    "fly_ball"
                ),
                false
            )
        })

        it("identifies fly-ball outs", function () {
            assert.equal(
                service.isFlyBallOut(
                    "field_out",
                    "fly_ball"
                ),
                true
            )

            assert.equal(
                service.isFlyBallOut(
                    "sac_fly",
                    ""
                ),
                true
            )

            assert.equal(
                service.isFlyBallOut(
                    "other_out",
                    "fly_ball"
                ),
                true
            )

            assert.equal(
                service.isFlyBallOut(
                    "single",
                    "fly_ball"
                ),
                false
            )

            assert.equal(
                service.isFlyBallOut(
                    "field_out",
                    "ground_ball"
                ),
                false
            )
        })

        it("identifies completed double plays", function () {
            assert.equal(
                service.isDoublePlay(
                    "grounded_into_double_play",
                    2
                ),
                true
            )

            assert.equal(
                service.isDoublePlay(
                    "double_play",
                    3
                ),
                true
            )

            assert.equal(
                service.isDoublePlay(
                    "double_play",
                    1
                ),
                false
            )

            assert.equal(
                service.isDoublePlay(
                    "field_out",
                    2
                ),
                false
            )
        })
    })
})
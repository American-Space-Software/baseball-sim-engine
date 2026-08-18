import assert from "node:assert/strict"

import {
    BaseResult,
    Contact,
    PitchCall,
    PitchType,
    PitchZone,
    PlayResult,
    Position,
    ShallowDeep
} from "../src/sim/service/enums.js"

import type {
    Game,
    GamePlayer,
    Pitch,
    Play
} from "../src/sim/service/interfaces.js"
import { PlayByPlayService, PlayDescriptionType } from "../src/presentation/services/play-by-play-service.js"



describe("PlayByPlayService", () => {

    const service = new PlayByPlayService()

    function player(id: string, fullName: string): GamePlayer {
        return { _id: id, fullName } as GamePlayer
    }

    function pitch(result: PitchCall, count = { balls: 0, strikes: 0, outs: 0 }): Pitch {
        return {
            type: PitchType.FF,
            actualZone: PitchZone.MID_MIDDLE,
            result,
            count,
            swing: false,
            inZone: true,
            isWP: false,
            isPB: false,
            overallQuality: 100,
            locQ: 100
        } as Pitch
    }

    function play(overrides: Partial<Play> = {}): Play {
        return {
            index: 0,
            hitterId: "hitter",
            pitcherId: "pitcher",
            catcherId: "catcher",
            inningNum: 1,
            inningTop: true,
            pitchLog: { pitches: [] },
            result: PlayResult.OUT,
            contact: Contact.GROUNDBALL,
            shallowDeep: ShallowDeep.NORMAL,
            fielder: Position.SHORTSTOP,
            fielderId: "fielder",
            runner: {
                events: [],
                result: {
                    start: { first: "", second: "", third: "", scored: [], out: [] },
                    end: { first: "", second: "", third: "", scored: [], out: ["hitter"] }
                }
            },
            count: {
                start: { balls: 0, strikes: 0, outs: 0 },
                end: { balls: 0, strikes: 0, outs: 1 }
            },
            score: {
                start: { away: 0, home: 0 },
                end: { away: 0, home: 0 }
            },
            matchupHandedness: {} as any,
            ...overrides
        } as Play
    }

    function game(plays: Play[] = []): Game {
        return {
            _id: "game-1",
            away: {
                _id: "away",
                name: "Away Team",
                abbrev: "AWY",
                players: [player("away-pitcher", "Away Starter"), player("hitter", "Example Hitter"), player("runner", "Example Runner")],
                currentPitcherId: "away-pitcher"
            },
            home: {
                _id: "home",
                name: "Home Team",
                abbrev: "HME",
                players: [player("home-pitcher", "Home Starter"), player("pitcher", "Example Pitcher"), player("catcher", "Example Catcher"), player("fielder", "Example Shortstop"), player("reliever", "Example Reliever")],
                currentPitcherId: "home-pitcher"
            },
            halfInnings: plays.length > 0 ? [{ num: 1, top: true, plays } as any] : [],
            substitutions: [],
            playIndex: plays.length > 0 ? plays[plays.length - 1].index : 0,
            isFinished: false,
            isComplete: false
        } as Game
    }


    describe("getGameStartDescriptions", () => {

        it("describes the matchup and both starting pitchers", () => {
            assert.deepEqual(service.getGameStartDescriptions(game()), [
                { type: PlayDescriptionType.RECAP, text: "Away Team at Home Team." },
                { type: PlayDescriptionType.RECAP, text: "Away Starter gets the start for Away Team." },
                { type: PlayDescriptionType.RECAP, text: "Home Starter gets the start for Home Team." }
            ])
        })

    })


    describe("getInningStartDescriptions", () => {

        it("describes the inning, score, outs, and runners", () => {
            const currentPlay = play({
                inningNum: 7,
                inningTop: false,
                score: { start: { away: 3, home: 4 }, end: { away: 3, home: 4 } },
                count: { start: { balls: 0, strikes: 0, outs: 1 }, end: { balls: 0, strikes: 0, outs: 1 } },
                runner: {
                    events: [],
                    result: {
                        start: { first: "runner", second: "", third: "runner-3", scored: [], out: [] },
                        end: { first: "runner", second: "", third: "runner-3", scored: [], out: [] }
                    }
                }
            } as Partial<Play>)

            const descriptions = service.getInningStartDescriptions(currentPlay)

            assert.equal(descriptions.length, 1)
            assert.equal(descriptions[0].type, PlayDescriptionType.RECAP)
            assert.match(descriptions[0].text, /bottom of the 7th/i)
            assert.match(descriptions[0].text, /home team leads 4-3/i)
            assert.match(descriptions[0].text, /one out/i)
            assert.match(descriptions[0].text, /runners on first and third/i)
        })

        it("is deterministic for the same play", () => {
            const currentPlay = play({ index: 17, inningNum: 4, inningTop: true })
            assert.deepEqual(service.getInningStartDescriptions(currentPlay), service.getInningStartDescriptions(currentPlay))
        })

    })


    describe("getPlayDescriptions", () => {

        it("describes the matchup and strikeout", () => {
            const currentPlay = play({
                result: PlayResult.STRIKEOUT,
                contact: undefined,
                fielder: undefined,
                fielderId: undefined,
                pitchLog: { pitches: [pitch(PitchCall.STRIKE, { balls: 1, strikes: 2, outs: 0 })] }
            } as Partial<Play>)

            const descriptions = service.getPlayDescriptions(game([currentPlay]), currentPlay)
            const resultDescription = descriptions.find(description => description.type === PlayDescriptionType.RESULT)

            assert.match(descriptions[0].text, /Example Hitter/)
            assert.ok(resultDescription)
            assert.match(resultDescription.text, /strike/i)
        })

        it("describes a walk", () => {
            const currentPlay = play({
                result: PlayResult.BB,
                contact: undefined,
                fielder: undefined,
                fielderId: undefined,
                runner: {
                    events: [],
                    result: {
                        start: { first: "", second: "", third: "", scored: [], out: [] },
                        end: { first: "hitter", second: "", third: "", scored: [], out: [] }
                    }
                },
                count: { start: { balls: 3, strikes: 1, outs: 0 }, end: { balls: 4, strikes: 1, outs: 0 } }
            } as Partial<Play>)

            const resultDescription = service.getPlayDescriptions(game([currentPlay]), currentPlay).find(description => description.type === PlayDescriptionType.RESULT)

            assert.ok(resultDescription)
            assert.match(resultDescription.text, /walk|ball four/i)
        })

        it("describes a single and attaches the in-play pitch to the result", () => {
            const inPlayPitch = pitch(PitchCall.IN_PLAY)
            const currentPlay = play({
                result: PlayResult.SINGLE,
                contact: Contact.LINE_DRIVE,
                fielder: Position.CENTER_FIELD,
                fielderId: "fielder",
                shallowDeep: ShallowDeep.NORMAL,
                pitchLog: { pitches: [inPlayPitch] },
                runner: {
                    events: [],
                    result: {
                        start: { first: "", second: "", third: "", scored: [], out: [] },
                        end: { first: "hitter", second: "", third: "", scored: [], out: [] }
                    }
                }
            } as Partial<Play>)

            const resultDescription = service.getPlayDescriptions(game([currentPlay]), currentPlay).find(description => description.type === PlayDescriptionType.RESULT)

            assert.ok(resultDescription)
            assert.match(resultDescription.text, /single/i)
            assert.equal(resultDescription.meta?.pitch, inPlayPitch)
        })

        it("describes a runner event once when it occurs on a pitch", () => {
            const currentPlay = play({
                result: PlayResult.SINGLE,
                pitchLog: { pitches: [pitch(PitchCall.IN_PLAY)] },
                runner: {
                    events: [
                        { pitchIndex: 0, runner: { _id: "runner" }, movement: { start: BaseResult.FIRST, end: BaseResult.THIRD, isOut: false } },
                        { pitchIndex: 0, runner: { _id: "hitter" }, movement: { start: BaseResult.HOME, end: BaseResult.FIRST, isOut: false } }
                    ] as any,
                    result: {
                        start: { first: "runner", second: "", third: "", scored: [], out: [] },
                        end: { first: "hitter", second: "", third: "runner", scored: [], out: [] }
                    }
                }
            } as Partial<Play>)

            const descriptions = service.getPlayDescriptions(game([currentPlay]), currentPlay)
            const runnerDescriptions = descriptions.filter(description => description.text.includes("Example Runner"))

            assert.equal(runnerDescriptions.length, 1)
            assert.match(runnerDescriptions[0].text, /advances to/i)
        })

        it("announces runs and the updated score", () => {
            const currentPlay = play({
                result: PlayResult.DOUBLE,
                contact: Contact.LINE_DRIVE,
                score: { start: { away: 1, home: 0 }, end: { away: 2, home: 0 } },
                runner: {
                    events: [],
                    result: {
                        start: { first: "", second: "runner", third: "", scored: [], out: [] },
                        end: { first: "", second: "hitter", third: "", scored: ["runner"], out: [] }
                    }
                }
            } as Partial<Play>)

            const descriptions = service.getPlayDescriptions(game([currentPlay]), currentPlay)

            assert.ok(descriptions.some(description => description.text === "1 run scores."))
            assert.ok(descriptions.some(description => description.text === "The score is 2 - 0."))
        })

        it("describes a pitching change", () => {
            const currentPlay = play({ index: 8 })
            const currentGame = game([currentPlay])
            currentGame.substitutions = [{ inning: 1, top: true, teamId: "home", outPlayerId: "pitcher", inPlayerId: "reliever", isPitchingChange: true, playIndex: 8 }] as any

            const substitution = service.getPlayDescriptions(currentGame, currentPlay).find(description => description.type === PlayDescriptionType.SUBSTITUTION)

            assert.ok(substitution)
            assert.match(substitution.text, /Example Reliever/)
            assert.match(substitution.text, /Example Pitcher/)
        })

        it("adds the final game recap on the game-ending play", () => {
            const currentPlay = play({
                index: 10,
                inningNum: 9,
                inningTop: false,
                score: { start: { away: 2, home: 3 }, end: { away: 2, home: 3 } },
                count: { start: { balls: 0, strikes: 0, outs: 2 }, end: { balls: 0, strikes: 0, outs: 3 } }
            })
            const currentGame = game([currentPlay])
            currentGame.isFinished = true
            currentGame.isComplete = true
            currentGame.playIndex = 10

            const descriptions = service.getPlayDescriptions(currentGame, currentPlay)

            assert.ok(descriptions.some(description => description.text === "The final score is 2 - 3."))
            assert.ok(descriptions.some(description => /Home Team/.test(description.text)))
        })

        it("is deterministic for the same game and play", () => {
            const currentPlay = play({ index: 23, result: PlayResult.HR, contact: Contact.FLY_BALL, fielder: Position.LEFT_FIELD, fielderId: "fielder" })
            const currentGame = game([currentPlay])
            assert.deepEqual(service.getPlayDescriptions(currentGame, currentPlay), service.getPlayDescriptions(currentGame, currentPlay))
        })

    })


    describe("getPlayByPlay", () => {

        it("returns newest plays first", () => {
            const first = play({ index: 1 })
            const second = play({ index: 2 })
            const playByPlay = service.getPlayByPlay(game([first, second]))

            assert.equal(playByPlay.length, 2)
            assert.equal(playByPlay[0].play.index, 2)
            assert.equal(playByPlay[1].play.index, 1)
        })

        it("returns an empty array when the game has no half innings", () => {
            assert.deepEqual(service.getPlayByPlay(game()), [])
        })

    })

})
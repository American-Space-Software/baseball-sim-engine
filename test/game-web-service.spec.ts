import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    Handedness,
    PitchCall,
    PitchType,
    Position
} from "../src/sim/service/enums.js"

import type {
    Game,
    GamePlayer,
    Pitch,
    Play
} from "../src/sim/service/interfaces.js"

import {
    AtBatState,
    GameViewService,
    GameWebService
} from "../src/presentation/services/game-web-service.js"

import {
    PlayByPlayService
} from "../src/presentation/services/play-by-play-service.js"

import type {
    PlayByPlayEntry,
    PlayDescription
} from "../src/presentation/services/play-by-play-service.js"


describe("GameWebService", function () {

    it("builds the base view model before the game starts", function () {
        const service = createGameWebService()
        const game = buildGame({
            isStarted: false,
            isTopInning: true,
            currentInning: 1
        })

        const vm = service.getGameViewModel(game)

        assert.equal(vm.game, game)
        assert.equal(vm.currentInning, 1)
        assert.equal(vm.isTopInning, true)
        assert.equal(vm.balls, 0)
        assert.equal(vm.strikes, 0)
        assert.equal(vm.outs, 0)
        assert.equal(vm.showHitter, false)
        assert.equal(vm.showPitcher, false)
        assert.equal(vm.awayBoxscore.side, "AWAY")
        assert.equal(vm.homeBoxscore.side, "HOME")
        assert.equal(vm.atBatBoxscore.side, "AWAY")
        assert.equal(vm.hitter, undefined)
        assert.equal(vm.pitcher, undefined)
    })

    it("uses the home boxscore as the active boxscore in the bottom half", function () {
        const service = createGameWebService()
        const game = buildGame({
            isStarted: false,
            isTopInning: false
        })

        const vm = service.getGameViewModel(game)

        assert.equal(vm.atBatBoxscore.side, "HOME")
        assert.equal(vm.atBatBoxscore.team, game.home)
    })

    it("builds the current hitter pitcher runners and defense", function () {
        const service = createGameWebService()

        const awayHitter = buildPlayer("away-hitter", Position.CENTER_FIELD, {
            hits: Handedness.L
        })

        const runner1B = buildPlayer("runner-1", Position.FIRST_BASE)
        const runner2B = buildPlayer("runner-2", Position.SECOND_BASE)
        const runner3B = buildPlayer("runner-3", Position.THIRD_BASE)

        const pitcher = buildPlayer("pitcher", Position.PITCHER, {
            throws: Handedness.R
        })

        const catcher = buildPlayer("catcher", Position.CATCHER)
        const firstBase = buildPlayer("first", Position.FIRST_BASE)
        const secondBase = buildPlayer("second", Position.SECOND_BASE)
        const thirdBase = buildPlayer("third", Position.THIRD_BASE)
        const shortstop = buildPlayer("shortstop", Position.SHORTSTOP)
        const leftField = buildPlayer("left", Position.LEFT_FIELD)
        const centerField = buildPlayer("center", Position.CENTER_FIELD)
        const rightField = buildPlayer("right", Position.RIGHT_FIELD)

        const currentPlay = buildPlay({
            index: 1,
            hitterId: awayHitter._id,
            pitcherId: pitcher._id,
            result: undefined
        })

        const game = buildGame({
            isStarted: true,
            isTopInning: true,
            awayPlayers: [
                awayHitter,
                runner1B,
                runner2B,
                runner3B
            ],
            homePlayers: [
                pitcher,
                catcher,
                firstBase,
                secondBase,
                thirdBase,
                shortstop,
                leftField,
                centerField,
                rightField
            ],
            awayCurrentPitcherId: "away-pitcher",
            homeCurrentPitcherId: pitcher._id,
            awayRunner1BId: runner1B._id,
            awayRunner2BId: runner2B._id,
            awayRunner3BId: runner3B._id,
            plays: [
                currentPlay
            ]
        })

        const vm = service.getGameViewModel(game)

        assert.equal(vm.hitter, awayHitter)
        assert.equal(vm.pitcher, pitcher)
        assert.equal(vm.runner1B, runner1B)
        assert.equal(vm.runner2B, runner2B)
        assert.equal(vm.runner3B, runner3B)

        assert.equal(vm.awayPlayer, awayHitter)
        assert.equal(vm.homePlayer, pitcher)

        assert.equal(vm.defense, game.home)
        assert.equal(vm.catcher, catcher)
        assert.equal(vm.firstBase, firstBase)
        assert.equal(vm.secondBase, secondBase)
        assert.equal(vm.thirdBase, thirdBase)
        assert.equal(vm.shortstop, shortstop)
        assert.equal(vm.leftField, leftField)
        assert.equal(vm.centerField, centerField)
        assert.equal(vm.rightField, rightField)

        assert.equal(vm.showHitter, true)
        assert.equal(vm.showPitcher, true)

        assert.deepEqual(
            vm.matchupHandedness,
            {
                throws: Handedness.R,
                hits: Handedness.L,
                vsSameHand: false
            }
        )
    })

    it("uses home runners and away defense in the bottom half", function () {
        const service = createGameWebService()

        const hitter = buildPlayer("home-hitter", Position.CENTER_FIELD)
        const runner = buildPlayer("home-runner", Position.FIRST_BASE)
        const pitcher = buildPlayer("away-pitcher", Position.PITCHER)

        const currentPlay = buildPlay({
            hitterId: hitter._id,
            pitcherId: pitcher._id,
            result: undefined
        })

        const game = buildGame({
            isStarted: true,
            isTopInning: false,
            awayPlayers: [
                pitcher
            ],
            homePlayers: [
                hitter,
                runner
            ],
            awayCurrentPitcherId: pitcher._id,
            homeRunner1BId: runner._id,
            plays: [
                currentPlay
            ]
        })

        const vm = service.getGameViewModel(game)

        assert.equal(vm.runner1B, runner)
        assert.equal(vm.defense, game.away)
        assert.equal(vm.homePlayer, hitter)
        assert.equal(vm.awayPlayer, pitcher)
    })

    it("builds a typed line score", function () {
        const service = createGameWebService()

        const game = buildGame({
            currentInning: 3,
            scoreAway: 3,
            scoreHome: 2,
            halfInnings: [
                buildHalfInning(1, true, 2, 3, 0),
                buildHalfInning(1, false, 1, 2, 0),
                buildHalfInning(2, true, 0, 1, 0),
                buildHalfInning(2, false, 1, 1, 1),
                buildHalfInning(3, true, 1, 2, 0)
            ]
        })

        const linescore = service.getLineScore(game)

        assert.equal(linescore.currentInning, 3)
        assert.equal(linescore.away.name, "AWY")
        assert.equal(linescore.home.name, "HME")

        assert.deepEqual(
            linescore.away.innings.slice(0, 3),
            [
                2,
                0,
                1
            ]
        )

        assert.deepEqual(
            linescore.home.innings.slice(0, 3),
            [
                1,
                1,
                undefined
            ]
        )

        assert.equal(linescore.away.runs, 3)
        assert.equal(linescore.home.runs, 2)
        assert.equal(linescore.away.hits, 6)
        assert.equal(linescore.home.hits, 3)
        assert.equal(linescore.away.errors, 0)
        assert.equal(linescore.home.errors, 1)
        assert.equal(linescore.away.innings.length, 9)
        assert.equal(linescore.home.innings.length, 9)
    })

    it("extends the line score beyond nine innings", function () {
        const service = createGameWebService()
        const game = buildGame({
            currentInning: 11
        })

        const linescore = service.getLineScore(game)

        assert.equal(linescore.away.innings.length, 11)
        assert.equal(linescore.home.innings.length, 11)
    })

    it("returns plays in chronological order", function () {
        const service = createGameWebService()

        const first = buildPlay({
            index: 1,
            result: "OUT"
        })

        const second = buildPlay({
            index: 2,
            result: "SINGLE"
        })

        const third = buildPlay({
            index: 3,
            result: undefined
        })

        const game = buildGame({
            halfInnings: [
                {
                    num: 1,
                    top: true,
                    plays: [
                        first,
                        second
                    ],
                    linescore: {}
                },
                {
                    num: 1,
                    top: false,
                    plays: [
                        third
                    ],
                    linescore: {}
                }
            ]
        })

        assert.deepEqual(
            service.getPlays(game),
            [
                first,
                second,
                third
            ]
        )
    })

    it("returns the current unfinished play", function () {
        const service = createGameWebService()

        const completed = buildPlay({
            index: 1,
            result: "OUT"
        })

        const current = buildPlay({
            index: 2,
            result: undefined
        })

        const game = buildGame({
            plays: [
                completed,
                current
            ]
        })

        assert.equal(
            service.getCurrentPlay(game),
            current
        )
    })

    it("returns the most recent completed play", function () {
        const service = createGameWebService()

        const first = buildPlay({
            index: 1,
            result: "OUT"
        })

        const second = buildPlay({
            index: 2,
            result: "SINGLE"
        })

        const current = buildPlay({
            index: 3,
            result: undefined
        })

        const game = buildGame({
            plays: [
                first,
                second,
                current
            ]
        })

        assert.equal(
            service.getLastPlay(game),
            second
        )
    })

    it("identifies a newly started at bat", function () {
        const service = createGameWebService()

        const game = buildGame({
            plays: [
                buildPlay({
                    result: undefined,
                    pitches: []
                })
            ]
        })

        assert.equal(
            service.getAtBatState(game),
            AtBatState.STARTED
        )
    })

    it("identifies an ongoing at bat", function () {
        const service = createGameWebService()

        const game = buildGame({
            plays: [
                buildPlay({
                    result: undefined,
                    pitches: [
                        buildPitch()
                    ]
                })
            ]
        })

        assert.equal(
            service.getAtBatState(game),
            AtBatState.ONGOING
        )
    })

    it("identifies an ended at bat", function () {
        const service = createGameWebService()

        const game = buildGame({
            plays: [
                buildPlay({
                    result: "OUT"
                })
            ]
        })

        assert.equal(
            service.getAtBatState(game),
            AtBatState.ENDED
        )
    })

    it("returns undefined when no at bat exists", function () {
        const service = createGameWebService()

        assert.equal(
            service.getAtBatState(
                buildGame()
            ),
            undefined
        )
    })

    it("indexes every game player by id", function () {
        const service = createGameWebService()
        const away = buildPlayer("1", Position.CENTER_FIELD)
        const home = buildPlayer("2", Position.PITCHER)

        const game = buildGame({
            awayPlayers: [
                away
            ],
            homePlayers: [
                home
            ]
        })

        assert.deepEqual(
            service.getGamePlayers(game),
            {
                "1": away,
                "2": home
            }
        )
    })

    it("returns the correct offense and defense", function () {
        const service = createGameWebService()

        const topGame = buildGame({
            isTopInning: true
        })

        assert.equal(service.getOffense(topGame), topGame.away)
        assert.equal(service.getDefense(topGame), topGame.home)

        const bottomGame = buildGame({
            isTopInning: false
        })

        assert.equal(service.getOffense(bottomGame), bottomGame.home)
        assert.equal(service.getDefense(bottomGame), bottomGame.away)
    })

    it("uses the hitter on the current play", function () {
        const service = createGameWebService()
        const hitter = buildPlayer("hitter", Position.CENTER_FIELD)

        const game = buildGame({
            isStarted: true,
            awayPlayers: [
                hitter
            ],
            plays: [
                buildPlay({
                    hitterId: hitter._id,
                    result: undefined
                })
            ]
        })

        assert.equal(
            service.getHitter(game),
            hitter
        )
    })

    it("uses the current defensive pitcher", function () {
        const service = createGameWebService()
        const pitcher = buildPlayer("pitcher", Position.PITCHER)

        const game = buildGame({
            isStarted: true,
            isTopInning: true,
            homePlayers: [
                pitcher
            ],
            homeCurrentPitcherId: pitcher._id
        })

        assert.equal(
            service.getPitcher(game),
            pitcher
        )
    })

    it("resolves switch hitters against pitcher handedness", function () {
        const service = createGameWebService()

        const hitter = buildPlayer("hitter", Position.CENTER_FIELD, {
            hits: Handedness.S
        })

        const rightPitcher = buildPlayer("right-pitcher", Position.PITCHER, {
            throws: Handedness.R
        })

        assert.deepEqual(
            service.getMatchupHandedness(
                hitter,
                rightPitcher
            ),
            {
                throws: Handedness.R,
                hits: Handedness.L,
                vsSameHand: false
            }
        )

        const leftPitcher = buildPlayer("left-pitcher", Position.PITCHER, {
            throws: Handedness.L
        })

        assert.deepEqual(
            service.getMatchupHandedness(
                hitter,
                leftPitcher
            ),
            {
                throws: Handedness.L,
                hits: Handedness.R,
                vsSameHand: false
            }
        )
    })

    it("delegates full play by play generation", function () {
        const entries = [
            {
                play: buildPlay(),
                descriptions: []
            }
        ] as PlayByPlayEntry[]

        const playByPlayService = createPlayByPlayService({
            getPlayByPlay: () => entries
        })

        const service = new GameWebService(
            playByPlayService
        )

        const game = buildGame()

        assert.equal(
            service.getPlayByPlay(game),
            entries
        )
    })

    it("returns game start descriptions before the first half inning", function () {
        const descriptions = [
            {
                text: "Game start"
            }
        ] as PlayDescription[]

        const playByPlayService = createPlayByPlayService({
            getGameStartDescriptions: () => descriptions
        })

        const service = new GameWebService(
            playByPlayService
        )

        assert.deepEqual(
            service.getCurrentDescriptions(
                buildGame()
            ),
            descriptions
        )
    })

    it("includes inning start and play descriptions for the first play of a half inning", function () {
        const play = buildPlay({
            index: 5,
            result: undefined
        })

        const inningDescriptions = [
            {
                text: "Top of the inning"
            }
        ] as PlayDescription[]

        const playDescriptions = [
            {
                text: "Batter steps in"
            }
        ] as PlayDescription[]

        const playByPlayService = createPlayByPlayService({
            getInningStartDescriptions: () => inningDescriptions,
            getPlayDescriptions: () => playDescriptions
        })

        const service = new GameWebService(
            playByPlayService
        )

        const game = buildGame({
            halfInnings: [
                {
                    num: 1,
                    top: true,
                    plays: [
                        play
                    ],
                    linescore: {}
                }
            ]
        })

        assert.deepEqual(
            service.getCurrentDescriptions(game),
            [
                ...inningDescriptions,
                ...playDescriptions
            ]
        )
    })

})


describe("GameViewService", function () {

    it("returns the correct effective hitter ratings", function () {
        const service = createGameViewService()

        const hitter = buildPlayer(
            "hitter",
            Position.CENTER_FIELD
        )

        assert.equal(
            service.getEffectiveHittingRatings(
                hitter,
                Handedness.R
            ),
            hitter.hittingRatings.vsR
        )

        assert.equal(
            service.getEffectiveHittingRatings(
                hitter,
                Handedness.L
            ),
            hitter.hittingRatings.vsL
        )
    })

    it("returns the correct effective pitcher ratings", function () {
        const service = createGameViewService()

        const pitcher = buildPlayer(
            "pitcher",
            Position.PITCHER
        )

        assert.deepEqual(
            service.getEffectivePitchRatings(
                pitcher,
                Handedness.R
            ),
            {
                power: 110,
                control: 120,
                movement: 130
            }
        )

        assert.deepEqual(
            service.getEffectivePitchRatings(
                pitcher,
                Handedness.L
            ),
            {
                power: 110,
                control: 90,
                movement: 80
            }
        )
    })

    it("formats pitcher ratings", function () {
        const service = createGameViewService()
        const pitcher = buildPlayer("pitcher", Position.PITCHER)

        assert.equal(
            service.getPitcherRatingsText(
                pitcher,
                Handedness.R
            ),
            "POW 110, CON 120, MOV 130"
        )
    })

    it("formats hitter ratings", function () {
        const service = createGameViewService()
        const hitter = buildPlayer("hitter", Position.CENTER_FIELD)

        assert.equal(
            service.getHitterRatingsText(
                hitter,
                Handedness.R
            ),
            "CON 105, GAP 115, HR 125, EYE 95"
        )
    })

    it("formats pitcher game stats", function () {
        const service = createGameViewService()
        const pitcher = buildPlayer("pitcher", Position.PITCHER)

        assert.equal(
            service.getPitcherGameStats(pitcher),
            "6 IP, 2 ER, 7 K, 2 BB, 95 PC"
        )

        assert.equal(
            service.getPitcherGameStatsShort(pitcher),
            "6 IP, 2 ER, 7 K"
        )
    })

    it("formats hitter game stats", function () {
        const service = createGameViewService()

        const hitter = buildPlayer(
            "hitter",
            Position.CENTER_FIELD,
            {
                hitResult: {
                    hits: 2,
                    atBats: 4,
                    runs: 1,
                    doubles: 1,
                    triples: 0,
                    homeRuns: 1,
                    rbi: 3,
                    bb: 2,
                    hbp: 1,
                    so: 1
                }
            }
        )

        assert.equal(
            service.getHitterGameStats(hitter),
            "2/4, 2 BB, HBP, 2B, HR, 3 RBI"
        )

        assert.equal(
            service.getHitterGameStatsShort(hitter),
            "2/4"
        )
    })

    it("formats a pitch header", function () {
        const playByPlayService = createPlayByPlayService({
            getPitchTypeFull: () => "Fastball"
        })

        const service = new GameViewService(
            playByPlayService
        )

        const pitch = buildPitch({
            result: PitchCall.STRIKE,
            swing: true,
            velocity: 97.4,
            balls: 1,
            strikes: 2,
            type: PitchType.FF
        })

        assert.equal(
            service.getPitchHeader(pitch),
            "Swinging Strike - 1-2 - 97.4 MPH Fastball"
        )
    })

    it("returns an empty pitch header without pitch quality", function () {
        const service = createGameViewService()

        const pitch = {
            ...buildPitch(),
            quality: undefined
        } as Pitch

        assert.equal(
            service.getPitchHeader(pitch),
            ""
        )
    })

    it("formats an in-play contact header", function () {
        const service = createGameViewService()

        const pitch = {
            ...buildPitch(),
            contactQuality: {
                exitVelocity: 103.4,
                launchAngle: 27.2,
                distance: 412
            }
        } as Pitch

        assert.equal(
            service.getInPlayHeader(pitch),
            "EV 103.4 MPH / LA 27.2° / Dst 412 ft"
        )
    })

    it("returns an empty in-play header without contact quality", function () {
        const service = createGameViewService()

        assert.equal(
            service.getInPlayHeader(
                buildPitch()
            ),
            ""
        )
    })

    it("describes pitch results", function () {
        const service = createGameViewService()

        assert.equal(
            service.getPitchResultDescription(
                buildPitch({
                    result: PitchCall.BALL
                })
            ),
            "Ball"
        )

        assert.equal(
            service.getPitchResultDescription(
                buildPitch({
                    result: PitchCall.STRIKE,
                    swing: false
                })
            ),
            "Called Strike"
        )

        assert.equal(
            service.getPitchResultDescription(
                buildPitch({
                    result: PitchCall.STRIKE,
                    swing: true
                })
            ),
            "Swinging Strike"
        )

        assert.equal(
            service.getPitchResultDescription(
                buildPitch({
                    result: PitchCall.FOUL
                })
            ),
            "Foul Ball"
        )

        assert.equal(
            service.getPitchResultDescription(
                buildPitch({
                    result: PitchCall.IN_PLAY
                })
            ),
            "In Play"
        )
    })

    it("prioritizes wild pitches and passed balls", function () {
        const service = createGameViewService()

        assert.equal(
            service.getPitchResultDescription({
                ...buildPitch(),
                isWP: true
            } as Pitch),
            "Wild Pitch"
        )

        assert.equal(
            service.getPitchResultDescription({
                ...buildPitch(),
                isPB: true
            } as Pitch),
            "Passed Ball"
        )
    })

    it("formats ordinal numbers", function () {
        const service = createGameViewService()

        assert.equal(service.getNumberWithOrdinal(1), "1st")
        assert.equal(service.getNumberWithOrdinal(2), "2nd")
        assert.equal(service.getNumberWithOrdinal(3), "3rd")
        assert.equal(service.getNumberWithOrdinal(4), "4th")
        assert.equal(service.getNumberWithOrdinal(11), "11th")
        assert.equal(service.getNumberWithOrdinal(12), "12th")
        assert.equal(service.getNumberWithOrdinal(13), "13th")
        assert.equal(service.getNumberWithOrdinal(21), "21st")
        assert.equal(service.getNumberWithOrdinal(22), "22nd")
        assert.equal(service.getNumberWithOrdinal(23), "23rd")
    })

    it("formats filled count indicators", function () {
        const service = createGameViewService()

        assert.equal(
            service.getBalls(
                3,
                2
            ),
            "🟡🟡⚪"
        )

        assert.equal(
            service.getBalls(
                2,
                0
            ),
            "⚪⚪"
        )
    })

})


function createGameWebService(): GameWebService {
    return new GameWebService(
        createPlayByPlayService()
    )
}


function createGameViewService(): GameViewService {
    return new GameViewService(
        createPlayByPlayService()
    )
}


function createPlayByPlayService(overrides: Partial<PlayByPlayService> = {}): PlayByPlayService {
    return {
        getGameStartDescriptions: () => [],
        getInningStartDescriptions: () => [],
        getPlayDescriptions: () => [],
        getPlayByPlay: () => [],
        getPitchTypeFull: pitchType => String(pitchType),
        ...overrides
    } as unknown as PlayByPlayService
}


function buildGame(options: {
    isStarted?: boolean
    isComplete?: boolean
    isTopInning?: boolean
    currentInning?: number

    scoreAway?: number
    scoreHome?: number

    awayPlayers?: GamePlayer[]
    homePlayers?: GamePlayer[]

    awayCurrentPitcherId?: string
    homeCurrentPitcherId?: string

    awayRunner1BId?: string
    awayRunner2BId?: string
    awayRunner3BId?: string

    homeRunner1BId?: string
    homeRunner2BId?: string
    homeRunner3BId?: string

    winningPitcherId?: string
    losingPitcherId?: string

    plays?: Play[]
    halfInnings?: any[]
} = {}): Game {
    const away = {
        _id: "away",
        name: "Away",
        abbrev: "AWY",
        players: options.awayPlayers ?? [],
        lineupIds: (options.awayPlayers ?? []).map(player => player._id),
        currentHitterIndex: 0,
        currentPitcherId: options.awayCurrentPitcherId,
        runner1BId: options.awayRunner1BId,
        runner2BId: options.awayRunner2BId,
        runner3BId: options.awayRunner3BId
    }

    const home = {
        _id: "home",
        name: "Home",
        abbrev: "HME",
        players: options.homePlayers ?? [],
        lineupIds: (options.homePlayers ?? []).map(player => player._id),
        currentHitterIndex: 0,
        currentPitcherId: options.homeCurrentPitcherId,
        runner1BId: options.homeRunner1BId,
        runner2BId: options.homeRunner2BId,
        runner3BId: options.homeRunner3BId
    }

    const halfInnings = options.halfInnings ?? (
        options.plays
            ? [
                {
                    num: 1,
                    top: true,
                    plays: options.plays,
                    linescore: {}
                }
            ]
            : []
    )

    return {
        _id: "game",
        away,
        home,
        isStarted: options.isStarted ?? false,
        isComplete: options.isComplete ?? false,
        isTopInning: options.isTopInning ?? true,
        currentInning: options.currentInning ?? 1,
        count: {
            balls: 0,
            strikes: 0,
            outs: 0
        },
        score: {
            away: options.scoreAway ?? 0,
            home: options.scoreHome ?? 0
        },
        halfInnings,
        winningPitcherId: options.winningPitcherId,
        losingPitcherId: options.losingPitcherId
    } as unknown as Game
}


function buildPlayer(playerId: string, position: Position, options: {
    hits?: Handedness
    throws?: Handedness
    hitResult?: Partial<GamePlayer["hitResult"]>
} = {}): GamePlayer {
    return {
        _id: playerId,
        fullName: `Player ${playerId}`,
        displayName: `Player ${playerId}`,
        currentPosition: position,
        hits: options.hits ?? Handedness.R,
        throws: options.throws ?? Handedness.R,

        hittingRatings: {
            speed: 100,
            arm: 100,
            defense: 100,
            vsR: {
                contact: 105,
                gapPower: 115,
                homerunPower: 125,
                plateDiscipline: 95
            },
            vsL: {
                contact: 85,
                gapPower: 90,
                homerunPower: 95,
                plateDiscipline: 100
            }
        },

        pitchRatings: {
            power: 110,
            vsR: {
                control: 120,
                movement: 130
            },
            vsL: {
                control: 90,
                movement: 80
            }
        },

        hitResult: {
            hits: 0,
            atBats: 0,
            runs: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            rbi: 0,
            bb: 0,
            hbp: 0,
            so: 0,
            ...options.hitResult
        },

        pitchResult: {
            wins: 0,
            losses: 0,
            ip: 6,
            hits: 5,
            runs: 2,
            er: 2,
            homeRuns: 1,
            bb: 2,
            so: 7,
            hbp: 0,
            battersFaced: 24,
            pitches: 95,
            strikes: 62
        }
    } as unknown as GamePlayer
}


function buildPlay(options: {
    index?: number
    hitterId?: string
    pitcherId?: string
    result?: any
    pitches?: Pitch[]
} = {}): Play {
    return {
        index: options.index ?? 1,
        inningNum: 1,
        inningTop: true,
        hitterId: options.hitterId ?? "hitter",
        pitcherId: options.pitcherId ?? "pitcher",
        result: options.result,
        pitchLog: {
            pitches: options.pitches ?? []
        }
    } as unknown as Play
}


function buildPitch(options: {
    result?: PitchCall
    swing?: boolean
    velocity?: number
    balls?: number
    strikes?: number
    type?: PitchType
} = {}): Pitch {
    return {
        type: options.type ?? PitchType.FF,
        result: options.result ?? PitchCall.BALL,
        swing: options.swing ?? false,
        isWP: false,
        isPB: false,
        count: {
            balls: options.balls ?? 0,
            strikes: options.strikes ?? 0
        },
        quality: {
            velocity: options.velocity ?? 95
        }
    } as unknown as Pitch
}


function buildHalfInning(num: number, top: boolean, runs: number, hits: number, errors: number) {
    return {
        num,
        top,
        plays: [],
        linescore: {
            runs,
            hits,
            errors
        }
    }
}
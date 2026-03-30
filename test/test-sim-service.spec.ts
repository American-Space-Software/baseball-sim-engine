import assert from "assert"
import {
    BaseResult,
    Contact,
    Handedness,
    PitchType,
    PlayResult,
    Position,
    ShallowDeep,
    ThrowResult,
    simService
} from "../src/index.js"
import seedrandom from "seedrandom"
import type {
    Game,
    StartGameCommand,
    Player,
    Team,
    Lineup,
    RotationPitcher
} from "../src/index.js"

let rng = new seedrandom(4)

describe("SimService", async () => {

    it("should sim a game", async () => {

        const laRatings = simService.buildLeagueAverages(100)

        const awayPlayers: Player[] = buildTestTeam(1)
        const homePlayers: Player[] = buildTestTeam(100)

        const awayTeam: Team = {
            _id: "away-team",
            name: "Away",
            abbrev: "AWAY",
            colors: {
                color1: "#ff0000",
                color2: "#ffffff"
            }
        } as Team

        const homeTeam: Team = {
            _id: "home-team",
            name: "Home",
            abbrev: "HOME",
            colors: {
                color1: "#0000ff",
                color2: "#ffffff"
            }
        } as Team

        const awayLineup: Lineup = buildTestLineup(awayPlayers)
        const homeLineup: Lineup = buildTestLineup(homePlayers)

        const awayStartingPitcher: RotationPitcher = {
            _id: awayPlayers.find(p => p.primaryPosition == Position.PITCHER)!._id,
            stamina: 1
        } as RotationPitcher

        const homeStartingPitcher: RotationPitcher = {
            _id: homePlayers.find(p => p.primaryPosition == Position.PITCHER)!._id,
            stamina: 1
        } as RotationPitcher

        const game: Game = {
            _id: "game-1",
        } as Game

        simService.initGame(game)

        const command: StartGameCommand = {
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

            leagueAverages: laRatings,
            date: new Date()
        }

        const startedGame: Game = simService.startGame(command)

        while (!startedGame.isComplete) {
            simService.simPitch(startedGame, rng)
        }

        assert.equal(startedGame.isComplete, true)
        assert.equal(startedGame.score.away, 11)
        assert.equal(startedGame.score.home, 3)
    })

    it("inning can end during runner events; stop further processing but keep events", async () => {
        const game = buildStartedGame()
        const laRatings = game.leagueAverages

        const awayTeam = game.away
        const homeTeam = game.home

        const pitcher = homeTeam.players.find(p => p._id === homeTeam.currentPitcherId)!
        const fielder =
            homeTeam.players.find(p => p.currentPosition === Position.CENTER_FIELD) ??
            homeTeam.players.find(p => p.currentPosition === Position.RIGHT_FIELD) ??
            homeTeam.players.find(p => p.currentPosition === Position.LEFT_FIELD)!

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds.includes(p._id))!
        const runner2B = awayTeam.players.find(p => p._id !== hitter._id)!

        const runnerResult: any = {
            first: undefined,
            second: runner2B._id,
            third: undefined,
            out: [],
            scored: [],
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "fakeOut1" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
            { runner: { _id: "fakeOut2" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
        ]

        const defensiveCredits: any[] = []

        const runnerActions = (simService as any).runnerActions
        const originalChance = runnerActions.getChanceRunnerSafe
        const originalThrow = runnerActions.gameRolls.getThrowResult

        runnerActions.getChanceRunnerSafe = () => 95
        runnerActions.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

        let inPlayRunnerEvents: any[] = []
        try {
            inPlayRunnerEvents = simService.getRunnerEvents(
                () => 0.5,
                runnerResult,
                halfInningRunnerEvents,
                defensiveCredits,
                laRatings,
                PlayResult.SINGLE,
                Contact.LINE_DRIVE,
                ShallowDeep.NORMAL,
                hitter,
                fielder,
                undefined,
                runner2B,
                undefined,
                awayTeam,
                homeTeam,
                pitcher,
                0
            ) as any[]
        } finally {
            runnerActions.getChanceRunnerSafe = originalChance
            runnerActions.gameRolls.getThrowResult = originalThrow
        }

        const outs =
            halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
            inPlayRunnerEvents.filter(e => e?.movement?.isOut).length

        assert.equal(outs, 3)
        assert.ok(inPlayRunnerEvents.length > 0)

        const baseIds = [runnerResult.first, runnerResult.second, runnerResult.third].filter(Boolean)
        assert.equal(new Set(baseIds).size, baseIds.length)
    })

    it("Ground ball to infielder with runner on 3B and 2 outs must record the batter out at 1B (throw if needed), no run", async () => {
        const game = buildStartedGame()
        const laRatings = game.leagueAverages

        const awayTeam = game.away
        const homeTeam = game.home

        const pitcher = homeTeam.players.find(p => p._id === homeTeam.currentPitcherId)
        assert.ok(pitcher)

        const infielder =
            homeTeam.players.find(p => p.currentPosition === Position.FIRST_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SECOND_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.THIRD_BASE) ??
            homeTeam.players.find(p => p.currentPosition === Position.SHORTSTOP)

        assert.ok(infielder, "Need an infielder on defense")

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds?.includes(p._id)) ?? awayTeam.players[0]
        assert.ok(hitter)

        const runner3B = awayTeam.players.find(p => p._id !== hitter._id)
        assert.ok(runner3B)

        const runnerResult: any = {
            first: undefined,
            second: undefined,
            third: runner3B._id,
            out: [],
            scored: [],
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "out1" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
            { runner: { _id: "out2" }, movement: { isOut: true, start: BaseResult.HOME, end: BaseResult.FIRST } },
        ]

        const defensiveCredits: any[] = []

        const runnerActions = (simService as any).runnerActions
        const originalChance = runnerActions.getChanceRunnerSafe
        const originalThrow = runnerActions.gameRolls.getThrowResult

        runnerActions.getChanceRunnerSafe = () => 95
        runnerActions.gameRolls.getThrowResult = () => ({ roll: 100, result: ThrowResult.OUT })

        let inPlayRunnerEvents: any[] = []
        try {
            inPlayRunnerEvents = simService.getRunnerEvents(
                () => 0.5,
                runnerResult,
                halfInningRunnerEvents,
                defensiveCredits,
                laRatings,
                PlayResult.OUT,
                Contact.GROUNDBALL,
                ShallowDeep.NORMAL,
                hitter,
                infielder,
                undefined,
                undefined,
                runner3B,
                awayTeam,
                homeTeam,
                pitcher,
                2
            ) as any[]
        } finally {
            runnerActions.getChanceRunnerSafe = originalChance
            runnerActions.gameRolls.getThrowResult = originalThrow
        }

        const batterEvent = inPlayRunnerEvents.find(e => e?.runner?._id === hitter._id)
        assert.ok(batterEvent, "Expected a runner event for the hitter")

        assert.equal(batterEvent.movement?.start, BaseResult.HOME)
        assert.equal(batterEvent.movement?.end, BaseResult.FIRST)
        assert.equal(batterEvent.movement?.isOut, true)
        assert.equal(batterEvent.movement?.outBase, BaseResult.FIRST)

        if (infielder.currentPosition !== Position.FIRST_BASE) {
            assert.ok(batterEvent.throw, "Expected a throw to be recorded (fielder != 1B)")
            assert.equal(batterEvent.throw.to.position, Position.FIRST_BASE)
            assert.equal(batterEvent.throw.result, ThrowResult.OUT)
        } else {
            assert.equal(batterEvent.throw, undefined, "Unassisted putout at 1B should not record a throw object")
        }

        const outs =
            halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
            inPlayRunnerEvents.filter(e => e?.movement?.isOut).length
        assert.equal(outs, 3)

        const scored = inPlayRunnerEvents.some(e => e?.movement?.end === BaseResult.HOME && e?.movement?.isOut === false)
        assert.equal(scored, false)
    })
})

function buildStartedGame(seedIdAway = 1, seedIdHome = 100): Game {
    const laRatings = simService.buildLeagueAverages(100)

    const awayPlayers: Player[] = buildTestTeam(seedIdAway)
    const homePlayers: Player[] = buildTestTeam(seedIdHome)

    const awayTeam: Team = {
        _id: "away-team",
        name: "Away",
        abbrev: "AWAY",
        colors: {
            color1: "#ff0000",
            color2: "#ffffff"
        }
    } as Team

    const homeTeam: Team = {
        _id: "home-team",
        name: "Home",
        abbrev: "HOME",
        colors: {
            color1: "#0000ff",
            color2: "#ffffff"
        }
    } as Team

    const awayLineup: Lineup = buildTestLineup(awayPlayers)
    const homeLineup: Lineup = buildTestLineup(homePlayers)

    const awayStartingPitcher: RotationPitcher = {
        _id: awayPlayers.find(p => p.primaryPosition == Position.PITCHER)!._id,
        stamina: 1
    } as RotationPitcher

    const homeStartingPitcher: RotationPitcher = {
        _id: homePlayers.find(p => p.primaryPosition == Position.PITCHER)!._id,
        stamina: 1
    } as RotationPitcher

    const game: Game = {
        _id: "game-runner-events",
    } as Game

    simService.initGame(game)

    const command: StartGameCommand = {
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

        leagueAverages: laRatings,
        date: new Date()
    }

    return simService.startGame(command)
}

function buildTestTeam(startingId: number): Player[] {
    return [
        createPlayer(startingId + 0, Position.PITCHER),
        createPlayer(startingId + 1, Position.CATCHER),
        createPlayer(startingId + 2, Position.FIRST_BASE),
        createPlayer(startingId + 3, Position.SECOND_BASE),
        createPlayer(startingId + 4, Position.THIRD_BASE),
        createPlayer(startingId + 5, Position.SHORTSTOP),
        createPlayer(startingId + 6, Position.LEFT_FIELD),
        createPlayer(startingId + 7, Position.CENTER_FIELD),
        createPlayer(startingId + 8, Position.RIGHT_FIELD),
    ]
}

function buildTestLineup(players: Player[]): Lineup {
    const pitcher = players.find(p => p.primaryPosition === Position.PITCHER)!

    pitcher.pitchRatings.pitches = [PitchType.FF, PitchType.CU]

    const catcher = players.find(p => p.primaryPosition === Position.CATCHER)!
    const firstBase = players.find(p => p.primaryPosition === Position.FIRST_BASE)!
    const secondBase = players.find(p => p.primaryPosition === Position.SECOND_BASE)!
    const thirdBase = players.find(p => p.primaryPosition === Position.THIRD_BASE)!
    const shortstop = players.find(p => p.primaryPosition === Position.SHORTSTOP)!
    const leftField = players.find(p => p.primaryPosition === Position.LEFT_FIELD)!
    const centerField = players.find(p => p.primaryPosition === Position.CENTER_FIELD)!
    const rightField = players.find(p => p.primaryPosition === Position.RIGHT_FIELD)!

    return {
        order: [
            { _id: catcher._id, position: Position.CATCHER },
            { _id: firstBase._id, position: Position.FIRST_BASE },
            { _id: secondBase._id, position: Position.SECOND_BASE },
            { _id: thirdBase._id, position: Position.THIRD_BASE },
            { _id: shortstop._id, position: Position.SHORTSTOP },
            { _id: leftField._id, position: Position.LEFT_FIELD },
            { _id: centerField._id, position: Position.CENTER_FIELD },
            { _id: rightField._id, position: Position.RIGHT_FIELD },
            { _id: pitcher._id, position: Position.PITCHER },
        ],
        rotation: [
            { _id: pitcher._id, stamina: 1 },
            { _id: pitcher._id, stamina: 1 },
            { _id: pitcher._id, stamina: 1 },
            { _id: pitcher._id, stamina: 1 },
            { _id: pitcher._id, stamina: 1 },
        ]
    } as Lineup
}

function createPlayer(id: number, position: Position): Player {
    return {
        _id: id.toString(),

        firstName: "Player",
        lastName: `${id}`,

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
            contactProfile: {
                groundball: 44,
                flyBall: 35,
                lineDrive: 21
            },
            power: 100,
            vsL: {
                control: 100,
                movement: 100
            },
            vsR: {
                control: 100,
                movement: 100
            }
        },

        hittingRatings: {
            contactProfile: {
                groundball: 44,
                flyBall: 35,
                lineDrive: 21
            },
            speed: 100,
            steals: 100,
            arm: 100,
            defense: 100,
            vsL: {
                contact: 100,
                gapPower: 100,
                homerunPower: 100,
                plateDiscipline: 100
            },
            vsR: {
                contact: 100,
                gapPower: 100,
                homerunPower: 100,
                plateDiscipline: 100
            }
        },

        potentialOverallRating: 100,
        potentialPitchRatings: {
            power: 100,
            vsL: {
                control: 100,
                movement: 100
            },
            vsR: {
                control: 100,
                movement: 100
            }
        },
        potentialHittingRatings: {
            speed: 100,
            steals: 100,
            arm: 100,
            defense: 100,
            vsL: {
                contact: 100,
                gapPower: 100,
                homerunPower: 100,
                plateDiscipline: 100
            },
            vsR: {
                contact: 100,
                gapPower: 100,
                homerunPower: 100,
                plateDiscipline: 100
            }
        },

        age: 25
    }
}
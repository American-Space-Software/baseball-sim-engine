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
    simService,
    StatService
} from "../src/index.js"
import seedrandom from "seedrandom"
import type {
    Game,
    StartGameCommand,
    Player,
    Team,
    Lineup,
    RotationPitcher,
    HitResultCount,
    PitchResultCount,
    PitchEnvironmentTarget
} from "../src/index.js"

let rng = new seedrandom(4)
const statService = new StatService()

describe("SimService", async () => {

    it("should sim a game", async () => {

        const target = getPitchEnvironmentTargetForSeason(2025)
        const laRatings = simService.pitchEnvironmentTargetToLeagueAverage(target)

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

        const game: Game = { _id: "game-1" } as Game

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
    })

    it("should print aggregate stats over 250 games", async () => {

        const NUM_GAMES = 250
        const target = getPitchEnvironmentTargetForSeason(2025)

        let totalHit: HitResultCount = {} as any
        let totalPitch: PitchResultCount = {} as any

        const normalize = (v: number) => v / 100

        for (let i = 0; i < NUM_GAMES; i++) {

            const game = buildStartedGame()

            while (!game.isComplete) {
                simService.simPitch(game, rng)
            }

            simService.finishGame(game)

            const players = [
                ...game.away.players,
                ...game.home.players
            ]

            for (const p of players) {
                if (p.hitResult) {
                    totalHit = mergeHitResults(totalHit, p.hitResult)
                }

                if (p.pitchResult) {
                    totalPitch = mergePitchResults(totalPitch, p.pitchResult)
                }
            }
        }

        const hitterStatLine = statService.hitResultToHitterStatLine(totalHit)
        const pitcherStatLine = statService.pitchResultToPitcherStatLine(totalPitch)

        console.log("=== HITTER STATLINE ===")
        console.log(JSON.stringify(hitterStatLine, null, 2))

        console.log("=== PITCHER STATLINE ===")
        console.log(JSON.stringify(pitcherStatLine, null, 2))

        const totalTeamGames = hitterStatLine.games / 9

        const teamRunsPerGame = hitterStatLine.runs / totalTeamGames
        const teamHitsPerGame = hitterStatLine.hits / totalTeamGames
        const teamHomeRunsPerGame = hitterStatLine.homeRuns / totalTeamGames
        const teamBBPerGame = hitterStatLine.bb / totalTeamGames
        const teamSOPerGame = hitterStatLine.so / totalTeamGames

        console.log("=== TARGET PITCH ===")
        console.log({
            inZonePercent: target.pitch.inZonePercent,
            strikePercent: target.pitch.strikePercent,
            ballPercent: target.pitch.ballPercent,
            swingPercent: target.pitch.swingPercent,
            foulContactPercent: target.pitch.foulContactPercent,
            pitchesPerPA: target.pitch.pitchesPerPA
        })

        console.log("=== TARGET SWING ===")
        console.log({
            swingAtStrikesPercent: target.swing.swingAtStrikesPercent,
            swingAtBallsPercent: target.swing.swingAtBallsPercent,
            inZoneContactPercent: target.swing.inZoneContactPercent,
            outZoneContactPercent: target.swing.outZoneContactPercent
        })


        console.log("=== ACTUAL PITCH ===")
        console.log({
            inZonePercent: hitterStatLine.inZonePercent,
            strikePercent: hitterStatLine.strikePercent,
            ballPercent: hitterStatLine.ballPercent,
            swingPercent: hitterStatLine.swingPercent,
            foulContactPercent: pitcherStatLine.foulContactPercent,
            pitchesPerPA: hitterStatLine.pitchesPerPA
        })


        console.log("=== ACTUAL SWING ===")
        console.log({
            calledStrikesPercent: hitterStatLine.calledStrikesPercent,
            swingingStrikesPercent: hitterStatLine.swingingStrikesPercent,

            swingAtStrikesPercent: hitterStatLine.swingAtStrikesPercent,
            swingAtBallsPercent: hitterStatLine.swingAtBallsPercent,
            inZoneContactPercent: hitterStatLine.inZoneContactPercent,
            outZoneContactPercent: hitterStatLine.outZoneContactPercent
        })


        console.log("=== PITCH DIFF ===")
        console.log({
            inZonePercentDiff: hitterStatLine.inZonePercent - normalize(target.pitch.inZonePercent),
            strikePercentDiff: hitterStatLine.strikePercent - normalize(target.pitch.strikePercent),
            ballPercentDiff: hitterStatLine.ballPercent - normalize(target.pitch.ballPercent),
            swingPercentDiff: hitterStatLine.swingPercent - normalize(target.pitch.swingPercent),
            foulContactPercentDiff: pitcherStatLine.foulContactPercent - normalize(target.pitch.foulContactPercent),
            pitchesPerPADiff: hitterStatLine.pitchesPerPA - target.pitch.pitchesPerPA,
            swingAtStrikesPercentDiff: hitterStatLine.swingAtStrikesPercent - normalize(target.swing.swingAtStrikesPercent),
            swingAtBallsPercentDiff: hitterStatLine.swingAtBallsPercent - normalize(target.swing.swingAtBallsPercent),
            inZoneContactPercentDiff: hitterStatLine.inZoneContactPercent - normalize(target.swing.inZoneContactPercent),
            outZoneContactPercentDiff: hitterStatLine.outZoneContactPercent - normalize(target.swing.outZoneContactPercent)
        })

        console.log("=== TARGET TEAM ===")
        console.log(target.team)

        console.log("=== TEAM PER GAME ===")
        console.log({
            teamRunsPerGame,
            teamHitsPerGame,
            teamHomeRunsPerGame,
            teamBBPerGame,
            teamSOPerGame
        })

        assert.equal(hitterStatLine.hits, pitcherStatLine.hits)
        assert.equal(hitterStatLine.runs, pitcherStatLine.runs)
        assert.equal(hitterStatLine.homeRuns, pitcherStatLine.homeRuns)
        assert.equal(hitterStatLine.bb, pitcherStatLine.bb)
        assert.equal(hitterStatLine.so, pitcherStatLine.so)
        assert.equal(hitterStatLine.hbp, pitcherStatLine.hbp)
        assert.equal(hitterStatLine.atBats, pitcherStatLine.atBats)
        assert.equal(hitterStatLine.pa, pitcherStatLine.battersFaced)

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

        assert.ok(infielder)

        const hitter = awayTeam.players.find(p => awayTeam.lineupIds?.includes(p._id)) ?? awayTeam.players[0]
        const runner3B = awayTeam.players.find(p => p._id !== hitter._id)!

        const runnerResult: any = {
            first: undefined,
            second: undefined,
            third: runner3B._id,
            out: [],
            scored: [],
        }

        const halfInningRunnerEvents: any[] = [
            { runner: { _id: "out1" }, movement: { isOut: true } },
            { runner: { _id: "out2" }, movement: { isOut: true } },
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
        assert.ok(batterEvent)

        assert.equal(batterEvent.movement?.isOut, true)

        const outs =
            halfInningRunnerEvents.filter(e => e?.movement?.isOut).length +
            inPlayRunnerEvents.filter(e => e?.movement?.isOut).length

        assert.equal(outs, 3)

        const scored = inPlayRunnerEvents.some(e => e?.movement?.end === BaseResult.HOME && !e?.movement?.isOut)
        assert.equal(scored, false)
    })
})

function buildStartedGame(seedIdAway = 1, seedIdHome = 100): Game {

    const target = getPitchEnvironmentTargetForSeason(2025)
    const laRatings = simService.pitchEnvironmentTargetToLeagueAverage(target)

    const awayPlayers: Player[] = buildTestTeam(seedIdAway)
    const homePlayers: Player[] = buildTestTeam(seedIdHome)

    const awayTeam: Team = {
        _id: "away-team",
        name: "Away",
        abbrev: "AWAY",
        colors: { color1: "#ff0000", color2: "#ffffff" }
    } as Team

    const homeTeam: Team = {
        _id: "home-team",
        name: "Home",
        abbrev: "HOME",
        colors: { color1: "#0000ff", color2: "#ffffff" }
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

    const game: Game = { _id: "game-runner-events" } as Game

    simService.initGame(game)

    return simService.startGame({
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
    })
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
    pitcher.pitchRatings.pitches = [PitchType.FF, PitchType.CU, PitchType.SL, PitchType.FO]

    return {
        order: players.map(p => ({ _id: p._id, position: p.primaryPosition })),
        rotation: new Array(5).fill(0).map(() => ({ _id: pitcher._id, stamina: 1 }))
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
            contactProfile: { groundball: 44, flyBall: 35, lineDrive: 21 },
            power: 100,
            vsL: { control: 100, movement: 100 },
            vsR: { control: 100, movement: 100 }
        },
        hittingRatings: {
            contactProfile: { groundball: 44, flyBall: 35, lineDrive: 21 },
            speed: 100,
            steals: 100,
            arm: 100,
            defense: 100,
            vsL: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 },
            vsR: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 }
        },
        potentialOverallRating: 100,
        potentialPitchRatings: { power: 100, vsL: { control: 100, movement: 100 }, vsR: { control: 100, movement: 100 } },
        potentialHittingRatings: {
            speed: 100,
            steals: 100,
            arm: 100,
            defense: 100,
            vsL: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 },
            vsR: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 }
        },
        age: 25
    }
}

function mergeHitResults(total: any, current: any): any {
    total = total || {}

    for (const key of Object.keys(current)) {
        if (typeof current[key] === "number") {
            total[key] = (total[key] || 0) + current[key]
        }
    }

    return total
}

function mergePitchResults(total: any, current: any): any {
    total = total || {}

    for (const key of Object.keys(current)) {
        if (typeof current[key] === "number") {
            total[key] = (total[key] || 0) + current[key]
        }
    }

    return total
}

const PITCH_ENVIRONMENT_TARGETS: Record<number, PitchEnvironmentTarget> = {
    2025: {
        season: 2025,
        pitch: {
            inZonePercent: 50.5,
            strikePercent: 65,
            ballPercent: 33.5,
            swingPercent: 47.7,
            foulContactPercent: 50.7,
            pitchesPerPA: 3.88,
            inZoneByCount: [
                { balls: 0, strikes: 0, inZone: 55 },
                { balls: 0, strikes: 1, inZone: 46 },
                { balls: 0, strikes: 2, inZone: 32 },
                { balls: 1, strikes: 0, inZone: 56 },
                { balls: 1, strikes: 1, inZone: 51},
                { balls: 1, strikes: 2, inZone: 38 },
                { balls: 2, strikes: 0, inZone: 60 },
                { balls: 2, strikes: 1, inZone: 58 },
                { balls: 2, strikes: 2, inZone: 48 },
                { balls: 3, strikes: 0, inZone: 63 },
                { balls: 3, strikes: 1, inZone: 63 },
                { balls: 3, strikes: 2, inZone: 60 }
            ]
        },
        swing: {
            swingAtStrikesPercent: 66.8,
            swingAtBallsPercent: 28.1,
            inZoneContactPercent: 82.7,
            outZoneContactPercent: 55.3,
            ballSwingByCount: [
                { balls: 0, strikes: 0, swing: 16 },
                { balls: 0, strikes: 1, swing: 28 },
                { balls: 0, strikes: 2, swing: 32 },
                { balls: 1, strikes: 0, swing: 21 },
                { balls: 1, strikes: 1, swing: 31 },
                { balls: 1, strikes: 2, swing: 37 },
                { balls: 2, strikes: 0, swing: 19 },
                { balls: 2, strikes: 1, swing: 31 },
                { balls: 2, strikes: 2, swing: 42 },
                { balls: 3, strikes: 0, swing: 3 },
                { balls: 3, strikes: 1, swing: 25 },
                { balls: 3, strikes: 2, swing: 43 }
            ] ,
            strikeSwingByCount: [
                { balls: 0, strikes: 0, swing: 45 },
                { balls: 0, strikes: 1, swing: 73 },
                { balls: 0, strikes: 2, swing: 86 },
                { balls: 1, strikes: 0, swing: 59},
                { balls: 1, strikes: 1, swing: 77 },
                { balls: 1, strikes: 2, swing: 88 },
                { balls: 2, strikes: 0, swing: 55 },
                { balls: 2, strikes: 1, swing: 77 },
                { balls: 2, strikes: 2, swing: 88 },
                { balls: 3, strikes: 0, swing: 11 },
                { balls: 3, strikes: 1, swing: 70},
                { balls: 3, strikes: 2, swing: 88 }
            ]
        },
        battedBall: {
            inPlayPercent: 17.5,

            contactRollInput: {
                groundball: 43,
                flyBall: 35,
                lineDrive: 22,
            },

            powerRollInput: {
                out: 675,
                singles: 215,
                doubles: 62,
                triples: 4,
                hr: 44
            }

        },
        outcome: {
            avg: 0.245,
            obp: 0.315,
            slg: 0.404,
            ops: 0.719,
            babip: 0.291,
            homeRunPercent: 0.03,
            doublePercent: 0.042,
            triplePercent: 0.003,
            bbPercent: 0.084,
            soPercent: 0.222,
            hbpPercent: 0.01
        },
        team: {
            runsPerGame: 4.45,
            hitsPerGame: 8.25,
            homeRunsPerGame: 1.16,
            bbPerGame: 3.16,
            soPerGame: 8.36
        }
    }
}


function getPitchEnvironmentTargetForSeason(season: number): PitchEnvironmentTarget {
    const target = PITCH_ENVIRONMENT_TARGETS[season]

    if (!target) {
        throw new Error(`No PitchEnvironmentTarget found for season ${season}`)
    }

    return target
}
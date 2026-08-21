import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    Position
} from "../src/sim/service/enums.js"

import type {
    GamePlayer,
    GameSubstitution
} from "../src/sim/service/interfaces.js"

import {
    BoxscoreService
} from "../src/presentation/services/boxscore-service.js"

import type {
    GameBoxscoreViewModel
} from "../src/presentation/services/game-web-service.js"


describe("BoxscoreService", function () {

    it("builds batter rows in lineup appearance order", function () {
        const service = new BoxscoreService()
        const player1 = buildPlayer("1", Position.CENTER_FIELD)
        const player2 = buildPlayer("2", Position.SHORTSTOP)
        const player3 = buildPlayer("3", Position.FIRST_BASE)
        const viewModel = buildViewModel([player1, player2, player3], ["1", "2", "3"])

        const result = service.getBoxscoreInfo([], viewModel)

        assert.deepEqual(result.batters.map(row => row.player._id), ["1", "2", "3"])
    })

    it("reconstructs original lineup order when a batter has been substituted", function () {
        const service = new BoxscoreService()
        const starter = buildPlayer("starter", Position.CENTER_FIELD, { atBats: 2 })
        const replacement = buildPlayer("replacement", Position.CENTER_FIELD, { atBats: 1 })
        const other = buildPlayer("other", Position.SHORTSTOP)
        const viewModel = buildViewModel([starter, replacement, other], ["replacement", "other"])

        const substitutions: GameSubstitution[] = [
            buildSubstitution({
                teamId: "team",
                playIndex: 15,
                lineupIndex: 0,
                outPlayerId: "starter",
                inPlayerId: "replacement"
            })
        ]

        const result = service.getBoxscoreInfo(substitutions, viewModel)

        assert.deepEqual(result.batters.map(row => row.player._id), ["starter", "replacement", "other"])
    })

    it("assigns substitution numbers in substitution order", function () {
        const service = new BoxscoreService()

        const substitutions: GameSubstitution[] = [
            buildSubstitution({
                playIndex: 10,
                inPlayerId: "2"
            }),
            buildSubstitution({
                playIndex: 20,
                inPlayerId: "3"
            }),
            buildSubstitution({
                playIndex: 30,
                inPlayerId: "2"
            })
        ]

        const result = service.getSubNumberByPlayerId(substitutions)

        assert.equal(result.get("2"), 1)
        assert.equal(result.get("3"), 2)
        assert.equal(result.size, 2)
    })

    it("includes substituted batters that have batting lines", function () {
        const service = new BoxscoreService()
        const starter = buildPlayer("starter", Position.CENTER_FIELD, { atBats: 2 })
        const replacement = buildPlayer("replacement", Position.CENTER_FIELD, { atBats: 1 })
        const viewModel = buildViewModel([starter, replacement], ["replacement"])

        const result = service.getBoxscoreInfo(
            [
                buildSubstitution({
                    teamId: "team",
                    playIndex: 10,
                    lineupIndex: 0,
                    outPlayerId: "starter",
                    inPlayerId: "replacement"
                })
            ],
            viewModel
        )

        assert.deepEqual(
            result.batters.map(row => ({
                playerId: row.player._id,
                subNumber: row.subNumber
            })),
            [
                {
                    playerId: "starter",
                    subNumber: undefined
                },
                {
                    playerId: "replacement",
                    subNumber: 1
                }
            ]
        )
    })

    it("does not duplicate a batter already added from a seed id", function () {
        const service = new BoxscoreService()
        const player = buildPlayer("1", Position.CENTER_FIELD, { atBats: 3 })

        const result = service.getRowsFromSubstitutions(["1"], [player], new Map(), () => true)

        assert.equal(result.length, 1)
        assert.equal(result[0].player, player)
    })

    it("includes a player with any batting activity", function () {
        const service = new BoxscoreService()

        assert.equal(service.hasBattingLine(buildPlayer("1", Position.CENTER_FIELD, { bb: 1 })), true)
        assert.equal(service.hasBattingLine(buildPlayer("2", Position.CENTER_FIELD)), false)
    })

    it("includes a player with any pitching activity", function () {
        const service = new BoxscoreService()

        assert.equal(service.hasPitchingLine(buildPlayer("1", Position.PITCHER, {}, { pitches: 1 })), true)
        assert.equal(service.hasPitchingLine(buildPlayer("2", Position.PITCHER)), false)
    })

    it("orders pitchers by their pitching substitutions", function () {
        const service = new BoxscoreService()
        const starter = buildPlayer("starter", Position.PITCHER, {}, { pitches: 80 })
        const reliever1 = buildPlayer("reliever-1", Position.PITCHER, {}, { pitches: 20 })
        const reliever2 = buildPlayer("reliever-2", Position.PITCHER, {}, { pitches: 15 })
        const viewModel = buildViewModel([starter, reliever1, reliever2], [], "reliever-2")

        const result = service.getBoxscoreInfo(
            [
                buildSubstitution({
                    teamId: "team",
                    playIndex: 50,
                    isPitchingChange: true,
                    outPlayerId: "starter",
                    inPlayerId: "reliever-1"
                }),
                buildSubstitution({
                    teamId: "team",
                    playIndex: 80,
                    isPitchingChange: true,
                    outPlayerId: "reliever-1",
                    inPlayerId: "reliever-2"
                })
            ],
            viewModel
        )

        assert.deepEqual(result.pitchers.map(row => row.player._id), ["starter", "reliever-1", "reliever-2"])
    })

    it("uses the first pitching substitution out player as the starting pitcher", function () {
        const service = new BoxscoreService()

        const result = service.getPitcherAppearanceIds(
            [
                buildSubstitution({
                    playIndex: 30,
                    isPitchingChange: true,
                    outPlayerId: "starter",
                    inPlayerId: "reliever-1"
                }),
                buildSubstitution({
                    playIndex: 60,
                    isPitchingChange: true,
                    outPlayerId: "reliever-1",
                    inPlayerId: "reliever-2"
                })
            ]
        )

        assert.deepEqual(result, ["starter", "reliever-1", "reliever-2"])
    })

    it("does not duplicate pitcher ids across multiple pitching changes", function () {
        const service = new BoxscoreService()

        const result = service.getPitcherAppearanceIds(
            [
                buildSubstitution({
                    playIndex: 10,
                    isPitchingChange: true,
                    outPlayerId: "starter",
                    inPlayerId: "reliever"
                }),
                buildSubstitution({
                    playIndex: 20,
                    isPitchingChange: true,
                    outPlayerId: "reliever",
                    inPlayerId: "starter"
                })
            ]
        )

        assert.deepEqual(result, ["starter", "reliever"])
    })

    it("reconstructs batter appearance ids across multiple substitutions in one lineup slot", function () {
        const service = new BoxscoreService()

        const result = service.getBatterAppearanceIds(
            ["third", "2"],
            [
                buildSubstitution({
                    playIndex: 10,
                    lineupIndex: 0,
                    outPlayerId: "first",
                    inPlayerId: "second"
                }),
                buildSubstitution({
                    playIndex: 20,
                    lineupIndex: 0,
                    outPlayerId: "second",
                    inPlayerId: "third"
                })
            ]
        )

        assert.deepEqual(result, ["first", "second", "third", "2"])
    })

    it("ignores substitutions from the other team", function () {
        const service = new BoxscoreService()
        const starter = buildPlayer("starter", Position.CENTER_FIELD)
        const replacement = buildPlayer("replacement", Position.CENTER_FIELD, { atBats: 1 })
        const viewModel = buildViewModel([starter, replacement], ["starter"])

        const result = service.getBoxscoreInfo(
            [
                buildSubstitution({
                    teamId: "other-team",
                    playIndex: 10,
                    lineupIndex: 0,
                    outPlayerId: "starter",
                    inPlayerId: "replacement"
                })
            ],
            viewModel
        )

        assert.deepEqual(result.batters.map(row => row.player._id), ["starter", "replacement"])
        assert.equal(result.batters.find(row => row.player._id === "replacement")?.subNumber, undefined)
    })

    it("builds extra-base hit total-base and RBI summaries", function () {
        const service = new BoxscoreService()

        const first = buildPlayer("1", Position.CENTER_FIELD, {
            hits: 3,
            doubles: 2,
            homeRuns: 1,
            rbi: 3
        })

        const second = buildPlayer("2", Position.SHORTSTOP, {
            hits: 1,
            triples: 1,
            rbi: 1
        })

        const result = service.getBoxscoreInfo([], buildViewModel([first, second], ["1", "2"]))

        assert.deepEqual(
            result.doubles,
            [
                {
                    playerId: "1",
                    name: first.fullName,
                    value: 2
                }
            ]
        )

        assert.deepEqual(
            result.triples,
            [
                {
                    playerId: "2",
                    name: second.fullName,
                    value: 1
                }
            ]
        )

        assert.deepEqual(
            result.homeRuns,
            [
                {
                    playerId: "1",
                    name: first.fullName,
                    value: 1
                }
            ]
        )

        assert.deepEqual(
            result.totalBases,
            [
                {
                    playerId: "1",
                    name: first.fullName,
                    value: 8
                },
                {
                    playerId: "2",
                    name: second.fullName,
                    value: 3
                }
            ]
        )

        assert.deepEqual(
            result.rbi,
            [
                {
                    playerId: "1",
                    name: first.fullName,
                    value: 3
                },
                {
                    playerId: "2",
                    name: second.fullName,
                    value: 1
                }
            ]
        )
    })

    it("calculates total bases including singles", function () {
        const service = new BoxscoreService()

        const player = buildPlayer("1", Position.CENTER_FIELD, {
            hits: 4,
            doubles: 1,
            triples: 1,
            homeRuns: 1
        })

        const result = service.getBoxscoreInfo([], buildViewModel([player], ["1"]))

        assert.deepEqual(
            result.totalBases,
            [
                {
                    playerId: "1",
                    name: player.fullName,
                    value: 10
                }
            ]
        )
    })

    it("returns the current pitcher even before a pitching line exists", function () {
        const service = new BoxscoreService()
        const pitcher = buildPlayer("pitcher", Position.PITCHER)
        const result = service.getBoxscoreInfo([], buildViewModel([pitcher], [], pitcher._id))

        assert.deepEqual(result.pitchers.map(row => row.player._id), ["pitcher"])
    })

    it("returns the requested player", function () {
        const service = new BoxscoreService()
        const first = buildPlayer("1", Position.CENTER_FIELD)
        const second = buildPlayer("2", Position.SHORTSTOP)

        assert.equal(service.getPlayer([first, second], "2"), second)
        assert.equal(service.getPlayer([first, second], "3"), undefined)
    })

})


function buildViewModel(players: GamePlayer[], lineupIds: string[], currentPitcherId?: string): GameBoxscoreViewModel {
    return {
        side: "AWAY",
        team: {
            _id: "team",
            name: "Test Team",
            abbrev: "TST",
            players,
            lineupIds,
            currentHitterIndex: 0,
            currentPitcherId
        } as GameBoxscoreViewModel["team"],
        isComplete: false,
        isTopInning: true
    }
}


function buildPlayer(playerId: string, position: Position, hitting: {
    atBats?: number
    runs?: number
    hits?: number
    doubles?: number
    triples?: number
    homeRuns?: number
    rbi?: number
    bb?: number
    hbp?: number
    so?: number
} = {}, pitching: {
    battersFaced?: number
    pitches?: number
    strikes?: number
    hits?: number
    runs?: number
    er?: number
    homeRuns?: number
    bb?: number
    so?: number
    hbp?: number
} = {}): GamePlayer {
    return {
        _id: playerId,
        fullName: `Player ${playerId}`,
        currentPosition: position,
        hitResult: {
            atBats: hitting.atBats ?? 0,
            runs: hitting.runs ?? 0,
            hits: hitting.hits ?? 0,
            doubles: hitting.doubles ?? 0,
            triples: hitting.triples ?? 0,
            homeRuns: hitting.homeRuns ?? 0,
            rbi: hitting.rbi ?? 0,
            bb: hitting.bb ?? 0,
            hbp: hitting.hbp ?? 0,
            so: hitting.so ?? 0
        },
        pitchResult: {
            battersFaced: pitching.battersFaced ?? 0,
            pitches: pitching.pitches ?? 0,
            strikes: pitching.strikes ?? 0,
            hits: pitching.hits ?? 0,
            runs: pitching.runs ?? 0,
            er: pitching.er ?? 0,
            homeRuns: pitching.homeRuns ?? 0,
            bb: pitching.bb ?? 0,
            so: pitching.so ?? 0,
            hbp: pitching.hbp ?? 0
        }
    } as unknown as GamePlayer
}


function buildSubstitution(values: Partial<GameSubstitution>): GameSubstitution {
    return {
        teamId: "team",
        playIndex: 0,
        isPitchingChange: false,
        ...values
    } as GameSubstitution
}
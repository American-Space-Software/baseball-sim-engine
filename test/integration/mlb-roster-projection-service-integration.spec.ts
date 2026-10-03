
import { strict as assert } from "assert"

import {
    describe,
    it
} from "mocha"

import {
    Position
} from "../../src/sim/service/enums.js"

import {
    mlbGameBundleService
} from "../../src/ratings/index.js"


const GAME_DATE = "2026-10-03"
const GAME_PK = 849829


describe("MlbGameBundleService integration", function () {

    it("builds a valid White Sox at Guardians game", async function () {
        const dailyBundle = await mlbGameBundleService.build(GAME_DATE)

        const game = dailyBundle.games.find(game =>
            game.gamePk === GAME_PK
        )

        assert.ok(game, `Game ${GAME_PK} was not found.`)

        assert.equal(game.away.team.abbrev, "CWS")
        assert.equal(game.home.team.abbrev, "CLE")

        for (const team of [game.away, game.home]) {
            const label = team.team.abbrev
            const players = team.players
            const rosterIds = new Set(players.map(player => player._id))
            const pitchers = players.filter(player =>
                player.primaryPosition === Position.PITCHER
            )

            assert.equal(
                players.length,
                26,
                `${label} has ${players.length} players instead of 26.`
            )

            assert.equal(
                rosterIds.size,
                players.length,
                `${label} has duplicate roster entries.`
            )

            assert.ok(
                pitchers.length <= 13,
                `${label} has ${pitchers.length} pitchers instead of at most 13.`
            )

            assert.ok(
                players.filter(player => player.primaryPosition === Position.CATCHER).length >= 2,
                `${label} has fewer than two catchers.`
            )

            assert.equal(
                team.lineup.order.length,
                9,
                `${label} does not have a nine-player batting order.`
            )

            assert.equal(
                new Set(team.lineup.order.map(player => player._id)).size,
                9,
                `${label} has duplicate players in its batting order.`
            )

            for (const player of team.lineup.order) {
                assert.ok(
                    rosterIds.has(player._id),
                    `${label} lineup player ${player._id} is not on its roster.`
                )

                assert.ok(
                    player.position,
                    `${label} lineup player ${player._id} has no position.`
                )
            }

            assert.ok(
                rosterIds.has(team.startingPitcher._id),
                `${label} starting pitcher is not on its roster.`
            )

            assert.ok(
                pitchers.some(player => player._id === team.startingPitcher._id),
                `${label} starting pitcher is not classified as a pitcher.`
            )

            assert.ok(
                team.availablePitchers.length >= 5,
                `${label} has fewer than five bullpen pitchers.`
            )

            const bullpenIds = new Set<string>()

            for (const assignment of team.availablePitchers) {
                assert.ok(
                    rosterIds.has(assignment.playerId),
                    `${label} bullpen pitcher ${assignment.playerId} is not on its roster.`
                )

                assert.ok(
                    pitchers.some(player => player._id === assignment.playerId),
                    `${label} bullpen player ${assignment.playerId} is not classified as a pitcher.`
                )

                assert.notEqual(
                    assignment.playerId,
                    team.startingPitcher._id,
                    `${label} starting pitcher is also assigned to the bullpen.`
                )

                assert.ok(
                    !bullpenIds.has(assignment.playerId),
                    `${label} has duplicate bullpen assignments for ${assignment.playerId}.`
                )

                bullpenIds.add(assignment.playerId)
            }

            assert.ok(
                team.availablePitchers.length <= pitchers.length - 1,
                `${label} has more bullpen assignments than available pitchers.`
            )

            assert.equal(
                team.playerStats.length,
                players.length,
                `${label} has a different number of player stats and roster entries.`
            )

            console.log(
                `${label}: ${players.length} players, ${pitchers.length} pitchers, ` +
                `${team.lineup.order.length} hitters, ${team.availablePitchers.length} bullpen pitchers, ` +
                `lineup source: ${team.lineupSource}.`
            )
        }
    })

})

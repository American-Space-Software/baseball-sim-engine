import { strict as assert } from "assert"

import { before, describe, it } from "mocha"

import {
    downloadSeason
} from "baseball-database"

import { Position } from "baseball-sim-engine"

import { MlbRosterService } from "../src/ratings/service/mlb-roster-service.js"


const season = Number(
    process.env.MLB_GAME_PREDICTOR_TEST_SEASON ??
    2026
)

const gameDate =
    process.env.MLB_GAME_PREDICTOR_TEST_DATE ??
    `${season}-07-11`


class MlbRosterServiceTestHarness {

    public readonly service = new MlbRosterService()

    public async getPirates() {
        const teams = await this.service.getTeams(
            season
        )

        const pirates = teams.find(team =>
            team.id === 134
        )

        assert.ok(
            pirates
        )

        return pirates
    }

}


const harness = new MlbRosterServiceTestHarness()


describe("MlbRosterService", function () {

    this.timeout(
        120000
    )

    before(async function () {
        await downloadSeason(
            season
        )
    })

    it("loads real MLB teams from the stored schedule", async () => {
        const teams = await harness.service.getTeams(
            season
        )

        assert.equal(
            teams.length,
            30
        )

        const pirates = teams.find(team =>
            team.id === 134
        )

        assert.ok(
            pirates
        )

        assert.equal(
            pirates.name,
            "Pittsburgh Pirates"
        )

        assert.equal(
            pirates.id,
            134
        )
    })

    it("loads and maps the Pirates active roster for the selected date", async () => {
        const pirates = await harness.getPirates()

        await harness.service.syncRosters(
            gameDate
        )

        const roster = await harness.service.getRoster(
            gameDate,
            pirates
        )

        console.log(
            `Pirates active roster for ${gameDate}: ${roster.length}`
        )

        console.table(
            roster.map(player => ({
                playerId: player.playerId,
                fullName: player.fullName,
                position: player.position
            }))
        )

        assert.ok(
            roster.length >= 26,
            `Expected at least 26 roster players for ${gameDate}, found ${roster.length}.`
        )

        assert.ok(
            roster.some(player =>
                player.position === Position.PITCHER
            ),
            "Expected at least one pitcher."
        )

        assert.ok(
            roster.some(player =>
                player.position === Position.CATCHER
            ),
            "Expected at least one catcher."
        )

        assert.equal(
            new Set(
                roster.map(player =>
                    player.playerId
                )
            ).size,
            roster.length,
            "Roster contains duplicate player IDs."
        )

        for (const player of roster) {
            assert.ok(
                player.playerId.length > 0
            )

            assert.ok(
                player.fullName.length > 0
            )

            assert.ok(
                player.position
            )
        }
    })

})

import { strict as assert } from "assert"
import { describe, it } from "mocha"

import {
    Handedness,
    PitchingRoleType,
    Position
} from "../src/sim/service/enums.js"

import type {
    Player,
    Team
} from "../src/sim/service/interfaces.js"

import {
    FallbackGameLineupProvider
} from "../src/ratings/service/game-lineup-service.js"

import type {
    MlbTeam
} from "../src/ratings/service/mlb-roster-service.js"


describe("FallbackGameLineupProvider", function () {

    const mlbTeam: MlbTeam = {
        id: 139,
        name: "Tampa Bay Rays",
        abbrev: "TB"
    }

    const team: Team = {
        _id: "139",
        name: "Tampa Bay Rays",
        abbrev: "TB",
        colors: {
            color1: "#222222",
            color2: "#dddddd"
        }
    } as Team

    it("builds a normal fallback lineup using position fits", async function () {
        const result = await buildProvider().build(
            "2026-06-16",
            mlbTeam,
            team,
            buildNormalPlayers()
        )

        assert.ok(result)
        assert.equal(result.lineup.order.length, 9)
        assert.equal(new Set(result.lineup.order.map(spot => spot._id)).size, 9)

        assert.deepEqual(
            new Set(result.lineup.order.map(spot => spot.position)),
            new Set([
                Position.CATCHER,
                Position.FIRST_BASE,
                Position.SECOND_BASE,
                Position.THIRD_BASE,
                Position.SHORTSTOP,
                Position.LEFT_FIELD,
                Position.CENTER_FIELD,
                Position.RIGHT_FIELD,
                Position.DESIGNATED_HITTER
            ])
        )
    })

    it("uses unused position players out of position when historical roster data cannot fill defensive positions", async function () {
        const players = [
            buildPlayer("101", Position.CATCHER),
            buildPlayer("102", Position.FIRST_BASE),
            buildPlayer("103", Position.SECOND_BASE),
            buildPlayer("104", Position.THIRD_BASE),
            buildPlayer("105", Position.SHORTSTOP),
            buildPlayer("106", Position.DESIGNATED_HITTER),
            buildPlayer("107", Position.DESIGNATED_HITTER),
            buildPlayer("108", Position.DESIGNATED_HITTER),
            buildPlayer("109", Position.DESIGNATED_HITTER),
            buildPlayer("201", Position.PITCHER)
        ]

        const result = await buildProvider().build(
            "2026-06-16",
            mlbTeam,
            team,
            players
        )

        assert.ok(result)

        const order = result.lineup.order

        assert.equal(order.length, 9)
        assert.equal(new Set(order.map(spot => spot._id)).size, 9)
        assert.ok(order.some(spot => spot.position === Position.LEFT_FIELD))
        assert.ok(order.some(spot => spot.position === Position.CENTER_FIELD))
        assert.ok(order.some(spot => spot.position === Position.RIGHT_FIELD))
        assert.ok(order.some(spot => spot.position === Position.DESIGNATED_HITTER))
    })

    it("preserves constrained position players when choosing emergency out-of-position players", async function () {
        const players = [
            buildPlayer("101", Position.CATCHER),
            buildPlayer("102", Position.FIRST_BASE),
            buildPlayer("103", Position.SECOND_BASE),
            buildPlayer("104", Position.THIRD_BASE),
            buildPlayer("105", Position.SHORTSTOP),
            buildPlayer("106", Position.DESIGNATED_HITTER),
            buildPlayer("107", Position.DESIGNATED_HITTER),
            buildPlayer("108", Position.DESIGNATED_HITTER),
            buildPlayer("109", Position.DESIGNATED_HITTER),
            buildPlayer("201", Position.PITCHER)
        ]

        const result = await buildProvider().build(
            "2026-06-16",
            mlbTeam,
            team,
            players
        )

        assert.ok(result)

        const positionsByPlayerId = new Map(
            result.lineup.order.map(spot => [
                spot._id,
                spot.position
            ])
        )

        assert.equal(positionsByPlayerId.get("101"), Position.CATCHER)
        assert.equal(positionsByPlayerId.get("105"), Position.SHORTSTOP)

        assert.equal(
            ["106", "107", "108", "109"].filter(playerId =>
                positionsByPlayerId.get(playerId) === Position.LEFT_FIELD ||
                positionsByPlayerId.get(playerId) === Position.CENTER_FIELD ||
                positionsByPlayerId.get(playerId) === Position.RIGHT_FIELD
            ).length,
            3
        )
    })

    it("still throws when there are not enough non-pitchers to build a DH lineup", async function () {
        const players = [
            buildPlayer("101", Position.CATCHER),
            buildPlayer("102", Position.FIRST_BASE),
            buildPlayer("103", Position.SECOND_BASE),
            buildPlayer("104", Position.THIRD_BASE),
            buildPlayer("105", Position.SHORTSTOP),
            buildPlayer("106", Position.DESIGNATED_HITTER),
            buildPlayer("107", Position.DESIGNATED_HITTER),
            buildPlayer("108", Position.DESIGNATED_HITTER),
            buildPlayer("201", Position.PITCHER)
        ]

        await assert.rejects(
            buildProvider().build(
                "2026-06-16",
                mlbTeam,
                team,
                players
            ),
            /Unable to fill position|Unable to find a designated hitter/
        )
    })

    it("uses a DH in a pre-2020 AL park", async function () {
        const result = await buildProvider(
            buildFeed("home", 103)
        ).build(
            "2010-06-16",
            mlbTeam,
            team,
            buildNormalPlayers(),
            1
        )

        assert.ok(result)
        assert.ok(result.lineup.order.some(spot => spot.position === Position.DESIGNATED_HITTER))
        assert.ok(!result.lineup.order.some(spot => spot.position === Position.PITCHER))
    })

    it("has the starting pitcher bat in a pre-2020 NL park", async function () {
        const result = await buildProvider(
            buildFeed("away", 104)
        ).build(
            "2010-06-16",
            mlbTeam,
            team,
            buildNormalPlayers(),
            1
        )

        assert.ok(result)

        const pitcherSpot = result.lineup.order.find(spot =>
            spot.position === Position.PITCHER
        )

        assert.ok(pitcherSpot)
        assert.equal(pitcherSpot._id, "201")
        assert.ok(!result.lineup.order.some(spot => spot.position === Position.DESIGNATED_HITTER))
    })

    it("uses the universal DH in 2020", async function () {
        const result = await buildProvider().build(
            "2020-08-16",
            mlbTeam,
            team,
            buildNormalPlayers()
        )

        assert.ok(result)
        assert.ok(result.lineup.order.some(spot => spot.position === Position.DESIGNATED_HITTER))
        assert.ok(!result.lineup.order.some(spot => spot.position === Position.PITCHER))
    })

    it("returns to home-league DH rules in 2021", async function () {
        const alResult = await buildProvider(
            buildFeed("home", 103)
        ).build(
            "2021-06-16",
            mlbTeam,
            team,
            buildNormalPlayers(),
            1
        )

        const nlResult = await buildProvider(
            buildFeed("away", 104)
        ).build(
            "2021-06-16",
            mlbTeam,
            team,
            buildNormalPlayers(),
            1
        )

        assert.ok(alResult)
        assert.ok(nlResult)
        assert.ok(alResult.lineup.order.some(spot => spot.position === Position.DESIGNATED_HITTER))
        assert.ok(nlResult.lineup.order.some(spot => spot.position === Position.PITCHER))
    })

    it("uses the universal DH from 2022 onward", async function () {
        const result = await buildProvider().build(
            "2022-06-16",
            mlbTeam,
            team,
            buildNormalPlayers()
        )

        assert.ok(result)
        assert.ok(result.lineup.order.some(spot => spot.position === Position.DESIGNATED_HITTER))
        assert.ok(!result.lineup.order.some(spot => spot.position === Position.PITCHER))
    })

})


class TestFallbackGameLineupProvider extends FallbackGameLineupProvider {

    public constructor(
        bullpenResolver: ConstructorParameters<typeof FallbackGameLineupProvider>[0],
        private readonly feed?: any
    ) {
        super(bullpenResolver)
    }

    protected getGameFeed(_gamePk: number | string): any | undefined {
        return this.feed
    }

}


function buildProvider(feed?: any): FallbackGameLineupProvider {
    return new TestFallbackGameLineupProvider(
        async (_gameDate, _mlbTeam, players, startingPitcherId) =>
            players
                .filter(player =>
                    player.primaryPosition === Position.PITCHER &&
                    player._id !== startingPitcherId
                )
                .map((player, index) => ({
                    playerId: player._id,
                    role: PitchingRoleType.MIDDLE,
                    priority: index + 1
                }))
                .concat([
                    {
                        playerId: "202",
                        role: PitchingRoleType.CLOSER,
                        priority: 1
                    }
                ]) as any,
        feed
    )
}


function buildFeed(teamSide: "home" | "away", homeLeagueId: number): any {
    const homeTeamId = teamSide === "home" ? 139 : 999
    const awayTeamId = teamSide === "away" ? 139 : 999

    return {
        gameData: {
            teams: {
                home: {
                    id: homeTeamId,
                    league: {
                        id: homeLeagueId
                    }
                },
                away: {
                    id: awayTeamId
                }
            },
            probablePitchers: {
                [teamSide]: {
                    id: 201
                }
            }
        },
        liveData: {
            boxscore: {
                teams: {
                    home: {
                        players: {}
                    },
                    away: {
                        players: {}
                    }
                }
            }
        }
    }
}


function buildNormalPlayers(): Player[] {
    return [
        buildPlayer("101", Position.CATCHER),
        buildPlayer("102", Position.FIRST_BASE),
        buildPlayer("103", Position.SECOND_BASE),
        buildPlayer("104", Position.THIRD_BASE),
        buildPlayer("105", Position.SHORTSTOP),
        buildPlayer("106", Position.LEFT_FIELD),
        buildPlayer("107", Position.CENTER_FIELD),
        buildPlayer("108", Position.RIGHT_FIELD),
        buildPlayer("109", Position.DESIGNATED_HITTER),
        buildPlayer("201", Position.PITCHER)
    ]
}


function buildPlayer(playerId: string, position: Position): Player {
    return {
        _id: playerId,
        firstName: `First${playerId}`,
        lastName: `Last${playerId}`,
        fullName: `First${playerId} Last${playerId}`,
        displayName: `First${playerId} Last${playerId}`,
        primaryPosition: position,
        throws: Handedness.R,
        hits: Handedness.R,
        age: 27,
        stamina: position === Position.PITCHER ? 1 : 0,
        maxPitchCount: position === Position.PITCHER ? 100 : 0,
        overallRating: 100,
        hittingRatings: {},
        pitchRatings: {},
        isRetired: false,
        zodiacSign: "Aries"
    } as Player
}

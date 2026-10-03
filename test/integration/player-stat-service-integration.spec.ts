import { strict as assert } from "assert"

import {
    database
} from "baseball-database"

import {
    describe,
    it
} from "mocha"

import {
    DownloadService
} from "../../src/importer/service/download-service.js"

import {
    SchemaService
} from "../../src/importer/service/schema-service.js"

import {
    PlayerRatingInputRepository
} from "../../src/ratings/repository/player-rating-input-repository.js"

import {
    PlayerRatingSeasonInputRepository
} from "../../src/ratings/repository/player-rating-season-input-repository.js"

import {
    PlayerStatRepository
} from "../../src/ratings/repository/player-stat-repository.js"

import {
    PlayerStatService
} from "../../src/ratings/service/player-stat-service.js"

import {
    StatService
} from "../../src/sim/service/stat-service.js"


describe("PlayerStatService integration", function () {

    const schemaService = new SchemaService(
        database
    )

    const playerRatingInputRepository = new PlayerRatingInputRepository(
        database
    )

    const playerRatingSeasonInputRepository = new PlayerRatingSeasonInputRepository(
        database
    )

    const playerStatRepository = new PlayerStatRepository(
        database
    )

    const downloadService = new DownloadService(
        schemaService,
        playerRatingInputRepository,
        playerRatingSeasonInputRepository,
        playerStatRepository
    )

    const statService = new StatService()

    const playerStatService = new PlayerStatService(
        statService,
        playerStatRepository
    )

    it("materializes player stats when game 825036 is synchronized", function () {
        downloadService.syncGame(
            825036
        )

        const rows = database
            .prepare(`
                SELECT
                    player_id AS playerId,
                    pitching_games AS pitchingGames,
                    pitching_outs AS pitchingOuts,
                    pitching_batters_faced AS battersFaced,
                    pitching_so AS strikeouts
                FROM player_stats
                WHERE game_pk = ?
                ORDER BY player_id
            `)
            .all(825036)

        const montgomery = rows.find(
            (row: any) => Number(row.playerId) === 656756
        ) as any

        assert.ok(
            montgomery
        )

        assert.deepEqual(
            {
                pitchingGames: montgomery.pitchingGames,
                pitchingOuts: montgomery.pitchingOuts,
                battersFaced: montgomery.battersFaced,
                strikeouts: montgomery.strikeouts
            },
            {
                pitchingGames: 1,
                pitchingOuts: 6,
                battersFaced: 6,
                strikeouts: 1
            }
        )
    })

    it("matches Jordan Montgomery 2026 pitching stats", function () {
        const playerId = "656756"

        const stats = playerStatService.getStats(
            "2027-01-01",
            new Set([playerId])
        ).get(playerId)

        assert.ok(stats)

        const season = stats.seasonPitcherStats.find(
            season => season.season === 2026
        )

        assert.ok(season)

        assert.equal(season.teamAbbrev, "TEX")

        assert.deepEqual(
            {
                games: season.stats.games,
                wins: season.stats.wins,
                losses: season.stats.losses,
                era: Number(season.stats.era.toFixed(2)),
                starts: season.stats.starts,
                ip: season.stats.ip,
                hits: season.stats.hits,
                runs: season.stats.runs,
                er: season.stats.er,
                homeRuns: season.stats.homeRuns,
                bb: season.stats.bb,
                so: season.stats.so,
                hbp: season.stats.hbp,
                battersFaced: season.stats.battersFaced
            },
            {
                games: 13,
                wins: 1,
                losses: 0,
                era: 4.15,
                starts: 0,
                ip: "26.0",
                hits: 20,
                runs: 12,
                er: 12,
                homeRuns: 3,
                bb: 6,
                so: 20,
                hbp: 1,
                battersFaced: 104
            }
        )
    })

    it("has all Jordan Montgomery 2026 pitching appearances in player_stats", function () {
        const rows = database
            .prepare(`
                SELECT
                    game_pk AS gamePk,
                    game_date AS gameDate,
                    team_abbrev AS teamAbbrev,
                    pitching_games AS games,
                    pitching_outs AS outs,
                    pitching_batters_faced AS battersFaced,
                    pitching_hits AS hits,
                    pitching_runs AS runs,
                    pitching_earned_runs AS er,
                    pitching_home_runs AS homeRuns,
                    pitching_bb AS bb,
                    pitching_so AS so,
                    pitching_hbp AS hbp
                FROM player_stats
                WHERE player_id = ?
                    AND game_date >= '2026-01-01'
                    AND game_date < '2027-01-01'
                    AND game_type = 'R'
                    AND pitching_games > 0
                ORDER BY game_date
            `)
            .all(656756)

        assert.equal(
            rows.length,
            13
        )
    })

    it("has Jordan Montgomery's September 11 pitching appearance in the source database", function () {
        const row = database
            .prepare(`
                SELECT
                    games.game_pk AS gamePk,
                    games.game_date AS gameDate,
                    player_appearances.team_id AS teamId,
                    player_appearances.appeared_as_pitcher AS appearedAsPitcher,
                    player_appearances.started_as_pitcher AS startedAsPitcher
                FROM games
                INNER JOIN player_appearances
                    ON player_appearances.game_pk = games.game_pk
                    AND player_appearances.player_id = ?
                WHERE games.game_pk = ?
            `)
            .get(
                656756,
                825036
            ) as any

        assert.ok(
            row
        )

        assert.deepEqual(
            {
                gamePk: row.gamePk,
                gameDate: row.gameDate,
                teamId: row.teamId,
                appearedAsPitcher: row.appearedAsPitcher,
                startedAsPitcher: row.startedAsPitcher
            },
            {
                gamePk: 825036,
                gameDate: "2026-09-11",
                teamId: 140,
                appearedAsPitcher: 1,
                startedAsPitcher: 0
            }
        )
    })

})
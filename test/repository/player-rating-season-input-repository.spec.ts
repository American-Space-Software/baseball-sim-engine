import { strict as assert } from "assert"

import BetterSqlite3 from "better-sqlite3"
import { after, afterEach, before, beforeEach, describe, it } from "mocha"

import type { Database } from "better-sqlite3"
import type {
    PlayerRatingInput
} from "../../src/sim/service/interfaces.js"

import {
    PlayerRatingSeasonInputRepository
} from "../../src/ratings/repository/player-rating-season-input-repository.js"
import { PlayerRatingInputRepository } from "../../src/ratings/repository/player-rating-input-repository.js"
import { SchemaService } from "../../src/importer/service/schema-service.js"


class PlayerRatingSeasonInputRepositoryTestHarness {

    public readonly database: Database
    public readonly repository: PlayerRatingSeasonInputRepository
    public readonly inputRepository: PlayerRatingInputRepository

    public constructor() {
        this.database = new BetterSqlite3(
            ":memory:"
        )

        this.database.exec(`
            CREATE TABLE games (
                game_pk INTEGER PRIMARY KEY,
                game_date TEXT NOT NULL
            );

            CREATE INDEX idx_games_game_date
                ON games (
                    game_date
                );

            CREATE TABLE player_appearances (
                game_pk INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                team_id INTEGER NOT NULL,
                appeared_as_batter INTEGER NOT NULL,
                appeared_as_pitcher INTEGER NOT NULL,
                appeared_as_runner INTEGER NOT NULL,
                appeared_as_fielder INTEGER NOT NULL,
                started_as_batter INTEGER NOT NULL,
                started_as_pitcher INTEGER NOT NULL,
                started_as_fielder INTEGER NOT NULL,
                PRIMARY KEY (
                    game_pk,
                    player_id
                )
            );

            CREATE TABLE plate_appearances (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                batter_id INTEGER NOT NULL,
                pitcher_id INTEGER NOT NULL,
                bat_side_code TEXT,
                pitch_hand_code TEXT,
                event_type TEXT,
                is_complete INTEGER NOT NULL,
                PRIMARY KEY (
                    game_pk,
                    at_bat_index
                )
            );

            CREATE TABLE pitches (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                event_index INTEGER NOT NULL,
                call_code TEXT,
                is_in_play INTEGER NOT NULL,
                is_strike INTEGER NOT NULL,
                is_ball INTEGER NOT NULL,
                zone INTEGER,
                coordinate_p_x REAL,
                coordinate_p_z REAL,
                strike_zone_top REAL,
                strike_zone_bottom REAL,
                pitch_type_code TEXT,
                start_speed REAL,
                break_horizontal REAL,
                break_vertical REAL,
                launch_speed REAL,
                trajectory TEXT,
                PRIMARY KEY (
                    game_pk,
                    at_bat_index,
                    event_index
                )
            );

            CREATE TABLE runner_movements (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                runner_index INTEGER NOT NULL,
                runner_id INTEGER NOT NULL,
                responsible_pitcher_id INTEGER,
                event_type TEXT,
                end_base TEXT,
                is_out INTEGER NOT NULL,
                is_scoring_event INTEGER NOT NULL,
                earned INTEGER NOT NULL,
                PRIMARY KEY (
                    game_pk,
                    at_bat_index,
                    runner_index
                )
            );

            CREATE TABLE fielding_credits (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                runner_index INTEGER NOT NULL,
                credit_index INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                credit TEXT NOT NULL,
                position_abbreviation TEXT,
                PRIMARY KEY (
                    game_pk,
                    at_bat_index,
                    runner_index,
                    credit_index
                )
            );

            CREATE TABLE defensive_events (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                event_index INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                from_position TEXT,
                to_position TEXT,
                PRIMARY KEY (
                    game_pk,
                    at_bat_index,
                    event_index,
                    player_id
                )
            );
        `)

        new SchemaService(
            this.database
        ).load()

        this.inputRepository = new PlayerRatingInputRepository(
            this.database
        )

        this.repository = new PlayerRatingSeasonInputRepository(
            this.database
        )
    }

    public putGame(gamePk: number, gameDate: string): void {
        this.database.prepare(`
            INSERT INTO games (
                game_pk,
                game_date
            )
            VALUES (
                @gamePk,
                @gameDate
            )
        `).run({
            gamePk,
            gameDate
        })
    }

    public putInput(gamePk: number, input: PlayerRatingInput): void {
        this.inputRepository.put(
            gamePk,
            input
        )
    }

    public buildInput(playerId: string, plateAppearances: number): PlayerRatingInput {
        return {
            playerId,
            hitting: {
                games: 1,
                pa: plateAppearances,
                ab: plateAppearances,
                hits: plateAppearances,
                doubles: 0,
                triples: 0,
                homeRuns: 0,
                bb: 0,
                so: 0,
                hbp: 0,
                groundBalls: 0,
                flyBalls: 0,
                lineDrives: plateAppearances,
                popups: 0,
                pitchesSeen: plateAppearances,
                ballsSeen: 0,
                strikesSeen: plateAppearances,
                swings: plateAppearances,
                swingAtBalls: 0,
                swingAtStrikes: plateAppearances,
                calledStrikes: 0,
                swingingStrikes: 0,
                inZonePitches: plateAppearances,
                inZoneContact: plateAppearances,
                outZoneContact: 0,
                fouls: 0,
                ballsInPlay: plateAppearances,
                exitVelocity: {
                    count: plateAppearances,
                    totalExitVelo: plateAppearances * 90,
                    avgExitVelo: plateAppearances > 0
                        ? 90
                        : 0
                }
            },
            pitching: {
                games: 0,
                starts: 0,
                battersFaced: 0,
                outs: 0,
                hitsAllowed: 0,
                doublesAllowed: 0,
                triplesAllowed: 0,
                homeRunsAllowed: 0,
                bbAllowed: 0,
                so: 0,
                hbpAllowed: 0,
                groundBallsAllowed: 0,
                flyBallsAllowed: 0,
                lineDrivesAllowed: 0,
                popupsAllowed: 0,
                pitchesThrown: 0,
                ballsThrown: 0,
                strikesThrown: 0,
                swingsInduced: 0,
                swingAtBallsAllowed: 0,
                swingAtStrikesAllowed: 0,
                inZoneContactAllowed: 0,
                outZoneContactAllowed: 0,
                foulsAllowed: 0,
                ballsInPlayAllowed: 0,
                pitchTypes: {}
            },
            fielding: {
                gamesAtPosition: {},
                inningsAtPosition: {},
                errors: 0,
                assists: 0,
                putouts: 0,
                doublePlays: 0,
                outfieldAssists: 0,
                catcherCaughtStealing: 0,
                catcherStolenBasesAllowed: 0,
                passedBalls: 0
            },
            running: {
                sb: 0,
                cs: 0,
                sbAttempts: 0
            },
            splits: {
                hitting: {
                    vsL: {
                        pa: plateAppearances,
                        ab: plateAppearances,
                        hits: plateAppearances,
                        doubles: 0,
                        triples: 0,
                        homeRuns: 0,
                        bb: 0,
                        so: 0,
                        hbp: 0,
                        exitVelocity: plateAppearances > 0
                            ? 90
                            : 0,
                        exitVelocityCount: plateAppearances,
                        totalExitVelocity: plateAppearances * 90
                    },
                    vsR: {
                        pa: 0,
                        ab: 0,
                        hits: 0,
                        doubles: 0,
                        triples: 0,
                        homeRuns: 0,
                        bb: 0,
                        so: 0,
                        hbp: 0,
                        exitVelocity: 0,
                        exitVelocityCount: 0,
                        totalExitVelocity: 0
                    }
                },
                pitching: {
                    vsL: {
                        battersFaced: 0,
                        outs: 0,
                        runsAllowed: 0,
                        earnedRunsAllowed: 0,
                        hitsAllowed: 0,
                        doublesAllowed: 0,
                        triplesAllowed: 0,
                        homeRunsAllowed: 0,
                        bbAllowed: 0,
                        so: 0,
                        hbpAllowed: 0
                    },
                    vsR: {
                        battersFaced: 0,
                        outs: 0,
                        runsAllowed: 0,
                        earnedRunsAllowed: 0,
                        hitsAllowed: 0,
                        doublesAllowed: 0,
                        triplesAllowed: 0,
                        homeRunsAllowed: 0,
                        bbAllowed: 0,
                        so: 0,
                        hbpAllowed: 0
                    }
                }
            }
        }
    }

    public seedPerformanceData(firstSeason = 2008, lastSeason = 2025, gamesPerSeason = 2430, playerCount = 1470, playersPerGame = 30): void {
        const startedAt = Date.now()

        const templateGamePk = 1

        this.putGame(
            templateGamePk,
            "2000-01-01"
        )

        const template = this.buildInput(
            "1",
            1
        )

        template.pitching.pitchTypes = {
            FF: {
                count: 1,
                totalMph: 95,
                avgMph: 95,
                totalHorizontalBreak: 5,
                avgHorizontalBreak: 5,
                totalVerticalBreak: 12,
                avgVerticalBreak: 12
            },
            SL: {
                count: 1,
                totalMph: 86,
                avgMph: 86,
                totalHorizontalBreak: 8,
                avgHorizontalBreak: 8,
                totalVerticalBreak: 4,
                avgVerticalBreak: 4
            }
        }

        template.fielding.gamesAtPosition = {
            CF: 1,
            LF: 1
        }

        template.fielding.inningsAtPosition = {
            CF: 5,
            LF: 4
        }

        this.putInput(
            templateGamePk,
            template
        )

        const columns = this.database.prepare(`
            PRAGMA table_info(player_rating_inputs)
        `).all() as Array<{
            name: string
        }>

        const copiedColumns = columns
            .map(column =>
                column.name
            )
            .filter(column =>
                column !== "game_pk" &&
                column !== "player_id" &&
                column !== "game_date"
            )

        const columnList = copiedColumns.join(
            ", "
        )

        const selectList = copiedColumns.map(column =>
            `template.${column}`
        ).join(
            ", "
        )

        this.database.transaction(() => {
            this.database.exec(`
                WITH RECURSIVE
                seasons(season) AS (
                    SELECT ${firstSeason}
                    UNION ALL
                    SELECT season + 1
                    FROM seasons
                    WHERE season < ${lastSeason}
                ),
                game_numbers(game_number) AS (
                    SELECT 1
                    UNION ALL
                    SELECT game_number + 1
                    FROM game_numbers
                    WHERE game_number < ${gamesPerSeason}
                )
                INSERT INTO games (
                    game_pk,
                    game_date
                )
                SELECT
                    (seasons.season * 100000) + game_numbers.game_number,
                    printf(
                        '%04d-07-01',
                        seasons.season
                    )
                FROM seasons
                CROSS JOIN game_numbers;
            `)

            this.database.exec(`
                WITH RECURSIVE
                seasons(season) AS (
                    SELECT ${firstSeason}
                    UNION ALL
                    SELECT season + 1
                    FROM seasons
                    WHERE season < ${lastSeason}
                ),
                game_numbers(game_number) AS (
                    SELECT 1
                    UNION ALL
                    SELECT game_number + 1
                    FROM game_numbers
                    WHERE game_number < ${gamesPerSeason}
                ),
                player_slots(slot) AS (
                    SELECT 0
                    UNION ALL
                    SELECT slot + 1
                    FROM player_slots
                    WHERE slot + 1 < ${playersPerGame}
                )
                INSERT INTO player_rating_inputs (
                    game_pk,
                    player_id,
                    game_date,
                    ${columnList}
                )
                SELECT
                    (seasons.season * 100000) + game_numbers.game_number,
                    (
                        (
                            (
                                (seasons.season - ${firstSeason}) * ${gamesPerSeason} +
                                game_numbers.game_number - 1
                            ) * ${playersPerGame} +
                            player_slots.slot
                        ) % ${playerCount}
                    ) + 1,
                    printf(
                        '%04d-07-01',
                        seasons.season
                    ),
                    ${selectList}
                FROM seasons
                CROSS JOIN game_numbers
                CROSS JOIN player_slots
                CROSS JOIN player_rating_inputs template
                WHERE template.game_pk = ${templateGamePk}
                    AND template.player_id = 1;
            `)
        })()

        this.database.prepare(`
            DELETE FROM player_rating_inputs
            WHERE game_pk = ?
        `).run(
            templateGamePk
        )

        this.database.prepare(`
            DELETE FROM games
            WHERE game_pk = ?
        `).run(
            templateGamePk
        )

        const inputRow = this.database.prepare(`
            SELECT
                COUNT(*) AS count
            FROM player_rating_inputs
        `).get() as {
            count: number
        }

        const gameRow = this.database.prepare(`
            SELECT
                COUNT(*) AS count
            FROM games
        `).get() as {
            count: number
        }

        console.log(
            `[PERF] Seeded ${inputRow.count} player rating input rows across ${gameRow.count} games from ${firstSeason}-${lastSeason} in ${Date.now() - startedAt}ms.`
        )
    }

    public getPerformancePlayerIds(playerCount = 1470): Set<string> {
        return new Set(
            Array.from(
                {
                    length: playerCount
                },
                (_, index) =>
                    String(
                        index + 1
                    )
            )
        )
    }

    public close(): void {
        this.database.close()
    }
}


describe("PlayerRatingSeasonInputRepository", function () {

    let harness: PlayerRatingSeasonInputRepositoryTestHarness

    beforeEach(function () {
        harness = new PlayerRatingSeasonInputRepositoryTestHarness()
    })

    afterEach(function () {
        harness?.close()
    })

    it("creates and returns a season input", function () {
        harness.putGame(
            1,
            "2025-04-01"
        )

        harness.putInput(
            1,
            harness.buildInput(
                "101",
                10
            )
        )

        harness.repository.create(
            2025
        )

        const results = harness.repository.getBySeason(
            2025
        )

        assert.equal(
            results.length,
            1
        )

        assert.equal(
            results[0]?.season,
            2025
        )

        assert.equal(
            results[0]?.playerId,
            "101"
        )

        assert.equal(
            results[0]?.data.hitting.pa,
            10
        )

        assert.equal(
            results[0]?.data.splits.hitting.vsL.exitVelocityCount,
            10
        )

        assert.equal(
            results[0]?.data.splits.hitting.vsL.totalExitVelocity,
            900
        )
    })

    it("sums inputs for the same player across a season", function () {
        harness.putGame(
            1,
            "2025-04-01"
        )

        harness.putGame(
            2,
            "2025-04-02"
        )

        harness.putInput(
            1,
            harness.buildInput(
                "101",
                10
            )
        )

        harness.putInput(
            2,
            harness.buildInput(
                "101",
                20
            )
        )

        harness.repository.create(
            2025
        )

        const result = harness.repository.getBySeason(
            2025
        )[0]

        assert.ok(result)

        assert.equal(
            result.data.hitting.games,
            2
        )

        assert.equal(
            result.data.hitting.pa,
            30
        )

        assert.equal(
            result.data.hitting.exitVelocity.count,
            30
        )

        assert.equal(
            result.data.hitting.exitVelocity.totalExitVelo,
            2700
        )

        assert.equal(
            result.data.hitting.exitVelocity.avgExitVelo,
            90
        )

        assert.equal(
            result.data.splits.hitting.vsL.exitVelocityCount,
            30
        )

        assert.equal(
            result.data.splits.hitting.vsL.totalExitVelocity,
            2700
        )

        assert.equal(
            result.data.splits.hitting.vsL.exitVelocity,
            90
        )
    })

    it("upserts an existing season row", function () {
        harness.putGame(
            1,
            "2025-04-01"
        )

        harness.putInput(
            1,
            harness.buildInput(
                "101",
                10
            )
        )

        harness.repository.create(
            2025
        )

        const updated = harness.buildInput(
            "101",
            25
        )

        harness.putInput(
            1,
            updated
        )

        harness.repository.create(
            2025
        )

        const results = harness.repository.getBySeason(
            2025
        )

        assert.equal(
            results.length,
            1
        )

        assert.equal(
            results[0]?.data.hitting.pa,
            25
        )
    })

    it("returns only rows from the requested season", function () {
        harness.putGame(
            1,
            "2024-04-01"
        )

        harness.putGame(
            2,
            "2025-04-01"
        )

        harness.putInput(
            1,
            harness.buildInput(
                "101",
                10
            )
        )

        harness.putInput(
            2,
            harness.buildInput(
                "202",
                20
            )
        )

        harness.repository.create(
            2024
        )

        harness.repository.create(
            2025
        )

        assert.deepEqual(
            harness.repository.getBySeason(
                2025
            ).map(result =>
                result.playerId
            ),
            [
                "202"
            ]
        )
    })

    it("limits season rows to requested player IDs", function () {
        harness.putGame(
            1,
            "2025-04-01"
        )

        harness.putInput(
            1,
            harness.buildInput(
                "101",
                10
            )
        )

        harness.putInput(
            1,
            harness.buildInput(
                "202",
                20
            )
        )

        harness.repository.create(
            2025
        )

        const results = harness.repository.getBySeason(
            2025,
            new Set([
                "202"
            ])
        )

        assert.equal(
            results.length,
            1
        )

        assert.equal(
            results[0]?.playerId,
            "202"
        )
    })

    it("returns rows before the requested season in player and season order", function () {
        for (const [gamePk, gameDate, playerId] of [
            [1, "2023-04-01", "101"],
            [2, "2024-04-01", "202"],
            [3, "2024-04-02", "101"],
            [4, "2025-04-01", "101"]
        ] as Array<[number, string, string]>) {
            harness.putGame(
                gamePk,
                gameDate
            )

            harness.putInput(
                gamePk,
                harness.buildInput(
                    playerId,
                    10
                )
            )
        }

        harness.repository.create(
            2023
        )

        harness.repository.create(
            2024
        )

        harness.repository.create(
            2025
        )

        const results = harness.repository.getBeforeSeason(
            2025
        )

        assert.deepEqual(
            results.map(result => ({
                season: result.season,
                playerId: result.playerId
            })),
            [
                {
                    season: 2023,
                    playerId: "101"
                },
                {
                    season: 2024,
                    playerId: "101"
                },
                {
                    season: 2024,
                    playerId: "202"
                }
            ]
        )
    })

    it("returns an empty array when no rows match", function () {
        assert.deepEqual(
            harness.repository.getBySeason(
                2025
            ),
            []
        )

        assert.deepEqual(
            harness.repository.getBeforeSeason(
                2025
            ),
            []
        )
    })

    it("rejects invalid seasons and player ID filters", function () {
        assert.throws(
            () => harness.repository.create(
                0
            ),
            /Season must be a positive integer/
        )

        assert.throws(
            () => harness.repository.getBySeason(
                0
            ),
            /Season must be a positive integer/
        )

        assert.throws(
            () => harness.repository.getBeforeSeason(
                0
            ),
            /Season must be a positive integer/
        )

        assert.throws(
            () => harness.repository.getBySeason(
                2025,
                new Set([
                    "invalid"
                ])
            ),
            /filters must contain positive numeric player IDs/
        )
    })
})

describe("Player rating input performance diagnostics", function () {

    let harness: PlayerRatingSeasonInputRepositoryTestHarness
    let playerIds: Set<string>

    before(function () {
        this.timeout(
            0
        )

        harness = new PlayerRatingSeasonInputRepositoryTestHarness()
        harness.seedPerformanceData()
        playerIds = harness.getPerformancePlayerIds()
    })

    after(function () {
        harness?.close()
    })

    it("diagnoses the games date-range lookup", function () {
        this.timeout(
            0
        )

        const plan = harness.database.prepare(`
            EXPLAIN QUERY PLAN
            SELECT
                games.game_pk
            FROM games
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
        `).all({
            startDate: "2025-01-01",
            endDateExclusive: "2026-01-01"
        })

        console.log(
            "[PERF] Games date-range query plan:",
            plan
        )

        const startedAt = Date.now()

        const rows = harness.database.prepare(`
            SELECT
                games.game_pk
            FROM games
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
        `).all({
            startDate: "2025-01-01",
            endDateExclusive: "2026-01-01"
        })

        console.log(
            `[PERF] Games date-range lookup: ${rows.length} games in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            rows.length,
            2430
        )
    })

    it("diagnoses current join order against historical data", function () {
        this.timeout(
            0
        )

        const ids = Array.from(
            playerIds
        ).map(Number)

        const placeholders = ids.map(
            (_, index) =>
                `@playerId${index}`
        )

        const parameters: Record<string, number | string> = {
            startDate: "2025-01-01",
            endDateExclusive: "2026-01-01"
        }

        ids.forEach((playerId, index) => {
            parameters[`playerId${index}`] = playerId
        })

        const currentPlan = harness.database.prepare(`
            EXPLAIN QUERY PLAN
            SELECT
                player_rating_inputs.player_id
            FROM player_rating_inputs
            INNER JOIN games
                ON games.game_pk = player_rating_inputs.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
                AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
        `).all(
            parameters
        )

        console.log(
            "[PERF] Current join query plan:",
            currentPlan
        )

        const currentStartedAt = Date.now()

        const current = harness.database.prepare(`
            SELECT
                COUNT(*) AS count
            FROM player_rating_inputs
            INNER JOIN games
                ON games.game_pk = player_rating_inputs.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
                AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
        `).get(
            parameters
        ) as {
            count: number
        }

        console.log(
            `[PERF] Current join raw selection: ${current.count} rows in ${Date.now() - currentStartedAt}ms.`
        )

        const gamesFirstPlan = harness.database.prepare(`
            EXPLAIN QUERY PLAN
            SELECT
                player_rating_inputs.player_id
            FROM games INDEXED BY idx_games_game_date
            CROSS JOIN player_rating_inputs
                ON player_rating_inputs.game_pk = games.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
                AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
        `).all(
            parameters
        )

        console.log(
            "[PERF] Games-first query plan:",
            gamesFirstPlan
        )

        const gamesFirstStartedAt = Date.now()

        const gamesFirst = harness.database.prepare(`
            SELECT
                COUNT(*) AS count
            FROM games INDEXED BY idx_games_game_date
            CROSS JOIN player_rating_inputs
                ON player_rating_inputs.game_pk = games.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
                AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
        `).get(
            parameters
        ) as {
            count: number
        }

        console.log(
            `[PERF] Games-first raw selection: ${gamesFirst.count} rows in ${Date.now() - gamesFirstStartedAt}ms.`
        )

        assert.equal(
            current.count,
            72900
        )

        assert.equal(
            gamesFirst.count,
            72900
        )
    })

    it("diagnoses full-season date-range aggregation against historical data", function () {
        this.timeout(
            0
        )

        const ids = Array.from(
            playerIds
        ).map(Number)

        const placeholders = ids.map(
            (_, index) =>
                `@playerId${index}`
        )

        const parameters: Record<string, number | string> = {
            startDate: "2025-01-01",
            endDateExclusive: "2026-01-01"
        }

        ids.forEach((playerId, index) => {
            parameters[`playerId${index}`] = playerId
        })

        const scalarStartedAt = Date.now()

        const scalarRows = harness.database.prepare(`
            SELECT
                player_rating_inputs.player_id,
                SUM(player_rating_inputs.hitting_pa) AS hittingPa,
                SUM(player_rating_inputs.pitching_batters_faced) AS pitchingBattersFaced
            FROM player_rating_inputs
            INNER JOIN games
                ON games.game_pk = player_rating_inputs.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
                AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
            GROUP BY player_rating_inputs.player_id
        `).all(
            parameters
        )

        console.log(
            `[PERF] Historical-table scalar GROUP BY: ${scalarRows.length} players in ${Date.now() - scalarStartedAt}ms.`
        )

        const jsonStartedAt = Date.now()

        const pitchTypeRows = harness.database.prepare(`
            WITH selected_inputs AS (
                SELECT
                    player_rating_inputs.player_id,
                    player_rating_inputs.pitch_types
                FROM player_rating_inputs
                INNER JOIN games
                    ON games.game_pk = player_rating_inputs.game_pk
                WHERE games.game_date >= @startDate
                    AND games.game_date < @endDateExclusive
                    AND player_rating_inputs.player_id IN (${placeholders.join(", ")})
            )
            SELECT
                selected_inputs.player_id,
                pitch_type.key,
                SUM(
                    COALESCE(
                        json_extract(
                            pitch_type.value,
                            '$.count'
                        ),
                        0
                    )
                ) AS count
            FROM selected_inputs
            INNER JOIN json_each(
                selected_inputs.pitch_types
            ) pitch_type
            GROUP BY
                selected_inputs.player_id,
                pitch_type.key
        `).all(
            parameters
        )

        console.log(
            `[PERF] Historical-table pitch-type JSON aggregation: ${pitchTypeRows.length} player/pitch rows in ${Date.now() - jsonStartedAt}ms.`
        )

        const repositoryStartedAt = Date.now()

        const results = harness.inputRepository.getForDateRange(
            "2025-01-01",
            "2026-01-01",
            playerIds
        )

        console.log(
            `[PERF] Historical-table full getForDateRange: ${results.length} players in ${Date.now() - repositoryStartedAt}ms.`
        )

        assert.equal(
            results.length,
            1470
        )
    })

    it("diagnoses last-162 aggregation against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        const results = harness.inputRepository.getLastAppearances(
            "2026-01-01",
            162,
            playerIds
        )

        console.log(
            `[PERF] Historical-table full getLastAppearances(162): ${results.length} players in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            results.length,
            1470
        )
    })

    it("diagnoses season materialization against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        harness.repository.create(
            2025
        )

        console.log(
            `[PERF] Historical-table full season create(2025): ${Date.now() - startedAt}ms.`
        )

        const rows = harness.repository.getBySeason(
            2025
        )

        assert.equal(
            rows.length,
            1470
        )
    })
})


import { strict as assert } from "assert"

import BetterSqlite3 from "better-sqlite3"
import { after, afterEach, before, beforeEach, describe, it } from "mocha"

import type { Database } from "better-sqlite3"
import type { PlayerRatingInput } from "../../src/sim/service/interfaces.js"

import {
    PitchType,
    Position
} from "../../src/sim/service/enums.js"

import { PlayerRatingInputRepository } from "../../src/ratings/repository/player-rating-input-repository.js"
import { SchemaService } from "../../src/importer/service/schema-service.js"

class PlayerRatingInputRepositoryTestHarness {

    public readonly playerId = "101"
    public readonly database: Database
    public readonly repository: PlayerRatingInputRepository

    public constructor(seedCorrectnessData = true) {
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

        this.repository = new PlayerRatingInputRepository(
            this.database
        )

        if (seedCorrectnessData) {
            this.seed()

            this.repository.create(
                1
            )

            this.repository.create(
                2
            )

            this.repository.create(
                3
            )
        }
    }

    public seedPerformanceData(firstSeason = 2008, lastSeason = 2025, gamesPerSeason = 2430, playerCount = 1470, playersPerGame = 30): void {
        const startedAt = Date.now()
        const templateGamePk = 1

        this.database.prepare(`
            INSERT INTO games (
                game_pk,
                game_date
            )
            VALUES (
                ?,
                ?
            )
        `).run(
            templateGamePk,
            "2000-01-01"
        )

        this.repository.put(
            templateGamePk,
            this.buildPerformanceInput(
                "1"
            )
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

    private buildPerformanceInput(playerId: string): PlayerRatingInput {
        return {
            playerId,
            hitting: {
                games: 1,
                pa: 1,
                ab: 1,
                hits: 1,
                doubles: 0,
                triples: 0,
                homeRuns: 0,
                bb: 0,
                so: 0,
                hbp: 0,
                groundBalls: 0,
                flyBalls: 0,
                lineDrives: 1,
                popups: 0,
                pitchesSeen: 1,
                ballsSeen: 0,
                strikesSeen: 1,
                swings: 1,
                swingAtBalls: 0,
                swingAtStrikes: 1,
                calledStrikes: 0,
                swingingStrikes: 0,
                inZonePitches: 1,
                inZoneContact: 1,
                outZoneContact: 0,
                fouls: 0,
                ballsInPlay: 1,
                exitVelocity: {
                    count: 1,
                    totalExitVelo: 90,
                    avgExitVelo: 90
                }
            },
            pitching: {
                games: 1,
                starts: 0,
                battersFaced: 1,
                outs: 0,
                hitsAllowed: 1,
                doublesAllowed: 0,
                triplesAllowed: 0,
                homeRunsAllowed: 0,
                bbAllowed: 0,
                so: 0,
                hbpAllowed: 0,
                groundBallsAllowed: 0,
                flyBallsAllowed: 0,
                lineDrivesAllowed: 1,
                popupsAllowed: 0,
                pitchesThrown: 1,
                ballsThrown: 0,
                strikesThrown: 1,
                swingsInduced: 1,
                swingAtBallsAllowed: 0,
                swingAtStrikesAllowed: 1,
                inZoneContactAllowed: 1,
                outZoneContactAllowed: 0,
                foulsAllowed: 0,
                ballsInPlayAllowed: 1,
                pitchTypes: {
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
            },
            fielding: {
                gamesAtPosition: {
                    CF: 1,
                    LF: 1
                },
                inningsAtPosition: {
                    CF: 5,
                    LF: 4
                },
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
                        pa: 1,
                        ab: 1,
                        hits: 1,
                        doubles: 0,
                        triples: 0,
                        homeRuns: 0,
                        bb: 0,
                        so: 0,
                        hbp: 0,
                        exitVelocity: 90,
                        exitVelocityCount: 1,
                        totalExitVelocity: 90
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
                        battersFaced: 1,
                        outs: 0,
                        runsAllowed: 0,
                        earnedRunsAllowed: 0,
                        hitsAllowed: 1,
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

    private seed(): void {
        const insertGame = this.database.prepare(`
            INSERT INTO games (
                game_pk,
                game_date
            ) VALUES (
                @gamePk,
                @gameDate
            )
        `)

        insertGame.run({
            gamePk: 1,
            gameDate: "2026-04-01"
        })

        insertGame.run({
            gamePk: 2,
            gameDate: "2026-04-10"
        })

        insertGame.run({
            gamePk: 3,
            gameDate: "2026-05-01"
        })

        const insertAppearance = this.database.prepare(`
            INSERT INTO player_appearances (
                game_pk,
                player_id,
                team_id,
                appeared_as_batter,
                appeared_as_pitcher,
                appeared_as_runner,
                appeared_as_fielder,
                started_as_batter,
                started_as_pitcher,
                started_as_fielder
            ) VALUES (
                @gamePk,
                @playerId,
                10,
                1,
                1,
                1,
                1,
                1,
                @startedAsPitcher,
                1
            )
        `)

        insertAppearance.run({
            gamePk: 1,
            playerId: 101,
            startedAsPitcher: 1
        })

        insertAppearance.run({
            gamePk: 2,
            playerId: 101,
            startedAsPitcher: 0
        })

        insertAppearance.run({
            gamePk: 3,
            playerId: 101,
            startedAsPitcher: 1
        })

        const insertPlateAppearance = this.database.prepare(`
            INSERT INTO plate_appearances (
                game_pk,
                at_bat_index,
                batter_id,
                pitcher_id,
                bat_side_code,
                pitch_hand_code,
                event_type,
                is_complete
            ) VALUES (
                @gamePk,
                @atBatIndex,
                @batterId,
                @pitcherId,
                @batSideCode,
                @pitchHandCode,
                @eventType,
                1
            )
        `)

        insertPlateAppearance.run({
            gamePk: 1,
            atBatIndex: 0,
            batterId: 101,
            pitcherId: 101,
            batSideCode: "R",
            pitchHandCode: "L",
            eventType: "single"
        })

        insertPlateAppearance.run({
            gamePk: 2,
            atBatIndex: 0,
            batterId: 101,
            pitcherId: 101,
            batSideCode: "L",
            pitchHandCode: "R",
            eventType: "walk"
        })

        insertPlateAppearance.run({
            gamePk: 3,
            atBatIndex: 0,
            batterId: 101,
            pitcherId: 101,
            batSideCode: "R",
            pitchHandCode: "R",
            eventType: "home_run"
        })

        const insertPitch = this.database.prepare(`
            INSERT INTO pitches (
                game_pk,
                at_bat_index,
                event_index,
                call_code,
                is_in_play,
                is_strike,
                is_ball,
                zone,
                coordinate_p_x,
                coordinate_p_z,
                strike_zone_top,
                strike_zone_bottom,
                pitch_type_code,
                start_speed,
                break_horizontal,
                break_vertical,
                launch_speed,
                trajectory
            ) VALUES (
                @gamePk,
                0,
                @eventIndex,
                @callCode,
                @isInPlay,
                @isStrike,
                @isBall,
                @zone,
                @coordinatePX,
                @coordinatePZ,
                @strikeZoneTop,
                @strikeZoneBottom,
                @pitchTypeCode,
                @startSpeed,
                @breakHorizontal,
                @breakVertical,
                @launchSpeed,
                @trajectory
            )
        `)

        insertPitch.run({
            gamePk: 1,
            eventIndex: 0,
            callCode: "C",
            isInPlay: 0,
            isStrike: 1,
            isBall: 0,
            zone: 5,
            coordinatePX: 0,
            coordinatePZ: 2.5,
            strikeZoneTop: 3.5,
            strikeZoneBottom: 1.5,
            pitchTypeCode: "FF",
            startSpeed: 95,
            breakHorizontal: 4,
            breakVertical: -10,
            launchSpeed: null,
            trajectory: null
        })

        insertPitch.run({
            gamePk: 1,
            eventIndex: 1,
            callCode: "D",
            isInPlay: 1,
            isStrike: 0,
            isBall: 0,
            zone: 5,
            coordinatePX: 0.3,
            coordinatePZ: 2.7,
            strikeZoneTop: 3.5,
            strikeZoneBottom: 1.5,
            pitchTypeCode: "FF",
            startSpeed: 97,
            breakHorizontal: 6,
            breakVertical: -12,
            launchSpeed: 100,
            trajectory: "line_drive"
        })

        insertPitch.run({
            gamePk: 2,
            eventIndex: 0,
            callCode: "B",
            isInPlay: 0,
            isStrike: 0,
            isBall: 1,
            zone: 11,
            coordinatePX: 1.2,
            coordinatePZ: 2.5,
            strikeZoneTop: 3.5,
            strikeZoneBottom: 1.5,
            pitchTypeCode: "SL",
            startSpeed: 86,
            breakHorizontal: 8,
            breakVertical: -3,
            launchSpeed: null,
            trajectory: null
        })

        insertPitch.run({
            gamePk: 3,
            eventIndex: 0,
            callCode: "D",
            isInPlay: 1,
            isStrike: 0,
            isBall: 0,
            zone: 8,
            coordinatePX: 0.4,
            coordinatePZ: 1.8,
            strikeZoneTop: 3.5,
            strikeZoneBottom: 1.5,
            pitchTypeCode: "FF",
            startSpeed: 98,
            breakHorizontal: 7,
            breakVertical: -11,
            launchSpeed: 105,
            trajectory: "fly_ball"
        })

        const insertRunnerMovement = this.database.prepare(`
            INSERT INTO runner_movements (
                game_pk,
                at_bat_index,
                runner_index,
                runner_id,
                responsible_pitcher_id,
                event_type,
                end_base,
                is_out,
                is_scoring_event,
                earned
            ) VALUES (
                @gamePk,
                0,
                @runnerIndex,
                @runnerId,
                @responsiblePitcherId,
                @eventType,
                @endBase,
                @isOut,
                @isScoringEvent,
                @earned
            )
        `)

        insertRunnerMovement.run({
            gamePk: 1,
            runnerIndex: 0,
            runnerId: 101,
            responsiblePitcherId: 101,
            eventType: "stolen_base_2b",
            endBase: "2B",
            isOut: 0,
            isScoringEvent: 0,
            earned: 0
        })

        insertRunnerMovement.run({
            gamePk: 2,
            runnerIndex: 0,
            runnerId: 101,
            responsiblePitcherId: 101,
            eventType: "caught_stealing_2b",
            endBase: null,
            isOut: 1,
            isScoringEvent: 0,
            earned: 0
        })

        insertRunnerMovement.run({
            gamePk: 3,
            runnerIndex: 0,
            runnerId: 101,
            responsiblePitcherId: 101,
            eventType: "home_run",
            endBase: "score",
            isOut: 0,
            isScoringEvent: 1,
            earned: 1
        })

        const insertFieldingCredit = this.database.prepare(`
            INSERT INTO fielding_credits (
                game_pk,
                at_bat_index,
                runner_index,
                credit_index,
                player_id,
                credit,
                position_abbreviation
            ) VALUES (
                @gamePk,
                0,
                0,
                @creditIndex,
                101,
                @credit,
                @position
            )
        `)

        insertFieldingCredit.run({
            gamePk: 1,
            creditIndex: 0,
            credit: "f_assist",
            position: "SS"
        })

        insertFieldingCredit.run({
            gamePk: 2,
            creditIndex: 0,
            credit: "f_putout",
            position: "C"
        })

        insertFieldingCredit.run({
            gamePk: 3,
            creditIndex: 0,
            credit: "f_assist",
            position: "CF"
        })

        const insertDefensiveEvent = this.database.prepare(`
            INSERT INTO defensive_events (
                game_pk,
                at_bat_index,
                event_index,
                player_id,
                from_position,
                to_position
            ) VALUES (
                @gamePk,
                0,
                0,
                101,
                @fromPosition,
                @toPosition
            )
        `)

        insertDefensiveEvent.run({
            gamePk: 1,
            fromPosition: "SS",
            toPosition: "SS"
        })

        insertDefensiveEvent.run({
            gamePk: 2,
            fromPosition: "C",
            toPosition: "C"
        })

        insertDefensiveEvent.run({
            gamePk: 3,
            fromPosition: "CF",
            toPosition: "CF"
        })

        insertAppearance.run({
            gamePk: 1,
            playerId: 202,
            startedAsPitcher: 0
        })

        insertPlateAppearance.run({
            gamePk: 1,
            atBatIndex: 1,
            batterId: 202,
            pitcherId: 202,
            batSideCode: "R",
            pitchHandCode: "R",
            eventType: "double"
        })
    }
}


describe("PlayerRatingInputRepository", function () {

    let harness: PlayerRatingInputRepositoryTestHarness

    beforeEach(function () {
        harness = new PlayerRatingInputRepositoryTestHarness()
    })

    afterEach(function () {
        harness?.close()
    })



    it("materializes one row per player appearance for a game", function () {
        const rows = harness.database.prepare(`
            SELECT
                player_rating_inputs.player_id,
                games.game_date,
                player_rating_inputs.hitting_hits
            FROM player_rating_inputs
            INNER JOIN games
                ON games.game_pk = player_rating_inputs.game_pk
            WHERE player_rating_inputs.game_pk = 1
            ORDER BY player_rating_inputs.player_id
        `).all() as Array<{
            player_id: number
            game_date: string
            hitting_hits: number
        }>

        assert.equal(
            rows.length,
            2
        )

        assert.equal(
            rows[0]?.player_id,
            101
        )

        assert.equal(
            rows[0]?.game_date,
            "2026-04-01"
        )

        assert.equal(
            rows[0]?.hitting_hits,
            1
        )

        assert.equal(
            rows[1]?.player_id,
            202
        )

        assert.equal(
            rows[1]?.hitting_hits,
            1
        )
    })

    it("replaces existing materialized rows when a game is created again", function () {
        harness.database.prepare(`
            UPDATE player_rating_inputs
            SET hitting_hits = 999
            WHERE game_pk = 1
                AND player_id = 101
        `).run()

        harness.repository.create(
            1
        )

        const row = harness.database.prepare(`
            SELECT
                hitting_hits AS hittingHits
            FROM player_rating_inputs
            WHERE game_pk = 1
                AND player_id = 101
        `).get() as {
            hittingHits: number
        }

        assert.equal(
            row.hittingHits,
            1
        )
    })

    it("returns an empty array when no players have selected appearances", function () {
        const results = harness.repository.getCareer(
            "2026-06-01",
            new Set([
                "999"
            ])
        )

        assert.equal(
            results.length,
            0
        )
    })

    it("returns career rating inputs before the exclusive end date", function () {
        const results = harness.repository.getCareer(
            "2026-05-01",
            new Set([
                harness.playerId
            ])
        )

        assert.equal(
            results.length,
            1
        )

        const result = results[0]

        assert.ok(result)

        assert.equal(
            result.hitting.games,
            2
        )

        assert.equal(
            result.hitting.pa,
            2
        )

        assert.equal(
            result.hitting.hits,
            1
        )

        assert.equal(
            result.hitting.bb,
            1
        )

        assert.equal(
            result.pitching.starts,
            1
        )
    })

    it("returns only games inside the requested date range", function () {
        const results = harness.repository.getForDateRange(
            "2026-04-10",
            "2026-05-01",
            new Set([
                harness.playerId
            ])
        )

        const result = results.find(input =>
            input.playerId === harness.playerId
        )

        assert.ok(result)

        assert.equal(result.hitting.games, 1)
        assert.equal(result.hitting.pa, 1)
        assert.equal(result.hitting.ab, 0)
        assert.equal(result.hitting.bb, 1)
        assert.equal(result.hitting.hits, 0)

        assert.equal(result.pitching.games, 1)
        assert.equal(result.pitching.starts, 0)
        assert.equal(result.pitching.battersFaced, 1)
        assert.equal(result.pitching.bbAllowed, 1)

        assert.equal(result.running.sb, 0)
        assert.equal(result.running.cs, 1)
        assert.equal(result.running.sbAttempts, 1)

        assert.equal(result.splits.hitting.vsR.pa, 1)
        assert.equal(result.splits.hitting.vsL.pa, 0)
    })

    it("returns the most recent requested number of appearances", function () {
        const results = harness.repository.getLastAppearances(
            "2026-05-01",
            1,
            new Set([
                harness.playerId
            ])
        )

        const result = results.find(input =>
            input.playerId === harness.playerId
        )

        assert.ok(result)

        assert.equal(result.hitting.games, 1)
        assert.equal(result.hitting.pa, 1)
        assert.equal(result.hitting.bb, 1)
        assert.equal(result.hitting.hits, 0)

        assert.equal(result.pitching.games, 1)
        assert.equal(result.pitching.starts, 0)

        assert.equal(result.running.sb, 0)
        assert.equal(result.running.cs, 1)
    })

    it("returns all selected players in one bulk query", function () {
        const results = harness.repository.getCareer(
            "2026-05-01"
        )

        assert.equal(
            results.length,
            2
        )

        assert.equal(
            results.find(input => input.playerId === "101")?.hitting.hits,
            1
        )

        assert.equal(
            results.find(input => input.playerId === "202")?.hitting.doubles,
            1
        )
    })

    it("limits bulk results to the requested player IDs", function () {
        const results = harness.repository.getCareer(
            "2026-05-01",
            new Set([
                "202"
            ])
        )

        assert.equal(
            results.length,
            1
        )

        assert.equal(
            results.some(input => input.playerId === "101"),
            false
        )

        assert.equal(
            results.find(input => input.playerId === "202")?.hitting.doubles,
            1
        )
    })

    it("returns no rows when the requested appearance count is zero", function () {
        assert.deepEqual(
            harness.repository.getLastAppearances(
                "2026-05-01",
                0
            ),
            []
        )
    })

    it("returns no rows when the date range is empty", function () {
        assert.deepEqual(
            harness.repository.getForDateRange(
                "2026-05-01",
                "2026-05-01"
            ),
            []
        )
    })

    it("uses pitch coordinates before the legacy zone value", function () {
        harness.database.prepare(`
            UPDATE pitches
            SET
                zone = 5,
                coordinate_p_x = 1.2,
                coordinate_p_z = 2.5,
                strike_zone_top = 3.5,
                strike_zone_bottom = 1.5
            WHERE game_pk = 1
                AND at_bat_index = 0
                AND event_index = 1
        `).run()

        harness.repository.create(1)

        const result = harness.repository.getCareer(
            "2026-04-02",
            new Set([
                harness.playerId
            ])
        ).find(input =>
            input.playerId === harness.playerId
        )

        assert.ok(result)
        assert.equal(result.hitting.swingAtStrikes, 0)
        assert.equal(result.hitting.swingAtBalls, 1)
        assert.equal(result.hitting.inZoneContact, 0)
        assert.equal(result.hitting.outZoneContact, 1)
    })

    it("falls back to the legacy zone when pitch coordinates are unavailable", function () {
        harness.database.prepare(`
            UPDATE pitches
            SET
                coordinate_p_x = NULL,
                coordinate_p_z = NULL,
                strike_zone_top = NULL,
                strike_zone_bottom = NULL
            WHERE game_pk = 1
        `).run()

        harness.repository.create(1)

        const result = harness.repository.getCareer(
            "2026-04-02",
            new Set([
                harness.playerId
            ])
        ).find(input =>
            input.playerId === harness.playerId
        )

        assert.ok(result)
        assert.equal(result.hitting.inZonePitches, 2)
        assert.equal(result.hitting.swingAtStrikes, 1)
        assert.equal(result.hitting.swingAtBalls, 0)
        assert.equal(result.hitting.inZoneContact, 1)
        assert.equal(result.hitting.outZoneContact, 0)
    })

    it("does not classify a pitch as outside the zone when all zone data is unavailable", function () {
        harness.database.prepare(`
            UPDATE pitches
            SET
                zone = NULL,
                coordinate_p_x = NULL,
                coordinate_p_z = NULL,
                strike_zone_top = NULL,
                strike_zone_bottom = NULL
            WHERE game_pk = 1
                AND at_bat_index = 0
                AND event_index = 1
        `).run()

        harness.repository.create(1)

        const result = harness.repository.getCareer(
            "2026-04-02",
            new Set([
                harness.playerId
            ])
        ).find(input =>
            input.playerId === harness.playerId
        )

        assert.ok(result)
        assert.equal(result.hitting.swings, 1)
        assert.equal(result.hitting.swingAtStrikes, 0)
        assert.equal(result.hitting.swingAtBalls, 0)
        assert.equal(result.hitting.inZoneContact, 0)
        assert.equal(result.hitting.outZoneContact, 0)
    })

    it("includes the latest stored appearance when it is before the cutoff", function () {
        const results = harness.repository.getCareer(
            "2026-05-02",
            new Set([
                harness.playerId
            ])
        )

        assert.equal(
            results.length,
            1
        )

        const result = results[0]

        assert.ok(result)

        assert.equal(
            result.hitting.games,
            3
        )

        assert.equal(
            result.hitting.pa,
            3
        )

        assert.equal(
            result.hitting.ab,
            2
        )

        assert.equal(
            result.hitting.hits,
            2
        )

        assert.equal(
            result.hitting.homeRuns,
            1
        )

        assert.deepEqual(
            result.hitting.exitVelocity,
            {
                count: 2,
                totalExitVelo: 205,
                avgExitVelo: 102.5
            }
        )

        assert.equal(
            result.pitching.games,
            3
        )

        assert.equal(
            result.pitching.starts,
            2
        )

        assert.equal(
            result.fielding.outfieldAssists,
            1
        )

        assert.equal(
            result.fielding.gamesAtPosition?.[Position.CENTER_FIELD],
            1
        )

        assert.equal(
            result.splits.hitting.vsR.pa,
            2
        )

        assert.equal(
            result.splits.hitting.vsR.homeRuns,
            1
        )

        assert.equal(
            result.splits.hitting.vsR.exitVelocity,
            105
        )

        assert.equal(
            result.splits.pitching.vsR.battersFaced,
            2
        )

        assert.equal(
            result.splits.pitching.vsR.homeRunsAllowed,
            1
        )

        assert.equal(
            result.splits.pitching.vsR.runsAllowed,
            1
        )

        assert.equal(
            result.splits.pitching.vsR.earnedRunsAllowed,
            1
        )
    })
})

describe("PlayerRatingInputRepository performance diagnostics", function () {

    let harness: PlayerRatingInputRepositoryTestHarness
    let playerIds: Set<string>

    before(function () {
        this.timeout(
            0
        )

        harness = new PlayerRatingInputRepositoryTestHarness(
            false
        )

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

        const plan = harness.database.prepare(`
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
            plan
        )

        const startedAt = Date.now()

        const row = harness.database.prepare(`
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
            `[PERF] Current join raw selection: ${row.count} rows in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            row.count,
            72900
        )
    })

    it("diagnoses getCareer against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        const results = harness.repository.getCareer(
            "2026-01-01",
            playerIds
        )

        console.log(
            `[PERF] Historical-table full getCareer: ${results.length} players in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            results.length,
            1470
        )
    })

    it("diagnoses getForDateRange against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        const results = harness.repository.getForDateRange(
            "2025-01-01",
            "2026-01-01",
            playerIds
        )

        console.log(
            `[PERF] Historical-table full getForDateRange: ${results.length} players in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            results.length,
            1470
        )
    })

    it("diagnoses getLastAppearances against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        const results = harness.repository.getLastAppearances(
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

    it("diagnoses getPlayerIdsForSeason against historical data", function () {
        this.timeout(
            0
        )

        const startedAt = Date.now()

        const results = harness.repository.getPlayerIdsForSeason(
            2025
        )

        console.log(
            `[PERF] Historical-table getPlayerIdsForSeason(2025): ${results.size} players in ${Date.now() - startedAt}ms.`
        )

        assert.equal(
            results.size,
            1470
        )
    })
})


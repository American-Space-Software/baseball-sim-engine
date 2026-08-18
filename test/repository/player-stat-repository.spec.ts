import { strict as assert } from "assert"

import BetterSqlite3 from "better-sqlite3"
import { afterEach, beforeEach, describe, it } from "mocha"

import type { Database } from "better-sqlite3"

import { SchemaService } from "../../src/importer/service/schema-service.js"
import { PlayerStatRepository } from "../../src/ratings/repository/player-stat-repository.js"


class PlayerStatRepositoryTestHarness {

    public readonly hitterId = "101"
    public readonly pitcherId = "201"

    public readonly database: Database
    public readonly repository: PlayerStatRepository

    public constructor() {
        this.database = new BetterSqlite3(":memory:")

        this.database.exec(`
            CREATE TABLE games (
                game_pk INTEGER PRIMARY KEY,
                data TEXT NOT NULL,
                game_date TEXT NOT NULL
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
                event_type TEXT,
                rbi INTEGER NOT NULL,
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
                is_ball INTEGER NOT NULL,
                is_strike INTEGER NOT NULL,
                is_in_play INTEGER NOT NULL,
                zone INTEGER,
                coordinate_p_x REAL,
                coordinate_p_z REAL,
                strike_zone_top REAL,
                strike_zone_bottom REAL,
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
                play_index INTEGER,
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
        `)

        new SchemaService(this.database).load()

        this.repository = new PlayerStatRepository(this.database)

        this.seed()

        this.repository.create(1)
        this.repository.create(2)
        this.repository.create(3)
    }

    public close(): void {
        this.database.close()
    }

    private seed(): void {
        this.insertGame(1, "2025-04-01", 2, 5, 201)
        this.insertGame(2, "2025-04-10", 4, 2, undefined, undefined, 201)
        this.insertGame(3, "2026-05-01", 3, 1, undefined, 201)

        for (const gamePk of [1, 2, 3]) {
            this.insertAppearance(gamePk, 101, 10, true, false, false)
            this.insertAppearance(gamePk, 201, 20, false, true, true)
        }

        this.insertPlateAppearance(1, 0, 101, 201, "home_run", 1)
        this.insertPitch(1, 0, 0, "X", false, true, true, 5, "fly_ball")

        this.insertRunnerMovement({
            gamePk: 1,
            atBatIndex: 0,
            runnerIndex: 0,
            playIndex: 0,
            runnerId: 101,
            responsiblePitcherId: 201,
            eventType: "home_run",
            endBase: "score",
            isOut: 0,
            isScoringEvent: 1,
            earned: 1
        })

        this.insertPlateAppearance(2, 0, 101, 201, "single", 2)
        this.insertPitch(2, 0, 0, "X", false, true, true, 14, "ground_ball")

        this.insertRunnerMovement({
            gamePk: 2,
            atBatIndex: 0,
            runnerIndex: 0,
            playIndex: 0,
            runnerId: 999,
            responsiblePitcherId: 201,
            eventType: "grounded_into_double_play",
            endBase: null,
            isOut: 1,
            isScoringEvent: 0,
            earned: 0
        })

        this.insertRunnerMovement({
            gamePk: 2,
            atBatIndex: 0,
            runnerIndex: 1,
            playIndex: 1,
            runnerId: 101,
            responsiblePitcherId: 201,
            eventType: "stolen_base_2b",
            endBase: "2B",
            isOut: 0,
            isScoringEvent: 0,
            earned: 0
        })

        this.insertFieldingCredit(2, 0, 0, 0, 101, "f_putout", "LF")
        this.insertFieldingCredit(2, 0, 0, 1, 101, "f_assist", "LF")

        this.insertPlateAppearance(3, 0, 101, 201, "walk", 0)

        this.insertPitch(3, 0, 0, "C", false, true, false, 5)
        this.insertPitch(3, 0, 1, "S", false, true, false, 14)
        this.insertPitch(3, 0, 2, "B", true, false, false, 14)

        this.insertRunnerMovement({
            gamePk: 3,
            atBatIndex: 0,
            runnerIndex: 0,
            playIndex: 0,
            runnerId: 101,
            responsiblePitcherId: 201,
            eventType: "caught_stealing_2b",
            endBase: null,
            isOut: 1,
            isScoringEvent: 0,
            earned: 0
        })

        this.insertRunnerMovement({
            gamePk: 3,
            atBatIndex: 0,
            runnerIndex: 1,
            playIndex: 1,
            runnerId: 999,
            responsiblePitcherId: 201,
            eventType: "passed_ball",
            endBase: "2B",
            isOut: 0,
            isScoringEvent: 0,
            earned: 0
        })

        this.insertRunnerMovement({
            gamePk: 3,
            atBatIndex: 0,
            runnerIndex: 2,
            playIndex: 2,
            runnerId: 998,
            responsiblePitcherId: 201,
            eventType: "wild_pitch",
            endBase: "2B",
            isOut: 0,
            isScoringEvent: 0,
            earned: 0
        })

        this.insertFieldingCredit(3, 0, 0, 0, 101, "f_assist", "C")
        this.insertFieldingCredit(3, 0, 1, 0, 101, "f_error", "C")
    }

    private insertGame(gamePk: number, gameDate: string, homeRuns: number, awayRuns: number, winningPitcherId?: number, losingPitcherId?: number, savePitcherId?: number): void {
        this.database.prepare(`
            INSERT INTO games (
                game_pk,
                data,
                game_date
            ) VALUES (
                @gamePk,
                @data,
                @gameDate
            )
        `).run({
            gamePk,
            gameDate,
            data: JSON.stringify({
                gameData: {
                    teams: {
                        home: { id: 10 },
                        away: { id: 20 }
                    }
                },
                liveData: {
                    linescore: {
                        teams: {
                            home: { runs: homeRuns },
                            away: { runs: awayRuns }
                        }
                    },
                    decisions: {
                        winner: winningPitcherId ? { id: winningPitcherId } : undefined,
                        loser: losingPitcherId ? { id: losingPitcherId } : undefined,
                        save: savePitcherId ? { id: savePitcherId } : undefined
                    }
                }
            })
        })
    }

    private insertAppearance(gamePk: number, playerId: number, teamId: number, appearedAsBatter: boolean, appearedAsPitcher: boolean, startedAsPitcher: boolean): void {
        this.database.prepare(`
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
                @teamId,
                @appearedAsBatter,
                @appearedAsPitcher,
                0,
                @appearedAsBatter,
                @appearedAsBatter,
                @startedAsPitcher,
                @appearedAsBatter
            )
        `).run({
            gamePk,
            playerId,
            teamId,
            appearedAsBatter: appearedAsBatter ? 1 : 0,
            appearedAsPitcher: appearedAsPitcher ? 1 : 0,
            startedAsPitcher: startedAsPitcher ? 1 : 0
        })
    }

    private insertPlateAppearance(gamePk: number, atBatIndex: number, batterId: number, pitcherId: number, eventType: string, rbi: number): void {
        this.database.prepare(`
            INSERT INTO plate_appearances (
                game_pk,
                at_bat_index,
                batter_id,
                pitcher_id,
                event_type,
                rbi,
                is_complete
            ) VALUES (
                @gamePk,
                @atBatIndex,
                @batterId,
                @pitcherId,
                @eventType,
                @rbi,
                1
            )
        `).run({ gamePk, atBatIndex, batterId, pitcherId, eventType, rbi })
    }

    private insertPitch(gamePk: number, atBatIndex: number, eventIndex: number, callCode: string, isBall: boolean, isStrike: boolean, isInPlay: boolean, zone: number, trajectory?: string): void {
        this.database.prepare(`
            INSERT INTO pitches (
                game_pk,
                at_bat_index,
                event_index,
                call_code,
                is_ball,
                is_strike,
                is_in_play,
                zone,
                coordinate_p_x,
                coordinate_p_z,
                strike_zone_top,
                strike_zone_bottom,
                trajectory
            ) VALUES (
                @gamePk,
                @atBatIndex,
                @eventIndex,
                @callCode,
                @isBall,
                @isStrike,
                @isInPlay,
                @zone,
                NULL,
                NULL,
                NULL,
                NULL,
                @trajectory
            )
        `).run({
            gamePk,
            atBatIndex,
            eventIndex,
            callCode,
            isBall: isBall ? 1 : 0,
            isStrike: isStrike ? 1 : 0,
            isInPlay: isInPlay ? 1 : 0,
            zone,
            trajectory: trajectory ?? null
        })
    }

    private insertRunnerMovement(input: {
        gamePk: number
        atBatIndex: number
        runnerIndex: number
        playIndex: number
        runnerId: number
        responsiblePitcherId: number
        eventType: string
        endBase: string | null
        isOut: number
        isScoringEvent: number
        earned: number
    }): void {
        this.database.prepare(`
            INSERT INTO runner_movements (
                game_pk,
                at_bat_index,
                runner_index,
                play_index,
                runner_id,
                responsible_pitcher_id,
                event_type,
                end_base,
                is_out,
                is_scoring_event,
                earned
            ) VALUES (
                @gamePk,
                @atBatIndex,
                @runnerIndex,
                @playIndex,
                @runnerId,
                @responsiblePitcherId,
                @eventType,
                @endBase,
                @isOut,
                @isScoringEvent,
                @earned
            )
        `).run(input)
    }

    private insertFieldingCredit(gamePk: number, atBatIndex: number, runnerIndex: number, creditIndex: number, playerId: number, credit: string, positionAbbreviation: string): void {
        this.database.prepare(`
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
                @atBatIndex,
                @runnerIndex,
                @creditIndex,
                @playerId,
                @credit,
                @positionAbbreviation
            )
        `).run({ gamePk, atBatIndex, runnerIndex, creditIndex, playerId, credit, positionAbbreviation })
    }

}


describe("PlayerStatRepository", function () {

    let harness: PlayerStatRepositoryTestHarness

    beforeEach(function () {
        harness = new PlayerStatRepositoryTestHarness()
    })

    afterEach(function () {
        harness?.close()
    })

    it("materializes one row per player appearance", function () {
        const rows = harness.database.prepare(`
            SELECT player_id AS playerId
            FROM player_stats
            WHERE game_pk = 1
            ORDER BY player_id
        `).all() as { playerId: number }[]

        assert.deepEqual(rows.map(row => row.playerId), [101, 201])
    })

    it("materializes hitter counting stats", function () {
        const row = harness.database.prepare(`
            SELECT
                hitting_games AS hittingGames,
                hitting_pa AS hittingPa,
                hitting_ab AS hittingAb,
                hitting_runs AS hittingRuns,
                hitting_hits AS hittingHits,
                hitting_singles AS hittingSingles,
                hitting_doubles AS hittingDoubles,
                hitting_triples AS hittingTriples,
                hitting_home_runs AS hittingHomeRuns,
                hitting_rbi AS hittingRbi,
                hitting_bb AS hittingBb,
                hitting_so AS hittingSo,
                hitting_hbp AS hittingHbp
            FROM player_stats
            WHERE game_pk = 1
                AND player_id = 101
        `).get()

        assert.deepEqual(row, {
            hittingGames: 1,
            hittingPa: 1,
            hittingAb: 1,
            hittingRuns: 1,
            hittingHits: 1,
            hittingSingles: 0,
            hittingDoubles: 0,
            hittingTriples: 0,
            hittingHomeRuns: 1,
            hittingRbi: 1,
            hittingBb: 0,
            hittingSo: 0,
            hittingHbp: 0
        })
    })

    it("materializes hitter team wins and losses", function () {
        const results = harness.repository.getCareer("2027-01-01", new Set([harness.hitterId]))

        assert.equal(results[0]?.hittingTeamWins, 2)
        assert.equal(results[0]?.hittingTeamLosses, 1)
    })

    it("uses the official plate appearance RBI value", function () {
        const row = harness.database.prepare(`
            SELECT hitting_rbi AS hittingRbi
            FROM player_stats
            WHERE game_pk = 2
                AND player_id = 101
        `).get() as { hittingRbi: number }

        assert.equal(row.hittingRbi, 2)
    })

    it("materializes stolen bases, caught stealing, and steal attempts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.hitterId]))[0]

        assert.ok(result)
        assert.equal(result.hittingSb, 1)
        assert.equal(result.hittingCs, 1)
        assert.equal(result.hittingSbAttempts, 2)
    })

    it("materializes hitter pitch counts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.hitterId]))[0]

        assert.ok(result)
        assert.equal(result.hittingPitches, 5)
        assert.equal(result.hittingBalls, 1)
        assert.equal(result.hittingStrikes, 4)
        assert.equal(result.hittingCalledStrikes, 1)
        assert.equal(result.hittingSwingingStrikes, 1)
        assert.equal(result.hittingSwings, 3)
        assert.equal(result.hittingInZone, 2)
        assert.equal(result.hittingSwingAtBalls, 2)
        assert.equal(result.hittingSwingAtStrikes, 1)
        assert.equal(result.hittingInZoneContact, 1)
        assert.equal(result.hittingOutZoneContact, 1)
        assert.equal(result.hittingBallsInPlay, 2)
    })

    it("materializes hitter batted-ball counts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.hitterId]))[0]

        assert.ok(result)
        assert.equal(result.hittingGroundBalls, 1)
        assert.equal(result.hittingFlyBalls, 1)
        assert.equal(result.hittingLineDrives, 0)
        assert.equal(result.hittingPopups, 0)
    })

    it("materializes fielding stats", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.hitterId]))[0]

        assert.ok(result)
        assert.equal(result.hittingPo, 1)
        assert.equal(result.hittingAssists, 2)
        assert.equal(result.hittingOutfieldAssists, 1)
        assert.equal(result.hittingErrors, 1)
        assert.equal(result.hittingPassedBalls, 1)
        assert.equal(result.hittingCsDefense, 1)
        assert.equal(result.hittingDoublePlays, 1)
    })

    it("materializes pitcher counting stats", function () {
        const row = harness.database.prepare(`
            SELECT
                pitching_games AS pitchingGames,
                pitching_starts AS pitchingStarts,
                pitching_wins AS pitchingWins,
                pitching_losses AS pitchingLosses,
                pitching_outs AS pitchingOuts,
                pitching_ab AS pitchingAb,
                pitching_batters_faced AS pitchingBattersFaced,
                pitching_hits AS pitchingHits,
                pitching_singles AS pitchingSingles,
                pitching_doubles AS pitchingDoubles,
                pitching_triples AS pitchingTriples,
                pitching_runs AS pitchingRuns,
                pitching_earned_runs AS pitchingEarnedRuns,
                pitching_home_runs AS pitchingHomeRuns,
                pitching_bb AS pitchingBb,
                pitching_so AS pitchingSo,
                pitching_hbp AS pitchingHbp
            FROM player_stats
            WHERE game_pk = 1
                AND player_id = 201
        `).get()

        assert.deepEqual(row, {
            pitchingGames: 1,
            pitchingStarts: 1,
            pitchingWins: 1,
            pitchingLosses: 0,
            pitchingOuts: 0,
            pitchingAb: 1,
            pitchingBattersFaced: 1,
            pitchingHits: 1,
            pitchingSingles: 0,
            pitchingDoubles: 0,
            pitchingTriples: 0,
            pitchingRuns: 1,
            pitchingEarnedRuns: 1,
            pitchingHomeRuns: 1,
            pitchingBb: 0,
            pitchingSo: 0,
            pitchingHbp: 0
        })
    })

    it("materializes official pitcher decisions and saves", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))[0]

        assert.ok(result)
        assert.equal(result.pitchingWins, 1)
        assert.equal(result.pitchingLosses, 1)
        assert.equal(result.pitchingSaves, 1)
    })

    it("materializes complete games and shutouts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))[0]

        assert.ok(result)
        assert.equal(result.pitchingCg, 3)
        assert.equal(result.pitchingSho, 2)
    })

    it("materializes wild pitches", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))[0]

        assert.ok(result)
        assert.equal(result.pitchingWildPitches, 1)
    })

    it("materializes pitcher pitch counts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))[0]

        assert.ok(result)
        assert.equal(result.pitchingPitches, 5)
        assert.equal(result.pitchingBalls, 1)
        assert.equal(result.pitchingStrikes, 4)
        assert.equal(result.pitchingCalledStrikes, 1)
        assert.equal(result.pitchingSwingingStrikes, 1)
        assert.equal(result.pitchingSwings, 3)
        assert.equal(result.pitchingInZone, 2)
        assert.equal(result.pitchingSwingAtBalls, 2)
        assert.equal(result.pitchingSwingAtStrikes, 1)
        assert.equal(result.pitchingInZoneContact, 1)
        assert.equal(result.pitchingOutZoneContact, 1)
        assert.equal(result.pitchingBallsInPlay, 2)
    })

    it("materializes pitcher batted-ball counts", function () {
        const result = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))[0]

        assert.ok(result)
        assert.equal(result.pitchingGroundBalls, 1)
        assert.equal(result.pitchingFlyBalls, 1)
        assert.equal(result.pitchingLineDrives, 0)
        assert.equal(result.pitchingPopups, 0)
    })

    it("replaces existing materialized stats when a game is created again", function () {
        harness.database.prepare(`
            UPDATE player_stats
            SET hitting_hits = 999
            WHERE game_pk = 1
                AND player_id = 101
        `).run()

        harness.repository.create(1)

        const row = harness.database.prepare(`
            SELECT hitting_hits AS hittingHits
            FROM player_stats
            WHERE game_pk = 1
                AND player_id = 101
        `).get() as { hittingHits: number }

        assert.equal(row.hittingHits, 1)
    })

    it("returns career totals before the exclusive end date", function () {
        const results = harness.repository.getCareer("2026-01-01", new Set([harness.hitterId]))

        assert.equal(results.length, 1)

        const result = results[0]

        assert.ok(result)
        assert.equal(result.hittingGames, 2)
        assert.equal(result.hittingPa, 2)
        assert.equal(result.hittingAb, 2)
        assert.equal(result.hittingHits, 2)
        assert.equal(result.hittingSingles, 1)
        assert.equal(result.hittingHomeRuns, 1)
        assert.equal(result.hittingRuns, 1)
        assert.equal(result.hittingRbi, 3)
        assert.equal(result.hittingSb, 1)
        assert.equal(result.hittingCs, 0)
        assert.equal(result.hittingSbAttempts, 1)
    })

    it("does not include a game on the exclusive cutoff date", function () {
        const results = harness.repository.getCareer("2026-05-01", new Set([harness.hitterId]))

        assert.equal(results.length, 1)
        assert.equal(results[0]?.hittingGames, 2)
        assert.equal(results[0]?.hittingBb, 0)
        assert.equal(results[0]?.hittingCs, 0)
    })

    it("returns hitter season totals in chronological order", function () {
        const results = harness.repository.getSeasons("2027-01-01", new Set([harness.hitterId]))

        assert.equal(results.length, 2)

        assert.equal(results[0]?.season, 2025)
        assert.equal(results[0]?.hittingGames, 2)
        assert.equal(results[0]?.hittingHits, 2)
        assert.equal(results[0]?.hittingRbi, 3)
        assert.equal(results[0]?.hittingSb, 1)

        assert.equal(results[1]?.season, 2026)
        assert.equal(results[1]?.hittingGames, 1)
        assert.equal(results[1]?.hittingPa, 1)
        assert.equal(results[1]?.hittingAb, 0)
        assert.equal(results[1]?.hittingBb, 1)
        assert.equal(results[1]?.hittingCs, 1)
    })

    it("returns pitcher season totals in chronological order", function () {
        const results = harness.repository.getSeasons("2027-01-01", new Set([harness.pitcherId]))

        assert.equal(results.length, 2)

        assert.equal(results[0]?.season, 2025)
        assert.equal(results[0]?.pitchingGames, 2)
        assert.equal(results[0]?.pitchingStarts, 2)
        assert.equal(results[0]?.pitchingWins, 1)
        assert.equal(results[0]?.pitchingLosses, 0)
        assert.equal(results[0]?.pitchingHits, 2)
        assert.equal(results[0]?.pitchingRuns, 1)
        assert.equal(results[0]?.pitchingEarnedRuns, 1)
        assert.equal(results[0]?.pitchingSaves, 1)

        assert.equal(results[1]?.season, 2026)
        assert.equal(results[1]?.pitchingGames, 1)
        assert.equal(results[1]?.pitchingLosses, 1)
        assert.equal(results[1]?.pitchingBb, 1)
        assert.equal(results[1]?.pitchingWildPitches, 1)
    })

    it("returns all players when no player filter is provided", function () {
        const results = harness.repository.getCareer("2027-01-01")

        assert.equal(results.length, 2)
        assert.equal(results.some(row => row.playerId === harness.hitterId), true)
        assert.equal(results.some(row => row.playerId === harness.pitcherId), true)
    })

    it("limits career totals to the requested players", function () {
        const results = harness.repository.getCareer("2027-01-01", new Set([harness.pitcherId]))

        assert.equal(results.length, 1)
        assert.equal(results[0]?.playerId, harness.pitcherId)
    })

    it("returns an empty array for a player with no stats", function () {
        const results = harness.repository.getCareer("2027-01-01", new Set(["9999"]))

        assert.deepEqual(results, [])
    })

    it("deletes materialized stats for a game", function () {
        harness.repository.deleteByGame(2)

        const row = harness.database.prepare(`
            SELECT COUNT(*) AS count
            FROM player_stats
            WHERE game_pk = 2
        `).get() as { count: number }

        assert.equal(row.count, 0)
    })

})
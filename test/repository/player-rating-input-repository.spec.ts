import { strict as assert } from "assert"

import BetterSqlite3 from "better-sqlite3"
import { afterEach, beforeEach, describe, it } from "mocha"

import type { Database } from "better-sqlite3"

import {
    PitchType,
    Position
} from "../../src/sim/service/enums.js"

import { PlayerRatingInputRepository } from "../../src/importer/repository/player-rating-input-repository.js"
import { StatClassificationService } from "../../src/importer/service/stat-classification-service.js"


class PlayerRatingInputRepositoryTestHarness {

    public readonly playerId = "101"
    public readonly database: Database
    public readonly repository: PlayerRatingInputRepository

    public constructor() {
        this.database = new BetterSqlite3(":memory:")

        this.database.exec(`
            CREATE TABLE games (
                game_pk INTEGER PRIMARY KEY,
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
                PRIMARY KEY (game_pk, player_id)
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
                PRIMARY KEY (game_pk, at_bat_index)
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
                pitch_type_code TEXT,
                start_speed REAL,
                break_horizontal REAL,
                break_vertical REAL,
                launch_speed REAL,
                trajectory TEXT,
                PRIMARY KEY (game_pk, at_bat_index, event_index)
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
                PRIMARY KEY (game_pk, at_bat_index, runner_index)
            );

            CREATE TABLE fielding_credits (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                runner_index INTEGER NOT NULL,
                credit_index INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                credit TEXT NOT NULL,
                position_abbreviation TEXT,
                PRIMARY KEY (game_pk, at_bat_index, runner_index, credit_index)
            );

            CREATE TABLE defensive_events (
                game_pk INTEGER NOT NULL,
                at_bat_index INTEGER NOT NULL,
                event_index INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                from_position TEXT,
                to_position TEXT,
                PRIMARY KEY (game_pk, at_bat_index, event_index, player_id)
            );
        `)

        this.repository = new PlayerRatingInputRepository(
            this.database,
            new StatClassificationService()
        )

        this.seed()
    }

    public close(): void {
        this.database.close()
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
        harness.close()
    })

    it("returns an empty map when no players have selected appearances", function () {
        const results = harness.repository.getCareer(
            "2026-06-01",
            new Set([
                "999"
            ])
        )

        assert.equal(
            results.size,
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

        const result = results.get(
            harness.playerId
        )

        assert.ok(result)
        assert.equal(result.playerId, harness.playerId)

        assert.equal(result.hitting.games, 2)
        assert.equal(result.hitting.pa, 2)
        assert.equal(result.hitting.ab, 1)
        assert.equal(result.hitting.hits, 1)
        assert.equal(result.hitting.bb, 1)
        assert.equal(result.hitting.homeRuns, 0)

        assert.equal(result.hitting.pitchesSeen, 3)
        assert.equal(result.hitting.ballsSeen, 1)
        assert.equal(result.hitting.strikesSeen, 2)
        assert.equal(result.hitting.swings, 1)
        assert.equal(result.hitting.swingAtStrikes, 1)
        assert.equal(result.hitting.swingAtBalls, 0)
        assert.equal(result.hitting.calledStrikes, 1)
        assert.equal(result.hitting.inZonePitches, 2)
        assert.equal(result.hitting.inZoneContact, 1)
        assert.equal(result.hitting.ballsInPlay, 1)
        assert.equal(result.hitting.lineDrives, 1)

        assert.deepEqual(result.hitting.exitVelocity, {
            count: 1,
            totalExitVelo: 100,
            avgExitVelo: 100
        })

        assert.equal(result.pitching.games, 2)
        assert.equal(result.pitching.starts, 1)
        assert.equal(result.pitching.battersFaced, 2)
        assert.equal(result.pitching.outs, 1)
        assert.equal(result.pitching.hitsAllowed, 1)
        assert.equal(result.pitching.bbAllowed, 1)
        assert.equal(result.pitching.pitchesThrown, 3)

        assert.deepEqual(result.pitching.pitchTypes?.[PitchType.FF], {
            count: 2,
            totalMph: 192,
            avgMph: 96,
            totalHorizontalBreak: 10,
            avgHorizontalBreak: 5,
            totalVerticalBreak: -22,
            avgVerticalBreak: -11
        })

        assert.deepEqual(result.pitching.pitchTypes?.[PitchType.SL], {
            count: 1,
            totalMph: 86,
            avgMph: 86,
            totalHorizontalBreak: 8,
            avgHorizontalBreak: 8,
            totalVerticalBreak: -3,
            avgVerticalBreak: -3
        })

        assert.equal(result.running.sb, 1)
        assert.equal(result.running.cs, 1)
        assert.equal(result.running.sbAttempts, 2)

        assert.equal(result.fielding.assists, 1)
        assert.equal(result.fielding.putouts, 1)
        assert.equal(result.fielding.gamesAtPosition?.[Position.SHORTSTOP], 1)
        assert.equal(result.fielding.gamesAtPosition?.[Position.CATCHER], 1)

        assert.equal(result.splits.hitting.vsL.pa, 1)
        assert.equal(result.splits.hitting.vsL.hits, 1)
        assert.equal(result.splits.hitting.vsL.exitVelocity, 100)

        assert.equal(result.splits.hitting.vsR.pa, 1)
        assert.equal(result.splits.hitting.vsR.bb, 1)

        assert.equal(result.splits.pitching.vsL.battersFaced, 1)
        assert.equal(result.splits.pitching.vsL.bbAllowed, 1)

        assert.equal(result.splits.pitching.vsR.battersFaced, 1)
        assert.equal(result.splits.pitching.vsR.hitsAllowed, 1)
    })

    it("returns only games inside the requested date range", function () {
        const results = harness.repository.getForDateRange(
            "2026-04-10",
            "2026-05-01",
            new Set([
                harness.playerId
            ])
        )

        const result = results.get(
            harness.playerId
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

        const result = results.get(
            harness.playerId
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
            results.size,
            2
        )

        assert.equal(
            results.get("101")?.hitting.hits,
            1
        )

        assert.equal(
            results.get("202")?.hitting.doubles,
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
            results.size,
            1
        )

        assert.equal(
            results.has("101"),
            false
        )

        assert.equal(
            results.get("202")?.hitting.doubles,
            1
        )
    })

    it("rejects a non-positive last-appearance count", function () {
        assert.throws(
            () => harness.repository.getLastAppearances(
                "2026-05-01",
                0
            ),
            /positive integer/
        )
    })

    it("rejects an invalid date range", function () {
        assert.throws(
            () => harness.repository.getForDateRange(
                "2026-05-01",
                "2026-05-01"
            ),
            /must be before/
        )
    })

    it("includes the latest stored appearance when it is before the cutoff", function () {
        const results = harness.repository.getCareer(
            "2026-05-02",
            new Set([
                harness.playerId
            ])
        )

        const result = results.get(
            harness.playerId
        )

        assert.ok(result)

        assert.equal(result.hitting.games, 3)
        assert.equal(result.hitting.pa, 3)
        assert.equal(result.hitting.ab, 2)
        assert.equal(result.hitting.hits, 2)
        assert.equal(result.hitting.homeRuns, 1)

        assert.deepEqual(result.hitting.exitVelocity, {
            count: 2,
            totalExitVelo: 205,
            avgExitVelo: 102.5
        })

        assert.equal(result.pitching.games, 3)
        assert.equal(result.pitching.starts, 2)

        assert.equal(result.fielding.outfieldAssists, 1)
        assert.equal(result.fielding.gamesAtPosition?.[Position.CENTER_FIELD], 1)

        assert.equal(result.splits.hitting.vsR.pa, 2)
        assert.equal(result.splits.hitting.vsR.homeRuns, 1)
        assert.equal(result.splits.hitting.vsR.exitVelocity, 105)

        assert.equal(result.splits.pitching.vsR.battersFaced, 2)
        assert.equal(result.splits.pitching.vsR.homeRunsAllowed, 1)
        assert.equal(result.splits.pitching.vsR.runsAllowed, 1)
        assert.equal(result.splits.pitching.vsR.earnedRunsAllowed, 1)
    })
})

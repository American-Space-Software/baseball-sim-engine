import type { Database } from "better-sqlite3"

import {
    PitchType,
    Position
} from "../../sim/service/enums.js"

import type {
    PitchTypeMovementStat,
    PlayerFieldingStats,
    PlayerHittingSplitStats,
    PlayerHittingStats,
    PlayerPitchingSplitStats,
    PlayerPitchingStats,
    PlayerRatingInput,
    PlayerRunningStats
} from "../../sim/service/interfaces.js"

import { StatClassificationService } from "../service/stat-classification-service.js"


class PlayerRatingInputRepository {

    public constructor(private readonly database: Database, private readonly statClassificationService: StatClassificationService) {}

    public getCareer(endDateExclusive: string, filterPlayerIds?: Set<string>): Map<string, PlayerRatingInput> {
        const playerFilter = this.getPlayerFilter(filterPlayerIds)

        return this.get(
            `
                SELECT
                    player_appearances.player_id,
                    player_appearances.game_pk
                FROM player_appearances
                INNER JOIN games
                    ON games.game_pk = player_appearances.game_pk
                WHERE games.game_date < @endDateExclusive
                    ${playerFilter.sql}
            `,
            {
                endDateExclusive,
                ...playerFilter.parameters
            }
        )
    }

    public getLastAppearances(endDateExclusive: string, appearanceCount: number, filterPlayerIds?: Set<string>): Map<string, PlayerRatingInput> {
        if (!Number.isInteger(appearanceCount) || appearanceCount <= 0) {
            throw new Error(`Appearance count must be a positive integer: ${appearanceCount}.`)
        }

        const playerFilter = this.getPlayerFilter(filterPlayerIds)

        return this.get(
            `
                SELECT
                    ranked.player_id,
                    ranked.game_pk
                FROM (
                    SELECT
                        player_appearances.player_id,
                        player_appearances.game_pk,
                        ROW_NUMBER() OVER (
                            PARTITION BY player_appearances.player_id
                            ORDER BY
                                games.game_date DESC,
                                player_appearances.game_pk DESC
                        ) AS appearance_number
                    FROM player_appearances
                    INNER JOIN games
                        ON games.game_pk = player_appearances.game_pk
                    WHERE games.game_date < @endDateExclusive
                        ${playerFilter.sql}
                ) ranked
                WHERE ranked.appearance_number <= @appearanceCount
            `,
            {
                endDateExclusive,
                appearanceCount,
                ...playerFilter.parameters
            }
        )
    }

    public getForDateRange(startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>): Map<string, PlayerRatingInput> {
        if (startDate >= endDateExclusive) {
            throw new Error(`Start date ${startDate} must be before end date ${endDateExclusive}.`)
        }

        const playerFilter = this.getPlayerFilter(filterPlayerIds)

        return this.get(
            `
                SELECT
                    player_appearances.player_id,
                    player_appearances.game_pk
                FROM player_appearances
                INNER JOIN games
                    ON games.game_pk = player_appearances.game_pk
                WHERE games.game_date >= @startDate
                    AND games.game_date < @endDateExclusive
                    ${playerFilter.sql}
            `,
            {
                startDate,
                endDateExclusive,
                ...playerFilter.parameters
            }
        )
    }

    public getPlayerIdsForSeason(season: number): Set<string> {
        const startDate = `${season}-01-01`
        const endDateExclusive = `${season + 1}-01-01`

        const rows = this.database.prepare(`
            SELECT DISTINCT
                player_appearances.player_id
            FROM player_appearances
            INNER JOIN games
                ON games.game_pk = player_appearances.game_pk
            WHERE games.game_date >= @startDate
                AND games.game_date < @endDateExclusive
            ORDER BY player_appearances.player_id
        `).all({
            startDate,
            endDateExclusive
        }) as NumericRow[]

        return new Set(
            rows.map(row =>
                String(row.player_id)
            )
        )
    }


    private get(selectedGamesQuery: string, parameters: QueryParameters): Map<string, PlayerRatingInput> {
        const players = this.createPlayers(
            selectedGamesQuery,
            parameters
        )

        if (players.size === 0) {
            return players
        }

        this.loadHitting(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadPitching(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadPitchTypes(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadFielding(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadGamesAtPosition(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadRunning(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadHittingSplits(
            players,
            selectedGamesQuery,
            parameters
        )

        this.loadPitchingSplits(
            players,
            selectedGamesQuery,
            parameters
        )

        return players
    }

    private createPlayers(selectedGamesQuery: string, parameters: QueryParameters): Map<string, PlayerRatingInput> {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            )
            SELECT DISTINCT
                selected_games.player_id
            FROM selected_games
            ORDER BY selected_games.player_id
        `).all(parameters) as NumericRow[]

        const players = new Map<string, PlayerRatingInput>()

        for (const row of rows) {
            const playerId = String(
                row.player_id
            )

            players.set(
                playerId,
                {
                    playerId,
                    hitting: this.emptyHitting(),
                    pitching: this.emptyPitching(),
                    fielding: this.emptyFielding(),
                    running: this.emptyRunning(),
                    splits: {
                        hitting: {
                            vsL: this.emptyHittingSplit(),
                            vsR: this.emptyHittingSplit()
                        },
                        pitching: {
                            vsL: this.emptyPitchingSplit(),
                            vsR: this.emptyPitchingSplit()
                        }
                    }
                }
            )
        }

        return players
    }

    private loadHitting(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            ),
            plate_totals AS (
                SELECT
                    selected_games.player_id,
                    COUNT(DISTINCT plate_appearances.game_pk) AS games,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS pa,
                    SUM(CASE WHEN plate_appearances.event_type IN (${atBatEvents}) THEN 1 ELSE 0 END) AS ab,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.batter_id = selected_games.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY selected_games.player_id
            ),
            pitch_totals AS (
                SELECT
                    selected_games.player_id,
                    COUNT(*) AS pitches_seen,
                    SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls_seen,
                    SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes_seen,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.zone BETWEEN 1 AND 9 THEN 1 ELSE 0 END) AS swing_at_strikes,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND (pitches.zone IS NULL OR pitches.zone NOT BETWEEN 1 AND 9) THEN 1 ELSE 0 END) AS swing_at_balls,
                    SUM(CASE WHEN pitches.call_code = 'C' THEN 1 ELSE 0 END) AS called_strikes,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'W') THEN 1 ELSE 0 END) AS swinging_strikes,
                    SUM(CASE WHEN pitches.zone BETWEEN 1 AND 9 THEN 1 ELSE 0 END) AS in_zone_pitches,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.zone BETWEEN 1 AND 9 THEN 1 ELSE 0 END) AS in_zone_contact,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND (pitches.zone IS NULL OR pitches.zone NOT BETWEEN 1 AND 9) THEN 1 ELSE 0 END) AS out_zone_contact,
                    SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls,
                    SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN pitches.launch_speed ELSE 0 END) AS total_exit_velocity,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN 1 ELSE 0 END) AS exit_velocity_count
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.batter_id = selected_games.player_id
                INNER JOIN pitches
                    ON pitches.game_pk = plate_appearances.game_pk
                    AND pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY selected_games.player_id
            )
            SELECT
                selected_players.player_id,
                COALESCE(plate_totals.games, 0) AS games,
                COALESCE(plate_totals.pa, 0) AS pa,
                COALESCE(plate_totals.ab, 0) AS ab,
                COALESCE(plate_totals.hits, 0) AS hits,
                COALESCE(plate_totals.doubles, 0) AS doubles,
                COALESCE(plate_totals.triples, 0) AS triples,
                COALESCE(plate_totals.home_runs, 0) AS home_runs,
                COALESCE(plate_totals.bb, 0) AS bb,
                COALESCE(plate_totals.so, 0) AS so,
                COALESCE(plate_totals.hbp, 0) AS hbp,
                COALESCE(pitch_totals.pitches_seen, 0) AS pitches_seen,
                COALESCE(pitch_totals.balls_seen, 0) AS balls_seen,
                COALESCE(pitch_totals.strikes_seen, 0) AS strikes_seen,
                COALESCE(pitch_totals.swings, 0) AS swings,
                COALESCE(pitch_totals.swing_at_strikes, 0) AS swing_at_strikes,
                COALESCE(pitch_totals.swing_at_balls, 0) AS swing_at_balls,
                COALESCE(pitch_totals.called_strikes, 0) AS called_strikes,
                COALESCE(pitch_totals.swinging_strikes, 0) AS swinging_strikes,
                COALESCE(pitch_totals.in_zone_pitches, 0) AS in_zone_pitches,
                COALESCE(pitch_totals.in_zone_contact, 0) AS in_zone_contact,
                COALESCE(pitch_totals.out_zone_contact, 0) AS out_zone_contact,
                COALESCE(pitch_totals.fouls, 0) AS fouls,
                COALESCE(pitch_totals.balls_in_play, 0) AS balls_in_play,
                COALESCE(pitch_totals.ground_balls, 0) AS ground_balls,
                COALESCE(pitch_totals.fly_balls, 0) AS fly_balls,
                COALESCE(pitch_totals.line_drives, 0) AS line_drives,
                COALESCE(pitch_totals.popups, 0) AS popups,
                COALESCE(pitch_totals.total_exit_velocity, 0) AS total_exit_velocity,
                COALESCE(pitch_totals.exit_velocity_count, 0) AS exit_velocity_count
            FROM (
                SELECT DISTINCT
                    player_id
                FROM selected_games
            ) selected_players
            LEFT JOIN plate_totals
                ON plate_totals.player_id = selected_players.player_id
            LEFT JOIN pitch_totals
                ON pitch_totals.player_id = selected_players.player_id
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            const exitVelocityCount = this.getNumber(row, "exit_velocity_count")
            const totalExitVelocity = this.getNumber(row, "total_exit_velocity")

            player.hitting = {
                games: this.getNumber(row, "games"),
                pa: this.getNumber(row, "pa"),
                ab: this.getNumber(row, "ab"),
                hits: this.getNumber(row, "hits"),
                doubles: this.getNumber(row, "doubles"),
                triples: this.getNumber(row, "triples"),
                homeRuns: this.getNumber(row, "home_runs"),
                bb: this.getNumber(row, "bb"),
                so: this.getNumber(row, "so"),
                hbp: this.getNumber(row, "hbp"),
                groundBalls: this.getNumber(row, "ground_balls"),
                flyBalls: this.getNumber(row, "fly_balls"),
                lineDrives: this.getNumber(row, "line_drives"),
                popups: this.getNumber(row, "popups"),
                pitchesSeen: this.getNumber(row, "pitches_seen"),
                ballsSeen: this.getNumber(row, "balls_seen"),
                strikesSeen: this.getNumber(row, "strikes_seen"),
                swings: this.getNumber(row, "swings"),
                swingAtBalls: this.getNumber(row, "swing_at_balls"),
                swingAtStrikes: this.getNumber(row, "swing_at_strikes"),
                calledStrikes: this.getNumber(row, "called_strikes"),
                swingingStrikes: this.getNumber(row, "swinging_strikes"),
                inZonePitches: this.getNumber(row, "in_zone_pitches"),
                inZoneContact: this.getNumber(row, "in_zone_contact"),
                outZoneContact: this.getNumber(row, "out_zone_contact"),
                fouls: this.getNumber(row, "fouls"),
                ballsInPlay: this.getNumber(row, "balls_in_play"),
                exitVelocity: {
                    count: exitVelocityCount,
                    totalExitVelo: totalExitVelocity,
                    avgExitVelo: exitVelocityCount > 0
                        ? Number((totalExitVelocity / exitVelocityCount).toFixed(3))
                        : 0
                }
            }
        }
    }

    private loadPitching(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            ),
            appearance_totals AS (
                SELECT
                    selected_games.player_id,
                    COUNT(DISTINCT player_appearances.game_pk) AS games,
                    SUM(CASE WHEN player_appearances.started_as_pitcher = 1 THEN 1 ELSE 0 END) AS starts
                FROM selected_games
                INNER JOIN player_appearances
                    ON player_appearances.game_pk = selected_games.game_pk
                    AND player_appearances.player_id = selected_games.player_id
                WHERE player_appearances.appeared_as_pitcher = 1
                GROUP BY selected_games.player_id
            ),
            plate_totals AS (
                SELECT
                    selected_games.player_id,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS batters_faced,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs_allowed,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb_allowed,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp_allowed
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.pitcher_id = selected_games.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY selected_games.player_id
            ),
            out_totals AS (
                SELECT
                    selected_games.player_id,
                    SUM(CASE WHEN runner_movements.is_out = 1 THEN 1 ELSE 0 END) AS outs
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.pitcher_id = selected_games.player_id
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = plate_appearances.game_pk
                    AND runner_movements.at_bat_index = plate_appearances.at_bat_index
                GROUP BY selected_games.player_id
            ),
            pitch_totals AS (
                SELECT
                    selected_games.player_id,
                    COUNT(*) AS pitches_thrown,
                    SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls_thrown,
                    SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes_thrown,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings_induced,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.zone BETWEEN 1 AND 9 THEN 1 ELSE 0 END) AS swing_at_strikes_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND (pitches.zone IS NULL OR pitches.zone NOT BETWEEN 1 AND 9) THEN 1 ELSE 0 END) AS swing_at_balls_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.zone BETWEEN 1 AND 9 THEN 1 ELSE 0 END) AS in_zone_contact_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND (pitches.zone IS NULL OR pitches.zone NOT BETWEEN 1 AND 9) THEN 1 ELSE 0 END) AS out_zone_contact_allowed,
                    SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups_allowed
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.pitcher_id = selected_games.player_id
                INNER JOIN pitches
                    ON pitches.game_pk = plate_appearances.game_pk
                    AND pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY selected_games.player_id
            )
            SELECT
                selected_players.player_id,
                COALESCE(appearance_totals.games, 0) AS games,
                COALESCE(appearance_totals.starts, 0) AS starts,
                COALESCE(plate_totals.batters_faced, 0) AS batters_faced,
                COALESCE(out_totals.outs, 0) AS outs,
                COALESCE(plate_totals.hits_allowed, 0) AS hits_allowed,
                COALESCE(plate_totals.doubles_allowed, 0) AS doubles_allowed,
                COALESCE(plate_totals.triples_allowed, 0) AS triples_allowed,
                COALESCE(plate_totals.home_runs_allowed, 0) AS home_runs_allowed,
                COALESCE(plate_totals.bb_allowed, 0) AS bb_allowed,
                COALESCE(plate_totals.so, 0) AS so,
                COALESCE(plate_totals.hbp_allowed, 0) AS hbp_allowed,
                COALESCE(pitch_totals.ground_balls_allowed, 0) AS ground_balls_allowed,
                COALESCE(pitch_totals.fly_balls_allowed, 0) AS fly_balls_allowed,
                COALESCE(pitch_totals.line_drives_allowed, 0) AS line_drives_allowed,
                COALESCE(pitch_totals.popups_allowed, 0) AS popups_allowed,
                COALESCE(pitch_totals.pitches_thrown, 0) AS pitches_thrown,
                COALESCE(pitch_totals.balls_thrown, 0) AS balls_thrown,
                COALESCE(pitch_totals.strikes_thrown, 0) AS strikes_thrown,
                COALESCE(pitch_totals.swings_induced, 0) AS swings_induced,
                COALESCE(pitch_totals.swing_at_balls_allowed, 0) AS swing_at_balls_allowed,
                COALESCE(pitch_totals.swing_at_strikes_allowed, 0) AS swing_at_strikes_allowed,
                COALESCE(pitch_totals.in_zone_contact_allowed, 0) AS in_zone_contact_allowed,
                COALESCE(pitch_totals.out_zone_contact_allowed, 0) AS out_zone_contact_allowed,
                COALESCE(pitch_totals.fouls_allowed, 0) AS fouls_allowed,
                COALESCE(pitch_totals.balls_in_play_allowed, 0) AS balls_in_play_allowed
            FROM (
                SELECT DISTINCT
                    player_id
                FROM selected_games
            ) selected_players
            LEFT JOIN appearance_totals
                ON appearance_totals.player_id = selected_players.player_id
            LEFT JOIN plate_totals
                ON plate_totals.player_id = selected_players.player_id
            LEFT JOIN out_totals
                ON out_totals.player_id = selected_players.player_id
            LEFT JOIN pitch_totals
                ON pitch_totals.player_id = selected_players.player_id
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            player.pitching = {
                games: this.getNumber(row, "games"),
                starts: this.getNumber(row, "starts"),
                battersFaced: this.getNumber(row, "batters_faced"),
                outs: this.getNumber(row, "outs"),
                hitsAllowed: this.getNumber(row, "hits_allowed"),
                doublesAllowed: this.getNumber(row, "doubles_allowed"),
                triplesAllowed: this.getNumber(row, "triples_allowed"),
                homeRunsAllowed: this.getNumber(row, "home_runs_allowed"),
                bbAllowed: this.getNumber(row, "bb_allowed"),
                so: this.getNumber(row, "so"),
                hbpAllowed: this.getNumber(row, "hbp_allowed"),
                groundBallsAllowed: this.getNumber(row, "ground_balls_allowed"),
                flyBallsAllowed: this.getNumber(row, "fly_balls_allowed"),
                lineDrivesAllowed: this.getNumber(row, "line_drives_allowed"),
                popupsAllowed: this.getNumber(row, "popups_allowed"),
                pitchesThrown: this.getNumber(row, "pitches_thrown"),
                ballsThrown: this.getNumber(row, "balls_thrown"),
                strikesThrown: this.getNumber(row, "strikes_thrown"),
                swingsInduced: this.getNumber(row, "swings_induced"),
                swingAtBallsAllowed: this.getNumber(row, "swing_at_balls_allowed"),
                swingAtStrikesAllowed: this.getNumber(row, "swing_at_strikes_allowed"),
                inZoneContactAllowed: this.getNumber(row, "in_zone_contact_allowed"),
                outZoneContactAllowed: this.getNumber(row, "out_zone_contact_allowed"),
                foulsAllowed: this.getNumber(row, "fouls_allowed"),
                ballsInPlayAllowed: this.getNumber(row, "balls_in_play_allowed"),
                pitchTypes: {}
            }
        }
    }

    private loadPitchTypes(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            )
            SELECT
                selected_games.player_id,
                pitches.pitch_type_code,
                SUM(CASE WHEN pitches.start_speed > 0 THEN 1 ELSE 0 END) AS count,
                SUM(CASE WHEN pitches.start_speed > 0 THEN pitches.start_speed ELSE 0 END) AS total_mph,
                SUM(CASE WHEN pitches.break_horizontal IS NOT NULL THEN pitches.break_horizontal ELSE 0 END) AS total_horizontal_break,
                SUM(CASE WHEN pitches.break_vertical IS NOT NULL THEN pitches.break_vertical ELSE 0 END) AS total_vertical_break
            FROM selected_games
            INNER JOIN plate_appearances
                ON plate_appearances.game_pk = selected_games.game_pk
                AND plate_appearances.pitcher_id = selected_games.player_id
            INNER JOIN pitches
                ON pitches.game_pk = plate_appearances.game_pk
                AND pitches.at_bat_index = plate_appearances.at_bat_index
            WHERE pitches.pitch_type_code IS NOT NULL
                AND pitches.pitch_type_code != ''
            GROUP BY
                selected_games.player_id,
                pitches.pitch_type_code
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            const pitchType = this.statClassificationService.mapPitchType(
                String(
                    row.pitch_type_code ??
                    ""
                )
            )

            if (!player || !pitchType) {
                continue
            }

            const count = this.getNumber(row, "count")
            const totalMph = this.getNumber(row, "total_mph")
            const totalHorizontalBreak = this.getNumber(row, "total_horizontal_break")
            const totalVerticalBreak = this.getNumber(row, "total_vertical_break")

            const pitchTypeStat: PitchTypeMovementStat = {
                count,
                totalMph,
                avgMph: count > 0
                    ? Number((totalMph / count).toFixed(3))
                    : 0,
                totalHorizontalBreak,
                avgHorizontalBreak: count > 0
                    ? Number((totalHorizontalBreak / count).toFixed(3))
                    : 0,
                totalVerticalBreak,
                avgVerticalBreak: count > 0
                    ? Number((totalVerticalBreak / count).toFixed(3))
                    : 0
            }

            player.pitching.pitchTypes ??= {}
            player.pitching.pitchTypes[pitchType] = pitchTypeStat
        }
    }

    private loadFielding(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            )
            SELECT
                selected_games.player_id,
                SUM(CASE WHEN fielding_credits.credit = 'f_error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN fielding_credits.credit = 'f_assist' THEN 1 ELSE 0 END) AS assists,
                SUM(CASE WHEN fielding_credits.credit = 'f_putout' THEN 1 ELSE 0 END) AS putouts,
                COUNT(DISTINCT CASE
                    WHEN fielding_credits.credit = 'f_assist'
                        AND fielding_credits.position_abbreviation IN ('LF', 'CF', 'RF')
                    THEN CAST(fielding_credits.game_pk AS TEXT) || ':' || CAST(fielding_credits.at_bat_index AS TEXT)
                END) AS outfield_assists,
                SUM(CASE
                    WHEN fielding_credits.credit = 'f_assist'
                        AND fielding_credits.position_abbreviation = 'C'
                        AND runner_movements.event_type LIKE 'caught_stealing%'
                    THEN 1
                    ELSE 0
                END) AS catcher_caught_stealing,
                SUM(CASE
                    WHEN fielding_credits.position_abbreviation = 'C'
                        AND runner_movements.event_type IN ('stolen_base_2b', 'stolen_base_3b')
                    THEN 1
                    ELSE 0
                END) AS catcher_stolen_bases_allowed,
                COUNT(DISTINCT CASE
                    WHEN fielding_credits.position_abbreviation = 'C'
                        AND runner_movements.event_type = 'passed_ball'
                    THEN CAST(fielding_credits.game_pk AS TEXT) || ':' || CAST(fielding_credits.at_bat_index AS TEXT)
                END) AS passed_balls,
                COUNT(DISTINCT CASE
                    WHEN runner_movements.event_type IN ('grounded_into_double_play', 'double_play')
                        AND fielding_credits.credit IN ('f_assist', 'f_putout')
                    THEN CAST(fielding_credits.game_pk AS TEXT) || ':' || CAST(fielding_credits.at_bat_index AS TEXT)
                END) AS double_plays
            FROM selected_games
            INNER JOIN fielding_credits
                ON fielding_credits.game_pk = selected_games.game_pk
                AND fielding_credits.player_id = selected_games.player_id
            INNER JOIN runner_movements
                ON runner_movements.game_pk = fielding_credits.game_pk
                AND runner_movements.at_bat_index = fielding_credits.at_bat_index
                AND runner_movements.runner_index = fielding_credits.runner_index
            GROUP BY selected_games.player_id
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            player.fielding = {
                ...player.fielding,
                errors: this.getNumber(row, "errors"),
                assists: this.getNumber(row, "assists"),
                putouts: this.getNumber(row, "putouts"),
                doublePlays: this.getNumber(row, "double_plays"),
                outfieldAssists: this.getNumber(row, "outfield_assists"),
                catcherCaughtStealing: this.getNumber(row, "catcher_caught_stealing"),
                catcherStolenBasesAllowed: this.getNumber(row, "catcher_stolen_bases_allowed"),
                passedBalls: this.getNumber(row, "passed_balls")
            }
        }
    }

    private loadGamesAtPosition(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            ),
            position_records AS (
                SELECT
                    selected_games.player_id,
                    defensive_events.game_pk,
                    defensive_events.from_position AS position
                FROM selected_games
                INNER JOIN defensive_events
                    ON defensive_events.game_pk = selected_games.game_pk
                    AND defensive_events.player_id = selected_games.player_id
                WHERE defensive_events.from_position IS NOT NULL
                    AND defensive_events.from_position != ''

                UNION

                SELECT
                    selected_games.player_id,
                    defensive_events.game_pk,
                    defensive_events.to_position AS position
                FROM selected_games
                INNER JOIN defensive_events
                    ON defensive_events.game_pk = selected_games.game_pk
                    AND defensive_events.player_id = selected_games.player_id
                WHERE defensive_events.to_position IS NOT NULL
                    AND defensive_events.to_position != ''

                UNION

                SELECT
                    selected_games.player_id,
                    fielding_credits.game_pk,
                    fielding_credits.position_abbreviation AS position
                FROM selected_games
                INNER JOIN fielding_credits
                    ON fielding_credits.game_pk = selected_games.game_pk
                    AND fielding_credits.player_id = selected_games.player_id
                WHERE fielding_credits.position_abbreviation IS NOT NULL
                    AND fielding_credits.position_abbreviation != ''
            )
            SELECT
                player_id,
                position,
                COUNT(DISTINCT game_pk) AS games
            FROM position_records
            GROUP BY
                player_id,
                position
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            const position = this.statClassificationService.mapPositionAbbreviation(
                String(
                    row.position ??
                    ""
                )
            )

            if (!player || !position) {
                continue
            }

            player.fielding.gamesAtPosition ??= {}
            player.fielding.gamesAtPosition[position] = this.getNumber(
                row,
                "games"
            )
        }
    }

    private loadRunning(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            )
            SELECT
                selected_games.player_id,
                SUM(CASE WHEN runner_movements.event_type IN ('stolen_base_2b', 'stolen_base_3b') THEN 1 ELSE 0 END) AS sb,
                SUM(CASE WHEN runner_movements.event_type IN ('caught_stealing_2b', 'caught_stealing_3b') THEN 1 ELSE 0 END) AS cs,
                SUM(CASE WHEN runner_movements.event_type IN ('stolen_base_2b', 'stolen_base_3b', 'caught_stealing_2b', 'caught_stealing_3b') THEN 1 ELSE 0 END) AS sb_attempts
            FROM selected_games
            INNER JOIN runner_movements
                ON runner_movements.game_pk = selected_games.game_pk
                AND runner_movements.runner_id = selected_games.player_id
            GROUP BY selected_games.player_id
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            player.running = {
                sb: this.getNumber(row, "sb"),
                cs: this.getNumber(row, "cs"),
                sbAttempts: this.getNumber(row, "sb_attempts")
            }
        }
    }

    private loadHittingSplits(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            ),
            plate_totals AS (
                SELECT
                    selected_games.player_id,
                    CASE WHEN plate_appearances.pitch_hand_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS pa,
                    SUM(CASE WHEN plate_appearances.event_type IN (${atBatEvents}) THEN 1 ELSE 0 END) AS ab,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.batter_id = selected_games.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY
                    selected_games.player_id,
                    split
            ),
            exit_velocity AS (
                SELECT
                    selected_games.player_id,
                    CASE WHEN plate_appearances.pitch_hand_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    AVG(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN pitches.launch_speed END) AS exit_velocity
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.batter_id = selected_games.player_id
                INNER JOIN pitches
                    ON pitches.game_pk = plate_appearances.game_pk
                    AND pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY
                    selected_games.player_id,
                    split
            )
            SELECT
                plate_totals.player_id,
                plate_totals.split,
                plate_totals.pa,
                plate_totals.ab,
                plate_totals.hits,
                plate_totals.doubles,
                plate_totals.triples,
                plate_totals.home_runs,
                plate_totals.bb,
                plate_totals.so,
                plate_totals.hbp,
                COALESCE(exit_velocity.exit_velocity, 0) AS exit_velocity
            FROM plate_totals
            LEFT JOIN exit_velocity
                ON exit_velocity.player_id = plate_totals.player_id
                AND exit_velocity.split = plate_totals.split
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            const split: PlayerHittingSplitStats = {
                pa: this.getNumber(row, "pa"),
                ab: this.getNumber(row, "ab"),
                hits: this.getNumber(row, "hits"),
                doubles: this.getNumber(row, "doubles"),
                triples: this.getNumber(row, "triples"),
                homeRuns: this.getNumber(row, "home_runs"),
                bb: this.getNumber(row, "bb"),
                so: this.getNumber(row, "so"),
                hbp: this.getNumber(row, "hbp"),
                exitVelocity: Number(
                    this.getNumber(row, "exit_velocity").toFixed(3)
                )
            }

            if (row.split === "vsL") {
                player.splits.hitting.vsL = split
            } else {
                player.splits.hitting.vsR = split
            }
        }
    }

    private loadPitchingSplits(players: Map<string, PlayerRatingInput>, selectedGamesQuery: string, parameters: QueryParameters): void {
        const rows = this.database.prepare(`
            WITH selected_games AS (
                ${selectedGamesQuery}
            ),
            plate_totals AS (
                SELECT
                    selected_games.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS batters_faced,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs_allowed,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb_allowed,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp_allowed
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.pitcher_id = selected_games.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY
                    selected_games.player_id,
                    split
            ),
            out_totals AS (
                SELECT
                    selected_games.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN runner_movements.is_out = 1 THEN 1 ELSE 0 END) AS outs
                FROM selected_games
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = selected_games.game_pk
                    AND plate_appearances.pitcher_id = selected_games.player_id
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = plate_appearances.game_pk
                    AND runner_movements.at_bat_index = plate_appearances.at_bat_index
                GROUP BY
                    selected_games.player_id,
                    split
            ),
            run_totals AS (
                SELECT
                    selected_games.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN runner_movements.end_base = 'score' OR runner_movements.is_scoring_event = 1 THEN 1 ELSE 0 END) AS runs_allowed,
                    SUM(CASE WHEN (runner_movements.end_base = 'score' OR runner_movements.is_scoring_event = 1) AND runner_movements.earned = 1 THEN 1 ELSE 0 END) AS earned_runs_allowed
                FROM selected_games
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = selected_games.game_pk
                    AND runner_movements.responsible_pitcher_id = selected_games.player_id
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = runner_movements.game_pk
                    AND plate_appearances.at_bat_index = runner_movements.at_bat_index
                    AND plate_appearances.pitcher_id = selected_games.player_id
                GROUP BY
                    selected_games.player_id,
                    split
            )
            SELECT
                plate_totals.player_id,
                plate_totals.split,
                plate_totals.batters_faced,
                COALESCE(out_totals.outs, 0) AS outs,
                COALESCE(run_totals.runs_allowed, 0) AS runs_allowed,
                COALESCE(run_totals.earned_runs_allowed, 0) AS earned_runs_allowed,
                plate_totals.hits_allowed,
                plate_totals.doubles_allowed,
                plate_totals.triples_allowed,
                plate_totals.home_runs_allowed,
                plate_totals.bb_allowed,
                plate_totals.so,
                plate_totals.hbp_allowed
            FROM plate_totals
            LEFT JOIN out_totals
                ON out_totals.player_id = plate_totals.player_id
                AND out_totals.split = plate_totals.split
            LEFT JOIN run_totals
                ON run_totals.player_id = plate_totals.player_id
                AND run_totals.split = plate_totals.split
        `).all(parameters) as NumericRow[]

        for (const row of rows) {
            const player = players.get(
                String(row.player_id)
            )

            if (!player) {
                continue
            }

            const split: PlayerPitchingSplitStats = {
                battersFaced: this.getNumber(row, "batters_faced"),
                outs: this.getNumber(row, "outs"),
                runsAllowed: this.getNumber(row, "runs_allowed"),
                earnedRunsAllowed: this.getNumber(row, "earned_runs_allowed"),
                hitsAllowed: this.getNumber(row, "hits_allowed"),
                doublesAllowed: this.getNumber(row, "doubles_allowed"),
                triplesAllowed: this.getNumber(row, "triples_allowed"),
                homeRunsAllowed: this.getNumber(row, "home_runs_allowed"),
                bbAllowed: this.getNumber(row, "bb_allowed"),
                so: this.getNumber(row, "so"),
                hbpAllowed: this.getNumber(row, "hbp_allowed")
            }

            if (row.split === "vsL") {
                player.splits.pitching.vsL = split
            } else {
                player.splits.pitching.vsR = split
            }
        }
    }

    private getPlayerFilter(filterPlayerIds?: Set<string>): PlayerFilter {
        if (!filterPlayerIds || filterPlayerIds.size === 0) {
            return {
                sql: "",
                parameters: {}
            }
        }

        const playerIds = Array.from(filterPlayerIds)
            .map(playerId => Number(playerId))
            .filter(playerId =>
                Number.isSafeInteger(playerId) &&
                playerId > 0
            )

        if (playerIds.length !== filterPlayerIds.size) {
            throw new Error(
                "Player rating input filters must contain positive numeric player IDs."
            )
        }

        const placeholders = playerIds.map((_, index) =>
            `@filterPlayerId${index}`
        )

        const parameters: QueryParameters = {}

        for (let index = 0; index < playerIds.length; index++) {
            parameters[`filterPlayerId${index}`] = playerIds[index]
        }

        return {
            sql: `AND player_appearances.player_id IN (${placeholders.join(", ")})`,
            parameters
        }
    }

    private emptyHitting(): PlayerHittingStats {
        return {
            games: 0,
            pa: 0,
            ab: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            bb: 0,
            so: 0,
            hbp: 0,
            groundBalls: 0,
            flyBalls: 0,
            lineDrives: 0,
            popups: 0,
            pitchesSeen: 0,
            ballsSeen: 0,
            strikesSeen: 0,
            swings: 0,
            swingAtBalls: 0,
            swingAtStrikes: 0,
            calledStrikes: 0,
            swingingStrikes: 0,
            inZonePitches: 0,
            inZoneContact: 0,
            outZoneContact: 0,
            fouls: 0,
            ballsInPlay: 0,
            exitVelocity: {
                count: 0,
                totalExitVelo: 0,
                avgExitVelo: 0
            }
        }
    }

    private emptyPitching(): PlayerPitchingStats {
        return {
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
        }
    }

    private emptyFielding(): PlayerFieldingStats {
        return {
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
        }
    }

    private emptyRunning(): PlayerRunningStats {
        return {
            sb: 0,
            cs: 0,
            sbAttempts: 0
        }
    }

    private emptyHittingSplit(): PlayerHittingSplitStats {
        return {
            pa: 0,
            ab: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            bb: 0,
            so: 0,
            hbp: 0,
            exitVelocity: 0
        }
    }

    private emptyPitchingSplit(): PlayerPitchingSplitStats {
        return {
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

    private getNumber(row: NumericRow, key: string): number {
        const value = Number(
            row[key] ??
            0
        )

        return Number.isFinite(value)
            ? value
            : 0
    }
}


type QueryParameters = Record<string, string | number>

interface NumericRow {
    [key: string]: string | number | null | undefined
}

interface PlayerFilter {
    sql: string
    parameters: QueryParameters
}


const plateAppearanceEvents = `
    'single',
    'double',
    'triple',
    'home_run',
    'walk',
    'intent_walk',
    'hit_by_pitch',
    'strikeout',
    'strikeout_double_play',
    'field_out',
    'force_out',
    'grounded_into_double_play',
    'double_play',
    'fielders_choice',
    'field_error',
    'sac_fly',
    'sac_bunt',
    'fielders_choice_out',
    'other_out'
`

const atBatEvents = `
    'single',
    'double',
    'triple',
    'home_run',
    'strikeout',
    'strikeout_double_play',
    'field_out',
    'force_out',
    'grounded_into_double_play',
    'double_play',
    'fielders_choice',
    'field_error',
    'fielders_choice_out',
    'other_out'
`


export {
    PlayerRatingInputRepository
}

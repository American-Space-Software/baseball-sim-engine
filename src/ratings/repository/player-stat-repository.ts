import type {
    Database,
    Statement
} from "better-sqlite3"


interface PlayerStatRow {
    gamePk?: number
    playerId: string
    gameDate?: string
    gameType?: string
    season?: number

    hittingTeamWins: number
    hittingTeamLosses: number
    hittingGames: number
    hittingPa: number
    hittingAb: number
    hittingRuns: number
    hittingHits: number
    hittingSingles: number
    hittingDoubles: number
    hittingTriples: number
    hittingHomeRuns: number
    hittingRbi: number
    hittingBb: number
    hittingSo: number
    hittingHbp: number
    hittingGidp: number
    hittingSacFlys: number

    hittingPo: number
    hittingAssists: number
    hittingOutfieldAssists: number
    hittingErrors: number
    hittingPassedBalls: number
    hittingCsDefense: number
    hittingDoublePlays: number

    hittingSb: number
    hittingSbAttempts: number
    hittingCs: number

    hittingPitches: number
    hittingBalls: number
    hittingStrikes: number
    hittingCalledStrikes: number
    hittingSwingingStrikes: number
    hittingSwings: number
    hittingFouls: number
    hittingInZone: number
    hittingSwingAtBalls: number
    hittingSwingAtStrikes: number
    hittingInZoneContact: number
    hittingOutZoneContact: number
    hittingBallsInPlay: number
    hittingGroundBalls: number
    hittingFlyBalls: number
    hittingLineDrives: number
    hittingPopups: number

    pitchingGames: number
    pitchingStarts: number
    pitchingWins: number
    pitchingLosses: number
    pitchingCg: number
    pitchingSho: number
    pitchingSaves: number
    pitchingOuts: number
    pitchingAb: number
    pitchingBattersFaced: number
    pitchingHits: number
    pitchingSingles: number
    pitchingDoubles: number
    pitchingTriples: number
    pitchingRuns: number
    pitchingEarnedRuns: number
    pitchingHomeRuns: number
    pitchingBb: number
    pitchingSo: number
    pitchingHbp: number
    pitchingSacFlys: number
    pitchingWildPitches: number

    pitchingPitches: number
    pitchingBalls: number
    pitchingStrikes: number
    pitchingCalledStrikes: number
    pitchingSwingingStrikes: number
    pitchingSwings: number
    pitchingFouls: number
    pitchingInZone: number
    pitchingSwingAtBalls: number
    pitchingSwingAtStrikes: number
    pitchingInZoneContact: number
    pitchingOutZoneContact: number
    pitchingBallsInPlay: number
    pitchingGroundBalls: number
    pitchingFlyBalls: number
    pitchingLineDrives: number
    pitchingPopups: number
}


class PlayerStatRepository {

    private readonly createStatement: Statement

    public constructor(private readonly database: Database) {
        this.createStatement = this.database.prepare(createQuery)
    }

    public create(gamePk: number): void {
        this.createStatement.run({ gamePk })
    }

    public getCareer(endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerStatRow[] {
        const parameters: Record<string, string> = { endDateExclusive }
        let playerFilter = ""

        if (filterPlayerIds && filterPlayerIds.size > 0) {
            parameters.playerIds = JSON.stringify(Array.from(filterPlayerIds).map(Number))

            playerFilter = `
                AND player_stats.player_id IN (
                    SELECT CAST(value AS INTEGER)
                    FROM json_each(@playerIds)
                )
            `
        }

        const rows = this.database.prepare(`
            SELECT
                player_stats.player_id AS playerId,
                ${aggregateColumns}
            FROM player_stats
            WHERE player_stats.game_date < @endDateExclusive
                AND player_stats.game_type = 'R'
                ${playerFilter}
            GROUP BY player_stats.player_id
            ORDER BY player_stats.player_id
        `).all(parameters) as PlayerStatRow[]

        return rows.map(row => ({
            ...row,
            playerId: String(row.playerId)
        }))
    }

    public getSeasons(endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerStatRow[] {
        const parameters: Record<string, string> = { endDateExclusive }
        let playerFilter = ""

        if (filterPlayerIds && filterPlayerIds.size > 0) {
            parameters.playerIds = JSON.stringify(Array.from(filterPlayerIds).map(Number))

            playerFilter = `
                AND player_stats.player_id IN (
                    SELECT CAST(value AS INTEGER)
                    FROM json_each(@playerIds)
                )
            `
        }

        const rows = this.database.prepare(`
            SELECT
                player_stats.player_id AS playerId,
                CAST(SUBSTR(player_stats.game_date, 1, 4) AS INTEGER) AS season,
                ${aggregateColumns}
            FROM player_stats
            WHERE player_stats.game_date < @endDateExclusive
                AND player_stats.game_type = 'R'
                ${playerFilter}
            GROUP BY
                player_stats.player_id,
                SUBSTR(player_stats.game_date, 1, 4)
            ORDER BY
                player_stats.player_id,
                season
        `).all(parameters) as PlayerStatRow[]

        return rows.map(row => ({
            ...row,
            playerId: String(row.playerId)
        }))
    }

    public deleteByGame(gamePk: number): void {
        this.database.prepare(`
            DELETE FROM player_stats
            WHERE game_pk = ?
        `).run(gamePk)
    }

}


const aggregateColumns = `
    SUM(player_stats.hitting_team_wins) AS hittingTeamWins,
    SUM(player_stats.hitting_team_losses) AS hittingTeamLosses,
    SUM(player_stats.hitting_games) AS hittingGames,
    SUM(player_stats.hitting_pa) AS hittingPa,
    SUM(player_stats.hitting_ab) AS hittingAb,
    SUM(player_stats.hitting_runs) AS hittingRuns,
    SUM(player_stats.hitting_hits) AS hittingHits,
    SUM(player_stats.hitting_singles) AS hittingSingles,
    SUM(player_stats.hitting_doubles) AS hittingDoubles,
    SUM(player_stats.hitting_triples) AS hittingTriples,
    SUM(player_stats.hitting_home_runs) AS hittingHomeRuns,
    SUM(player_stats.hitting_rbi) AS hittingRbi,
    SUM(player_stats.hitting_bb) AS hittingBb,
    SUM(player_stats.hitting_so) AS hittingSo,
    SUM(player_stats.hitting_hbp) AS hittingHbp,
    SUM(player_stats.hitting_gidp) AS hittingGidp,
    SUM(player_stats.hitting_sac_flys) AS hittingSacFlys,

    SUM(player_stats.hitting_po) AS hittingPo,
    SUM(player_stats.hitting_assists) AS hittingAssists,
    SUM(player_stats.hitting_outfield_assists) AS hittingOutfieldAssists,
    SUM(player_stats.hitting_errors) AS hittingErrors,
    SUM(player_stats.hitting_passed_balls) AS hittingPassedBalls,
    SUM(player_stats.hitting_cs_defense) AS hittingCsDefense,
    SUM(player_stats.hitting_double_plays) AS hittingDoublePlays,

    SUM(player_stats.hitting_sb) AS hittingSb,
    SUM(player_stats.hitting_sb_attempts) AS hittingSbAttempts,
    SUM(player_stats.hitting_cs) AS hittingCs,

    SUM(player_stats.hitting_pitches) AS hittingPitches,
    SUM(player_stats.hitting_balls) AS hittingBalls,
    SUM(player_stats.hitting_strikes) AS hittingStrikes,
    SUM(player_stats.hitting_called_strikes) AS hittingCalledStrikes,
    SUM(player_stats.hitting_swinging_strikes) AS hittingSwingingStrikes,
    SUM(player_stats.hitting_swings) AS hittingSwings,
    SUM(player_stats.hitting_fouls) AS hittingFouls,
    SUM(player_stats.hitting_in_zone) AS hittingInZone,
    SUM(player_stats.hitting_swing_at_balls) AS hittingSwingAtBalls,
    SUM(player_stats.hitting_swing_at_strikes) AS hittingSwingAtStrikes,
    SUM(player_stats.hitting_in_zone_contact) AS hittingInZoneContact,
    SUM(player_stats.hitting_out_zone_contact) AS hittingOutZoneContact,
    SUM(player_stats.hitting_balls_in_play) AS hittingBallsInPlay,
    SUM(player_stats.hitting_ground_balls) AS hittingGroundBalls,
    SUM(player_stats.hitting_fly_balls) AS hittingFlyBalls,
    SUM(player_stats.hitting_line_drives) AS hittingLineDrives,
    SUM(player_stats.hitting_popups) AS hittingPopups,

    SUM(player_stats.pitching_games) AS pitchingGames,
    SUM(player_stats.pitching_starts) AS pitchingStarts,
    SUM(player_stats.pitching_wins) AS pitchingWins,
    SUM(player_stats.pitching_losses) AS pitchingLosses,
    SUM(player_stats.pitching_cg) AS pitchingCg,
    SUM(player_stats.pitching_sho) AS pitchingSho,
    SUM(player_stats.pitching_saves) AS pitchingSaves,
    SUM(player_stats.pitching_outs) AS pitchingOuts,
    SUM(player_stats.pitching_ab) AS pitchingAb,
    SUM(player_stats.pitching_batters_faced) AS pitchingBattersFaced,
    SUM(player_stats.pitching_hits) AS pitchingHits,
    SUM(player_stats.pitching_singles) AS pitchingSingles,
    SUM(player_stats.pitching_doubles) AS pitchingDoubles,
    SUM(player_stats.pitching_triples) AS pitchingTriples,
    SUM(player_stats.pitching_runs) AS pitchingRuns,
    SUM(player_stats.pitching_earned_runs) AS pitchingEarnedRuns,
    SUM(player_stats.pitching_home_runs) AS pitchingHomeRuns,
    SUM(player_stats.pitching_bb) AS pitchingBb,
    SUM(player_stats.pitching_so) AS pitchingSo,
    SUM(player_stats.pitching_hbp) AS pitchingHbp,
    SUM(player_stats.pitching_sac_flys) AS pitchingSacFlys,
    SUM(player_stats.pitching_wild_pitches) AS pitchingWildPitches,

    SUM(player_stats.pitching_pitches) AS pitchingPitches,
    SUM(player_stats.pitching_balls) AS pitchingBalls,
    SUM(player_stats.pitching_strikes) AS pitchingStrikes,
    SUM(player_stats.pitching_called_strikes) AS pitchingCalledStrikes,
    SUM(player_stats.pitching_swinging_strikes) AS pitchingSwingingStrikes,
    SUM(player_stats.pitching_swings) AS pitchingSwings,
    SUM(player_stats.pitching_fouls) AS pitchingFouls,
    SUM(player_stats.pitching_in_zone) AS pitchingInZone,
    SUM(player_stats.pitching_swing_at_balls) AS pitchingSwingAtBalls,
    SUM(player_stats.pitching_swing_at_strikes) AS pitchingSwingAtStrikes,
    SUM(player_stats.pitching_in_zone_contact) AS pitchingInZoneContact,
    SUM(player_stats.pitching_out_zone_contact) AS pitchingOutZoneContact,
    SUM(player_stats.pitching_balls_in_play) AS pitchingBallsInPlay,
    SUM(player_stats.pitching_ground_balls) AS pitchingGroundBalls,
    SUM(player_stats.pitching_fly_balls) AS pitchingFlyBalls,
    SUM(player_stats.pitching_line_drives) AS pitchingLineDrives,
    SUM(player_stats.pitching_popups) AS pitchingPopups
`


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


const createQuery = `
    WITH
    game_info AS (
        SELECT
            games.game_date,
            games.game_type,
            CAST(json_extract(games.data, '$.gameData.teams.home.id') AS INTEGER) AS home_team_id,
            CAST(json_extract(games.data, '$.gameData.teams.away.id') AS INTEGER) AS away_team_id,
            CAST(json_extract(games.data, '$.liveData.linescore.teams.home.runs') AS INTEGER) AS home_runs,
            CAST(json_extract(games.data, '$.liveData.linescore.teams.away.runs') AS INTEGER) AS away_runs,
            CAST(json_extract(games.data, '$.liveData.decisions.winner.id') AS INTEGER) AS winning_pitcher_id,
            CAST(json_extract(games.data, '$.liveData.decisions.loser.id') AS INTEGER) AS losing_pitcher_id,
            CAST(json_extract(games.data, '$.liveData.decisions.save.id') AS INTEGER) AS save_pitcher_id
        FROM games
        WHERE games.game_pk = @gamePk
    ),
    selected_players AS (
        SELECT DISTINCT
            player_appearances.player_id,
            player_appearances.team_id
        FROM player_appearances
        WHERE player_appearances.game_pk = @gamePk
    ),
    classified_pitches AS (
        SELECT
            pitches.*,
            CASE
                WHEN pitches.coordinate_p_x IS NOT NULL
                    AND pitches.coordinate_p_z IS NOT NULL
                    AND pitches.strike_zone_top IS NOT NULL
                    AND pitches.strike_zone_bottom IS NOT NULL
                THEN CASE
                    WHEN ABS(pitches.coordinate_p_x) <= 0.83
                        AND pitches.coordinate_p_z >= pitches.strike_zone_bottom
                        AND pitches.coordinate_p_z <= pitches.strike_zone_top
                    THEN 1
                    ELSE 0
                END
                WHEN pitches.zone BETWEEN 1 AND 9
                THEN 1
                WHEN pitches.zone IS NOT NULL
                THEN 0
                ELSE NULL
            END AS is_in_zone
        FROM pitches
        WHERE pitches.game_pk = @gamePk
    ),
    hitting AS (
        SELECT
            selected_players.player_id,
            COUNT(DISTINCT plate_appearances.game_pk) AS games,
            SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS pa,
            SUM(CASE WHEN plate_appearances.event_type IN (${atBatEvents}) THEN 1 ELSE 0 END) AS ab,
            SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits,
            SUM(CASE WHEN plate_appearances.event_type = 'single' THEN 1 ELSE 0 END) AS singles,
            SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles,
            SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples,
            SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs,
            SUM(COALESCE(plate_appearances.rbi, 0)) AS rbi,
            SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb,
            SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
            SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp,
            SUM(CASE WHEN plate_appearances.event_type = 'grounded_into_double_play' THEN 1 ELSE 0 END) AS gidp,
            SUM(CASE WHEN plate_appearances.event_type = 'sac_fly' THEN 1 ELSE 0 END) AS sac_flys
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.batter_id = selected_players.player_id
        WHERE plate_appearances.is_complete = 1
        GROUP BY selected_players.player_id
    ),
    hitting_runs AS (
        SELECT
            selected_players.player_id,
            COUNT(*) AS runs
        FROM selected_players
        INNER JOIN runner_movements
            ON runner_movements.game_pk = @gamePk
            AND runner_movements.runner_id = selected_players.player_id
        WHERE runner_movements.end_base = 'score'
            OR runner_movements.is_scoring_event = 1
        GROUP BY selected_players.player_id
    ),
    running AS (
        SELECT
            selected_players.player_id,
            SUM(CASE WHEN runner_movements.event_type LIKE 'stolen_base%' THEN 1 ELSE 0 END) AS sb,
            SUM(CASE WHEN runner_movements.event_type LIKE 'caught_stealing%' THEN 1 ELSE 0 END) AS cs,
            SUM(CASE
                WHEN runner_movements.event_type LIKE 'stolen_base%'
                    OR runner_movements.event_type LIKE 'caught_stealing%'
                THEN 1
                ELSE 0
            END) AS sb_attempts
        FROM selected_players
        INNER JOIN runner_movements
            ON runner_movements.game_pk = @gamePk
            AND runner_movements.runner_id = selected_players.player_id
        GROUP BY selected_players.player_id
    ),
    hitting_pitches AS (
        SELECT
            selected_players.player_id,
            COUNT(*) AS pitches,
            SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls,
            SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes,
            SUM(CASE WHEN pitches.call_code = 'C' THEN 1 ELSE 0 END) AS called_strikes,
            SUM(CASE WHEN pitches.call_code IN ('S', 'W') THEN 1 ELSE 0 END) AS swinging_strikes,
            SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings,
            SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls,
            SUM(CASE WHEN pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone,
            SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS swing_at_balls,
            SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS swing_at_strikes,
            SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone_contact,
            SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS out_zone_contact,
            SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.batter_id = selected_players.player_id
        INNER JOIN classified_pitches pitches
            ON pitches.at_bat_index = plate_appearances.at_bat_index
        GROUP BY selected_players.player_id
    ),
    fielding AS (
        SELECT
            selected_players.player_id,
            SUM(CASE WHEN fielding_credits.credit = 'f_putout' THEN 1 ELSE 0 END) AS po,
            SUM(CASE WHEN fielding_credits.credit = 'f_assist' THEN 1 ELSE 0 END) AS assists,
            SUM(CASE WHEN fielding_credits.credit = 'f_error' THEN 1 ELSE 0 END) AS errors,
            COUNT(DISTINCT CASE
                WHEN fielding_credits.credit = 'f_assist'
                    AND fielding_credits.position_abbreviation IN ('LF', 'CF', 'RF')
                THEN CAST(fielding_credits.at_bat_index AS TEXT) || ':' || CAST(fielding_credits.runner_index AS TEXT)
            END) AS outfield_assists,
            SUM(CASE
                WHEN fielding_credits.credit = 'f_assist'
                    AND fielding_credits.position_abbreviation = 'C'
                    AND runner_movements.event_type LIKE 'caught_stealing%'
                THEN 1
                ELSE 0
            END) AS cs_defense,
            COUNT(DISTINCT CASE
                WHEN fielding_credits.position_abbreviation = 'C'
                    AND runner_movements.event_type = 'passed_ball'
                THEN CAST(fielding_credits.at_bat_index AS TEXT) || ':' || CAST(COALESCE(runner_movements.play_index, runner_movements.runner_index) AS TEXT)
            END) AS passed_balls,
            COUNT(DISTINCT CASE
                WHEN runner_movements.event_type IN ('grounded_into_double_play', 'double_play')
                    AND fielding_credits.credit IN ('f_assist', 'f_putout')
                THEN CAST(fielding_credits.at_bat_index AS TEXT) || ':' || CAST(fielding_credits.player_id AS TEXT)
            END) AS double_plays
        FROM selected_players
        INNER JOIN fielding_credits
            ON fielding_credits.game_pk = @gamePk
            AND fielding_credits.player_id = selected_players.player_id
        INNER JOIN runner_movements
            ON runner_movements.game_pk = fielding_credits.game_pk
            AND runner_movements.at_bat_index = fielding_credits.at_bat_index
            AND runner_movements.runner_index = fielding_credits.runner_index
        GROUP BY selected_players.player_id
    ),
    pitching_appearances AS (
        SELECT
            selected_players.player_id,
            COUNT(DISTINCT player_appearances.game_pk) AS games,
            SUM(CASE WHEN player_appearances.started_as_pitcher = 1 THEN 1 ELSE 0 END) AS starts
        FROM selected_players
        INNER JOIN player_appearances
            ON player_appearances.game_pk = @gamePk
            AND player_appearances.player_id = selected_players.player_id
        WHERE player_appearances.appeared_as_pitcher = 1
        GROUP BY selected_players.player_id
    ),
    team_pitcher_counts AS (
        SELECT
            player_appearances.team_id,
            COUNT(*) AS pitchers
        FROM player_appearances
        WHERE player_appearances.game_pk = @gamePk
            AND player_appearances.appeared_as_pitcher = 1
        GROUP BY player_appearances.team_id
    ),
    pitching AS (
        SELECT
            selected_players.player_id,
            SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS batters_faced,
            SUM(CASE WHEN plate_appearances.event_type IN (${atBatEvents}) THEN 1 ELSE 0 END) AS ab,
            SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits,
            SUM(CASE WHEN plate_appearances.event_type = 'single' THEN 1 ELSE 0 END) AS singles,
            SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles,
            SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples,
            SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs,
            SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb,
            SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
            SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp,
            SUM(CASE WHEN plate_appearances.event_type = 'sac_fly' THEN 1 ELSE 0 END) AS sac_flys
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.pitcher_id = selected_players.player_id
        WHERE plate_appearances.is_complete = 1
        GROUP BY selected_players.player_id
    ),
    pitching_outs AS (
        SELECT
            selected_players.player_id,
            SUM(CASE WHEN runner_movements.is_out = 1 THEN 1 ELSE 0 END) AS outs
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.pitcher_id = selected_players.player_id
        INNER JOIN runner_movements
            ON runner_movements.game_pk = plate_appearances.game_pk
            AND runner_movements.at_bat_index = plate_appearances.at_bat_index
        GROUP BY selected_players.player_id
    ),
    pitching_runs AS (
        SELECT
            selected_players.player_id,
            SUM(CASE
                WHEN runner_movements.end_base = 'score'
                    OR runner_movements.is_scoring_event = 1
                THEN 1
                ELSE 0
            END) AS runs,
            SUM(CASE
                WHEN (runner_movements.end_base = 'score' OR runner_movements.is_scoring_event = 1)
                    AND runner_movements.earned = 1
                THEN 1
                ELSE 0
            END) AS earned_runs
        FROM selected_players
        INNER JOIN runner_movements
            ON runner_movements.game_pk = @gamePk
            AND runner_movements.responsible_pitcher_id = selected_players.player_id
        GROUP BY selected_players.player_id
    ),
    pitching_pitches AS (
        SELECT
            selected_players.player_id,
            COUNT(*) AS pitches,
            SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls,
            SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes,
            SUM(CASE WHEN pitches.call_code = 'C' THEN 1 ELSE 0 END) AS called_strikes,
            SUM(CASE WHEN pitches.call_code IN ('S', 'W') THEN 1 ELSE 0 END) AS swinging_strikes,
            SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings,
            SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls,
            SUM(CASE WHEN pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone,
            SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS swing_at_balls,
            SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS swing_at_strikes,
            SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone_contact,
            SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS out_zone_contact,
            SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives,
            SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.pitcher_id = selected_players.player_id
        INNER JOIN classified_pitches pitches
            ON pitches.at_bat_index = plate_appearances.at_bat_index
        GROUP BY selected_players.player_id
    ),
    pitching_wild_pitches AS (
        SELECT
            selected_players.player_id,
            COUNT(DISTINCT
                CAST(runner_movements.at_bat_index AS TEXT) || ':' ||
                CAST(COALESCE(runner_movements.play_index, runner_movements.runner_index) AS TEXT)
            ) AS wild_pitches
        FROM selected_players
        INNER JOIN plate_appearances
            ON plate_appearances.game_pk = @gamePk
            AND plate_appearances.pitcher_id = selected_players.player_id
        INNER JOIN runner_movements
            ON runner_movements.game_pk = plate_appearances.game_pk
            AND runner_movements.at_bat_index = plate_appearances.at_bat_index
        WHERE runner_movements.event_type = 'wild_pitch'
        GROUP BY selected_players.player_id
    )
    INSERT INTO player_stats (
        game_pk,
        player_id,
        game_date,
        game_type,

        hitting_team_wins,
        hitting_team_losses,
        hitting_games,
        hitting_pa,
        hitting_ab,
        hitting_runs,
        hitting_hits,
        hitting_singles,
        hitting_doubles,
        hitting_triples,
        hitting_home_runs,
        hitting_rbi,
        hitting_bb,
        hitting_so,
        hitting_hbp,
        hitting_gidp,
        hitting_sac_flys,

        hitting_po,
        hitting_assists,
        hitting_outfield_assists,
        hitting_errors,
        hitting_passed_balls,
        hitting_cs_defense,
        hitting_double_plays,

        hitting_sb,
        hitting_sb_attempts,
        hitting_cs,

        hitting_pitches,
        hitting_balls,
        hitting_strikes,
        hitting_called_strikes,
        hitting_swinging_strikes,
        hitting_swings,
        hitting_fouls,
        hitting_in_zone,
        hitting_swing_at_balls,
        hitting_swing_at_strikes,
        hitting_in_zone_contact,
        hitting_out_zone_contact,
        hitting_balls_in_play,
        hitting_ground_balls,
        hitting_fly_balls,
        hitting_line_drives,
        hitting_popups,

        pitching_games,
        pitching_starts,
        pitching_wins,
        pitching_losses,
        pitching_cg,
        pitching_sho,
        pitching_saves,
        pitching_outs,
        pitching_ab,
        pitching_batters_faced,
        pitching_hits,
        pitching_singles,
        pitching_doubles,
        pitching_triples,
        pitching_runs,
        pitching_earned_runs,
        pitching_home_runs,
        pitching_bb,
        pitching_so,
        pitching_hbp,
        pitching_sac_flys,
        pitching_wild_pitches,

        pitching_pitches,
        pitching_balls,
        pitching_strikes,
        pitching_called_strikes,
        pitching_swinging_strikes,
        pitching_swings,
        pitching_fouls,
        pitching_in_zone,
        pitching_swing_at_balls,
        pitching_swing_at_strikes,
        pitching_in_zone_contact,
        pitching_out_zone_contact,
        pitching_balls_in_play,
        pitching_ground_balls,
        pitching_fly_balls,
        pitching_line_drives,
        pitching_popups
    )
    SELECT
        @gamePk,
        selected_players.player_id,
        game_info.game_date,
        game_info.game_type,

        CASE
            WHEN COALESCE(hitting.games, 0) > 0
                AND (
                    (selected_players.team_id = game_info.home_team_id AND game_info.home_runs > game_info.away_runs)
                    OR
                    (selected_players.team_id = game_info.away_team_id AND game_info.away_runs > game_info.home_runs)
                )
            THEN 1
            ELSE 0
        END,

        CASE
            WHEN COALESCE(hitting.games, 0) > 0
                AND (
                    (selected_players.team_id = game_info.home_team_id AND game_info.home_runs < game_info.away_runs)
                    OR
                    (selected_players.team_id = game_info.away_team_id AND game_info.away_runs < game_info.home_runs)
                )
            THEN 1
            ELSE 0
        END,

        COALESCE(hitting.games, 0),
        COALESCE(hitting.pa, 0),
        COALESCE(hitting.ab, 0),
        COALESCE(hitting_runs.runs, 0),
        COALESCE(hitting.hits, 0),
        COALESCE(hitting.singles, 0),
        COALESCE(hitting.doubles, 0),
        COALESCE(hitting.triples, 0),
        COALESCE(hitting.home_runs, 0),
        COALESCE(hitting.rbi, 0),
        COALESCE(hitting.bb, 0),
        COALESCE(hitting.so, 0),
        COALESCE(hitting.hbp, 0),
        COALESCE(hitting.gidp, 0),
        COALESCE(hitting.sac_flys, 0),

        COALESCE(fielding.po, 0),
        COALESCE(fielding.assists, 0),
        COALESCE(fielding.outfield_assists, 0),
        COALESCE(fielding.errors, 0),
        COALESCE(fielding.passed_balls, 0),
        COALESCE(fielding.cs_defense, 0),
        COALESCE(fielding.double_plays, 0),

        COALESCE(running.sb, 0),
        COALESCE(running.sb_attempts, 0),
        COALESCE(running.cs, 0),

        COALESCE(hitting_pitches.pitches, 0),
        COALESCE(hitting_pitches.balls, 0),
        COALESCE(hitting_pitches.strikes, 0),
        COALESCE(hitting_pitches.called_strikes, 0),
        COALESCE(hitting_pitches.swinging_strikes, 0),
        COALESCE(hitting_pitches.swings, 0),
        COALESCE(hitting_pitches.fouls, 0),
        COALESCE(hitting_pitches.in_zone, 0),
        COALESCE(hitting_pitches.swing_at_balls, 0),
        COALESCE(hitting_pitches.swing_at_strikes, 0),
        COALESCE(hitting_pitches.in_zone_contact, 0),
        COALESCE(hitting_pitches.out_zone_contact, 0),
        COALESCE(hitting_pitches.balls_in_play, 0),
        COALESCE(hitting_pitches.ground_balls, 0),
        COALESCE(hitting_pitches.fly_balls, 0),
        COALESCE(hitting_pitches.line_drives, 0),
        COALESCE(hitting_pitches.popups, 0),

        COALESCE(pitching_appearances.games, 0),
        COALESCE(pitching_appearances.starts, 0),

        CASE WHEN selected_players.player_id = game_info.winning_pitcher_id THEN 1 ELSE 0 END,
        CASE WHEN selected_players.player_id = game_info.losing_pitcher_id THEN 1 ELSE 0 END,

        CASE
            WHEN COALESCE(pitching_appearances.starts, 0) > 0
                AND COALESCE(team_pitcher_counts.pitchers, 0) = 1
            THEN 1
            ELSE 0
        END,

        CASE
            WHEN COALESCE(pitching_appearances.starts, 0) > 0
                AND COALESCE(team_pitcher_counts.pitchers, 0) = 1
                AND COALESCE(pitching_runs.runs, 0) = 0
            THEN 1
            ELSE 0
        END,

        CASE WHEN selected_players.player_id = game_info.save_pitcher_id THEN 1 ELSE 0 END,

        COALESCE(pitching_outs.outs, 0),
        COALESCE(pitching.ab, 0),
        COALESCE(pitching.batters_faced, 0),
        COALESCE(pitching.hits, 0),
        COALESCE(pitching.singles, 0),
        COALESCE(pitching.doubles, 0),
        COALESCE(pitching.triples, 0),
        COALESCE(pitching_runs.runs, 0),
        COALESCE(pitching_runs.earned_runs, 0),
        COALESCE(pitching.home_runs, 0),
        COALESCE(pitching.bb, 0),
        COALESCE(pitching.so, 0),
        COALESCE(pitching.hbp, 0),
        COALESCE(pitching.sac_flys, 0),
        COALESCE(pitching_wild_pitches.wild_pitches, 0),

        COALESCE(pitching_pitches.pitches, 0),
        COALESCE(pitching_pitches.balls, 0),
        COALESCE(pitching_pitches.strikes, 0),
        COALESCE(pitching_pitches.called_strikes, 0),
        COALESCE(pitching_pitches.swinging_strikes, 0),
        COALESCE(pitching_pitches.swings, 0),
        COALESCE(pitching_pitches.fouls, 0),
        COALESCE(pitching_pitches.in_zone, 0),
        COALESCE(pitching_pitches.swing_at_balls, 0),
        COALESCE(pitching_pitches.swing_at_strikes, 0),
        COALESCE(pitching_pitches.in_zone_contact, 0),
        COALESCE(pitching_pitches.out_zone_contact, 0),
        COALESCE(pitching_pitches.balls_in_play, 0),
        COALESCE(pitching_pitches.ground_balls, 0),
        COALESCE(pitching_pitches.fly_balls, 0),
        COALESCE(pitching_pitches.line_drives, 0),
        COALESCE(pitching_pitches.popups, 0)

    FROM selected_players
    CROSS JOIN game_info
    LEFT JOIN hitting ON hitting.player_id = selected_players.player_id
    LEFT JOIN hitting_runs ON hitting_runs.player_id = selected_players.player_id
    LEFT JOIN running ON running.player_id = selected_players.player_id
    LEFT JOIN hitting_pitches ON hitting_pitches.player_id = selected_players.player_id
    LEFT JOIN fielding ON fielding.player_id = selected_players.player_id
    LEFT JOIN pitching_appearances ON pitching_appearances.player_id = selected_players.player_id
    LEFT JOIN team_pitcher_counts ON team_pitcher_counts.team_id = selected_players.team_id
    LEFT JOIN pitching ON pitching.player_id = selected_players.player_id
    LEFT JOIN pitching_outs ON pitching_outs.player_id = selected_players.player_id
    LEFT JOIN pitching_runs ON pitching_runs.player_id = selected_players.player_id
    LEFT JOIN pitching_pitches ON pitching_pitches.player_id = selected_players.player_id
    LEFT JOIN pitching_wild_pitches ON pitching_wild_pitches.player_id = selected_players.player_id

    ON CONFLICT(game_pk, player_id) DO UPDATE SET
        game_date = excluded.game_date,
        game_type = excluded.game_type,

        hitting_team_wins = excluded.hitting_team_wins,
        hitting_team_losses = excluded.hitting_team_losses,
        hitting_games = excluded.hitting_games,
        hitting_pa = excluded.hitting_pa,
        hitting_ab = excluded.hitting_ab,
        hitting_runs = excluded.hitting_runs,
        hitting_hits = excluded.hitting_hits,
        hitting_singles = excluded.hitting_singles,
        hitting_doubles = excluded.hitting_doubles,
        hitting_triples = excluded.hitting_triples,
        hitting_home_runs = excluded.hitting_home_runs,
        hitting_rbi = excluded.hitting_rbi,
        hitting_bb = excluded.hitting_bb,
        hitting_so = excluded.hitting_so,
        hitting_hbp = excluded.hitting_hbp,
        hitting_gidp = excluded.hitting_gidp,
        hitting_sac_flys = excluded.hitting_sac_flys,

        hitting_po = excluded.hitting_po,
        hitting_assists = excluded.hitting_assists,
        hitting_outfield_assists = excluded.hitting_outfield_assists,
        hitting_errors = excluded.hitting_errors,
        hitting_passed_balls = excluded.hitting_passed_balls,
        hitting_cs_defense = excluded.hitting_cs_defense,
        hitting_double_plays = excluded.hitting_double_plays,

        hitting_sb = excluded.hitting_sb,
        hitting_sb_attempts = excluded.hitting_sb_attempts,
        hitting_cs = excluded.hitting_cs,

        hitting_pitches = excluded.hitting_pitches,
        hitting_balls = excluded.hitting_balls,
        hitting_strikes = excluded.hitting_strikes,
        hitting_called_strikes = excluded.hitting_called_strikes,
        hitting_swinging_strikes = excluded.hitting_swinging_strikes,
        hitting_swings = excluded.hitting_swings,
        hitting_fouls = excluded.hitting_fouls,
        hitting_in_zone = excluded.hitting_in_zone,
        hitting_swing_at_balls = excluded.hitting_swing_at_balls,
        hitting_swing_at_strikes = excluded.hitting_swing_at_strikes,
        hitting_in_zone_contact = excluded.hitting_in_zone_contact,
        hitting_out_zone_contact = excluded.hitting_out_zone_contact,
        hitting_balls_in_play = excluded.hitting_balls_in_play,
        hitting_ground_balls = excluded.hitting_ground_balls,
        hitting_fly_balls = excluded.hitting_fly_balls,
        hitting_line_drives = excluded.hitting_line_drives,
        hitting_popups = excluded.hitting_popups,

        pitching_games = excluded.pitching_games,
        pitching_starts = excluded.pitching_starts,
        pitching_wins = excluded.pitching_wins,
        pitching_losses = excluded.pitching_losses,
        pitching_cg = excluded.pitching_cg,
        pitching_sho = excluded.pitching_sho,
        pitching_saves = excluded.pitching_saves,
        pitching_outs = excluded.pitching_outs,
        pitching_ab = excluded.pitching_ab,
        pitching_batters_faced = excluded.pitching_batters_faced,
        pitching_hits = excluded.pitching_hits,
        pitching_singles = excluded.pitching_singles,
        pitching_doubles = excluded.pitching_doubles,
        pitching_triples = excluded.pitching_triples,
        pitching_runs = excluded.pitching_runs,
        pitching_earned_runs = excluded.pitching_earned_runs,
        pitching_home_runs = excluded.pitching_home_runs,
        pitching_bb = excluded.pitching_bb,
        pitching_so = excluded.pitching_so,
        pitching_hbp = excluded.pitching_hbp,
        pitching_sac_flys = excluded.pitching_sac_flys,
        pitching_wild_pitches = excluded.pitching_wild_pitches,

        pitching_pitches = excluded.pitching_pitches,
        pitching_balls = excluded.pitching_balls,
        pitching_strikes = excluded.pitching_strikes,
        pitching_called_strikes = excluded.pitching_called_strikes,
        pitching_swinging_strikes = excluded.pitching_swinging_strikes,
        pitching_swings = excluded.pitching_swings,
        pitching_fouls = excluded.pitching_fouls,
        pitching_in_zone = excluded.pitching_in_zone,
        pitching_swing_at_balls = excluded.pitching_swing_at_balls,
        pitching_swing_at_strikes = excluded.pitching_swing_at_strikes,
        pitching_in_zone_contact = excluded.pitching_in_zone_contact,
        pitching_out_zone_contact = excluded.pitching_out_zone_contact,
        pitching_balls_in_play = excluded.pitching_balls_in_play,
        pitching_ground_balls = excluded.pitching_ground_balls,
        pitching_fly_balls = excluded.pitching_fly_balls,
        pitching_line_drives = excluded.pitching_line_drives,
        pitching_popups = excluded.pitching_popups
`


export {
    PlayerStatRepository
}

export type {
    PlayerStatRow
}
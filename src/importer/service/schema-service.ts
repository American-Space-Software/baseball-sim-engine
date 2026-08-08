import type { Database } from "better-sqlite3"


class SchemaService {

    public constructor(private readonly database: Database) {}

    public load(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS player_rating_inputs (
                game_pk INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                game_date TEXT NOT NULL,

                hitting_games INTEGER NOT NULL,
                hitting_pa INTEGER NOT NULL,
                hitting_ab INTEGER NOT NULL,
                hitting_hits INTEGER NOT NULL,
                hitting_doubles INTEGER NOT NULL,
                hitting_triples INTEGER NOT NULL,
                hitting_home_runs INTEGER NOT NULL,
                hitting_bb INTEGER NOT NULL,
                hitting_so INTEGER NOT NULL,
                hitting_hbp INTEGER NOT NULL,
                hitting_ground_balls INTEGER NOT NULL,
                hitting_fly_balls INTEGER NOT NULL,
                hitting_line_drives INTEGER NOT NULL,
                hitting_popups INTEGER NOT NULL,
                hitting_pitches_seen INTEGER NOT NULL,
                hitting_balls_seen INTEGER NOT NULL,
                hitting_strikes_seen INTEGER NOT NULL,
                hitting_swings INTEGER NOT NULL,
                hitting_swing_at_balls INTEGER NOT NULL,
                hitting_swing_at_strikes INTEGER NOT NULL,
                hitting_called_strikes INTEGER NOT NULL,
                hitting_swinging_strikes INTEGER NOT NULL,
                hitting_in_zone_pitches INTEGER NOT NULL,
                hitting_in_zone_contact INTEGER NOT NULL,
                hitting_out_zone_contact INTEGER NOT NULL,
                hitting_fouls INTEGER NOT NULL,
                hitting_balls_in_play INTEGER NOT NULL,
                hitting_exit_velocity_count REAL NOT NULL,
                hitting_total_exit_velocity REAL NOT NULL,
                pitching_games INTEGER NOT NULL,
                pitching_starts INTEGER NOT NULL,
                pitching_batters_faced INTEGER NOT NULL,
                pitching_outs INTEGER NOT NULL,
                pitching_hits_allowed INTEGER NOT NULL,
                pitching_doubles_allowed INTEGER NOT NULL,
                pitching_triples_allowed INTEGER NOT NULL,
                pitching_home_runs_allowed INTEGER NOT NULL,
                pitching_bb_allowed INTEGER NOT NULL,
                pitching_so INTEGER NOT NULL,
                pitching_hbp_allowed INTEGER NOT NULL,
                pitching_ground_balls_allowed INTEGER NOT NULL,
                pitching_fly_balls_allowed INTEGER NOT NULL,
                pitching_line_drives_allowed INTEGER NOT NULL,
                pitching_popups_allowed INTEGER NOT NULL,
                pitching_pitches_thrown INTEGER NOT NULL,
                pitching_balls_thrown INTEGER NOT NULL,
                pitching_strikes_thrown INTEGER NOT NULL,
                pitching_swings_induced INTEGER NOT NULL,
                pitching_swing_at_balls_allowed INTEGER NOT NULL,
                pitching_swing_at_strikes_allowed INTEGER NOT NULL,
                pitching_in_zone_contact_allowed INTEGER NOT NULL,
                pitching_out_zone_contact_allowed INTEGER NOT NULL,
                pitching_fouls_allowed INTEGER NOT NULL,
                pitching_balls_in_play_allowed INTEGER NOT NULL,
                fielding_errors INTEGER NOT NULL,
                fielding_assists INTEGER NOT NULL,
                fielding_putouts INTEGER NOT NULL,
                fielding_double_plays INTEGER NOT NULL,
                fielding_outfield_assists INTEGER NOT NULL,
                fielding_catcher_caught_stealing INTEGER NOT NULL,
                fielding_catcher_stolen_bases_allowed INTEGER NOT NULL,
                fielding_passed_balls INTEGER NOT NULL,
                running_sb INTEGER NOT NULL,
                running_cs INTEGER NOT NULL,
                running_sb_attempts INTEGER NOT NULL,
                hitting_vs_l_pa INTEGER NOT NULL,
                hitting_vs_l_ab INTEGER NOT NULL,
                hitting_vs_l_hits INTEGER NOT NULL,
                hitting_vs_l_doubles INTEGER NOT NULL,
                hitting_vs_l_triples INTEGER NOT NULL,
                hitting_vs_l_home_runs INTEGER NOT NULL,
                hitting_vs_l_bb INTEGER NOT NULL,
                hitting_vs_l_so INTEGER NOT NULL,
                hitting_vs_l_hbp INTEGER NOT NULL,
                hitting_vs_l_exit_velocity_count REAL NOT NULL,
                hitting_vs_l_total_exit_velocity REAL NOT NULL,
                hitting_vs_r_pa INTEGER NOT NULL,
                hitting_vs_r_ab INTEGER NOT NULL,
                hitting_vs_r_hits INTEGER NOT NULL,
                hitting_vs_r_doubles INTEGER NOT NULL,
                hitting_vs_r_triples INTEGER NOT NULL,
                hitting_vs_r_home_runs INTEGER NOT NULL,
                hitting_vs_r_bb INTEGER NOT NULL,
                hitting_vs_r_so INTEGER NOT NULL,
                hitting_vs_r_hbp INTEGER NOT NULL,
                hitting_vs_r_exit_velocity_count REAL NOT NULL,
                hitting_vs_r_total_exit_velocity REAL NOT NULL,
                pitching_vs_l_batters_faced INTEGER NOT NULL,
                pitching_vs_l_outs INTEGER NOT NULL,
                pitching_vs_l_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_earned_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_hits_allowed INTEGER NOT NULL,
                pitching_vs_l_doubles_allowed INTEGER NOT NULL,
                pitching_vs_l_triples_allowed INTEGER NOT NULL,
                pitching_vs_l_home_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_bb_allowed INTEGER NOT NULL,
                pitching_vs_l_so INTEGER NOT NULL,
                pitching_vs_l_hbp_allowed INTEGER NOT NULL,
                pitching_vs_r_batters_faced INTEGER NOT NULL,
                pitching_vs_r_outs INTEGER NOT NULL,
                pitching_vs_r_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_earned_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_hits_allowed INTEGER NOT NULL,
                pitching_vs_r_doubles_allowed INTEGER NOT NULL,
                pitching_vs_r_triples_allowed INTEGER NOT NULL,
                pitching_vs_r_home_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_bb_allowed INTEGER NOT NULL,
                pitching_vs_r_so INTEGER NOT NULL,
                pitching_vs_r_hbp_allowed INTEGER NOT NULL,
                pitch_types TEXT NOT NULL CHECK (json_valid(pitch_types)),
                games_at_position TEXT NOT NULL CHECK (json_valid(games_at_position)),
                innings_at_position TEXT NOT NULL CHECK (json_valid(innings_at_position)),

                PRIMARY KEY (
                    game_pk,
                    player_id
                ),
                FOREIGN KEY (game_pk)
                    REFERENCES games(game_pk)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_player_rating_inputs_player
                ON player_rating_inputs (
                    player_id,
                    game_pk DESC
                );

            CREATE INDEX IF NOT EXISTS idx_player_rating_inputs_game
                ON player_rating_inputs (
                    game_pk
                );

            CREATE INDEX IF NOT EXISTS idx_player_rating_inputs_player_date
                ON player_rating_inputs (
                    player_id,
                    game_date DESC,
                    game_pk DESC
                );

            CREATE TABLE IF NOT EXISTS player_rating_season_inputs (
                season INTEGER NOT NULL,
                player_id INTEGER NOT NULL,

                hitting_games INTEGER NOT NULL,
                hitting_pa INTEGER NOT NULL,
                hitting_ab INTEGER NOT NULL,
                hitting_hits INTEGER NOT NULL,
                hitting_doubles INTEGER NOT NULL,
                hitting_triples INTEGER NOT NULL,
                hitting_home_runs INTEGER NOT NULL,
                hitting_bb INTEGER NOT NULL,
                hitting_so INTEGER NOT NULL,
                hitting_hbp INTEGER NOT NULL,
                hitting_ground_balls INTEGER NOT NULL,
                hitting_fly_balls INTEGER NOT NULL,
                hitting_line_drives INTEGER NOT NULL,
                hitting_popups INTEGER NOT NULL,
                hitting_pitches_seen INTEGER NOT NULL,
                hitting_balls_seen INTEGER NOT NULL,
                hitting_strikes_seen INTEGER NOT NULL,
                hitting_swings INTEGER NOT NULL,
                hitting_swing_at_balls INTEGER NOT NULL,
                hitting_swing_at_strikes INTEGER NOT NULL,
                hitting_called_strikes INTEGER NOT NULL,
                hitting_swinging_strikes INTEGER NOT NULL,
                hitting_in_zone_pitches INTEGER NOT NULL,
                hitting_in_zone_contact INTEGER NOT NULL,
                hitting_out_zone_contact INTEGER NOT NULL,
                hitting_fouls INTEGER NOT NULL,
                hitting_balls_in_play INTEGER NOT NULL,
                hitting_exit_velocity_count REAL NOT NULL,
                hitting_total_exit_velocity REAL NOT NULL,
                pitching_games INTEGER NOT NULL,
                pitching_starts INTEGER NOT NULL,
                pitching_batters_faced INTEGER NOT NULL,
                pitching_outs INTEGER NOT NULL,
                pitching_hits_allowed INTEGER NOT NULL,
                pitching_doubles_allowed INTEGER NOT NULL,
                pitching_triples_allowed INTEGER NOT NULL,
                pitching_home_runs_allowed INTEGER NOT NULL,
                pitching_bb_allowed INTEGER NOT NULL,
                pitching_so INTEGER NOT NULL,
                pitching_hbp_allowed INTEGER NOT NULL,
                pitching_ground_balls_allowed INTEGER NOT NULL,
                pitching_fly_balls_allowed INTEGER NOT NULL,
                pitching_line_drives_allowed INTEGER NOT NULL,
                pitching_popups_allowed INTEGER NOT NULL,
                pitching_pitches_thrown INTEGER NOT NULL,
                pitching_balls_thrown INTEGER NOT NULL,
                pitching_strikes_thrown INTEGER NOT NULL,
                pitching_swings_induced INTEGER NOT NULL,
                pitching_swing_at_balls_allowed INTEGER NOT NULL,
                pitching_swing_at_strikes_allowed INTEGER NOT NULL,
                pitching_in_zone_contact_allowed INTEGER NOT NULL,
                pitching_out_zone_contact_allowed INTEGER NOT NULL,
                pitching_fouls_allowed INTEGER NOT NULL,
                pitching_balls_in_play_allowed INTEGER NOT NULL,
                fielding_errors INTEGER NOT NULL,
                fielding_assists INTEGER NOT NULL,
                fielding_putouts INTEGER NOT NULL,
                fielding_double_plays INTEGER NOT NULL,
                fielding_outfield_assists INTEGER NOT NULL,
                fielding_catcher_caught_stealing INTEGER NOT NULL,
                fielding_catcher_stolen_bases_allowed INTEGER NOT NULL,
                fielding_passed_balls INTEGER NOT NULL,
                running_sb INTEGER NOT NULL,
                running_cs INTEGER NOT NULL,
                running_sb_attempts INTEGER NOT NULL,
                hitting_vs_l_pa INTEGER NOT NULL,
                hitting_vs_l_ab INTEGER NOT NULL,
                hitting_vs_l_hits INTEGER NOT NULL,
                hitting_vs_l_doubles INTEGER NOT NULL,
                hitting_vs_l_triples INTEGER NOT NULL,
                hitting_vs_l_home_runs INTEGER NOT NULL,
                hitting_vs_l_bb INTEGER NOT NULL,
                hitting_vs_l_so INTEGER NOT NULL,
                hitting_vs_l_hbp INTEGER NOT NULL,
                hitting_vs_l_exit_velocity_count REAL NOT NULL,
                hitting_vs_l_total_exit_velocity REAL NOT NULL,
                hitting_vs_r_pa INTEGER NOT NULL,
                hitting_vs_r_ab INTEGER NOT NULL,
                hitting_vs_r_hits INTEGER NOT NULL,
                hitting_vs_r_doubles INTEGER NOT NULL,
                hitting_vs_r_triples INTEGER NOT NULL,
                hitting_vs_r_home_runs INTEGER NOT NULL,
                hitting_vs_r_bb INTEGER NOT NULL,
                hitting_vs_r_so INTEGER NOT NULL,
                hitting_vs_r_hbp INTEGER NOT NULL,
                hitting_vs_r_exit_velocity_count REAL NOT NULL,
                hitting_vs_r_total_exit_velocity REAL NOT NULL,
                pitching_vs_l_batters_faced INTEGER NOT NULL,
                pitching_vs_l_outs INTEGER NOT NULL,
                pitching_vs_l_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_earned_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_hits_allowed INTEGER NOT NULL,
                pitching_vs_l_doubles_allowed INTEGER NOT NULL,
                pitching_vs_l_triples_allowed INTEGER NOT NULL,
                pitching_vs_l_home_runs_allowed INTEGER NOT NULL,
                pitching_vs_l_bb_allowed INTEGER NOT NULL,
                pitching_vs_l_so INTEGER NOT NULL,
                pitching_vs_l_hbp_allowed INTEGER NOT NULL,
                pitching_vs_r_batters_faced INTEGER NOT NULL,
                pitching_vs_r_outs INTEGER NOT NULL,
                pitching_vs_r_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_earned_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_hits_allowed INTEGER NOT NULL,
                pitching_vs_r_doubles_allowed INTEGER NOT NULL,
                pitching_vs_r_triples_allowed INTEGER NOT NULL,
                pitching_vs_r_home_runs_allowed INTEGER NOT NULL,
                pitching_vs_r_bb_allowed INTEGER NOT NULL,
                pitching_vs_r_so INTEGER NOT NULL,
                pitching_vs_r_hbp_allowed INTEGER NOT NULL,
                pitch_types TEXT NOT NULL CHECK (json_valid(pitch_types)),
                games_at_position TEXT NOT NULL CHECK (json_valid(games_at_position)),
                innings_at_position TEXT NOT NULL CHECK (json_valid(innings_at_position)),

                PRIMARY KEY (
                    season,
                    player_id
                )
            );

            CREATE INDEX IF NOT EXISTS idx_player_rating_season_inputs_player
                ON player_rating_season_inputs (
                    player_id,
                    season
                );
        `)
    }

    public transaction<T>(callback: () => T): T {
        return this.database.transaction(
            callback
        )()
    }

}


export {
    SchemaService
}

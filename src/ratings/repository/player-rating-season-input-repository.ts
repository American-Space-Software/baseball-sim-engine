import type {
    Database,
    Statement
} from "better-sqlite3"

import type {
    PlayerRatingInput,
    PlayerRatingSeasonInput
} from "../../sim/service/interfaces.js"


interface PlayerRatingSeasonInputRow {
    season: number
    playerId: string | number

    hittingGames: number
    hittingPa: number
    hittingAb: number
    hittingHits: number
    hittingDoubles: number
    hittingTriples: number
    hittingHomeRuns: number
    hittingBb: number
    hittingSo: number
    hittingHbp: number
    hittingGroundBalls: number
    hittingFlyBalls: number
    hittingLineDrives: number
    hittingPopups: number
    hittingPitchesSeen: number
    hittingBallsSeen: number
    hittingStrikesSeen: number
    hittingSwings: number
    hittingSwingAtBalls: number
    hittingSwingAtStrikes: number
    hittingCalledStrikes: number
    hittingSwingingStrikes: number
    hittingInZonePitches: number
    hittingInZoneContact: number
    hittingOutZoneContact: number
    hittingFouls: number
    hittingBallsInPlay: number
    hittingExitVelocityCount: number
    hittingTotalExitVelocity: number
    pitchingGames: number
    pitchingStarts: number
    pitchingBattersFaced: number
    pitchingOuts: number
    pitchingHitsAllowed: number
    pitchingDoublesAllowed: number
    pitchingTriplesAllowed: number
    pitchingHomeRunsAllowed: number
    pitchingBbAllowed: number
    pitchingSo: number
    pitchingHbpAllowed: number
    pitchingGroundBallsAllowed: number
    pitchingFlyBallsAllowed: number
    pitchingLineDrivesAllowed: number
    pitchingPopupsAllowed: number
    pitchingPitchesThrown: number
    pitchingBallsThrown: number
    pitchingStrikesThrown: number
    pitchingSwingsInduced: number
    pitchingSwingAtBallsAllowed: number
    pitchingSwingAtStrikesAllowed: number
    pitchingInZoneContactAllowed: number
    pitchingOutZoneContactAllowed: number
    pitchingFoulsAllowed: number
    pitchingBallsInPlayAllowed: number
    fieldingErrors: number
    fieldingAssists: number
    fieldingPutouts: number
    fieldingDoublePlays: number
    fieldingOutfieldAssists: number
    fieldingCatcherCaughtStealing: number
    fieldingCatcherStolenBasesAllowed: number
    fieldingPassedBalls: number
    runningSb: number
    runningCs: number
    runningSbAttempts: number
    hittingVsLPa: number
    hittingVsLAb: number
    hittingVsLHits: number
    hittingVsLDoubles: number
    hittingVsLTriples: number
    hittingVsLHomeRuns: number
    hittingVsLBb: number
    hittingVsLSo: number
    hittingVsLHbp: number
    hittingVsLExitVelocityCount: number
    hittingVsLTotalExitVelocity: number
    hittingVsRPa: number
    hittingVsRAb: number
    hittingVsRHits: number
    hittingVsRDoubles: number
    hittingVsRTriples: number
    hittingVsRHomeRuns: number
    hittingVsRBb: number
    hittingVsRSo: number
    hittingVsRHbp: number
    hittingVsRExitVelocityCount: number
    hittingVsRTotalExitVelocity: number
    pitchingVsLBattersFaced: number
    pitchingVsLOuts: number
    pitchingVsLRunsAllowed: number
    pitchingVsLEarnedRunsAllowed: number
    pitchingVsLHitsAllowed: number
    pitchingVsLDoublesAllowed: number
    pitchingVsLTriplesAllowed: number
    pitchingVsLHomeRunsAllowed: number
    pitchingVsLBbAllowed: number
    pitchingVsLSo: number
    pitchingVsLHbpAllowed: number
    pitchingVsRBattersFaced: number
    pitchingVsROuts: number
    pitchingVsRRunsAllowed: number
    pitchingVsREarnedRunsAllowed: number
    pitchingVsRHitsAllowed: number
    pitchingVsRDoublesAllowed: number
    pitchingVsRTriplesAllowed: number
    pitchingVsRHomeRunsAllowed: number
    pitchingVsRBbAllowed: number
    pitchingVsRSo: number
    pitchingVsRHbpAllowed: number

    pitchTypes: string
    gamesAtPosition: string
    inningsAtPosition: string
}


class PlayerRatingSeasonInputRepository {

    private readonly createStatement: Statement

    public constructor(private readonly database: Database) {
        this.createStatement = this.database.prepare(
            createQuery
        )
    }

    public create(season: number): void {
        this.validateSeason(
            season
        )

        this.createStatement.run({
            season,
            startDate: `${season}-01-01`,
            endDateExclusive: `${season + 1}-01-01`
        })
    }

    public getBySeason(season: number, filterPlayerIds?: Set<string>): PlayerRatingSeasonInput[] {
        this.validateSeason(
            season
        )

        const playerFilter = this.getPlayerFilter(
            filterPlayerIds
        )

        const rows = this.database.prepare(`
            SELECT
                player_rating_season_inputs.season,
                player_rating_season_inputs.player_id AS playerId,
                player_rating_season_inputs.hitting_games AS hittingGames,
                player_rating_season_inputs.hitting_pa AS hittingPa,
                player_rating_season_inputs.hitting_ab AS hittingAb,
                player_rating_season_inputs.hitting_hits AS hittingHits,
                player_rating_season_inputs.hitting_doubles AS hittingDoubles,
                player_rating_season_inputs.hitting_triples AS hittingTriples,
                player_rating_season_inputs.hitting_home_runs AS hittingHomeRuns,
                player_rating_season_inputs.hitting_bb AS hittingBb,
                player_rating_season_inputs.hitting_so AS hittingSo,
                player_rating_season_inputs.hitting_hbp AS hittingHbp,
                player_rating_season_inputs.hitting_ground_balls AS hittingGroundBalls,
                player_rating_season_inputs.hitting_fly_balls AS hittingFlyBalls,
                player_rating_season_inputs.hitting_line_drives AS hittingLineDrives,
                player_rating_season_inputs.hitting_popups AS hittingPopups,
                player_rating_season_inputs.hitting_pitches_seen AS hittingPitchesSeen,
                player_rating_season_inputs.hitting_balls_seen AS hittingBallsSeen,
                player_rating_season_inputs.hitting_strikes_seen AS hittingStrikesSeen,
                player_rating_season_inputs.hitting_swings AS hittingSwings,
                player_rating_season_inputs.hitting_swing_at_balls AS hittingSwingAtBalls,
                player_rating_season_inputs.hitting_swing_at_strikes AS hittingSwingAtStrikes,
                player_rating_season_inputs.hitting_called_strikes AS hittingCalledStrikes,
                player_rating_season_inputs.hitting_swinging_strikes AS hittingSwingingStrikes,
                player_rating_season_inputs.hitting_in_zone_pitches AS hittingInZonePitches,
                player_rating_season_inputs.hitting_in_zone_contact AS hittingInZoneContact,
                player_rating_season_inputs.hitting_out_zone_contact AS hittingOutZoneContact,
                player_rating_season_inputs.hitting_fouls AS hittingFouls,
                player_rating_season_inputs.hitting_balls_in_play AS hittingBallsInPlay,
                player_rating_season_inputs.hitting_exit_velocity_count AS hittingExitVelocityCount,
                player_rating_season_inputs.hitting_total_exit_velocity AS hittingTotalExitVelocity,
                player_rating_season_inputs.pitching_games AS pitchingGames,
                player_rating_season_inputs.pitching_starts AS pitchingStarts,
                player_rating_season_inputs.pitching_batters_faced AS pitchingBattersFaced,
                player_rating_season_inputs.pitching_outs AS pitchingOuts,
                player_rating_season_inputs.pitching_hits_allowed AS pitchingHitsAllowed,
                player_rating_season_inputs.pitching_doubles_allowed AS pitchingDoublesAllowed,
                player_rating_season_inputs.pitching_triples_allowed AS pitchingTriplesAllowed,
                player_rating_season_inputs.pitching_home_runs_allowed AS pitchingHomeRunsAllowed,
                player_rating_season_inputs.pitching_bb_allowed AS pitchingBbAllowed,
                player_rating_season_inputs.pitching_so AS pitchingSo,
                player_rating_season_inputs.pitching_hbp_allowed AS pitchingHbpAllowed,
                player_rating_season_inputs.pitching_ground_balls_allowed AS pitchingGroundBallsAllowed,
                player_rating_season_inputs.pitching_fly_balls_allowed AS pitchingFlyBallsAllowed,
                player_rating_season_inputs.pitching_line_drives_allowed AS pitchingLineDrivesAllowed,
                player_rating_season_inputs.pitching_popups_allowed AS pitchingPopupsAllowed,
                player_rating_season_inputs.pitching_pitches_thrown AS pitchingPitchesThrown,
                player_rating_season_inputs.pitching_balls_thrown AS pitchingBallsThrown,
                player_rating_season_inputs.pitching_strikes_thrown AS pitchingStrikesThrown,
                player_rating_season_inputs.pitching_swings_induced AS pitchingSwingsInduced,
                player_rating_season_inputs.pitching_swing_at_balls_allowed AS pitchingSwingAtBallsAllowed,
                player_rating_season_inputs.pitching_swing_at_strikes_allowed AS pitchingSwingAtStrikesAllowed,
                player_rating_season_inputs.pitching_in_zone_contact_allowed AS pitchingInZoneContactAllowed,
                player_rating_season_inputs.pitching_out_zone_contact_allowed AS pitchingOutZoneContactAllowed,
                player_rating_season_inputs.pitching_fouls_allowed AS pitchingFoulsAllowed,
                player_rating_season_inputs.pitching_balls_in_play_allowed AS pitchingBallsInPlayAllowed,
                player_rating_season_inputs.fielding_errors AS fieldingErrors,
                player_rating_season_inputs.fielding_assists AS fieldingAssists,
                player_rating_season_inputs.fielding_putouts AS fieldingPutouts,
                player_rating_season_inputs.fielding_double_plays AS fieldingDoublePlays,
                player_rating_season_inputs.fielding_outfield_assists AS fieldingOutfieldAssists,
                player_rating_season_inputs.fielding_catcher_caught_stealing AS fieldingCatcherCaughtStealing,
                player_rating_season_inputs.fielding_catcher_stolen_bases_allowed AS fieldingCatcherStolenBasesAllowed,
                player_rating_season_inputs.fielding_passed_balls AS fieldingPassedBalls,
                player_rating_season_inputs.running_sb AS runningSb,
                player_rating_season_inputs.running_cs AS runningCs,
                player_rating_season_inputs.running_sb_attempts AS runningSbAttempts,
                player_rating_season_inputs.hitting_vs_l_pa AS hittingVsLPa,
                player_rating_season_inputs.hitting_vs_l_ab AS hittingVsLAb,
                player_rating_season_inputs.hitting_vs_l_hits AS hittingVsLHits,
                player_rating_season_inputs.hitting_vs_l_doubles AS hittingVsLDoubles,
                player_rating_season_inputs.hitting_vs_l_triples AS hittingVsLTriples,
                player_rating_season_inputs.hitting_vs_l_home_runs AS hittingVsLHomeRuns,
                player_rating_season_inputs.hitting_vs_l_bb AS hittingVsLBb,
                player_rating_season_inputs.hitting_vs_l_so AS hittingVsLSo,
                player_rating_season_inputs.hitting_vs_l_hbp AS hittingVsLHbp,
                player_rating_season_inputs.hitting_vs_l_exit_velocity_count AS hittingVsLExitVelocityCount,
                player_rating_season_inputs.hitting_vs_l_total_exit_velocity AS hittingVsLTotalExitVelocity,
                player_rating_season_inputs.hitting_vs_r_pa AS hittingVsRPa,
                player_rating_season_inputs.hitting_vs_r_ab AS hittingVsRAb,
                player_rating_season_inputs.hitting_vs_r_hits AS hittingVsRHits,
                player_rating_season_inputs.hitting_vs_r_doubles AS hittingVsRDoubles,
                player_rating_season_inputs.hitting_vs_r_triples AS hittingVsRTriples,
                player_rating_season_inputs.hitting_vs_r_home_runs AS hittingVsRHomeRuns,
                player_rating_season_inputs.hitting_vs_r_bb AS hittingVsRBb,
                player_rating_season_inputs.hitting_vs_r_so AS hittingVsRSo,
                player_rating_season_inputs.hitting_vs_r_hbp AS hittingVsRHbp,
                player_rating_season_inputs.hitting_vs_r_exit_velocity_count AS hittingVsRExitVelocityCount,
                player_rating_season_inputs.hitting_vs_r_total_exit_velocity AS hittingVsRTotalExitVelocity,
                player_rating_season_inputs.pitching_vs_l_batters_faced AS pitchingVsLBattersFaced,
                player_rating_season_inputs.pitching_vs_l_outs AS pitchingVsLOuts,
                player_rating_season_inputs.pitching_vs_l_runs_allowed AS pitchingVsLRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_earned_runs_allowed AS pitchingVsLEarnedRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_hits_allowed AS pitchingVsLHitsAllowed,
                player_rating_season_inputs.pitching_vs_l_doubles_allowed AS pitchingVsLDoublesAllowed,
                player_rating_season_inputs.pitching_vs_l_triples_allowed AS pitchingVsLTriplesAllowed,
                player_rating_season_inputs.pitching_vs_l_home_runs_allowed AS pitchingVsLHomeRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_bb_allowed AS pitchingVsLBbAllowed,
                player_rating_season_inputs.pitching_vs_l_so AS pitchingVsLSo,
                player_rating_season_inputs.pitching_vs_l_hbp_allowed AS pitchingVsLHbpAllowed,
                player_rating_season_inputs.pitching_vs_r_batters_faced AS pitchingVsRBattersFaced,
                player_rating_season_inputs.pitching_vs_r_outs AS pitchingVsROuts,
                player_rating_season_inputs.pitching_vs_r_runs_allowed AS pitchingVsRRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_earned_runs_allowed AS pitchingVsREarnedRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_hits_allowed AS pitchingVsRHitsAllowed,
                player_rating_season_inputs.pitching_vs_r_doubles_allowed AS pitchingVsRDoublesAllowed,
                player_rating_season_inputs.pitching_vs_r_triples_allowed AS pitchingVsRTriplesAllowed,
                player_rating_season_inputs.pitching_vs_r_home_runs_allowed AS pitchingVsRHomeRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_bb_allowed AS pitchingVsRBbAllowed,
                player_rating_season_inputs.pitching_vs_r_so AS pitchingVsRSo,
                player_rating_season_inputs.pitching_vs_r_hbp_allowed AS pitchingVsRHbpAllowed,
                player_rating_season_inputs.pitch_types AS pitchTypes,
                player_rating_season_inputs.games_at_position AS gamesAtPosition,
                player_rating_season_inputs.innings_at_position AS inningsAtPosition
            FROM player_rating_season_inputs
            WHERE player_rating_season_inputs.season = @season
                ${playerFilter.sql}
            ORDER BY player_rating_season_inputs.player_id
        `).all({
            season,
            ...playerFilter.parameters
        }) as PlayerRatingSeasonInputRow[]

        return rows.map(row =>
            this.mapRow(
                row
            )
        )
    }

    public getBeforeSeason(season: number, filterPlayerIds?: Set<string>): PlayerRatingSeasonInput[] {
        this.validateSeason(
            season
        )

        const playerFilter = this.getPlayerFilter(
            filterPlayerIds
        )

        const queryStartedAt = Date.now()

        const rows = this.database.prepare(`
            SELECT
                player_rating_season_inputs.season,
                player_rating_season_inputs.player_id AS playerId,
                player_rating_season_inputs.hitting_games AS hittingGames,
                player_rating_season_inputs.hitting_pa AS hittingPa,
                player_rating_season_inputs.hitting_ab AS hittingAb,
                player_rating_season_inputs.hitting_hits AS hittingHits,
                player_rating_season_inputs.hitting_doubles AS hittingDoubles,
                player_rating_season_inputs.hitting_triples AS hittingTriples,
                player_rating_season_inputs.hitting_home_runs AS hittingHomeRuns,
                player_rating_season_inputs.hitting_bb AS hittingBb,
                player_rating_season_inputs.hitting_so AS hittingSo,
                player_rating_season_inputs.hitting_hbp AS hittingHbp,
                player_rating_season_inputs.hitting_ground_balls AS hittingGroundBalls,
                player_rating_season_inputs.hitting_fly_balls AS hittingFlyBalls,
                player_rating_season_inputs.hitting_line_drives AS hittingLineDrives,
                player_rating_season_inputs.hitting_popups AS hittingPopups,
                player_rating_season_inputs.hitting_pitches_seen AS hittingPitchesSeen,
                player_rating_season_inputs.hitting_balls_seen AS hittingBallsSeen,
                player_rating_season_inputs.hitting_strikes_seen AS hittingStrikesSeen,
                player_rating_season_inputs.hitting_swings AS hittingSwings,
                player_rating_season_inputs.hitting_swing_at_balls AS hittingSwingAtBalls,
                player_rating_season_inputs.hitting_swing_at_strikes AS hittingSwingAtStrikes,
                player_rating_season_inputs.hitting_called_strikes AS hittingCalledStrikes,
                player_rating_season_inputs.hitting_swinging_strikes AS hittingSwingingStrikes,
                player_rating_season_inputs.hitting_in_zone_pitches AS hittingInZonePitches,
                player_rating_season_inputs.hitting_in_zone_contact AS hittingInZoneContact,
                player_rating_season_inputs.hitting_out_zone_contact AS hittingOutZoneContact,
                player_rating_season_inputs.hitting_fouls AS hittingFouls,
                player_rating_season_inputs.hitting_balls_in_play AS hittingBallsInPlay,
                player_rating_season_inputs.hitting_exit_velocity_count AS hittingExitVelocityCount,
                player_rating_season_inputs.hitting_total_exit_velocity AS hittingTotalExitVelocity,
                player_rating_season_inputs.pitching_games AS pitchingGames,
                player_rating_season_inputs.pitching_starts AS pitchingStarts,
                player_rating_season_inputs.pitching_batters_faced AS pitchingBattersFaced,
                player_rating_season_inputs.pitching_outs AS pitchingOuts,
                player_rating_season_inputs.pitching_hits_allowed AS pitchingHitsAllowed,
                player_rating_season_inputs.pitching_doubles_allowed AS pitchingDoublesAllowed,
                player_rating_season_inputs.pitching_triples_allowed AS pitchingTriplesAllowed,
                player_rating_season_inputs.pitching_home_runs_allowed AS pitchingHomeRunsAllowed,
                player_rating_season_inputs.pitching_bb_allowed AS pitchingBbAllowed,
                player_rating_season_inputs.pitching_so AS pitchingSo,
                player_rating_season_inputs.pitching_hbp_allowed AS pitchingHbpAllowed,
                player_rating_season_inputs.pitching_ground_balls_allowed AS pitchingGroundBallsAllowed,
                player_rating_season_inputs.pitching_fly_balls_allowed AS pitchingFlyBallsAllowed,
                player_rating_season_inputs.pitching_line_drives_allowed AS pitchingLineDrivesAllowed,
                player_rating_season_inputs.pitching_popups_allowed AS pitchingPopupsAllowed,
                player_rating_season_inputs.pitching_pitches_thrown AS pitchingPitchesThrown,
                player_rating_season_inputs.pitching_balls_thrown AS pitchingBallsThrown,
                player_rating_season_inputs.pitching_strikes_thrown AS pitchingStrikesThrown,
                player_rating_season_inputs.pitching_swings_induced AS pitchingSwingsInduced,
                player_rating_season_inputs.pitching_swing_at_balls_allowed AS pitchingSwingAtBallsAllowed,
                player_rating_season_inputs.pitching_swing_at_strikes_allowed AS pitchingSwingAtStrikesAllowed,
                player_rating_season_inputs.pitching_in_zone_contact_allowed AS pitchingInZoneContactAllowed,
                player_rating_season_inputs.pitching_out_zone_contact_allowed AS pitchingOutZoneContactAllowed,
                player_rating_season_inputs.pitching_fouls_allowed AS pitchingFoulsAllowed,
                player_rating_season_inputs.pitching_balls_in_play_allowed AS pitchingBallsInPlayAllowed,
                player_rating_season_inputs.fielding_errors AS fieldingErrors,
                player_rating_season_inputs.fielding_assists AS fieldingAssists,
                player_rating_season_inputs.fielding_putouts AS fieldingPutouts,
                player_rating_season_inputs.fielding_double_plays AS fieldingDoublePlays,
                player_rating_season_inputs.fielding_outfield_assists AS fieldingOutfieldAssists,
                player_rating_season_inputs.fielding_catcher_caught_stealing AS fieldingCatcherCaughtStealing,
                player_rating_season_inputs.fielding_catcher_stolen_bases_allowed AS fieldingCatcherStolenBasesAllowed,
                player_rating_season_inputs.fielding_passed_balls AS fieldingPassedBalls,
                player_rating_season_inputs.running_sb AS runningSb,
                player_rating_season_inputs.running_cs AS runningCs,
                player_rating_season_inputs.running_sb_attempts AS runningSbAttempts,
                player_rating_season_inputs.hitting_vs_l_pa AS hittingVsLPa,
                player_rating_season_inputs.hitting_vs_l_ab AS hittingVsLAb,
                player_rating_season_inputs.hitting_vs_l_hits AS hittingVsLHits,
                player_rating_season_inputs.hitting_vs_l_doubles AS hittingVsLDoubles,
                player_rating_season_inputs.hitting_vs_l_triples AS hittingVsLTriples,
                player_rating_season_inputs.hitting_vs_l_home_runs AS hittingVsLHomeRuns,
                player_rating_season_inputs.hitting_vs_l_bb AS hittingVsLBb,
                player_rating_season_inputs.hitting_vs_l_so AS hittingVsLSo,
                player_rating_season_inputs.hitting_vs_l_hbp AS hittingVsLHbp,
                player_rating_season_inputs.hitting_vs_l_exit_velocity_count AS hittingVsLExitVelocityCount,
                player_rating_season_inputs.hitting_vs_l_total_exit_velocity AS hittingVsLTotalExitVelocity,
                player_rating_season_inputs.hitting_vs_r_pa AS hittingVsRPa,
                player_rating_season_inputs.hitting_vs_r_ab AS hittingVsRAb,
                player_rating_season_inputs.hitting_vs_r_hits AS hittingVsRHits,
                player_rating_season_inputs.hitting_vs_r_doubles AS hittingVsRDoubles,
                player_rating_season_inputs.hitting_vs_r_triples AS hittingVsRTriples,
                player_rating_season_inputs.hitting_vs_r_home_runs AS hittingVsRHomeRuns,
                player_rating_season_inputs.hitting_vs_r_bb AS hittingVsRBb,
                player_rating_season_inputs.hitting_vs_r_so AS hittingVsRSo,
                player_rating_season_inputs.hitting_vs_r_hbp AS hittingVsRHbp,
                player_rating_season_inputs.hitting_vs_r_exit_velocity_count AS hittingVsRExitVelocityCount,
                player_rating_season_inputs.hitting_vs_r_total_exit_velocity AS hittingVsRTotalExitVelocity,
                player_rating_season_inputs.pitching_vs_l_batters_faced AS pitchingVsLBattersFaced,
                player_rating_season_inputs.pitching_vs_l_outs AS pitchingVsLOuts,
                player_rating_season_inputs.pitching_vs_l_runs_allowed AS pitchingVsLRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_earned_runs_allowed AS pitchingVsLEarnedRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_hits_allowed AS pitchingVsLHitsAllowed,
                player_rating_season_inputs.pitching_vs_l_doubles_allowed AS pitchingVsLDoublesAllowed,
                player_rating_season_inputs.pitching_vs_l_triples_allowed AS pitchingVsLTriplesAllowed,
                player_rating_season_inputs.pitching_vs_l_home_runs_allowed AS pitchingVsLHomeRunsAllowed,
                player_rating_season_inputs.pitching_vs_l_bb_allowed AS pitchingVsLBbAllowed,
                player_rating_season_inputs.pitching_vs_l_so AS pitchingVsLSo,
                player_rating_season_inputs.pitching_vs_l_hbp_allowed AS pitchingVsLHbpAllowed,
                player_rating_season_inputs.pitching_vs_r_batters_faced AS pitchingVsRBattersFaced,
                player_rating_season_inputs.pitching_vs_r_outs AS pitchingVsROuts,
                player_rating_season_inputs.pitching_vs_r_runs_allowed AS pitchingVsRRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_earned_runs_allowed AS pitchingVsREarnedRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_hits_allowed AS pitchingVsRHitsAllowed,
                player_rating_season_inputs.pitching_vs_r_doubles_allowed AS pitchingVsRDoublesAllowed,
                player_rating_season_inputs.pitching_vs_r_triples_allowed AS pitchingVsRTriplesAllowed,
                player_rating_season_inputs.pitching_vs_r_home_runs_allowed AS pitchingVsRHomeRunsAllowed,
                player_rating_season_inputs.pitching_vs_r_bb_allowed AS pitchingVsRBbAllowed,
                player_rating_season_inputs.pitching_vs_r_so AS pitchingVsRSo,
                player_rating_season_inputs.pitching_vs_r_hbp_allowed AS pitchingVsRHbpAllowed,
                player_rating_season_inputs.pitch_types AS pitchTypes,
                player_rating_season_inputs.games_at_position AS gamesAtPosition,
                player_rating_season_inputs.innings_at_position AS inningsAtPosition
            FROM player_rating_season_inputs
            WHERE player_rating_season_inputs.season < @season
                ${playerFilter.sql}
            ORDER BY
                player_rating_season_inputs.player_id,
                player_rating_season_inputs.season
        `).all({
            season,
            ...playerFilter.parameters
        }) as PlayerRatingSeasonInputRow[]

        // console.log(
        //     `Fetched ${rows.length} player season rows in ${Date.now() - queryStartedAt}ms.`
        // )

        const mappingStartedAt = Date.now()

        const results = rows.map(row =>
            this.mapRow(
                row
            )
        )

        // console.log(
        //     `Mapped ${results.length} player season rows in ${Date.now() - mappingStartedAt}ms.`
        // )

        return results
    }

    public deleteBySeason(season: number): void {
        this.validateSeason(
            season
        )

        this.database.prepare(`
            DELETE FROM player_rating_season_inputs
            WHERE season = @season
        `).run({
            season
        })
    }

    private getPlayerFilter(filterPlayerIds?: Set<string>): {
        sql: string
        parameters: Record<string, number>
    } {
        if (!filterPlayerIds || filterPlayerIds.size === 0) {
            return {
                sql: "",
                parameters: {}
            }
        }

        const playerIds = Array.from(
            filterPlayerIds
        ).map(playerId =>
            Number(
                playerId
            )
        )

        if (playerIds.some(playerId =>
            !Number.isSafeInteger(playerId) ||
            playerId <= 0
        )) {
            throw new Error(
                "Player rating season input filters must contain positive numeric player IDs."
            )
        }

        const parameters: Record<string, number> = {}
        const placeholders: string[] = []

        for (let index = 0; index < playerIds.length; index++) {
            const parameterName = `filterPlayerId${index}`

            parameters[parameterName] = playerIds[index]
            placeholders.push(
                `@${parameterName}`
            )
        }

        return {
            sql: `AND player_rating_season_inputs.player_id IN (${placeholders.join(", ")})`,
            parameters
        }
    }

    private mapRow(row: PlayerRatingSeasonInputRow): PlayerRatingSeasonInput {
        return {
            season: row.season,
            playerId: String(
                row.playerId
            ),
            data: this.mapInputRow(
                row
            )
        }
    }

    private mapInputRow(row: PlayerRatingSeasonInputRow): PlayerRatingInput {
        return {
            playerId: String(
                row.playerId
            ),
            hitting: {
                games: row.hittingGames,
                pa: row.hittingPa,
                ab: row.hittingAb,
                hits: row.hittingHits,
                doubles: row.hittingDoubles,
                triples: row.hittingTriples,
                homeRuns: row.hittingHomeRuns,
                bb: row.hittingBb,
                so: row.hittingSo,
                hbp: row.hittingHbp,
                groundBalls: row.hittingGroundBalls,
                flyBalls: row.hittingFlyBalls,
                lineDrives: row.hittingLineDrives,
                popups: row.hittingPopups,
                pitchesSeen: row.hittingPitchesSeen,
                ballsSeen: row.hittingBallsSeen,
                strikesSeen: row.hittingStrikesSeen,
                swings: row.hittingSwings,
                swingAtBalls: row.hittingSwingAtBalls,
                swingAtStrikes: row.hittingSwingAtStrikes,
                calledStrikes: row.hittingCalledStrikes,
                swingingStrikes: row.hittingSwingingStrikes,
                inZonePitches: row.hittingInZonePitches,
                inZoneContact: row.hittingInZoneContact,
                outZoneContact: row.hittingOutZoneContact,
                fouls: row.hittingFouls,
                ballsInPlay: row.hittingBallsInPlay,
                exitVelocity: {
                    count: row.hittingExitVelocityCount,
                    totalExitVelo: row.hittingTotalExitVelocity,
                    avgExitVelo: this.getAverage(
                        row.hittingTotalExitVelocity,
                        row.hittingExitVelocityCount
                    )
                }
            },
            pitching: {
                games: row.pitchingGames,
                starts: row.pitchingStarts,
                battersFaced: row.pitchingBattersFaced,
                outs: row.pitchingOuts,
                hitsAllowed: row.pitchingHitsAllowed,
                doublesAllowed: row.pitchingDoublesAllowed,
                triplesAllowed: row.pitchingTriplesAllowed,
                homeRunsAllowed: row.pitchingHomeRunsAllowed,
                bbAllowed: row.pitchingBbAllowed,
                so: row.pitchingSo,
                hbpAllowed: row.pitchingHbpAllowed,
                groundBallsAllowed: row.pitchingGroundBallsAllowed,
                flyBallsAllowed: row.pitchingFlyBallsAllowed,
                lineDrivesAllowed: row.pitchingLineDrivesAllowed,
                popupsAllowed: row.pitchingPopupsAllowed,
                pitchesThrown: row.pitchingPitchesThrown,
                ballsThrown: row.pitchingBallsThrown,
                strikesThrown: row.pitchingStrikesThrown,
                swingsInduced: row.pitchingSwingsInduced,
                swingAtBallsAllowed: row.pitchingSwingAtBallsAllowed,
                swingAtStrikesAllowed: row.pitchingSwingAtStrikesAllowed,
                inZoneContactAllowed: row.pitchingInZoneContactAllowed,
                outZoneContactAllowed: row.pitchingOutZoneContactAllowed,
                foulsAllowed: row.pitchingFoulsAllowed,
                ballsInPlayAllowed: row.pitchingBallsInPlayAllowed,
                pitchTypes: JSON.parse(
                    row.pitchTypes
                )
            },
            fielding: {
                gamesAtPosition: JSON.parse(
                    row.gamesAtPosition
                ),
                inningsAtPosition: JSON.parse(
                    row.inningsAtPosition
                ),
                errors: row.fieldingErrors,
                assists: row.fieldingAssists,
                putouts: row.fieldingPutouts,
                doublePlays: row.fieldingDoublePlays,
                outfieldAssists: row.fieldingOutfieldAssists,
                catcherCaughtStealing: row.fieldingCatcherCaughtStealing,
                catcherStolenBasesAllowed: row.fieldingCatcherStolenBasesAllowed,
                passedBalls: row.fieldingPassedBalls
            },
            running: {
                sb: row.runningSb,
                cs: row.runningCs,
                sbAttempts: row.runningSbAttempts
            },
            splits: {
                hitting: {
                    vsL: {
                        pa: row.hittingVsLPa,
                        ab: row.hittingVsLAb,
                        hits: row.hittingVsLHits,
                        doubles: row.hittingVsLDoubles,
                        triples: row.hittingVsLTriples,
                        homeRuns: row.hittingVsLHomeRuns,
                        bb: row.hittingVsLBb,
                        so: row.hittingVsLSo,
                        hbp: row.hittingVsLHbp,
                        exitVelocity: this.getAverage(
                            row.hittingVsLTotalExitVelocity,
                            row.hittingVsLExitVelocityCount
                        ),
                        exitVelocityCount: row.hittingVsLExitVelocityCount,
                        totalExitVelocity: row.hittingVsLTotalExitVelocity
                    },
                    vsR: {
                        pa: row.hittingVsRPa,
                        ab: row.hittingVsRAb,
                        hits: row.hittingVsRHits,
                        doubles: row.hittingVsRDoubles,
                        triples: row.hittingVsRTriples,
                        homeRuns: row.hittingVsRHomeRuns,
                        bb: row.hittingVsRBb,
                        so: row.hittingVsRSo,
                        hbp: row.hittingVsRHbp,
                        exitVelocity: this.getAverage(
                            row.hittingVsRTotalExitVelocity,
                            row.hittingVsRExitVelocityCount
                        ),
                        exitVelocityCount: row.hittingVsRExitVelocityCount,
                        totalExitVelocity: row.hittingVsRTotalExitVelocity
                    }
                },
                pitching: {
                    vsL: {
                        battersFaced: row.pitchingVsLBattersFaced,
                        outs: row.pitchingVsLOuts,
                        runsAllowed: row.pitchingVsLRunsAllowed,
                        earnedRunsAllowed: row.pitchingVsLEarnedRunsAllowed,
                        hitsAllowed: row.pitchingVsLHitsAllowed,
                        doublesAllowed: row.pitchingVsLDoublesAllowed,
                        triplesAllowed: row.pitchingVsLTriplesAllowed,
                        homeRunsAllowed: row.pitchingVsLHomeRunsAllowed,
                        bbAllowed: row.pitchingVsLBbAllowed,
                        so: row.pitchingVsLSo,
                        hbpAllowed: row.pitchingVsLHbpAllowed
                    },
                    vsR: {
                        battersFaced: row.pitchingVsRBattersFaced,
                        outs: row.pitchingVsROuts,
                        runsAllowed: row.pitchingVsRRunsAllowed,
                        earnedRunsAllowed: row.pitchingVsREarnedRunsAllowed,
                        hitsAllowed: row.pitchingVsRHitsAllowed,
                        doublesAllowed: row.pitchingVsRDoublesAllowed,
                        triplesAllowed: row.pitchingVsRTriplesAllowed,
                        homeRunsAllowed: row.pitchingVsRHomeRunsAllowed,
                        bbAllowed: row.pitchingVsRBbAllowed,
                        so: row.pitchingVsRSo,
                        hbpAllowed: row.pitchingVsRHbpAllowed
                    }
                }
            }
        }
    }

    private getAverage(total: number, count: number): number {
        if (count <= 0) {
            return 0
        }

        return Number(
            (total / count).toFixed(3)
        )
    }


    private validateSeason(season: number): void {
        if (!Number.isInteger(season) || season <= 0) {
            throw new Error(
                `Season must be a positive integer: ${season}.`
            )
        }
    }
}


const createQuery = `
            WITH
            season_rows AS MATERIALIZED (
                SELECT
                    player_rating_inputs.player_id,
                        player_rating_inputs.hitting_games,
                        player_rating_inputs.hitting_pa,
                        player_rating_inputs.hitting_ab,
                        player_rating_inputs.hitting_hits,
                        player_rating_inputs.hitting_doubles,
                        player_rating_inputs.hitting_triples,
                        player_rating_inputs.hitting_home_runs,
                        player_rating_inputs.hitting_bb,
                        player_rating_inputs.hitting_so,
                        player_rating_inputs.hitting_hbp,
                        player_rating_inputs.hitting_ground_balls,
                        player_rating_inputs.hitting_fly_balls,
                        player_rating_inputs.hitting_line_drives,
                        player_rating_inputs.hitting_popups,
                        player_rating_inputs.hitting_pitches_seen,
                        player_rating_inputs.hitting_balls_seen,
                        player_rating_inputs.hitting_strikes_seen,
                        player_rating_inputs.hitting_swings,
                        player_rating_inputs.hitting_swing_at_balls,
                        player_rating_inputs.hitting_swing_at_strikes,
                        player_rating_inputs.hitting_called_strikes,
                        player_rating_inputs.hitting_swinging_strikes,
                        player_rating_inputs.hitting_in_zone_pitches,
                        player_rating_inputs.hitting_in_zone_contact,
                        player_rating_inputs.hitting_out_zone_contact,
                        player_rating_inputs.hitting_fouls,
                        player_rating_inputs.hitting_balls_in_play,
                        player_rating_inputs.hitting_exit_velocity_count,
                        player_rating_inputs.hitting_total_exit_velocity,
                        player_rating_inputs.pitching_games,
                        player_rating_inputs.pitching_starts,
                        player_rating_inputs.pitching_batters_faced,
                        player_rating_inputs.pitching_outs,
                        player_rating_inputs.pitching_hits_allowed,
                        player_rating_inputs.pitching_doubles_allowed,
                        player_rating_inputs.pitching_triples_allowed,
                        player_rating_inputs.pitching_home_runs_allowed,
                        player_rating_inputs.pitching_bb_allowed,
                        player_rating_inputs.pitching_so,
                        player_rating_inputs.pitching_hbp_allowed,
                        player_rating_inputs.pitching_ground_balls_allowed,
                        player_rating_inputs.pitching_fly_balls_allowed,
                        player_rating_inputs.pitching_line_drives_allowed,
                        player_rating_inputs.pitching_popups_allowed,
                        player_rating_inputs.pitching_pitches_thrown,
                        player_rating_inputs.pitching_balls_thrown,
                        player_rating_inputs.pitching_strikes_thrown,
                        player_rating_inputs.pitching_swings_induced,
                        player_rating_inputs.pitching_swing_at_balls_allowed,
                        player_rating_inputs.pitching_swing_at_strikes_allowed,
                        player_rating_inputs.pitching_in_zone_contact_allowed,
                        player_rating_inputs.pitching_out_zone_contact_allowed,
                        player_rating_inputs.pitching_fouls_allowed,
                        player_rating_inputs.pitching_balls_in_play_allowed,
                        player_rating_inputs.fielding_errors,
                        player_rating_inputs.fielding_assists,
                        player_rating_inputs.fielding_putouts,
                        player_rating_inputs.fielding_double_plays,
                        player_rating_inputs.fielding_outfield_assists,
                        player_rating_inputs.fielding_catcher_caught_stealing,
                        player_rating_inputs.fielding_catcher_stolen_bases_allowed,
                        player_rating_inputs.fielding_passed_balls,
                        player_rating_inputs.running_sb,
                        player_rating_inputs.running_cs,
                        player_rating_inputs.running_sb_attempts,
                        player_rating_inputs.hitting_vs_l_pa,
                        player_rating_inputs.hitting_vs_l_ab,
                        player_rating_inputs.hitting_vs_l_hits,
                        player_rating_inputs.hitting_vs_l_doubles,
                        player_rating_inputs.hitting_vs_l_triples,
                        player_rating_inputs.hitting_vs_l_home_runs,
                        player_rating_inputs.hitting_vs_l_bb,
                        player_rating_inputs.hitting_vs_l_so,
                        player_rating_inputs.hitting_vs_l_hbp,
                        player_rating_inputs.hitting_vs_l_exit_velocity_count,
                        player_rating_inputs.hitting_vs_l_total_exit_velocity,
                        player_rating_inputs.hitting_vs_r_pa,
                        player_rating_inputs.hitting_vs_r_ab,
                        player_rating_inputs.hitting_vs_r_hits,
                        player_rating_inputs.hitting_vs_r_doubles,
                        player_rating_inputs.hitting_vs_r_triples,
                        player_rating_inputs.hitting_vs_r_home_runs,
                        player_rating_inputs.hitting_vs_r_bb,
                        player_rating_inputs.hitting_vs_r_so,
                        player_rating_inputs.hitting_vs_r_hbp,
                        player_rating_inputs.hitting_vs_r_exit_velocity_count,
                        player_rating_inputs.hitting_vs_r_total_exit_velocity,
                        player_rating_inputs.pitching_vs_l_batters_faced,
                        player_rating_inputs.pitching_vs_l_outs,
                        player_rating_inputs.pitching_vs_l_runs_allowed,
                        player_rating_inputs.pitching_vs_l_earned_runs_allowed,
                        player_rating_inputs.pitching_vs_l_hits_allowed,
                        player_rating_inputs.pitching_vs_l_doubles_allowed,
                        player_rating_inputs.pitching_vs_l_triples_allowed,
                        player_rating_inputs.pitching_vs_l_home_runs_allowed,
                        player_rating_inputs.pitching_vs_l_bb_allowed,
                        player_rating_inputs.pitching_vs_l_so,
                        player_rating_inputs.pitching_vs_l_hbp_allowed,
                        player_rating_inputs.pitching_vs_r_batters_faced,
                        player_rating_inputs.pitching_vs_r_outs,
                        player_rating_inputs.pitching_vs_r_runs_allowed,
                        player_rating_inputs.pitching_vs_r_earned_runs_allowed,
                        player_rating_inputs.pitching_vs_r_hits_allowed,
                        player_rating_inputs.pitching_vs_r_doubles_allowed,
                        player_rating_inputs.pitching_vs_r_triples_allowed,
                        player_rating_inputs.pitching_vs_r_home_runs_allowed,
                        player_rating_inputs.pitching_vs_r_bb_allowed,
                        player_rating_inputs.pitching_vs_r_so,
                        player_rating_inputs.pitching_vs_r_hbp_allowed,
                        player_rating_inputs.pitch_types,
                        player_rating_inputs.games_at_position,
                        player_rating_inputs.innings_at_position
                FROM player_rating_inputs
                INNER JOIN games
                    ON games.game_pk = player_rating_inputs.game_pk
                WHERE games.game_date >= @startDate
                    AND games.game_date < @endDateExclusive
            ),
            player_totals AS (
                SELECT
                    season_rows.player_id,
                        SUM(season_rows.hitting_games) AS hitting_games,
                        SUM(season_rows.hitting_pa) AS hitting_pa,
                        SUM(season_rows.hitting_ab) AS hitting_ab,
                        SUM(season_rows.hitting_hits) AS hitting_hits,
                        SUM(season_rows.hitting_doubles) AS hitting_doubles,
                        SUM(season_rows.hitting_triples) AS hitting_triples,
                        SUM(season_rows.hitting_home_runs) AS hitting_home_runs,
                        SUM(season_rows.hitting_bb) AS hitting_bb,
                        SUM(season_rows.hitting_so) AS hitting_so,
                        SUM(season_rows.hitting_hbp) AS hitting_hbp,
                        SUM(season_rows.hitting_ground_balls) AS hitting_ground_balls,
                        SUM(season_rows.hitting_fly_balls) AS hitting_fly_balls,
                        SUM(season_rows.hitting_line_drives) AS hitting_line_drives,
                        SUM(season_rows.hitting_popups) AS hitting_popups,
                        SUM(season_rows.hitting_pitches_seen) AS hitting_pitches_seen,
                        SUM(season_rows.hitting_balls_seen) AS hitting_balls_seen,
                        SUM(season_rows.hitting_strikes_seen) AS hitting_strikes_seen,
                        SUM(season_rows.hitting_swings) AS hitting_swings,
                        SUM(season_rows.hitting_swing_at_balls) AS hitting_swing_at_balls,
                        SUM(season_rows.hitting_swing_at_strikes) AS hitting_swing_at_strikes,
                        SUM(season_rows.hitting_called_strikes) AS hitting_called_strikes,
                        SUM(season_rows.hitting_swinging_strikes) AS hitting_swinging_strikes,
                        SUM(season_rows.hitting_in_zone_pitches) AS hitting_in_zone_pitches,
                        SUM(season_rows.hitting_in_zone_contact) AS hitting_in_zone_contact,
                        SUM(season_rows.hitting_out_zone_contact) AS hitting_out_zone_contact,
                        SUM(season_rows.hitting_fouls) AS hitting_fouls,
                        SUM(season_rows.hitting_balls_in_play) AS hitting_balls_in_play,
                        SUM(season_rows.hitting_exit_velocity_count) AS hitting_exit_velocity_count,
                        SUM(season_rows.hitting_total_exit_velocity) AS hitting_total_exit_velocity,
                        SUM(season_rows.pitching_games) AS pitching_games,
                        SUM(season_rows.pitching_starts) AS pitching_starts,
                        SUM(season_rows.pitching_batters_faced) AS pitching_batters_faced,
                        SUM(season_rows.pitching_outs) AS pitching_outs,
                        SUM(season_rows.pitching_hits_allowed) AS pitching_hits_allowed,
                        SUM(season_rows.pitching_doubles_allowed) AS pitching_doubles_allowed,
                        SUM(season_rows.pitching_triples_allowed) AS pitching_triples_allowed,
                        SUM(season_rows.pitching_home_runs_allowed) AS pitching_home_runs_allowed,
                        SUM(season_rows.pitching_bb_allowed) AS pitching_bb_allowed,
                        SUM(season_rows.pitching_so) AS pitching_so,
                        SUM(season_rows.pitching_hbp_allowed) AS pitching_hbp_allowed,
                        SUM(season_rows.pitching_ground_balls_allowed) AS pitching_ground_balls_allowed,
                        SUM(season_rows.pitching_fly_balls_allowed) AS pitching_fly_balls_allowed,
                        SUM(season_rows.pitching_line_drives_allowed) AS pitching_line_drives_allowed,
                        SUM(season_rows.pitching_popups_allowed) AS pitching_popups_allowed,
                        SUM(season_rows.pitching_pitches_thrown) AS pitching_pitches_thrown,
                        SUM(season_rows.pitching_balls_thrown) AS pitching_balls_thrown,
                        SUM(season_rows.pitching_strikes_thrown) AS pitching_strikes_thrown,
                        SUM(season_rows.pitching_swings_induced) AS pitching_swings_induced,
                        SUM(season_rows.pitching_swing_at_balls_allowed) AS pitching_swing_at_balls_allowed,
                        SUM(season_rows.pitching_swing_at_strikes_allowed) AS pitching_swing_at_strikes_allowed,
                        SUM(season_rows.pitching_in_zone_contact_allowed) AS pitching_in_zone_contact_allowed,
                        SUM(season_rows.pitching_out_zone_contact_allowed) AS pitching_out_zone_contact_allowed,
                        SUM(season_rows.pitching_fouls_allowed) AS pitching_fouls_allowed,
                        SUM(season_rows.pitching_balls_in_play_allowed) AS pitching_balls_in_play_allowed,
                        SUM(season_rows.fielding_errors) AS fielding_errors,
                        SUM(season_rows.fielding_assists) AS fielding_assists,
                        SUM(season_rows.fielding_putouts) AS fielding_putouts,
                        SUM(season_rows.fielding_double_plays) AS fielding_double_plays,
                        SUM(season_rows.fielding_outfield_assists) AS fielding_outfield_assists,
                        SUM(season_rows.fielding_catcher_caught_stealing) AS fielding_catcher_caught_stealing,
                        SUM(season_rows.fielding_catcher_stolen_bases_allowed) AS fielding_catcher_stolen_bases_allowed,
                        SUM(season_rows.fielding_passed_balls) AS fielding_passed_balls,
                        SUM(season_rows.running_sb) AS running_sb,
                        SUM(season_rows.running_cs) AS running_cs,
                        SUM(season_rows.running_sb_attempts) AS running_sb_attempts,
                        SUM(season_rows.hitting_vs_l_pa) AS hitting_vs_l_pa,
                        SUM(season_rows.hitting_vs_l_ab) AS hitting_vs_l_ab,
                        SUM(season_rows.hitting_vs_l_hits) AS hitting_vs_l_hits,
                        SUM(season_rows.hitting_vs_l_doubles) AS hitting_vs_l_doubles,
                        SUM(season_rows.hitting_vs_l_triples) AS hitting_vs_l_triples,
                        SUM(season_rows.hitting_vs_l_home_runs) AS hitting_vs_l_home_runs,
                        SUM(season_rows.hitting_vs_l_bb) AS hitting_vs_l_bb,
                        SUM(season_rows.hitting_vs_l_so) AS hitting_vs_l_so,
                        SUM(season_rows.hitting_vs_l_hbp) AS hitting_vs_l_hbp,
                        SUM(season_rows.hitting_vs_l_exit_velocity_count) AS hitting_vs_l_exit_velocity_count,
                        SUM(season_rows.hitting_vs_l_total_exit_velocity) AS hitting_vs_l_total_exit_velocity,
                        SUM(season_rows.hitting_vs_r_pa) AS hitting_vs_r_pa,
                        SUM(season_rows.hitting_vs_r_ab) AS hitting_vs_r_ab,
                        SUM(season_rows.hitting_vs_r_hits) AS hitting_vs_r_hits,
                        SUM(season_rows.hitting_vs_r_doubles) AS hitting_vs_r_doubles,
                        SUM(season_rows.hitting_vs_r_triples) AS hitting_vs_r_triples,
                        SUM(season_rows.hitting_vs_r_home_runs) AS hitting_vs_r_home_runs,
                        SUM(season_rows.hitting_vs_r_bb) AS hitting_vs_r_bb,
                        SUM(season_rows.hitting_vs_r_so) AS hitting_vs_r_so,
                        SUM(season_rows.hitting_vs_r_hbp) AS hitting_vs_r_hbp,
                        SUM(season_rows.hitting_vs_r_exit_velocity_count) AS hitting_vs_r_exit_velocity_count,
                        SUM(season_rows.hitting_vs_r_total_exit_velocity) AS hitting_vs_r_total_exit_velocity,
                        SUM(season_rows.pitching_vs_l_batters_faced) AS pitching_vs_l_batters_faced,
                        SUM(season_rows.pitching_vs_l_outs) AS pitching_vs_l_outs,
                        SUM(season_rows.pitching_vs_l_runs_allowed) AS pitching_vs_l_runs_allowed,
                        SUM(season_rows.pitching_vs_l_earned_runs_allowed) AS pitching_vs_l_earned_runs_allowed,
                        SUM(season_rows.pitching_vs_l_hits_allowed) AS pitching_vs_l_hits_allowed,
                        SUM(season_rows.pitching_vs_l_doubles_allowed) AS pitching_vs_l_doubles_allowed,
                        SUM(season_rows.pitching_vs_l_triples_allowed) AS pitching_vs_l_triples_allowed,
                        SUM(season_rows.pitching_vs_l_home_runs_allowed) AS pitching_vs_l_home_runs_allowed,
                        SUM(season_rows.pitching_vs_l_bb_allowed) AS pitching_vs_l_bb_allowed,
                        SUM(season_rows.pitching_vs_l_so) AS pitching_vs_l_so,
                        SUM(season_rows.pitching_vs_l_hbp_allowed) AS pitching_vs_l_hbp_allowed,
                        SUM(season_rows.pitching_vs_r_batters_faced) AS pitching_vs_r_batters_faced,
                        SUM(season_rows.pitching_vs_r_outs) AS pitching_vs_r_outs,
                        SUM(season_rows.pitching_vs_r_runs_allowed) AS pitching_vs_r_runs_allowed,
                        SUM(season_rows.pitching_vs_r_earned_runs_allowed) AS pitching_vs_r_earned_runs_allowed,
                        SUM(season_rows.pitching_vs_r_hits_allowed) AS pitching_vs_r_hits_allowed,
                        SUM(season_rows.pitching_vs_r_doubles_allowed) AS pitching_vs_r_doubles_allowed,
                        SUM(season_rows.pitching_vs_r_triples_allowed) AS pitching_vs_r_triples_allowed,
                        SUM(season_rows.pitching_vs_r_home_runs_allowed) AS pitching_vs_r_home_runs_allowed,
                        SUM(season_rows.pitching_vs_r_bb_allowed) AS pitching_vs_r_bb_allowed,
                        SUM(season_rows.pitching_vs_r_so) AS pitching_vs_r_so,
                        SUM(season_rows.pitching_vs_r_hbp_allowed) AS pitching_vs_r_hbp_allowed
                FROM season_rows
                GROUP BY season_rows.player_id
            ),
            pitch_type_totals AS (
                SELECT
                    season_rows.player_id,
                    pitch_type.key AS pitch_type,
                    SUM(COALESCE(json_extract(pitch_type.value, '$.count'), 0)) AS count,
                    SUM(COALESCE(json_extract(pitch_type.value, '$.totalMph'), 0)) AS total_mph,
                    SUM(COALESCE(json_extract(pitch_type.value, '$.totalHorizontalBreak'), 0)) AS total_horizontal_break,
                    SUM(COALESCE(json_extract(pitch_type.value, '$.totalVerticalBreak'), 0)) AS total_vertical_break
                FROM season_rows
                INNER JOIN json_each(season_rows.pitch_types) pitch_type
                GROUP BY
                    season_rows.player_id,
                    pitch_type.key
            ),
            pitch_types AS (
                SELECT
                    pitch_type_totals.player_id,
                    json_group_object(
                        pitch_type_totals.pitch_type,
                        json_object(
                            'count', pitch_type_totals.count,
                            'totalMph', pitch_type_totals.total_mph,
                            'avgMph', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(
                                    pitch_type_totals.total_mph /
                                    pitch_type_totals.count,
                                    3
                                )
                                ELSE 0
                            END,
                            'totalHorizontalBreak', pitch_type_totals.total_horizontal_break,
                            'avgHorizontalBreak', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(
                                    pitch_type_totals.total_horizontal_break /
                                    pitch_type_totals.count,
                                    3
                                )
                                ELSE 0
                            END,
                            'totalVerticalBreak', pitch_type_totals.total_vertical_break,
                            'avgVerticalBreak', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(
                                    pitch_type_totals.total_vertical_break /
                                    pitch_type_totals.count,
                                    3
                                )
                                ELSE 0
                            END
                        )
                    ) AS data
                FROM pitch_type_totals
                GROUP BY pitch_type_totals.player_id
            ),
            games_at_position_totals AS (
                SELECT
                    season_rows.player_id,
                    position.key AS position,
                    SUM(COALESCE(position.value, 0)) AS games
                FROM season_rows
                INNER JOIN json_each(season_rows.games_at_position) position
                GROUP BY
                    season_rows.player_id,
                    position.key
            ),
            games_at_position AS (
                SELECT
                    games_at_position_totals.player_id,
                    json_group_object(
                        games_at_position_totals.position,
                        games_at_position_totals.games
                    ) AS data
                FROM games_at_position_totals
                GROUP BY games_at_position_totals.player_id
            ),
            innings_at_position_totals AS (
                SELECT
                    season_rows.player_id,
                    position.key AS position,
                    SUM(COALESCE(position.value, 0)) AS innings
                FROM season_rows
                INNER JOIN json_each(season_rows.innings_at_position) position
                GROUP BY
                    season_rows.player_id,
                    position.key
            ),
            innings_at_position AS (
                SELECT
                    innings_at_position_totals.player_id,
                    json_group_object(
                        innings_at_position_totals.position,
                        innings_at_position_totals.innings
                    ) AS data
                FROM innings_at_position_totals
                GROUP BY innings_at_position_totals.player_id
            )
            INSERT INTO player_rating_season_inputs (
                season,
                player_id,
                hitting_games,
                hitting_pa,
                hitting_ab,
                hitting_hits,
                hitting_doubles,
                hitting_triples,
                hitting_home_runs,
                hitting_bb,
                hitting_so,
                hitting_hbp,
                hitting_ground_balls,
                hitting_fly_balls,
                hitting_line_drives,
                hitting_popups,
                hitting_pitches_seen,
                hitting_balls_seen,
                hitting_strikes_seen,
                hitting_swings,
                hitting_swing_at_balls,
                hitting_swing_at_strikes,
                hitting_called_strikes,
                hitting_swinging_strikes,
                hitting_in_zone_pitches,
                hitting_in_zone_contact,
                hitting_out_zone_contact,
                hitting_fouls,
                hitting_balls_in_play,
                hitting_exit_velocity_count,
                hitting_total_exit_velocity,
                pitching_games,
                pitching_starts,
                pitching_batters_faced,
                pitching_outs,
                pitching_hits_allowed,
                pitching_doubles_allowed,
                pitching_triples_allowed,
                pitching_home_runs_allowed,
                pitching_bb_allowed,
                pitching_so,
                pitching_hbp_allowed,
                pitching_ground_balls_allowed,
                pitching_fly_balls_allowed,
                pitching_line_drives_allowed,
                pitching_popups_allowed,
                pitching_pitches_thrown,
                pitching_balls_thrown,
                pitching_strikes_thrown,
                pitching_swings_induced,
                pitching_swing_at_balls_allowed,
                pitching_swing_at_strikes_allowed,
                pitching_in_zone_contact_allowed,
                pitching_out_zone_contact_allowed,
                pitching_fouls_allowed,
                pitching_balls_in_play_allowed,
                fielding_errors,
                fielding_assists,
                fielding_putouts,
                fielding_double_plays,
                fielding_outfield_assists,
                fielding_catcher_caught_stealing,
                fielding_catcher_stolen_bases_allowed,
                fielding_passed_balls,
                running_sb,
                running_cs,
                running_sb_attempts,
                hitting_vs_l_pa,
                hitting_vs_l_ab,
                hitting_vs_l_hits,
                hitting_vs_l_doubles,
                hitting_vs_l_triples,
                hitting_vs_l_home_runs,
                hitting_vs_l_bb,
                hitting_vs_l_so,
                hitting_vs_l_hbp,
                hitting_vs_l_exit_velocity_count,
                hitting_vs_l_total_exit_velocity,
                hitting_vs_r_pa,
                hitting_vs_r_ab,
                hitting_vs_r_hits,
                hitting_vs_r_doubles,
                hitting_vs_r_triples,
                hitting_vs_r_home_runs,
                hitting_vs_r_bb,
                hitting_vs_r_so,
                hitting_vs_r_hbp,
                hitting_vs_r_exit_velocity_count,
                hitting_vs_r_total_exit_velocity,
                pitching_vs_l_batters_faced,
                pitching_vs_l_outs,
                pitching_vs_l_runs_allowed,
                pitching_vs_l_earned_runs_allowed,
                pitching_vs_l_hits_allowed,
                pitching_vs_l_doubles_allowed,
                pitching_vs_l_triples_allowed,
                pitching_vs_l_home_runs_allowed,
                pitching_vs_l_bb_allowed,
                pitching_vs_l_so,
                pitching_vs_l_hbp_allowed,
                pitching_vs_r_batters_faced,
                pitching_vs_r_outs,
                pitching_vs_r_runs_allowed,
                pitching_vs_r_earned_runs_allowed,
                pitching_vs_r_hits_allowed,
                pitching_vs_r_doubles_allowed,
                pitching_vs_r_triples_allowed,
                pitching_vs_r_home_runs_allowed,
                pitching_vs_r_bb_allowed,
                pitching_vs_r_so,
                pitching_vs_r_hbp_allowed,
                pitch_types,
                games_at_position,
                innings_at_position
            )
            SELECT
                @season,
                player_totals.player_id,
                player_totals.hitting_games,
                player_totals.hitting_pa,
                player_totals.hitting_ab,
                player_totals.hitting_hits,
                player_totals.hitting_doubles,
                player_totals.hitting_triples,
                player_totals.hitting_home_runs,
                player_totals.hitting_bb,
                player_totals.hitting_so,
                player_totals.hitting_hbp,
                player_totals.hitting_ground_balls,
                player_totals.hitting_fly_balls,
                player_totals.hitting_line_drives,
                player_totals.hitting_popups,
                player_totals.hitting_pitches_seen,
                player_totals.hitting_balls_seen,
                player_totals.hitting_strikes_seen,
                player_totals.hitting_swings,
                player_totals.hitting_swing_at_balls,
                player_totals.hitting_swing_at_strikes,
                player_totals.hitting_called_strikes,
                player_totals.hitting_swinging_strikes,
                player_totals.hitting_in_zone_pitches,
                player_totals.hitting_in_zone_contact,
                player_totals.hitting_out_zone_contact,
                player_totals.hitting_fouls,
                player_totals.hitting_balls_in_play,
                player_totals.hitting_exit_velocity_count,
                player_totals.hitting_total_exit_velocity,
                player_totals.pitching_games,
                player_totals.pitching_starts,
                player_totals.pitching_batters_faced,
                player_totals.pitching_outs,
                player_totals.pitching_hits_allowed,
                player_totals.pitching_doubles_allowed,
                player_totals.pitching_triples_allowed,
                player_totals.pitching_home_runs_allowed,
                player_totals.pitching_bb_allowed,
                player_totals.pitching_so,
                player_totals.pitching_hbp_allowed,
                player_totals.pitching_ground_balls_allowed,
                player_totals.pitching_fly_balls_allowed,
                player_totals.pitching_line_drives_allowed,
                player_totals.pitching_popups_allowed,
                player_totals.pitching_pitches_thrown,
                player_totals.pitching_balls_thrown,
                player_totals.pitching_strikes_thrown,
                player_totals.pitching_swings_induced,
                player_totals.pitching_swing_at_balls_allowed,
                player_totals.pitching_swing_at_strikes_allowed,
                player_totals.pitching_in_zone_contact_allowed,
                player_totals.pitching_out_zone_contact_allowed,
                player_totals.pitching_fouls_allowed,
                player_totals.pitching_balls_in_play_allowed,
                player_totals.fielding_errors,
                player_totals.fielding_assists,
                player_totals.fielding_putouts,
                player_totals.fielding_double_plays,
                player_totals.fielding_outfield_assists,
                player_totals.fielding_catcher_caught_stealing,
                player_totals.fielding_catcher_stolen_bases_allowed,
                player_totals.fielding_passed_balls,
                player_totals.running_sb,
                player_totals.running_cs,
                player_totals.running_sb_attempts,
                player_totals.hitting_vs_l_pa,
                player_totals.hitting_vs_l_ab,
                player_totals.hitting_vs_l_hits,
                player_totals.hitting_vs_l_doubles,
                player_totals.hitting_vs_l_triples,
                player_totals.hitting_vs_l_home_runs,
                player_totals.hitting_vs_l_bb,
                player_totals.hitting_vs_l_so,
                player_totals.hitting_vs_l_hbp,
                player_totals.hitting_vs_l_exit_velocity_count,
                player_totals.hitting_vs_l_total_exit_velocity,
                player_totals.hitting_vs_r_pa,
                player_totals.hitting_vs_r_ab,
                player_totals.hitting_vs_r_hits,
                player_totals.hitting_vs_r_doubles,
                player_totals.hitting_vs_r_triples,
                player_totals.hitting_vs_r_home_runs,
                player_totals.hitting_vs_r_bb,
                player_totals.hitting_vs_r_so,
                player_totals.hitting_vs_r_hbp,
                player_totals.hitting_vs_r_exit_velocity_count,
                player_totals.hitting_vs_r_total_exit_velocity,
                player_totals.pitching_vs_l_batters_faced,
                player_totals.pitching_vs_l_outs,
                player_totals.pitching_vs_l_runs_allowed,
                player_totals.pitching_vs_l_earned_runs_allowed,
                player_totals.pitching_vs_l_hits_allowed,
                player_totals.pitching_vs_l_doubles_allowed,
                player_totals.pitching_vs_l_triples_allowed,
                player_totals.pitching_vs_l_home_runs_allowed,
                player_totals.pitching_vs_l_bb_allowed,
                player_totals.pitching_vs_l_so,
                player_totals.pitching_vs_l_hbp_allowed,
                player_totals.pitching_vs_r_batters_faced,
                player_totals.pitching_vs_r_outs,
                player_totals.pitching_vs_r_runs_allowed,
                player_totals.pitching_vs_r_earned_runs_allowed,
                player_totals.pitching_vs_r_hits_allowed,
                player_totals.pitching_vs_r_doubles_allowed,
                player_totals.pitching_vs_r_triples_allowed,
                player_totals.pitching_vs_r_home_runs_allowed,
                player_totals.pitching_vs_r_bb_allowed,
                player_totals.pitching_vs_r_so,
                player_totals.pitching_vs_r_hbp_allowed,
                COALESCE(pitch_types.data, '{}'),
                COALESCE(games_at_position.data, '{}'),
                COALESCE(innings_at_position.data, '{}')
            FROM player_totals
            LEFT JOIN pitch_types
                ON pitch_types.player_id = player_totals.player_id
            LEFT JOIN games_at_position
                ON games_at_position.player_id = player_totals.player_id
            LEFT JOIN innings_at_position
                ON innings_at_position.player_id = player_totals.player_id
            ON CONFLICT(season, player_id) DO UPDATE SET
                hitting_games = excluded.hitting_games,
                hitting_pa = excluded.hitting_pa,
                hitting_ab = excluded.hitting_ab,
                hitting_hits = excluded.hitting_hits,
                hitting_doubles = excluded.hitting_doubles,
                hitting_triples = excluded.hitting_triples,
                hitting_home_runs = excluded.hitting_home_runs,
                hitting_bb = excluded.hitting_bb,
                hitting_so = excluded.hitting_so,
                hitting_hbp = excluded.hitting_hbp,
                hitting_ground_balls = excluded.hitting_ground_balls,
                hitting_fly_balls = excluded.hitting_fly_balls,
                hitting_line_drives = excluded.hitting_line_drives,
                hitting_popups = excluded.hitting_popups,
                hitting_pitches_seen = excluded.hitting_pitches_seen,
                hitting_balls_seen = excluded.hitting_balls_seen,
                hitting_strikes_seen = excluded.hitting_strikes_seen,
                hitting_swings = excluded.hitting_swings,
                hitting_swing_at_balls = excluded.hitting_swing_at_balls,
                hitting_swing_at_strikes = excluded.hitting_swing_at_strikes,
                hitting_called_strikes = excluded.hitting_called_strikes,
                hitting_swinging_strikes = excluded.hitting_swinging_strikes,
                hitting_in_zone_pitches = excluded.hitting_in_zone_pitches,
                hitting_in_zone_contact = excluded.hitting_in_zone_contact,
                hitting_out_zone_contact = excluded.hitting_out_zone_contact,
                hitting_fouls = excluded.hitting_fouls,
                hitting_balls_in_play = excluded.hitting_balls_in_play,
                hitting_exit_velocity_count = excluded.hitting_exit_velocity_count,
                hitting_total_exit_velocity = excluded.hitting_total_exit_velocity,
                pitching_games = excluded.pitching_games,
                pitching_starts = excluded.pitching_starts,
                pitching_batters_faced = excluded.pitching_batters_faced,
                pitching_outs = excluded.pitching_outs,
                pitching_hits_allowed = excluded.pitching_hits_allowed,
                pitching_doubles_allowed = excluded.pitching_doubles_allowed,
                pitching_triples_allowed = excluded.pitching_triples_allowed,
                pitching_home_runs_allowed = excluded.pitching_home_runs_allowed,
                pitching_bb_allowed = excluded.pitching_bb_allowed,
                pitching_so = excluded.pitching_so,
                pitching_hbp_allowed = excluded.pitching_hbp_allowed,
                pitching_ground_balls_allowed = excluded.pitching_ground_balls_allowed,
                pitching_fly_balls_allowed = excluded.pitching_fly_balls_allowed,
                pitching_line_drives_allowed = excluded.pitching_line_drives_allowed,
                pitching_popups_allowed = excluded.pitching_popups_allowed,
                pitching_pitches_thrown = excluded.pitching_pitches_thrown,
                pitching_balls_thrown = excluded.pitching_balls_thrown,
                pitching_strikes_thrown = excluded.pitching_strikes_thrown,
                pitching_swings_induced = excluded.pitching_swings_induced,
                pitching_swing_at_balls_allowed = excluded.pitching_swing_at_balls_allowed,
                pitching_swing_at_strikes_allowed = excluded.pitching_swing_at_strikes_allowed,
                pitching_in_zone_contact_allowed = excluded.pitching_in_zone_contact_allowed,
                pitching_out_zone_contact_allowed = excluded.pitching_out_zone_contact_allowed,
                pitching_fouls_allowed = excluded.pitching_fouls_allowed,
                pitching_balls_in_play_allowed = excluded.pitching_balls_in_play_allowed,
                fielding_errors = excluded.fielding_errors,
                fielding_assists = excluded.fielding_assists,
                fielding_putouts = excluded.fielding_putouts,
                fielding_double_plays = excluded.fielding_double_plays,
                fielding_outfield_assists = excluded.fielding_outfield_assists,
                fielding_catcher_caught_stealing = excluded.fielding_catcher_caught_stealing,
                fielding_catcher_stolen_bases_allowed = excluded.fielding_catcher_stolen_bases_allowed,
                fielding_passed_balls = excluded.fielding_passed_balls,
                running_sb = excluded.running_sb,
                running_cs = excluded.running_cs,
                running_sb_attempts = excluded.running_sb_attempts,
                hitting_vs_l_pa = excluded.hitting_vs_l_pa,
                hitting_vs_l_ab = excluded.hitting_vs_l_ab,
                hitting_vs_l_hits = excluded.hitting_vs_l_hits,
                hitting_vs_l_doubles = excluded.hitting_vs_l_doubles,
                hitting_vs_l_triples = excluded.hitting_vs_l_triples,
                hitting_vs_l_home_runs = excluded.hitting_vs_l_home_runs,
                hitting_vs_l_bb = excluded.hitting_vs_l_bb,
                hitting_vs_l_so = excluded.hitting_vs_l_so,
                hitting_vs_l_hbp = excluded.hitting_vs_l_hbp,
                hitting_vs_l_exit_velocity_count = excluded.hitting_vs_l_exit_velocity_count,
                hitting_vs_l_total_exit_velocity = excluded.hitting_vs_l_total_exit_velocity,
                hitting_vs_r_pa = excluded.hitting_vs_r_pa,
                hitting_vs_r_ab = excluded.hitting_vs_r_ab,
                hitting_vs_r_hits = excluded.hitting_vs_r_hits,
                hitting_vs_r_doubles = excluded.hitting_vs_r_doubles,
                hitting_vs_r_triples = excluded.hitting_vs_r_triples,
                hitting_vs_r_home_runs = excluded.hitting_vs_r_home_runs,
                hitting_vs_r_bb = excluded.hitting_vs_r_bb,
                hitting_vs_r_so = excluded.hitting_vs_r_so,
                hitting_vs_r_hbp = excluded.hitting_vs_r_hbp,
                hitting_vs_r_exit_velocity_count = excluded.hitting_vs_r_exit_velocity_count,
                hitting_vs_r_total_exit_velocity = excluded.hitting_vs_r_total_exit_velocity,
                pitching_vs_l_batters_faced = excluded.pitching_vs_l_batters_faced,
                pitching_vs_l_outs = excluded.pitching_vs_l_outs,
                pitching_vs_l_runs_allowed = excluded.pitching_vs_l_runs_allowed,
                pitching_vs_l_earned_runs_allowed = excluded.pitching_vs_l_earned_runs_allowed,
                pitching_vs_l_hits_allowed = excluded.pitching_vs_l_hits_allowed,
                pitching_vs_l_doubles_allowed = excluded.pitching_vs_l_doubles_allowed,
                pitching_vs_l_triples_allowed = excluded.pitching_vs_l_triples_allowed,
                pitching_vs_l_home_runs_allowed = excluded.pitching_vs_l_home_runs_allowed,
                pitching_vs_l_bb_allowed = excluded.pitching_vs_l_bb_allowed,
                pitching_vs_l_so = excluded.pitching_vs_l_so,
                pitching_vs_l_hbp_allowed = excluded.pitching_vs_l_hbp_allowed,
                pitching_vs_r_batters_faced = excluded.pitching_vs_r_batters_faced,
                pitching_vs_r_outs = excluded.pitching_vs_r_outs,
                pitching_vs_r_runs_allowed = excluded.pitching_vs_r_runs_allowed,
                pitching_vs_r_earned_runs_allowed = excluded.pitching_vs_r_earned_runs_allowed,
                pitching_vs_r_hits_allowed = excluded.pitching_vs_r_hits_allowed,
                pitching_vs_r_doubles_allowed = excluded.pitching_vs_r_doubles_allowed,
                pitching_vs_r_triples_allowed = excluded.pitching_vs_r_triples_allowed,
                pitching_vs_r_home_runs_allowed = excluded.pitching_vs_r_home_runs_allowed,
                pitching_vs_r_bb_allowed = excluded.pitching_vs_r_bb_allowed,
                pitching_vs_r_so = excluded.pitching_vs_r_so,
                pitching_vs_r_hbp_allowed = excluded.pitching_vs_r_hbp_allowed,
                pitch_types = excluded.pitch_types,
                games_at_position = excluded.games_at_position,
                innings_at_position = excluded.innings_at_position
        `



export {
    PlayerRatingSeasonInputRepository
}

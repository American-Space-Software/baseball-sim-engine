import type {
    Database,
    Statement
} from "better-sqlite3"

import type {
    PlayerRatingInput
} from "../../sim/service/interfaces.js"


interface PlayerRatingInputRow {
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


interface PlayerRatingAggregatedRow extends PlayerRatingInputRow {
    pitchTypeRows: string | null
    gamesAtPositionRows: string | null
    inningsAtPositionRows: string | null
}

class PlayerRatingInputRepository {

    private readonly createStatement: Statement

    public constructor(private readonly database: Database) {
        this.createStatement = this.database.prepare(
            createQuery
        )
    }

    public create(gamePk: number): void {
        this.createStatement.run({
            gamePk
        })
    }

    public getByGame(gamePk: number): PlayerRatingInput[] {
        const rows = this.database.prepare(`
            SELECT
                player_rating_inputs.player_id AS playerId,
                player_rating_inputs.hitting_games AS hittingGames,
                player_rating_inputs.hitting_pa AS hittingPa,
                player_rating_inputs.hitting_ab AS hittingAb,
                player_rating_inputs.hitting_hits AS hittingHits,
                player_rating_inputs.hitting_doubles AS hittingDoubles,
                player_rating_inputs.hitting_triples AS hittingTriples,
                player_rating_inputs.hitting_home_runs AS hittingHomeRuns,
                player_rating_inputs.hitting_bb AS hittingBb,
                player_rating_inputs.hitting_so AS hittingSo,
                player_rating_inputs.hitting_hbp AS hittingHbp,
                player_rating_inputs.hitting_ground_balls AS hittingGroundBalls,
                player_rating_inputs.hitting_fly_balls AS hittingFlyBalls,
                player_rating_inputs.hitting_line_drives AS hittingLineDrives,
                player_rating_inputs.hitting_popups AS hittingPopups,
                player_rating_inputs.hitting_pitches_seen AS hittingPitchesSeen,
                player_rating_inputs.hitting_balls_seen AS hittingBallsSeen,
                player_rating_inputs.hitting_strikes_seen AS hittingStrikesSeen,
                player_rating_inputs.hitting_swings AS hittingSwings,
                player_rating_inputs.hitting_swing_at_balls AS hittingSwingAtBalls,
                player_rating_inputs.hitting_swing_at_strikes AS hittingSwingAtStrikes,
                player_rating_inputs.hitting_called_strikes AS hittingCalledStrikes,
                player_rating_inputs.hitting_swinging_strikes AS hittingSwingingStrikes,
                player_rating_inputs.hitting_in_zone_pitches AS hittingInZonePitches,
                player_rating_inputs.hitting_in_zone_contact AS hittingInZoneContact,
                player_rating_inputs.hitting_out_zone_contact AS hittingOutZoneContact,
                player_rating_inputs.hitting_fouls AS hittingFouls,
                player_rating_inputs.hitting_balls_in_play AS hittingBallsInPlay,
                player_rating_inputs.hitting_exit_velocity_count AS hittingExitVelocityCount,
                player_rating_inputs.hitting_total_exit_velocity AS hittingTotalExitVelocity,
                player_rating_inputs.pitching_games AS pitchingGames,
                player_rating_inputs.pitching_starts AS pitchingStarts,
                player_rating_inputs.pitching_batters_faced AS pitchingBattersFaced,
                player_rating_inputs.pitching_outs AS pitchingOuts,
                player_rating_inputs.pitching_hits_allowed AS pitchingHitsAllowed,
                player_rating_inputs.pitching_doubles_allowed AS pitchingDoublesAllowed,
                player_rating_inputs.pitching_triples_allowed AS pitchingTriplesAllowed,
                player_rating_inputs.pitching_home_runs_allowed AS pitchingHomeRunsAllowed,
                player_rating_inputs.pitching_bb_allowed AS pitchingBbAllowed,
                player_rating_inputs.pitching_so AS pitchingSo,
                player_rating_inputs.pitching_hbp_allowed AS pitchingHbpAllowed,
                player_rating_inputs.pitching_ground_balls_allowed AS pitchingGroundBallsAllowed,
                player_rating_inputs.pitching_fly_balls_allowed AS pitchingFlyBallsAllowed,
                player_rating_inputs.pitching_line_drives_allowed AS pitchingLineDrivesAllowed,
                player_rating_inputs.pitching_popups_allowed AS pitchingPopupsAllowed,
                player_rating_inputs.pitching_pitches_thrown AS pitchingPitchesThrown,
                player_rating_inputs.pitching_balls_thrown AS pitchingBallsThrown,
                player_rating_inputs.pitching_strikes_thrown AS pitchingStrikesThrown,
                player_rating_inputs.pitching_swings_induced AS pitchingSwingsInduced,
                player_rating_inputs.pitching_swing_at_balls_allowed AS pitchingSwingAtBallsAllowed,
                player_rating_inputs.pitching_swing_at_strikes_allowed AS pitchingSwingAtStrikesAllowed,
                player_rating_inputs.pitching_in_zone_contact_allowed AS pitchingInZoneContactAllowed,
                player_rating_inputs.pitching_out_zone_contact_allowed AS pitchingOutZoneContactAllowed,
                player_rating_inputs.pitching_fouls_allowed AS pitchingFoulsAllowed,
                player_rating_inputs.pitching_balls_in_play_allowed AS pitchingBallsInPlayAllowed,
                player_rating_inputs.fielding_errors AS fieldingErrors,
                player_rating_inputs.fielding_assists AS fieldingAssists,
                player_rating_inputs.fielding_putouts AS fieldingPutouts,
                player_rating_inputs.fielding_double_plays AS fieldingDoublePlays,
                player_rating_inputs.fielding_outfield_assists AS fieldingOutfieldAssists,
                player_rating_inputs.fielding_catcher_caught_stealing AS fieldingCatcherCaughtStealing,
                player_rating_inputs.fielding_catcher_stolen_bases_allowed AS fieldingCatcherStolenBasesAllowed,
                player_rating_inputs.fielding_passed_balls AS fieldingPassedBalls,
                player_rating_inputs.running_sb AS runningSb,
                player_rating_inputs.running_cs AS runningCs,
                player_rating_inputs.running_sb_attempts AS runningSbAttempts,
                player_rating_inputs.hitting_vs_l_pa AS hittingVsLPa,
                player_rating_inputs.hitting_vs_l_ab AS hittingVsLAb,
                player_rating_inputs.hitting_vs_l_hits AS hittingVsLHits,
                player_rating_inputs.hitting_vs_l_doubles AS hittingVsLDoubles,
                player_rating_inputs.hitting_vs_l_triples AS hittingVsLTriples,
                player_rating_inputs.hitting_vs_l_home_runs AS hittingVsLHomeRuns,
                player_rating_inputs.hitting_vs_l_bb AS hittingVsLBb,
                player_rating_inputs.hitting_vs_l_so AS hittingVsLSo,
                player_rating_inputs.hitting_vs_l_hbp AS hittingVsLHbp,
                player_rating_inputs.hitting_vs_l_exit_velocity_count AS hittingVsLExitVelocityCount,
                player_rating_inputs.hitting_vs_l_total_exit_velocity AS hittingVsLTotalExitVelocity,
                player_rating_inputs.hitting_vs_r_pa AS hittingVsRPa,
                player_rating_inputs.hitting_vs_r_ab AS hittingVsRAb,
                player_rating_inputs.hitting_vs_r_hits AS hittingVsRHits,
                player_rating_inputs.hitting_vs_r_doubles AS hittingVsRDoubles,
                player_rating_inputs.hitting_vs_r_triples AS hittingVsRTriples,
                player_rating_inputs.hitting_vs_r_home_runs AS hittingVsRHomeRuns,
                player_rating_inputs.hitting_vs_r_bb AS hittingVsRBb,
                player_rating_inputs.hitting_vs_r_so AS hittingVsRSo,
                player_rating_inputs.hitting_vs_r_hbp AS hittingVsRHbp,
                player_rating_inputs.hitting_vs_r_exit_velocity_count AS hittingVsRExitVelocityCount,
                player_rating_inputs.hitting_vs_r_total_exit_velocity AS hittingVsRTotalExitVelocity,
                player_rating_inputs.pitching_vs_l_batters_faced AS pitchingVsLBattersFaced,
                player_rating_inputs.pitching_vs_l_outs AS pitchingVsLOuts,
                player_rating_inputs.pitching_vs_l_runs_allowed AS pitchingVsLRunsAllowed,
                player_rating_inputs.pitching_vs_l_earned_runs_allowed AS pitchingVsLEarnedRunsAllowed,
                player_rating_inputs.pitching_vs_l_hits_allowed AS pitchingVsLHitsAllowed,
                player_rating_inputs.pitching_vs_l_doubles_allowed AS pitchingVsLDoublesAllowed,
                player_rating_inputs.pitching_vs_l_triples_allowed AS pitchingVsLTriplesAllowed,
                player_rating_inputs.pitching_vs_l_home_runs_allowed AS pitchingVsLHomeRunsAllowed,
                player_rating_inputs.pitching_vs_l_bb_allowed AS pitchingVsLBbAllowed,
                player_rating_inputs.pitching_vs_l_so AS pitchingVsLSo,
                player_rating_inputs.pitching_vs_l_hbp_allowed AS pitchingVsLHbpAllowed,
                player_rating_inputs.pitching_vs_r_batters_faced AS pitchingVsRBattersFaced,
                player_rating_inputs.pitching_vs_r_outs AS pitchingVsROuts,
                player_rating_inputs.pitching_vs_r_runs_allowed AS pitchingVsRRunsAllowed,
                player_rating_inputs.pitching_vs_r_earned_runs_allowed AS pitchingVsREarnedRunsAllowed,
                player_rating_inputs.pitching_vs_r_hits_allowed AS pitchingVsRHitsAllowed,
                player_rating_inputs.pitching_vs_r_doubles_allowed AS pitchingVsRDoublesAllowed,
                player_rating_inputs.pitching_vs_r_triples_allowed AS pitchingVsRTriplesAllowed,
                player_rating_inputs.pitching_vs_r_home_runs_allowed AS pitchingVsRHomeRunsAllowed,
                player_rating_inputs.pitching_vs_r_bb_allowed AS pitchingVsRBbAllowed,
                player_rating_inputs.pitching_vs_r_so AS pitchingVsRSo,
                player_rating_inputs.pitching_vs_r_hbp_allowed AS pitchingVsRHbpAllowed,
                player_rating_inputs.pitch_types AS pitchTypes,
                player_rating_inputs.games_at_position AS gamesAtPosition,
                player_rating_inputs.innings_at_position AS inningsAtPosition
            FROM player_rating_inputs
            WHERE player_rating_inputs.game_pk = ?
            ORDER BY player_rating_inputs.player_id
        `).all(
            gamePk
        ) as PlayerRatingInputRow[]

        return rows.map(row =>
            this.mapRow(
                row
            )
        )
    }

    public getCareer(endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerRatingInput[] {
        return this.getAggregatedInputs(
            `
                SELECT
                    player_rating_inputs.game_pk,
                    player_rating_inputs.player_id
                FROM player_rating_inputs
                WHERE player_rating_inputs.game_date < @endDateExclusive
            `,
            {
                endDateExclusive
            },
            filterPlayerIds
        )
    }

    public getLastAppearances(endDateExclusive: string, appearanceCount: number, filterPlayerIds?: Set<string>): PlayerRatingInput[] {
        if (appearanceCount <= 0) {
            return []
        }

        const parameters: Record<string, string | number> = {
            endDateExclusive,
            appearanceCount
        }

        let requestedPlayers = ""

        if (filterPlayerIds && filterPlayerIds.size > 0) {
            parameters.playerIds = JSON.stringify(
                Array.from(
                    filterPlayerIds
                ).map(Number)
            )

            requestedPlayers = `
                requested_players AS (
                    SELECT
                        CAST(value AS INTEGER) AS player_id
                    FROM json_each(
                        @playerIds
                    )
                ),
            `
        }

        return this.getAggregatedInputs(
            `
                WITH
                ${requestedPlayers}
                ranked_inputs AS (
                    SELECT
                        player_rating_inputs.game_pk,
                        player_rating_inputs.player_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY player_rating_inputs.player_id
                            ORDER BY
                                player_rating_inputs.game_date DESC,
                                player_rating_inputs.game_pk DESC
                        ) AS appearance_number
                    FROM player_rating_inputs
                    ${
                        filterPlayerIds && filterPlayerIds.size > 0
                            ? `
                                INNER JOIN requested_players
                                    ON requested_players.player_id = player_rating_inputs.player_id
                            `
                            : ""
                    }
                    WHERE player_rating_inputs.game_date < @endDateExclusive
                )
                SELECT
                    ranked_inputs.game_pk,
                    ranked_inputs.player_id
                FROM ranked_inputs
                WHERE ranked_inputs.appearance_number <= @appearanceCount
            `,
            parameters
        )
    }

    public getForDateRange(startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerRatingInput[] {
        if (startDate >= endDateExclusive) {
            return []
        }

        return this.getAggregatedInputs(
            `
                SELECT
                    player_rating_inputs.game_pk,
                    player_rating_inputs.player_id
                FROM player_rating_inputs
                WHERE player_rating_inputs.game_date >= @startDate
                    AND player_rating_inputs.game_date < @endDateExclusive
            `,
            {
                startDate,
                endDateExclusive
            },
            filterPlayerIds
        )
    }

    public getPlayerIdsForSeason(season: number): Set<string> {
        const rows = this.database.prepare(`
            SELECT DISTINCT
                player_rating_inputs.player_id AS playerId
            FROM player_rating_inputs
            WHERE player_rating_inputs.game_date >= ?
                AND player_rating_inputs.game_date < ?
            ORDER BY player_rating_inputs.player_id
        `).all(
            `${season}-01-01`,
            `${season + 1}-01-01`
        ) as { playerId: string | number }[]

        return new Set(
            rows.map(row =>
                String(
                    row.playerId
                )
            )
        )
    }

    public put(gamePk: number, input: PlayerRatingInput): void {
        this.database.prepare(`
            INSERT INTO player_rating_inputs (
                game_pk,
                player_id,
                game_date,
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
            VALUES (
                @gamePk,
                @playerId,
                (
                    SELECT games.game_date
                    FROM games
                    WHERE games.game_pk = @gamePk
                ),
                @hittingGames,
                @hittingPa,
                @hittingAb,
                @hittingHits,
                @hittingDoubles,
                @hittingTriples,
                @hittingHomeRuns,
                @hittingBb,
                @hittingSo,
                @hittingHbp,
                @hittingGroundBalls,
                @hittingFlyBalls,
                @hittingLineDrives,
                @hittingPopups,
                @hittingPitchesSeen,
                @hittingBallsSeen,
                @hittingStrikesSeen,
                @hittingSwings,
                @hittingSwingAtBalls,
                @hittingSwingAtStrikes,
                @hittingCalledStrikes,
                @hittingSwingingStrikes,
                @hittingInZonePitches,
                @hittingInZoneContact,
                @hittingOutZoneContact,
                @hittingFouls,
                @hittingBallsInPlay,
                @hittingExitVelocityCount,
                @hittingTotalExitVelocity,
                @pitchingGames,
                @pitchingStarts,
                @pitchingBattersFaced,
                @pitchingOuts,
                @pitchingHitsAllowed,
                @pitchingDoublesAllowed,
                @pitchingTriplesAllowed,
                @pitchingHomeRunsAllowed,
                @pitchingBbAllowed,
                @pitchingSo,
                @pitchingHbpAllowed,
                @pitchingGroundBallsAllowed,
                @pitchingFlyBallsAllowed,
                @pitchingLineDrivesAllowed,
                @pitchingPopupsAllowed,
                @pitchingPitchesThrown,
                @pitchingBallsThrown,
                @pitchingStrikesThrown,
                @pitchingSwingsInduced,
                @pitchingSwingAtBallsAllowed,
                @pitchingSwingAtStrikesAllowed,
                @pitchingInZoneContactAllowed,
                @pitchingOutZoneContactAllowed,
                @pitchingFoulsAllowed,
                @pitchingBallsInPlayAllowed,
                @fieldingErrors,
                @fieldingAssists,
                @fieldingPutouts,
                @fieldingDoublePlays,
                @fieldingOutfieldAssists,
                @fieldingCatcherCaughtStealing,
                @fieldingCatcherStolenBasesAllowed,
                @fieldingPassedBalls,
                @runningSb,
                @runningCs,
                @runningSbAttempts,
                @hittingVsLPa,
                @hittingVsLAb,
                @hittingVsLHits,
                @hittingVsLDoubles,
                @hittingVsLTriples,
                @hittingVsLHomeRuns,
                @hittingVsLBb,
                @hittingVsLSo,
                @hittingVsLHbp,
                @hittingVsLExitVelocityCount,
                @hittingVsLTotalExitVelocity,
                @hittingVsRPa,
                @hittingVsRAb,
                @hittingVsRHits,
                @hittingVsRDoubles,
                @hittingVsRTriples,
                @hittingVsRHomeRuns,
                @hittingVsRBb,
                @hittingVsRSo,
                @hittingVsRHbp,
                @hittingVsRExitVelocityCount,
                @hittingVsRTotalExitVelocity,
                @pitchingVsLBattersFaced,
                @pitchingVsLOuts,
                @pitchingVsLRunsAllowed,
                @pitchingVsLEarnedRunsAllowed,
                @pitchingVsLHitsAllowed,
                @pitchingVsLDoublesAllowed,
                @pitchingVsLTriplesAllowed,
                @pitchingVsLHomeRunsAllowed,
                @pitchingVsLBbAllowed,
                @pitchingVsLSo,
                @pitchingVsLHbpAllowed,
                @pitchingVsRBattersFaced,
                @pitchingVsROuts,
                @pitchingVsRRunsAllowed,
                @pitchingVsREarnedRunsAllowed,
                @pitchingVsRHitsAllowed,
                @pitchingVsRDoublesAllowed,
                @pitchingVsRTriplesAllowed,
                @pitchingVsRHomeRunsAllowed,
                @pitchingVsRBbAllowed,
                @pitchingVsRSo,
                @pitchingVsRHbpAllowed,
                @pitchTypes,
                @gamesAtPosition,
                @inningsAtPosition
            )
            ON CONFLICT(game_pk, player_id) DO UPDATE SET
                game_date = excluded.game_date,
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
        `).run({
            gamePk,
            playerId: Number(
                input.playerId
            ),
            hittingGames: input.hitting.games,
            hittingPa: input.hitting.pa,
            hittingAb: input.hitting.ab,
            hittingHits: input.hitting.hits,
            hittingDoubles: input.hitting.doubles,
            hittingTriples: input.hitting.triples,
            hittingHomeRuns: input.hitting.homeRuns,
            hittingBb: input.hitting.bb,
            hittingSo: input.hitting.so,
            hittingHbp: input.hitting.hbp,
            hittingGroundBalls: input.hitting.groundBalls,
            hittingFlyBalls: input.hitting.flyBalls,
            hittingLineDrives: input.hitting.lineDrives,
            hittingPopups: input.hitting.popups,
            hittingPitchesSeen: input.hitting.pitchesSeen,
            hittingBallsSeen: input.hitting.ballsSeen,
            hittingStrikesSeen: input.hitting.strikesSeen,
            hittingSwings: input.hitting.swings,
            hittingSwingAtBalls: input.hitting.swingAtBalls,
            hittingSwingAtStrikes: input.hitting.swingAtStrikes,
            hittingCalledStrikes: input.hitting.calledStrikes,
            hittingSwingingStrikes: input.hitting.swingingStrikes,
            hittingInZonePitches: input.hitting.inZonePitches,
            hittingInZoneContact: input.hitting.inZoneContact,
            hittingOutZoneContact: input.hitting.outZoneContact,
            hittingFouls: input.hitting.fouls,
            hittingBallsInPlay: input.hitting.ballsInPlay,
            hittingExitVelocityCount: input.hitting.exitVelocity.count,
            hittingTotalExitVelocity: input.hitting.exitVelocity.totalExitVelo,
            pitchingGames: input.pitching.games,
            pitchingStarts: input.pitching.starts,
            pitchingBattersFaced: input.pitching.battersFaced,
            pitchingOuts: input.pitching.outs,
            pitchingHitsAllowed: input.pitching.hitsAllowed,
            pitchingDoublesAllowed: input.pitching.doublesAllowed,
            pitchingTriplesAllowed: input.pitching.triplesAllowed,
            pitchingHomeRunsAllowed: input.pitching.homeRunsAllowed,
            pitchingBbAllowed: input.pitching.bbAllowed,
            pitchingSo: input.pitching.so,
            pitchingHbpAllowed: input.pitching.hbpAllowed,
            pitchingGroundBallsAllowed: input.pitching.groundBallsAllowed,
            pitchingFlyBallsAllowed: input.pitching.flyBallsAllowed,
            pitchingLineDrivesAllowed: input.pitching.lineDrivesAllowed,
            pitchingPopupsAllowed: input.pitching.popupsAllowed,
            pitchingPitchesThrown: input.pitching.pitchesThrown,
            pitchingBallsThrown: input.pitching.ballsThrown,
            pitchingStrikesThrown: input.pitching.strikesThrown,
            pitchingSwingsInduced: input.pitching.swingsInduced,
            pitchingSwingAtBallsAllowed: input.pitching.swingAtBallsAllowed,
            pitchingSwingAtStrikesAllowed: input.pitching.swingAtStrikesAllowed,
            pitchingInZoneContactAllowed: input.pitching.inZoneContactAllowed,
            pitchingOutZoneContactAllowed: input.pitching.outZoneContactAllowed,
            pitchingFoulsAllowed: input.pitching.foulsAllowed,
            pitchingBallsInPlayAllowed: input.pitching.ballsInPlayAllowed,
            fieldingErrors: input.fielding.errors,
            fieldingAssists: input.fielding.assists,
            fieldingPutouts: input.fielding.putouts,
            fieldingDoublePlays: input.fielding.doublePlays,
            fieldingOutfieldAssists: input.fielding.outfieldAssists,
            fieldingCatcherCaughtStealing: input.fielding.catcherCaughtStealing,
            fieldingCatcherStolenBasesAllowed: input.fielding.catcherStolenBasesAllowed,
            fieldingPassedBalls: input.fielding.passedBalls,
            runningSb: input.running.sb,
            runningCs: input.running.cs,
            runningSbAttempts: input.running.sbAttempts,
            hittingVsLPa: input.splits.hitting.vsL.pa,
            hittingVsLAb: input.splits.hitting.vsL.ab,
            hittingVsLHits: input.splits.hitting.vsL.hits,
            hittingVsLDoubles: input.splits.hitting.vsL.doubles,
            hittingVsLTriples: input.splits.hitting.vsL.triples,
            hittingVsLHomeRuns: input.splits.hitting.vsL.homeRuns,
            hittingVsLBb: input.splits.hitting.vsL.bb,
            hittingVsLSo: input.splits.hitting.vsL.so,
            hittingVsLHbp: input.splits.hitting.vsL.hbp,
            hittingVsLExitVelocityCount: input.splits.hitting.vsL.exitVelocityCount,
            hittingVsLTotalExitVelocity: input.splits.hitting.vsL.totalExitVelocity,
            hittingVsRPa: input.splits.hitting.vsR.pa,
            hittingVsRAb: input.splits.hitting.vsR.ab,
            hittingVsRHits: input.splits.hitting.vsR.hits,
            hittingVsRDoubles: input.splits.hitting.vsR.doubles,
            hittingVsRTriples: input.splits.hitting.vsR.triples,
            hittingVsRHomeRuns: input.splits.hitting.vsR.homeRuns,
            hittingVsRBb: input.splits.hitting.vsR.bb,
            hittingVsRSo: input.splits.hitting.vsR.so,
            hittingVsRHbp: input.splits.hitting.vsR.hbp,
            hittingVsRExitVelocityCount: input.splits.hitting.vsR.exitVelocityCount,
            hittingVsRTotalExitVelocity: input.splits.hitting.vsR.totalExitVelocity,
            pitchingVsLBattersFaced: input.splits.pitching.vsL.battersFaced,
            pitchingVsLOuts: input.splits.pitching.vsL.outs,
            pitchingVsLRunsAllowed: input.splits.pitching.vsL.runsAllowed,
            pitchingVsLEarnedRunsAllowed: input.splits.pitching.vsL.earnedRunsAllowed,
            pitchingVsLHitsAllowed: input.splits.pitching.vsL.hitsAllowed,
            pitchingVsLDoublesAllowed: input.splits.pitching.vsL.doublesAllowed,
            pitchingVsLTriplesAllowed: input.splits.pitching.vsL.triplesAllowed,
            pitchingVsLHomeRunsAllowed: input.splits.pitching.vsL.homeRunsAllowed,
            pitchingVsLBbAllowed: input.splits.pitching.vsL.bbAllowed,
            pitchingVsLSo: input.splits.pitching.vsL.so,
            pitchingVsLHbpAllowed: input.splits.pitching.vsL.hbpAllowed,
            pitchingVsRBattersFaced: input.splits.pitching.vsR.battersFaced,
            pitchingVsROuts: input.splits.pitching.vsR.outs,
            pitchingVsRRunsAllowed: input.splits.pitching.vsR.runsAllowed,
            pitchingVsREarnedRunsAllowed: input.splits.pitching.vsR.earnedRunsAllowed,
            pitchingVsRHitsAllowed: input.splits.pitching.vsR.hitsAllowed,
            pitchingVsRDoublesAllowed: input.splits.pitching.vsR.doublesAllowed,
            pitchingVsRTriplesAllowed: input.splits.pitching.vsR.triplesAllowed,
            pitchingVsRHomeRunsAllowed: input.splits.pitching.vsR.homeRunsAllowed,
            pitchingVsRBbAllowed: input.splits.pitching.vsR.bbAllowed,
            pitchingVsRSo: input.splits.pitching.vsR.so,
            pitchingVsRHbpAllowed: input.splits.pitching.vsR.hbpAllowed,
            pitchTypes: JSON.stringify(
                input.pitching.pitchTypes
            ),
            gamesAtPosition: JSON.stringify(
                input.fielding.gamesAtPosition
            ),
            inningsAtPosition: JSON.stringify(
                input.fielding.inningsAtPosition
            )
        })
    }

    public deleteByGame(gamePk: number): void {
        this.database.prepare(`
            DELETE FROM player_rating_inputs
            WHERE game_pk = ?
        `).run(
            gamePk
        )
    }

    private getAggregatedInputs(selectedInputsQuery: string, parameters: Record<string, string | number>, filterPlayerIds?: Set<string>): PlayerRatingInput[] {
        const rows = this.database.prepare(`
            WITH selected_inputs AS (
                ${selectedInputsQuery}
            )
            SELECT
                selected_inputs.player_id AS playerId,
                ${aggregateColumns},
                '{}' AS pitchTypes,
                '{}' AS gamesAtPosition,
                '{}' AS inningsAtPosition,
                GROUP_CONCAT(
                    NULLIF(
                        input.pitch_types,
                        '{}'
                    ),
                    CHAR(30)
                ) AS pitchTypeRows,
                GROUP_CONCAT(
                    NULLIF(
                        input.games_at_position,
                        '{}'
                    ),
                    CHAR(30)
                ) AS gamesAtPositionRows,
                GROUP_CONCAT(
                    NULLIF(
                        input.innings_at_position,
                        '{}'
                    ),
                    CHAR(30)
                ) AS inningsAtPositionRows
            FROM selected_inputs
            INNER JOIN player_rating_inputs input
                ON input.game_pk = selected_inputs.game_pk
                AND input.player_id = selected_inputs.player_id
            GROUP BY selected_inputs.player_id
            ORDER BY selected_inputs.player_id
        `).all(
            parameters
        ) as PlayerRatingAggregatedRow[]

        return rows
            .filter(row =>
                !filterPlayerIds ||
                filterPlayerIds.size === 0 ||
                filterPlayerIds.has(
                    String(
                        row.playerId
                    )
                )
            )
            .map(row => {
                row.pitchTypes = JSON.stringify(
                    this.aggregatePitchTypes(
                        row.pitchTypeRows
                    )
                )

                row.gamesAtPosition = JSON.stringify(
                    this.aggregateNumericMaps(
                        row.gamesAtPositionRows
                    )
                )

                row.inningsAtPosition = JSON.stringify(
                    this.aggregateNumericMaps(
                        row.inningsAtPositionRows
                    )
                )

                return this.mapRow(
                    row
                )
            })
    }

    private aggregatePitchTypes(data: string | null): Record<string, {
        count: number
        totalMph: number
        avgMph: number
        totalHorizontalBreak: number
        avgHorizontalBreak: number
        totalVerticalBreak: number
        avgVerticalBreak: number
    }> {
        const result: Record<string, {
            count: number
            totalMph: number
            avgMph: number
            totalHorizontalBreak: number
            avgHorizontalBreak: number
            totalVerticalBreak: number
            avgVerticalBreak: number
        }> = {}

        if (!data) {
            return result
        }

        for (const json of data.split(
            "\u001e"
        )) {
            const pitchTypes = JSON.parse(
                json
            ) as Record<string, {
                count?: number
                totalMph?: number
                totalHorizontalBreak?: number
                totalVerticalBreak?: number
            }>

            for (const [pitchType, pitch] of Object.entries(pitchTypes)) {
                const aggregate = result[pitchType] ?? {
                    count: 0,
                    totalMph: 0,
                    avgMph: 0,
                    totalHorizontalBreak: 0,
                    avgHorizontalBreak: 0,
                    totalVerticalBreak: 0,
                    avgVerticalBreak: 0
                }

                aggregate.count += pitch.count ?? 0
                aggregate.totalMph += pitch.totalMph ?? 0
                aggregate.totalHorizontalBreak += pitch.totalHorizontalBreak ?? 0
                aggregate.totalVerticalBreak += pitch.totalVerticalBreak ?? 0

                result[pitchType] = aggregate
            }
        }

        for (const pitch of Object.values(result)) {
            pitch.avgMph = this.getAverage(
                pitch.totalMph,
                pitch.count
            )

            pitch.avgHorizontalBreak = this.getAverage(
                pitch.totalHorizontalBreak,
                pitch.count
            )

            pitch.avgVerticalBreak = this.getAverage(
                pitch.totalVerticalBreak,
                pitch.count
            )
        }

        return result
    }

    private aggregateNumericMaps(data: string | null): Record<string, number> {
        const result: Record<string, number> = {}

        if (!data) {
            return result
        }

        for (const json of data.split(
            "\u001e"
        )) {
            const values = JSON.parse(
                json
            ) as Record<string, number>

            for (const [key, value] of Object.entries(values)) {
                result[key] = (
                    result[key] ??
                    0
                ) + value
            }
        }

        return result
    }

    private mapRow(row: PlayerRatingInputRow): PlayerRatingInput {
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



}

const aggregateColumns = `
    SUM(input.hitting_games) AS hittingGames,
    SUM(input.hitting_pa) AS hittingPa,
    SUM(input.hitting_ab) AS hittingAb,
    SUM(input.hitting_hits) AS hittingHits,
    SUM(input.hitting_doubles) AS hittingDoubles,
    SUM(input.hitting_triples) AS hittingTriples,
    SUM(input.hitting_home_runs) AS hittingHomeRuns,
    SUM(input.hitting_bb) AS hittingBb,
    SUM(input.hitting_so) AS hittingSo,
    SUM(input.hitting_hbp) AS hittingHbp,
    SUM(input.hitting_ground_balls) AS hittingGroundBalls,
    SUM(input.hitting_fly_balls) AS hittingFlyBalls,
    SUM(input.hitting_line_drives) AS hittingLineDrives,
    SUM(input.hitting_popups) AS hittingPopups,
    SUM(input.hitting_pitches_seen) AS hittingPitchesSeen,
    SUM(input.hitting_balls_seen) AS hittingBallsSeen,
    SUM(input.hitting_strikes_seen) AS hittingStrikesSeen,
    SUM(input.hitting_swings) AS hittingSwings,
    SUM(input.hitting_swing_at_balls) AS hittingSwingAtBalls,
    SUM(input.hitting_swing_at_strikes) AS hittingSwingAtStrikes,
    SUM(input.hitting_called_strikes) AS hittingCalledStrikes,
    SUM(input.hitting_swinging_strikes) AS hittingSwingingStrikes,
    SUM(input.hitting_in_zone_pitches) AS hittingInZonePitches,
    SUM(input.hitting_in_zone_contact) AS hittingInZoneContact,
    SUM(input.hitting_out_zone_contact) AS hittingOutZoneContact,
    SUM(input.hitting_fouls) AS hittingFouls,
    SUM(input.hitting_balls_in_play) AS hittingBallsInPlay,
    SUM(input.hitting_exit_velocity_count) AS hittingExitVelocityCount,
    SUM(input.hitting_total_exit_velocity) AS hittingTotalExitVelocity,
    SUM(input.pitching_games) AS pitchingGames,
    SUM(input.pitching_starts) AS pitchingStarts,
    SUM(input.pitching_batters_faced) AS pitchingBattersFaced,
    SUM(input.pitching_outs) AS pitchingOuts,
    SUM(input.pitching_hits_allowed) AS pitchingHitsAllowed,
    SUM(input.pitching_doubles_allowed) AS pitchingDoublesAllowed,
    SUM(input.pitching_triples_allowed) AS pitchingTriplesAllowed,
    SUM(input.pitching_home_runs_allowed) AS pitchingHomeRunsAllowed,
    SUM(input.pitching_bb_allowed) AS pitchingBbAllowed,
    SUM(input.pitching_so) AS pitchingSo,
    SUM(input.pitching_hbp_allowed) AS pitchingHbpAllowed,
    SUM(input.pitching_ground_balls_allowed) AS pitchingGroundBallsAllowed,
    SUM(input.pitching_fly_balls_allowed) AS pitchingFlyBallsAllowed,
    SUM(input.pitching_line_drives_allowed) AS pitchingLineDrivesAllowed,
    SUM(input.pitching_popups_allowed) AS pitchingPopupsAllowed,
    SUM(input.pitching_pitches_thrown) AS pitchingPitchesThrown,
    SUM(input.pitching_balls_thrown) AS pitchingBallsThrown,
    SUM(input.pitching_strikes_thrown) AS pitchingStrikesThrown,
    SUM(input.pitching_swings_induced) AS pitchingSwingsInduced,
    SUM(input.pitching_swing_at_balls_allowed) AS pitchingSwingAtBallsAllowed,
    SUM(input.pitching_swing_at_strikes_allowed) AS pitchingSwingAtStrikesAllowed,
    SUM(input.pitching_in_zone_contact_allowed) AS pitchingInZoneContactAllowed,
    SUM(input.pitching_out_zone_contact_allowed) AS pitchingOutZoneContactAllowed,
    SUM(input.pitching_fouls_allowed) AS pitchingFoulsAllowed,
    SUM(input.pitching_balls_in_play_allowed) AS pitchingBallsInPlayAllowed,
    SUM(input.fielding_errors) AS fieldingErrors,
    SUM(input.fielding_assists) AS fieldingAssists,
    SUM(input.fielding_putouts) AS fieldingPutouts,
    SUM(input.fielding_double_plays) AS fieldingDoublePlays,
    SUM(input.fielding_outfield_assists) AS fieldingOutfieldAssists,
    SUM(input.fielding_catcher_caught_stealing) AS fieldingCatcherCaughtStealing,
    SUM(input.fielding_catcher_stolen_bases_allowed) AS fieldingCatcherStolenBasesAllowed,
    SUM(input.fielding_passed_balls) AS fieldingPassedBalls,
    SUM(input.running_sb) AS runningSb,
    SUM(input.running_cs) AS runningCs,
    SUM(input.running_sb_attempts) AS runningSbAttempts,
    SUM(input.hitting_vs_l_pa) AS hittingVsLPa,
    SUM(input.hitting_vs_l_ab) AS hittingVsLAb,
    SUM(input.hitting_vs_l_hits) AS hittingVsLHits,
    SUM(input.hitting_vs_l_doubles) AS hittingVsLDoubles,
    SUM(input.hitting_vs_l_triples) AS hittingVsLTriples,
    SUM(input.hitting_vs_l_home_runs) AS hittingVsLHomeRuns,
    SUM(input.hitting_vs_l_bb) AS hittingVsLBb,
    SUM(input.hitting_vs_l_so) AS hittingVsLSo,
    SUM(input.hitting_vs_l_hbp) AS hittingVsLHbp,
    SUM(input.hitting_vs_l_exit_velocity_count) AS hittingVsLExitVelocityCount,
    SUM(input.hitting_vs_l_total_exit_velocity) AS hittingVsLTotalExitVelocity,
    SUM(input.hitting_vs_r_pa) AS hittingVsRPa,
    SUM(input.hitting_vs_r_ab) AS hittingVsRAb,
    SUM(input.hitting_vs_r_hits) AS hittingVsRHits,
    SUM(input.hitting_vs_r_doubles) AS hittingVsRDoubles,
    SUM(input.hitting_vs_r_triples) AS hittingVsRTriples,
    SUM(input.hitting_vs_r_home_runs) AS hittingVsRHomeRuns,
    SUM(input.hitting_vs_r_bb) AS hittingVsRBb,
    SUM(input.hitting_vs_r_so) AS hittingVsRSo,
    SUM(input.hitting_vs_r_hbp) AS hittingVsRHbp,
    SUM(input.hitting_vs_r_exit_velocity_count) AS hittingVsRExitVelocityCount,
    SUM(input.hitting_vs_r_total_exit_velocity) AS hittingVsRTotalExitVelocity,
    SUM(input.pitching_vs_l_batters_faced) AS pitchingVsLBattersFaced,
    SUM(input.pitching_vs_l_outs) AS pitchingVsLOuts,
    SUM(input.pitching_vs_l_runs_allowed) AS pitchingVsLRunsAllowed,
    SUM(input.pitching_vs_l_earned_runs_allowed) AS pitchingVsLEarnedRunsAllowed,
    SUM(input.pitching_vs_l_hits_allowed) AS pitchingVsLHitsAllowed,
    SUM(input.pitching_vs_l_doubles_allowed) AS pitchingVsLDoublesAllowed,
    SUM(input.pitching_vs_l_triples_allowed) AS pitchingVsLTriplesAllowed,
    SUM(input.pitching_vs_l_home_runs_allowed) AS pitchingVsLHomeRunsAllowed,
    SUM(input.pitching_vs_l_bb_allowed) AS pitchingVsLBbAllowed,
    SUM(input.pitching_vs_l_so) AS pitchingVsLSo,
    SUM(input.pitching_vs_l_hbp_allowed) AS pitchingVsLHbpAllowed,
    SUM(input.pitching_vs_r_batters_faced) AS pitchingVsRBattersFaced,
    SUM(input.pitching_vs_r_outs) AS pitchingVsROuts,
    SUM(input.pitching_vs_r_runs_allowed) AS pitchingVsRRunsAllowed,
    SUM(input.pitching_vs_r_earned_runs_allowed) AS pitchingVsREarnedRunsAllowed,
    SUM(input.pitching_vs_r_hits_allowed) AS pitchingVsRHitsAllowed,
    SUM(input.pitching_vs_r_doubles_allowed) AS pitchingVsRDoublesAllowed,
    SUM(input.pitching_vs_r_triples_allowed) AS pitchingVsRTriplesAllowed,
    SUM(input.pitching_vs_r_home_runs_allowed) AS pitchingVsRHomeRunsAllowed,
    SUM(input.pitching_vs_r_bb_allowed) AS pitchingVsRBbAllowed,
    SUM(input.pitching_vs_r_so) AS pitchingVsRSo,
    SUM(input.pitching_vs_r_hbp_allowed) AS pitchingVsRHbpAllowed
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
            selected_players AS (
                SELECT
                    player_appearances.player_id
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
            hitting_plate_totals AS (
                SELECT
                    selected_players.player_id,
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
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.batter_id = selected_players.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY selected_players.player_id
            ),
            hitting_pitch_totals AS (
                SELECT
                    selected_players.player_id,
                    COUNT(*) AS pitches_seen,
                    SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls_seen,
                    SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes_seen,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS swing_at_balls,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS swing_at_strikes,
                    SUM(CASE WHEN pitches.call_code = 'C' THEN 1 ELSE 0 END) AS called_strikes,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'W') THEN 1 ELSE 0 END) AS swinging_strikes,
                    SUM(CASE WHEN pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone_pitches,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone_contact,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS out_zone_contact,
                    SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls,
                    SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN pitches.launch_speed ELSE 0 END) AS total_exit_velocity,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN 1 ELSE 0 END) AS exit_velocity_count
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.batter_id = selected_players.player_id
                INNER JOIN classified_pitches pitches
                    ON pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY selected_players.player_id
            ),
            pitching_appearance_totals AS (
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
            pitching_plate_totals AS (
                SELECT
                    selected_players.player_id,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS batters_faced,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs_allowed,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb_allowed,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp_allowed
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.pitcher_id = selected_players.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY selected_players.player_id
            ),
            pitching_out_totals AS (
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
            pitching_pitch_totals AS (
                SELECT
                    selected_players.player_id,
                    COUNT(*) AS pitches_thrown,
                    SUM(CASE WHEN pitches.is_ball = 1 OR pitches.call_code = '*B' THEN 1 ELSE 0 END) AS balls_thrown,
                    SUM(CASE WHEN pitches.is_strike = 1 OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS strikes_thrown,
                    SUM(CASE WHEN pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS swings_induced,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS swing_at_balls_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('S', 'F', 'T', 'W') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS swing_at_strikes_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 1 THEN 1 ELSE 0 END) AS in_zone_contact_allowed,
                    SUM(CASE WHEN (pitches.call_code IN ('F', 'T') OR pitches.is_in_play = 1) AND pitches.is_in_zone = 0 THEN 1 ELSE 0 END) AS out_zone_contact_allowed,
                    SUM(CASE WHEN pitches.call_code IN ('F', 'T') THEN 1 ELSE 0 END) AS fouls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 THEN 1 ELSE 0 END) AS balls_in_play_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'ground_ball' THEN 1 ELSE 0 END) AS ground_balls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'fly_ball' THEN 1 ELSE 0 END) AS fly_balls_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'line_drive' THEN 1 ELSE 0 END) AS line_drives_allowed,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.trajectory = 'popup' THEN 1 ELSE 0 END) AS popups_allowed
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.pitcher_id = selected_players.player_id
                INNER JOIN classified_pitches pitches
                    ON pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY selected_players.player_id
            ),
            pitch_type_totals AS (
                SELECT
                    selected_players.player_id,
                    pitches.pitch_type_code,
                    SUM(CASE WHEN pitches.start_speed > 0 THEN 1 ELSE 0 END) AS count,
                    SUM(CASE WHEN pitches.start_speed > 0 THEN pitches.start_speed ELSE 0 END) AS total_mph,
                    SUM(CASE WHEN pitches.break_horizontal IS NOT NULL THEN pitches.break_horizontal ELSE 0 END) AS total_horizontal_break,
                    SUM(CASE WHEN pitches.break_vertical IS NOT NULL THEN pitches.break_vertical ELSE 0 END) AS total_vertical_break
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.pitcher_id = selected_players.player_id
                INNER JOIN pitches
                    ON pitches.game_pk = plate_appearances.game_pk
                    AND pitches.at_bat_index = plate_appearances.at_bat_index
                WHERE pitches.pitch_type_code IS NOT NULL
                    AND pitches.pitch_type_code != ''
                GROUP BY
                    selected_players.player_id,
                    pitches.pitch_type_code
            ),
            pitch_types AS (
                SELECT
                    pitch_type_totals.player_id,
                    json_group_object(
                        pitch_type_totals.pitch_type_code,
                        json_object(
                            'count', pitch_type_totals.count,
                            'totalMph', pitch_type_totals.total_mph,
                            'avgMph', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(pitch_type_totals.total_mph / pitch_type_totals.count, 3)
                                ELSE 0
                            END,
                            'totalHorizontalBreak', pitch_type_totals.total_horizontal_break,
                            'avgHorizontalBreak', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(pitch_type_totals.total_horizontal_break / pitch_type_totals.count, 3)
                                ELSE 0
                            END,
                            'totalVerticalBreak', pitch_type_totals.total_vertical_break,
                            'avgVerticalBreak', CASE
                                WHEN pitch_type_totals.count > 0
                                THEN ROUND(pitch_type_totals.total_vertical_break / pitch_type_totals.count, 3)
                                ELSE 0
                            END
                        )
                    ) AS data
                FROM pitch_type_totals
                GROUP BY pitch_type_totals.player_id
            ),
            fielding AS (
                SELECT
                    selected_players.player_id,
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
            position_records AS (
                SELECT
                    selected_players.player_id,
                    defensive_events.from_position AS position
                FROM selected_players
                INNER JOIN defensive_events
                    ON defensive_events.game_pk = @gamePk
                    AND defensive_events.player_id = selected_players.player_id
                WHERE defensive_events.from_position IS NOT NULL
                    AND defensive_events.from_position != ''

                UNION

                SELECT
                    selected_players.player_id,
                    defensive_events.to_position AS position
                FROM selected_players
                INNER JOIN defensive_events
                    ON defensive_events.game_pk = @gamePk
                    AND defensive_events.player_id = selected_players.player_id
                WHERE defensive_events.to_position IS NOT NULL
                    AND defensive_events.to_position != ''

                UNION

                SELECT
                    selected_players.player_id,
                    fielding_credits.position_abbreviation AS position
                FROM selected_players
                INNER JOIN fielding_credits
                    ON fielding_credits.game_pk = @gamePk
                    AND fielding_credits.player_id = selected_players.player_id
                WHERE fielding_credits.position_abbreviation IS NOT NULL
                    AND fielding_credits.position_abbreviation != ''
            ),
            games_at_position AS (
                SELECT
                    position_records.player_id,
                    json_group_object(
                        position_records.position,
                        1
                    ) AS data
                FROM position_records
                GROUP BY position_records.player_id
            ),
            running AS (
                SELECT
                    selected_players.player_id,
                    SUM(CASE WHEN runner_movements.event_type IN ('stolen_base_2b', 'stolen_base_3b') THEN 1 ELSE 0 END) AS sb,
                    SUM(CASE WHEN runner_movements.event_type IN ('caught_stealing_2b', 'caught_stealing_3b') THEN 1 ELSE 0 END) AS cs,
                    SUM(CASE WHEN runner_movements.event_type IN ('stolen_base_2b', 'stolen_base_3b', 'caught_stealing_2b', 'caught_stealing_3b') THEN 1 ELSE 0 END) AS sb_attempts
                FROM selected_players
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = @gamePk
                    AND runner_movements.runner_id = selected_players.player_id
                GROUP BY selected_players.player_id
            ),
            hitting_split_plate_totals AS (
                SELECT
                    selected_players.player_id,
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
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.batter_id = selected_players.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY
                    selected_players.player_id,
                    split
            ),
            hitting_split_exit_velocity AS (
                SELECT
                    selected_players.player_id,
                    CASE WHEN plate_appearances.pitch_hand_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN 1 ELSE 0 END) AS exit_velocity_count,
                    SUM(CASE WHEN pitches.is_in_play = 1 AND pitches.launch_speed > 0 THEN pitches.launch_speed ELSE 0 END) AS total_exit_velocity
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.batter_id = selected_players.player_id
                INNER JOIN pitches
                    ON pitches.game_pk = plate_appearances.game_pk
                    AND pitches.at_bat_index = plate_appearances.at_bat_index
                GROUP BY
                    selected_players.player_id,
                    split
            ),
            hitting_splits AS (
                SELECT
                    hitting_split_plate_totals.player_id,
                    hitting_split_plate_totals.split,
                    hitting_split_plate_totals.pa,
                    hitting_split_plate_totals.ab,
                    hitting_split_plate_totals.hits,
                    hitting_split_plate_totals.doubles,
                    hitting_split_plate_totals.triples,
                    hitting_split_plate_totals.home_runs,
                    hitting_split_plate_totals.bb,
                    hitting_split_plate_totals.so,
                    hitting_split_plate_totals.hbp,
                    COALESCE(hitting_split_exit_velocity.exit_velocity_count, 0) AS exit_velocity_count,
                    COALESCE(hitting_split_exit_velocity.total_exit_velocity, 0) AS total_exit_velocity
                FROM hitting_split_plate_totals
                LEFT JOIN hitting_split_exit_velocity
                    ON hitting_split_exit_velocity.player_id = hitting_split_plate_totals.player_id
                    AND hitting_split_exit_velocity.split = hitting_split_plate_totals.split
            ),
            pitching_split_plate_totals AS (
                SELECT
                    selected_players.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN plate_appearances.event_type IN (${plateAppearanceEvents}) THEN 1 ELSE 0 END) AS batters_faced,
                    SUM(CASE WHEN plate_appearances.event_type IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) AS hits_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'double' THEN 1 ELSE 0 END) AS doubles_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'triple' THEN 1 ELSE 0 END) AS triples_allowed,
                    SUM(CASE WHEN plate_appearances.event_type = 'home_run' THEN 1 ELSE 0 END) AS home_runs_allowed,
                    SUM(CASE WHEN plate_appearances.event_type IN ('walk', 'intent_walk') THEN 1 ELSE 0 END) AS bb_allowed,
                    SUM(CASE WHEN plate_appearances.event_type LIKE 'strikeout%' THEN 1 ELSE 0 END) AS so,
                    SUM(CASE WHEN plate_appearances.event_type = 'hit_by_pitch' THEN 1 ELSE 0 END) AS hbp_allowed
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.pitcher_id = selected_players.player_id
                WHERE plate_appearances.is_complete = 1
                GROUP BY
                    selected_players.player_id,
                    split
            ),
            pitching_split_out_totals AS (
                SELECT
                    selected_players.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN runner_movements.is_out = 1 THEN 1 ELSE 0 END) AS outs
                FROM selected_players
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = @gamePk
                    AND plate_appearances.pitcher_id = selected_players.player_id
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = plate_appearances.game_pk
                    AND runner_movements.at_bat_index = plate_appearances.at_bat_index
                GROUP BY
                    selected_players.player_id,
                    split
            ),
            pitching_split_run_totals AS (
                SELECT
                    selected_players.player_id,
                    CASE WHEN plate_appearances.bat_side_code = 'L' THEN 'vsL' ELSE 'vsR' END AS split,
                    SUM(CASE WHEN runner_movements.end_base = 'score' OR runner_movements.is_scoring_event = 1 THEN 1 ELSE 0 END) AS runs_allowed,
                    SUM(CASE WHEN (runner_movements.end_base = 'score' OR runner_movements.is_scoring_event = 1) AND runner_movements.earned = 1 THEN 1 ELSE 0 END) AS earned_runs_allowed
                FROM selected_players
                INNER JOIN runner_movements
                    ON runner_movements.game_pk = @gamePk
                    AND runner_movements.responsible_pitcher_id = selected_players.player_id
                INNER JOIN plate_appearances
                    ON plate_appearances.game_pk = runner_movements.game_pk
                    AND plate_appearances.at_bat_index = runner_movements.at_bat_index
                    AND plate_appearances.pitcher_id = selected_players.player_id
                GROUP BY
                    selected_players.player_id,
                    split
            ),
            pitching_splits AS (
                SELECT
                    pitching_split_plate_totals.player_id,
                    pitching_split_plate_totals.split,
                    pitching_split_plate_totals.batters_faced,
                    COALESCE(pitching_split_out_totals.outs, 0) AS outs,
                    COALESCE(pitching_split_run_totals.runs_allowed, 0) AS runs_allowed,
                    COALESCE(pitching_split_run_totals.earned_runs_allowed, 0) AS earned_runs_allowed,
                    pitching_split_plate_totals.hits_allowed,
                    pitching_split_plate_totals.doubles_allowed,
                    pitching_split_plate_totals.triples_allowed,
                    pitching_split_plate_totals.home_runs_allowed,
                    pitching_split_plate_totals.bb_allowed,
                    pitching_split_plate_totals.so,
                    pitching_split_plate_totals.hbp_allowed
                FROM pitching_split_plate_totals
                LEFT JOIN pitching_split_out_totals
                    ON pitching_split_out_totals.player_id = pitching_split_plate_totals.player_id
                    AND pitching_split_out_totals.split = pitching_split_plate_totals.split
                LEFT JOIN pitching_split_run_totals
                    ON pitching_split_run_totals.player_id = pitching_split_plate_totals.player_id
                    AND pitching_split_run_totals.split = pitching_split_plate_totals.split
            )
            INSERT INTO player_rating_inputs (
                game_pk,
                player_id,
                game_date,
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
                @gamePk,
                selected_players.player_id,
                (
                    SELECT games.game_date
                    FROM games
                    WHERE games.game_pk = @gamePk
                ),
                COALESCE(hitting_plate_totals.games, 0),
                COALESCE(hitting_plate_totals.pa, 0),
                COALESCE(hitting_plate_totals.ab, 0),
                COALESCE(hitting_plate_totals.hits, 0),
                COALESCE(hitting_plate_totals.doubles, 0),
                COALESCE(hitting_plate_totals.triples, 0),
                COALESCE(hitting_plate_totals.home_runs, 0),
                COALESCE(hitting_plate_totals.bb, 0),
                COALESCE(hitting_plate_totals.so, 0),
                COALESCE(hitting_plate_totals.hbp, 0),
                COALESCE(hitting_pitch_totals.ground_balls, 0),
                COALESCE(hitting_pitch_totals.fly_balls, 0),
                COALESCE(hitting_pitch_totals.line_drives, 0),
                COALESCE(hitting_pitch_totals.popups, 0),
                COALESCE(hitting_pitch_totals.pitches_seen, 0),
                COALESCE(hitting_pitch_totals.balls_seen, 0),
                COALESCE(hitting_pitch_totals.strikes_seen, 0),
                COALESCE(hitting_pitch_totals.swings, 0),
                COALESCE(hitting_pitch_totals.swing_at_balls, 0),
                COALESCE(hitting_pitch_totals.swing_at_strikes, 0),
                COALESCE(hitting_pitch_totals.called_strikes, 0),
                COALESCE(hitting_pitch_totals.swinging_strikes, 0),
                COALESCE(hitting_pitch_totals.in_zone_pitches, 0),
                COALESCE(hitting_pitch_totals.in_zone_contact, 0),
                COALESCE(hitting_pitch_totals.out_zone_contact, 0),
                COALESCE(hitting_pitch_totals.fouls, 0),
                COALESCE(hitting_pitch_totals.balls_in_play, 0),
                COALESCE(hitting_pitch_totals.exit_velocity_count, 0),
                COALESCE(hitting_pitch_totals.total_exit_velocity, 0),
                COALESCE(pitching_appearance_totals.games, 0),
                COALESCE(pitching_appearance_totals.starts, 0),
                COALESCE(pitching_plate_totals.batters_faced, 0),
                COALESCE(pitching_out_totals.outs, 0),
                COALESCE(pitching_plate_totals.hits_allowed, 0),
                COALESCE(pitching_plate_totals.doubles_allowed, 0),
                COALESCE(pitching_plate_totals.triples_allowed, 0),
                COALESCE(pitching_plate_totals.home_runs_allowed, 0),
                COALESCE(pitching_plate_totals.bb_allowed, 0),
                COALESCE(pitching_plate_totals.so, 0),
                COALESCE(pitching_plate_totals.hbp_allowed, 0),
                COALESCE(pitching_pitch_totals.ground_balls_allowed, 0),
                COALESCE(pitching_pitch_totals.fly_balls_allowed, 0),
                COALESCE(pitching_pitch_totals.line_drives_allowed, 0),
                COALESCE(pitching_pitch_totals.popups_allowed, 0),
                COALESCE(pitching_pitch_totals.pitches_thrown, 0),
                COALESCE(pitching_pitch_totals.balls_thrown, 0),
                COALESCE(pitching_pitch_totals.strikes_thrown, 0),
                COALESCE(pitching_pitch_totals.swings_induced, 0),
                COALESCE(pitching_pitch_totals.swing_at_balls_allowed, 0),
                COALESCE(pitching_pitch_totals.swing_at_strikes_allowed, 0),
                COALESCE(pitching_pitch_totals.in_zone_contact_allowed, 0),
                COALESCE(pitching_pitch_totals.out_zone_contact_allowed, 0),
                COALESCE(pitching_pitch_totals.fouls_allowed, 0),
                COALESCE(pitching_pitch_totals.balls_in_play_allowed, 0),
                COALESCE(fielding.errors, 0),
                COALESCE(fielding.assists, 0),
                COALESCE(fielding.putouts, 0),
                COALESCE(fielding.double_plays, 0),
                COALESCE(fielding.outfield_assists, 0),
                COALESCE(fielding.catcher_caught_stealing, 0),
                COALESCE(fielding.catcher_stolen_bases_allowed, 0),
                COALESCE(fielding.passed_balls, 0),
                COALESCE(running.sb, 0),
                COALESCE(running.cs, 0),
                COALESCE(running.sb_attempts, 0),
                COALESCE(hitting_vs_l.pa, 0),
                COALESCE(hitting_vs_l.ab, 0),
                COALESCE(hitting_vs_l.hits, 0),
                COALESCE(hitting_vs_l.doubles, 0),
                COALESCE(hitting_vs_l.triples, 0),
                COALESCE(hitting_vs_l.home_runs, 0),
                COALESCE(hitting_vs_l.bb, 0),
                COALESCE(hitting_vs_l.so, 0),
                COALESCE(hitting_vs_l.hbp, 0),
                COALESCE(hitting_vs_l.exit_velocity_count, 0),
                COALESCE(hitting_vs_l.total_exit_velocity, 0),
                COALESCE(hitting_vs_r.pa, 0),
                COALESCE(hitting_vs_r.ab, 0),
                COALESCE(hitting_vs_r.hits, 0),
                COALESCE(hitting_vs_r.doubles, 0),
                COALESCE(hitting_vs_r.triples, 0),
                COALESCE(hitting_vs_r.home_runs, 0),
                COALESCE(hitting_vs_r.bb, 0),
                COALESCE(hitting_vs_r.so, 0),
                COALESCE(hitting_vs_r.hbp, 0),
                COALESCE(hitting_vs_r.exit_velocity_count, 0),
                COALESCE(hitting_vs_r.total_exit_velocity, 0),
                COALESCE(pitching_vs_l.batters_faced, 0),
                COALESCE(pitching_vs_l.outs, 0),
                COALESCE(pitching_vs_l.runs_allowed, 0),
                COALESCE(pitching_vs_l.earned_runs_allowed, 0),
                COALESCE(pitching_vs_l.hits_allowed, 0),
                COALESCE(pitching_vs_l.doubles_allowed, 0),
                COALESCE(pitching_vs_l.triples_allowed, 0),
                COALESCE(pitching_vs_l.home_runs_allowed, 0),
                COALESCE(pitching_vs_l.bb_allowed, 0),
                COALESCE(pitching_vs_l.so, 0),
                COALESCE(pitching_vs_l.hbp_allowed, 0),
                COALESCE(pitching_vs_r.batters_faced, 0),
                COALESCE(pitching_vs_r.outs, 0),
                COALESCE(pitching_vs_r.runs_allowed, 0),
                COALESCE(pitching_vs_r.earned_runs_allowed, 0),
                COALESCE(pitching_vs_r.hits_allowed, 0),
                COALESCE(pitching_vs_r.doubles_allowed, 0),
                COALESCE(pitching_vs_r.triples_allowed, 0),
                COALESCE(pitching_vs_r.home_runs_allowed, 0),
                COALESCE(pitching_vs_r.bb_allowed, 0),
                COALESCE(pitching_vs_r.so, 0),
                COALESCE(pitching_vs_r.hbp_allowed, 0),
                COALESCE(pitch_types.data, '{}'),
                COALESCE(games_at_position.data, '{}'),
                '{}'
            FROM selected_players
            LEFT JOIN hitting_plate_totals
                ON hitting_plate_totals.player_id = selected_players.player_id
            LEFT JOIN hitting_pitch_totals
                ON hitting_pitch_totals.player_id = selected_players.player_id
            LEFT JOIN pitching_appearance_totals
                ON pitching_appearance_totals.player_id = selected_players.player_id
            LEFT JOIN pitching_plate_totals
                ON pitching_plate_totals.player_id = selected_players.player_id
            LEFT JOIN pitching_out_totals
                ON pitching_out_totals.player_id = selected_players.player_id
            LEFT JOIN pitching_pitch_totals
                ON pitching_pitch_totals.player_id = selected_players.player_id
            LEFT JOIN pitch_types
                ON pitch_types.player_id = selected_players.player_id
            LEFT JOIN fielding
                ON fielding.player_id = selected_players.player_id
            LEFT JOIN games_at_position
                ON games_at_position.player_id = selected_players.player_id
            LEFT JOIN running
                ON running.player_id = selected_players.player_id
            LEFT JOIN hitting_splits hitting_vs_l
                ON hitting_vs_l.player_id = selected_players.player_id
                AND hitting_vs_l.split = 'vsL'
            LEFT JOIN hitting_splits hitting_vs_r
                ON hitting_vs_r.player_id = selected_players.player_id
                AND hitting_vs_r.split = 'vsR'
            LEFT JOIN pitching_splits pitching_vs_l
                ON pitching_vs_l.player_id = selected_players.player_id
                AND pitching_vs_l.split = 'vsL'
            LEFT JOIN pitching_splits pitching_vs_r
                ON pitching_vs_r.player_id = selected_players.player_id
                AND pitching_vs_r.split = 'vsR'
            ON CONFLICT(game_pk, player_id) DO UPDATE SET
                game_date = excluded.game_date,
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
    PlayerRatingInputRepository
}

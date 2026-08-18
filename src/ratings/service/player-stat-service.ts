import {
    HitterStatLine,
    PitcherStatLine,
    StatService
} from "../../sim/index.js"

import { PlayerStatRepository, PlayerStatRow } from "../repository/player-stat-repository.js"


class PlayerStatService {

    public constructor(
        private readonly statService: StatService,
        private readonly playerStatRepository: PlayerStatRepository
    ) {}

    public getCareerHitterStats(playerId: string, endDateExclusive: string): HitterStatLine {
        const row = this.playerStatRepository.getCareer(endDateExclusive, new Set([playerId]))[0]

        if (!row) {
            throw new Error(`Player stats not found for player ${playerId}.`)
        }

        return this.toHitterStatLine(row)
    }

    public getCareerPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine {
        const row = this.playerStatRepository.getCareer(endDateExclusive, new Set([playerId]))[0]

        if (!row) {
            throw new Error(`Player stats not found for player ${playerId}.`)
        }

        return this.toPitcherStatLine(row)
    }

    public getSeasonHitterStats(playerId: string, endDateExclusive: string): HitterStatLine[] {
        return this.playerStatRepository.getSeasons(endDateExclusive, new Set([playerId]))
            .map(row => this.toHitterStatLine(row))
    }

    public getSeasonPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine[] {
        return this.playerStatRepository.getSeasons(endDateExclusive, new Set([playerId]))
            .map(row => this.toPitcherStatLine(row))
    }

    private toHitterStatLine(row: PlayerStatRow): HitterStatLine {
        const avg = this.statService.getAVG(row.hittingHits, row.hittingAb)
        const obp = this.statService.getOBP(row.hittingHits, row.hittingBb, row.hittingHbp, row.hittingPa)
        const slg = this.statService.getSLG(row.hittingSingles, row.hittingDoubles, row.hittingTriples, row.hittingHomeRuns, row.hittingAb)

        return {
            teamWins: row.hittingTeamWins,
            teamLosses: row.hittingTeamLosses,

            games: row.hittingGames,
            pa: row.hittingPa,
            atBats: row.hittingAb,
            runs: row.hittingRuns,
            hits: row.hittingHits,
            singles: row.hittingSingles,
            doubles: row.hittingDoubles,
            triples: row.hittingTriples,
            homeRuns: row.hittingHomeRuns,
            hbp: row.hittingHbp,

            gidp: row.hittingGidp,
            po: row.hittingPo,
            assists: row.hittingAssists,
            outfieldAssists: row.hittingOutfieldAssists,

            e: row.hittingErrors,
            passedBalls: row.hittingPassedBalls,

            csDefense: row.hittingCsDefense,
            doublePlays: row.hittingDoublePlays,

            hbpPercent: this.statService.getAVG(row.hittingHbp, row.hittingPa),
            singlePercent: this.statService.getAVG(row.hittingSingles, row.hittingPa),
            doublePercent: this.statService.getAVG(row.hittingDoubles, row.hittingPa),
            triplePercent: this.statService.getAVG(row.hittingTriples, row.hittingPa),
            homeRunPercent: this.statService.getAVG(row.hittingHomeRuns, row.hittingPa),
            bbPercent: this.statService.getAVG(row.hittingBb, row.hittingPa),
            soPercent: this.statService.getAVG(row.hittingSo, row.hittingPa),

            strikePercent: this.statService.getAVG(row.hittingPitches - row.hittingBalls - row.hittingHbp, row.hittingPitches),
            calledStrikesPercent: this.statService.getAVG(row.hittingCalledStrikes, row.hittingPitches),
            swingingStrikesPercent: this.statService.getAVG(row.hittingSwingingStrikes, row.hittingPitches),
            ballPercent: this.statService.getAVG(row.hittingBalls, row.hittingPitches),
            swingPercent: this.statService.getAVG(row.hittingSwings, row.hittingPitches),
            foulPercent: this.statService.getAVG(row.hittingFouls, row.hittingPitches),
            foulContactPercent: this.statService.getAVG(row.hittingFouls, row.hittingInZoneContact + row.hittingOutZoneContact),
            swingAtBallsPercent: this.statService.getAVG(row.hittingSwingAtBalls, row.hittingPitches - row.hittingInZone),
            swingAtStrikesPercent: this.statService.getAVG(row.hittingSwingAtStrikes, row.hittingInZone),
            inZonePercent: this.statService.getAVG(row.hittingInZone, row.hittingPitches),
            inZoneContactPercent: this.statService.getAVG(row.hittingInZoneContact, row.hittingSwingAtStrikes),
            outZoneContactPercent: this.statService.getAVG(row.hittingOutZoneContact, row.hittingSwingAtBalls),
            inPlayPercent: this.statService.getAVG(row.hittingBallsInPlay, row.hittingPitches),
            babip: this.statService.getAVG(
                row.hittingHits - row.hittingHomeRuns,
                row.hittingAb - row.hittingHomeRuns - row.hittingSo + row.hittingSacFlys
            ),

            groundBallPercent: this.statService.getAVG(row.hittingGroundBalls, row.hittingBallsInPlay),
            flyBallPercent: this.statService.getAVG(row.hittingFlyBalls, row.hittingBallsInPlay),
            ldPercent: this.statService.getAVG(row.hittingLineDrives, row.hittingBallsInPlay),
            popupPercent: this.statService.getAVG(row.hittingPopups, row.hittingBallsInPlay),

            rbi: row.hittingRbi,
            sb: row.hittingSb,
            sbAttempts: row.hittingSbAttempts,
            cs: row.hittingCs,
            bb: row.hittingBb,
            so: row.hittingSo,

            avg,
            obp,
            slg,
            ops: this.statService.getOPS(obp, slg),

            runsPerGame: this.statService.getAVG(row.hittingRuns, row.hittingGames),
            sbPerGame: this.statService.getAVG(row.hittingSb, row.hittingGames),
            sbAttemptsPerGame: this.statService.getAVG(row.hittingSbAttempts, row.hittingGames),
            pitchesPerPA: this.statService.getAVG(row.hittingPitches, row.hittingPa)
        }
    }

    private toPitcherStatLine(row: PlayerStatRow): PitcherStatLine {
        return {
            games: row.pitchingGames,
            wins: row.pitchingWins,
            losses: row.pitchingLosses,
            winPercent: this.statService.getWinPercent(row.pitchingWins, row.pitchingLosses),
            era: this.statService.getERA(row.pitchingEarnedRuns, row.pitchingOuts),
            starts: row.pitchingStarts,
            outs: row.pitchingOuts,
            cg: row.pitchingCg,
            sho: row.pitchingSho,
            saves: row.pitchingSaves,
            ip: this.statService.getIP(row.pitchingOuts),
            atBats: row.pitchingAb,
            battersFaced: row.pitchingBattersFaced,
            hits: row.pitchingHits,
            runs: row.pitchingRuns,
            er: row.pitchingEarnedRuns,
            homeRuns: row.pitchingHomeRuns,
            bb: row.pitchingBb,
            so: row.pitchingSo,
            hbp: row.pitchingHbp,
            wildPitches: row.pitchingWildPitches,

            singlePercent: this.statService.getAVG(row.pitchingSingles, row.pitchingBattersFaced),
            doublePercent: this.statService.getAVG(row.pitchingDoubles, row.pitchingBattersFaced),
            triplePercent: this.statService.getAVG(row.pitchingTriples, row.pitchingBattersFaced),
            homeRunPercent: this.statService.getAVG(row.pitchingHomeRuns, row.pitchingBattersFaced),

            hbpPercent: this.statService.getAVG(row.pitchingHbp, row.pitchingBattersFaced),
            bbPercent: this.statService.getAVG(row.pitchingBb, row.pitchingBattersFaced),
            soPercent: this.statService.getAVG(row.pitchingSo, row.pitchingBattersFaced),
            strikePercent: this.statService.getAVG(row.pitchingPitches - row.pitchingBalls - row.pitchingHbp, row.pitchingPitches),
            calledStrikesPercent: this.statService.getAVG(row.pitchingCalledStrikes, row.pitchingPitches),
            swingingStrikesPercent: this.statService.getAVG(row.pitchingSwingingStrikes, row.pitchingPitches),
            ballPercent: this.statService.getAVG(row.pitchingBalls, row.pitchingPitches),
            swingPercent: this.statService.getAVG(row.pitchingSwings, row.pitchingPitches),
            inPlayPercent: this.statService.getAVG(row.pitchingBallsInPlay, row.pitchingPitches),
            foulPercent: this.statService.getAVG(row.pitchingFouls, row.pitchingPitches),
            foulContactPercent: this.statService.getAVG(row.pitchingFouls, row.pitchingInZoneContact + row.pitchingOutZoneContact),
            wildPitchPercent: this.statService.getAVG(row.pitchingWildPitches, row.pitchingPitches),
            swingAtBallsPercent: this.statService.getAVG(row.pitchingSwingAtBalls, row.pitchingPitches - row.pitchingInZone),
            swingAtStrikesPercent: this.statService.getAVG(row.pitchingSwingAtStrikes, row.pitchingInZone),
            inZonePercent: this.statService.getAVG(row.pitchingInZone, row.pitchingPitches),
            inZoneContactPercent: this.statService.getAVG(row.pitchingInZoneContact, row.pitchingSwingAtStrikes),
            outZoneContactPercent: this.statService.getAVG(row.pitchingOutZoneContact, row.pitchingSwingAtBalls),
            babip: this.statService.getAVG(
                row.pitchingHits - row.pitchingHomeRuns,
                row.pitchingAb - row.pitchingHomeRuns - row.pitchingSo + row.pitchingSacFlys
            ),

            groundBallPercent: this.statService.getAVG(row.pitchingGroundBalls, row.pitchingBallsInPlay),
            flyBallPercent: this.statService.getAVG(row.pitchingFlyBalls, row.pitchingBallsInPlay),
            ldPercent: this.statService.getAVG(row.pitchingLineDrives, row.pitchingBallsInPlay),
            popupPercent: this.statService.getAVG(row.pitchingPopups, row.pitchingBallsInPlay),

            runsPerGame: this.statService.getAVG(row.pitchingRuns, row.pitchingGames),
            pitchesPerGame: this.statService.getAVG(row.pitchingPitches, row.pitchingGames),
            pitchesPerPA: this.statService.getAVG(row.pitchingPitches, row.pitchingBattersFaced)
        }
    }

}


export {
    PlayerStatService
}
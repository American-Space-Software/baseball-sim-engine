import { strict as assert } from "assert"

import { beforeEach, describe, it } from "mocha"

import {
    queries
} from "baseball-database"

import {
    PlayerStatRepository
} from "../src/ratings/repository/player-stat-repository.js"

import type {
    PlayerStatRow
} from "../src/ratings/repository/player-stat-repository.js"

import {
    PlayerStatService
} from "../src/ratings/service/player-stat-service.js"

import {
    StatService
} from "../src/sim/service/stat-service.js"


class PlayerStatRepositoryStub {

    public seasons: PlayerStatRow[] = []

    public getSeasons(_endDateExclusive: string, filterPlayerIds?: Set<string>): PlayerStatRow[] {
        if (!filterPlayerIds) {
            return this.seasons
        }

        return this.seasons.filter(row => filterPlayerIds.has(row.playerId))
    }

}


describe("PlayerStatService", function () {

    let repository: PlayerStatRepositoryStub
    let service: PlayerStatService
    let originalGetPlayer

    beforeEach(function () {
        repository = new PlayerStatRepositoryStub()
        service = new PlayerStatService(new StatService(), repository as unknown as PlayerStatRepository)

        originalGetPlayer = queries.getPlayer

        queries.getPlayer = ((playerId: number) => ({
            playerId,
            birthDate: "1995-01-01"
        })) as typeof queries.getPlayer
    })

    afterEach(function () {
        queries.getPlayer = originalGetPlayer
    })

    it("returns career hitter stats", function () {
        repository.seasons = [createRow()]

        const result = service.getCareerHitterStats("101", "2027-01-01")

        assert.equal(result.teamWins, 10)
        assert.equal(result.teamLosses, 5)
        assert.equal(result.games, 15)
        assert.equal(result.pa, 50)
        assert.equal(result.atBats, 40)
        assert.equal(result.runs, 10)
        assert.equal(result.hits, 20)
        assert.equal(result.singles, 10)
        assert.equal(result.doubles, 5)
        assert.equal(result.triples, 1)
        assert.equal(result.homeRuns, 4)
        assert.equal(result.hbp, 2)
        assert.equal(result.gidp, 1)
        assert.equal(result.rbi, 15)
        assert.equal(result.bb, 6)
        assert.equal(result.so, 8)
        assert.equal(result.sb, 4)
        assert.equal(result.sbAttempts, 6)
        assert.equal(result.cs, 2)

        assert.equal(result.avg, .5)
        assert.equal(result.obp, .56)
        assert.equal(result.slg, .975)
        assert.ok(Math.abs((result.ops ?? 0) - 1.535) < 0.000001)
    })

    it("returns career hitter fielding stats", function () {
        repository.seasons = [createRow()]

        const result = service.getCareerHitterStats("101", "2027-01-01")

        assert.equal(result.po, 30)
        assert.equal(result.assists, 12)
        assert.equal(result.outfieldAssists, 2)
        assert.equal(result.e, 3)
        assert.equal(result.passedBalls, 1)
        assert.equal(result.csDefense, 4)
        assert.equal(result.doublePlays, 5)
    })

    it("returns career hitter pitch percentages", function () {
        repository.seasons = [createRow()]

        const result = service.getCareerHitterStats("101", "2027-01-01")

        assert.equal(result.hbpPercent, 2 / 50)
        assert.equal(result.singlePercent, 10 / 50)
        assert.equal(result.doublePercent, 5 / 50)
        assert.equal(result.triplePercent, 1 / 50)
        assert.equal(result.homeRunPercent, 4 / 50)
        assert.equal(result.bbPercent, 6 / 50)
        assert.equal(result.soPercent, 8 / 50)

        assert.equal(result.strikePercent, 68 / 100)
        assert.equal(result.calledStrikesPercent, 10 / 100)
        assert.equal(result.swingingStrikesPercent, 20 / 100)
        assert.equal(result.ballPercent, 30 / 100)
        assert.equal(result.swingPercent, 50 / 100)
        assert.equal(result.foulPercent, 10 / 100)
        assert.equal(result.foulContactPercent, 10 / 40)
        assert.equal(result.swingAtBallsPercent, 20 / 40)
        assert.equal(result.swingAtStrikesPercent, 30 / 60)
        assert.equal(result.inZonePercent, 60 / 100)
        assert.equal(result.inZoneContactPercent, 25 / 30)
        assert.equal(result.outZoneContactPercent, 15 / 20)
        assert.equal(result.inPlayPercent, 20 / 100)
        assert.equal(result.babip, 16 / 30)
    })

    it("returns career hitter batted-ball and per-game rates", function () {
        repository.seasons = [createRow()]

        const result = service.getCareerHitterStats("101", "2027-01-01")

        assert.equal(result.groundBallPercent, 8 / 20)
        assert.equal(result.flyBallPercent, 6 / 20)
        assert.equal(result.ldPercent, 4 / 20)
        assert.equal(result.popupPercent, 2 / 20)
        assert.equal(result.runsPerGame, 10 / 15)
        assert.equal(result.sbPerGame, 4 / 15)
        assert.equal(result.sbAttemptsPerGame, 6 / 15)
        assert.equal(result.pitchesPerPA, 100 / 50)
    })

    it("returns career pitcher stats", function () {
        repository.seasons = [createRow({ playerId: "201" })]

        const result = service.getCareerPitcherStats("201", "2027-01-01")

        assert.equal(result.games, 10)
        assert.equal(result.starts, 5)
        assert.equal(result.wins, 3)
        assert.equal(result.losses, 2)
        assert.equal(result.winPercent, 3 / 5)
        assert.equal(result.cg, 1)
        assert.equal(result.sho, 1)
        assert.equal(result.saves, 2)
        assert.equal(result.outs, 90)
        assert.equal(result.ip, "30.0")
        assert.equal(result.era, 3.6)
        assert.equal(result.atBats, 100)
        assert.equal(result.battersFaced, 120)
        assert.equal(result.hits, 30)
        assert.equal(result.runs, 15)
        assert.equal(result.er, 12)
        assert.equal(result.homeRuns, 4)
        assert.equal(result.bb, 10)
        assert.equal(result.so, 25)
        assert.equal(result.hbp, 2)
        assert.equal(result.wildPitches, 2)
    })

    it("returns career pitcher outcome percentages", function () {
        repository.seasons = [createRow({ playerId: "201" })]

        const result = service.getCareerPitcherStats("201", "2027-01-01")

        assert.equal(result.singlePercent, 20 / 120)
        assert.equal(result.doublePercent, 5 / 120)
        assert.equal(result.triplePercent, 1 / 120)
        assert.equal(result.homeRunPercent, 4 / 120)
        assert.equal(result.hbpPercent, 2 / 120)
        assert.equal(result.bbPercent, 10 / 120)
        assert.equal(result.soPercent, 25 / 120)
    })

    it("returns career pitcher pitch percentages", function () {
        repository.seasons = [createRow({ playerId: "201" })]

        const result = service.getCareerPitcherStats("201", "2027-01-01")

        assert.equal(result.strikePercent, 258 / 400)
        assert.equal(result.calledStrikesPercent, 40 / 400)
        assert.equal(result.swingingStrikesPercent, 60 / 400)
        assert.equal(result.ballPercent, 140 / 400)
        assert.equal(result.swingPercent, 200 / 400)
        assert.equal(result.inPlayPercent, 80 / 400)
        assert.equal(result.foulPercent, 50 / 400)
        assert.equal(result.foulContactPercent, 50 / 150)
        assert.equal(result.wildPitchPercent, 2 / 400)
        assert.equal(result.swingAtBallsPercent, 80 / 160)
        assert.equal(result.swingAtStrikesPercent, 120 / 240)
        assert.equal(result.inZonePercent, 240 / 400)
        assert.equal(result.inZoneContactPercent, 90 / 120)
        assert.equal(result.outZoneContactPercent, 60 / 80)
        assert.equal(result.babip, 26 / 74)
    })

    it("returns career pitcher batted-ball and per-game rates", function () {
        repository.seasons = [createRow({ playerId: "201" })]

        const result = service.getCareerPitcherStats("201", "2027-01-01")

        assert.equal(result.groundBallPercent, 35 / 80)
        assert.equal(result.flyBallPercent, 25 / 80)
        assert.equal(result.ldPercent, 15 / 80)
        assert.equal(result.popupPercent, 5 / 80)
        assert.equal(result.runsPerGame, 15 / 10)
        assert.equal(result.pitchesPerGame, 400 / 10)
        assert.equal(result.pitchesPerPA, 400 / 120)
    })

    it("aggregates career stats across seasons", function () {
        repository.seasons = [
            createRow({ season: 2025, hittingHits: 10 }),
            createRow({ season: 2026, hittingHits: 20 })
        ]

        const result = service.getCareerHitterStats("101", "2027-01-01")

        assert.equal(result.hits, 30)
        assert.equal(result.games, 30)
        assert.equal(result.pa, 100)
    })

    it("returns hitter season stats in repository order", function () {
        repository.seasons = [
            createRow({ season: 2025, hittingHits: 10 }),
            createRow({ season: 2026, hittingHits: 20 })
        ]

        const results = service.getSeasonHitterStats("101", "2027-01-01")

        assert.equal(results.length, 2)
        assert.equal(results[0]?.hits, 10)
        assert.equal(results[1]?.hits, 20)
    })

    it("returns pitcher season stats in repository order", function () {
        repository.seasons = [
            createRow({ playerId: "201", season: 2025, pitchingWins: 1 }),
            createRow({ playerId: "201", season: 2026, pitchingWins: 3 })
        ]

        const results = service.getSeasonPitcherStats("201", "2027-01-01")

        assert.equal(results.length, 2)
        assert.equal(results[0]?.wins, 1)
        assert.equal(results[1]?.wins, 3)
    })

    it("throws when stats do not exist", function () {
        assert.throws(
            () => service.getCareerHitterStats("999", "2027-01-01"),
            /Player stats not found for player 999/
        )

        assert.throws(
            () => service.getCareerPitcherStats("999", "2027-01-01"),
            /Player stats not found for player 999/
        )
    })

})


function createRow(overrides: Partial<PlayerStatRow> = {}): PlayerStatRow {
    return {
        playerId: "101",

        hittingTeamWins: 10,
        hittingTeamLosses: 5,
        hittingGames: 15,
        hittingPa: 50,
        hittingAb: 40,
        hittingRuns: 10,
        hittingHits: 20,
        hittingSingles: 10,
        hittingDoubles: 5,
        hittingTriples: 1,
        hittingHomeRuns: 4,
        hittingRbi: 15,
        hittingBb: 6,
        hittingSo: 8,
        hittingHbp: 2,
        hittingGidp: 1,
        hittingSacFlys: 2,

        hittingPo: 30,
        hittingAssists: 12,
        hittingOutfieldAssists: 2,
        hittingErrors: 3,
        hittingPassedBalls: 1,
        hittingCsDefense: 4,
        hittingDoublePlays: 5,

        hittingSb: 4,
        hittingSbAttempts: 6,
        hittingCs: 2,

        hittingPitches: 100,
        hittingBalls: 30,
        hittingStrikes: 70,
        hittingCalledStrikes: 10,
        hittingSwingingStrikes: 20,
        hittingSwings: 50,
        hittingFouls: 10,
        hittingInZone: 60,
        hittingSwingAtBalls: 20,
        hittingSwingAtStrikes: 30,
        hittingInZoneContact: 25,
        hittingOutZoneContact: 15,
        hittingBallsInPlay: 20,
        hittingGroundBalls: 8,
        hittingFlyBalls: 6,
        hittingLineDrives: 4,
        hittingPopups: 2,

        pitchingGames: 10,
        pitchingStarts: 5,
        pitchingWins: 3,
        pitchingLosses: 2,
        pitchingCg: 1,
        pitchingSho: 1,
        pitchingSaves: 2,
        pitchingOuts: 90,
        pitchingAb: 100,
        pitchingBattersFaced: 120,
        pitchingHits: 30,
        pitchingSingles: 20,
        pitchingDoubles: 5,
        pitchingTriples: 1,
        pitchingRuns: 15,
        pitchingEarnedRuns: 12,
        pitchingHomeRuns: 4,
        pitchingBb: 10,
        pitchingSo: 25,
        pitchingHbp: 2,
        pitchingSacFlys: 3,
        pitchingWildPitches: 2,

        pitchingPitches: 400,
        pitchingBalls: 140,
        pitchingStrikes: 260,
        pitchingCalledStrikes: 40,
        pitchingSwingingStrikes: 60,
        pitchingSwings: 200,
        pitchingFouls: 50,
        pitchingInZone: 240,
        pitchingSwingAtBalls: 80,
        pitchingSwingAtStrikes: 120,
        pitchingInZoneContact: 90,
        pitchingOutZoneContact: 60,
        pitchingBallsInPlay: 80,
        pitchingGroundBalls: 35,
        pitchingFlyBalls: 25,
        pitchingLineDrives: 15,
        pitchingPopups: 5,

        ...overrides
    }
}
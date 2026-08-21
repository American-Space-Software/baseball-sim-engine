import { strict as assert } from "assert"
import fs from "fs"
import path from "path"
import { before, describe, it } from "mocha"

import {
    Handedness,
    Position
} from "baseball-sim-engine"

import type {
    PitchEnvironmentTarget,
    Player
} from "baseball-sim-engine"

import {
    downloadService,
    playerRatingService
} from "baseball-sim-engine/ratings"

import {
    queries
} from "baseball-database"

import {
    GameLineupService
} from "../src/ratings/service/game-lineup-service.js"

import type {
    TeamBundle
} from "../src/ratings/service/game-lineup-service.js"

import {
    MlbRosterService
} from "../src/ratings/service/mlb-roster-service.js"

import type {
    MlbRosterEntry,
    MlbTeam
} from "../src/ratings/service/mlb-roster-service.js"

import {
    PitcherAppearanceService
} from "../src/ratings/service/pitcher-appearance-service.js"

import {
    PitcherWorkloadService
} from "../src/ratings/service/pitcher-workload-service.js"

import type {
    GeneratedPlayerRatings
} from "../src/ratings/service/player-rating-service.js"
import { PitcherAppearanceRepository } from "../src/ratings/repository/pitcher-appearance-repository.js"


const season = Number(
    process.env.MLB_GAME_PREDICTOR_TEST_SEASON ??
    new Date().getUTCFullYear()
)

const gameDate =
    process.env.MLB_GAME_PREDICTOR_TEST_DATE ??
    `${season}-07-09`

const dataDir =
    process.env.DATA_DIR ??
    path.resolve(process.cwd(), "data")


class GameLineupTestHarness {

    public readonly pitchEnvironmentTarget = this.readPitchEnvironmentTarget()
    public readonly pitcherAppearanceRepository = new PitcherAppearanceRepository(dataDir)
    public readonly pitcherAppearanceService = new PitcherAppearanceService(this.pitcherAppearanceRepository)
    public readonly pitcherWorkloadService = new PitcherWorkloadService(this.pitcherAppearanceService)
    public readonly mlbRosterService = new MlbRosterService()

    public readonly service = new GameLineupService(
        this.mlbRosterService,
        this.pitcherWorkloadService
    )

    public readonly mlbTeam: MlbTeam = {
        id: 134,
        name: "Pittsburgh Pirates",
        abbrev: "PIT"
    }

    public gamePk = 0
    public roster: MlbRosterEntry[] = []
    public ratings = new Map<string, GeneratedPlayerRatings>()

    public async prepare(): Promise<void> {
        await downloadService.syncSeason(
            season
        )

        await this.mlbRosterService.syncRosters(
            gameDate
        )

        this.gamePk = this.getGamePk()

        this.roster = await this.service.getRoster(
            gameDate,
            this.mlbTeam,
            this.gamePk
        )

        this.ratings = await playerRatingService.buildPlayerRatingsForDate(
            season,
            gameDate,
            this.pitchEnvironmentTarget,
            new Set(
                this.roster.map(player =>
                    player.playerId
                )
            )
        )
    }

    public async buildBundle(): Promise<TeamBundle> {
        return this.service.build(
            gameDate,
            this.mlbTeam,
            this.roster,
            this.ratings,
            this.gamePk
        )
    }

    public isPitcher(player: Player): boolean {
        return player.primaryPosition === Position.PITCHER
    }

    public getAge(birthDate: string | null, date: string): number {
        if (!birthDate) {
            return 27
        }

        const birth = new Date(`${birthDate}T12:00:00.000Z`)
        const game = new Date(`${date}T12:00:00.000Z`)

        let age = game.getUTCFullYear() - birth.getUTCFullYear()
        const monthDifference = game.getUTCMonth() - birth.getUTCMonth()

        if (
            monthDifference < 0 ||
            (
                monthDifference === 0 &&
                game.getUTCDate() < birth.getUTCDate()
            )
        ) {
            age--
        }

        return age
    }

    public toHandedness(value: string | null): Handedness {
        if (value === "L") {
            return Handedness.L
        }

        if (value === "S") {
            return Handedness.S
        }

        return Handedness.R
    }

    public assertValidTeamBundle(bundle: TeamBundle): void {
        assert.equal(
            bundle.team._id,
            "134"
        )

        assert.equal(
            bundle.team.name,
            "Pittsburgh Pirates"
        )

        assert.equal(
            bundle.team.abbrev,
            "PIT"
        )

        const starter = bundle.players.find(player =>
            player._id === bundle.startingPitcher._id
        )

        assert.ok(
            starter
        )

        assert.ok(
            this.isPitcher(starter)
        )

        const lineup = bundle.lineup.order ?? []

        assert.equal(
            lineup.length,
            9
        )

        assert.equal(
            new Set(
                lineup.map(player =>
                    player._id
                )
            ).size,
            9
        )

        for (const spot of lineup) {
            assert.ok(
                bundle.players.some(player =>
                    player._id === spot._id
                )
            )

            assert.ok(
                spot.position
            )
        }

        const bullpenPlayerIds = new Set(
            bundle.availablePitchers.map(assignment =>
                assignment.playerId
            )
        )

        assert.equal(
            bullpenPlayerIds.size,
            bundle.availablePitchers.length
        )

        assert.equal(
            bullpenPlayerIds.has(bundle.startingPitcher._id),
            false
        )

        const activePitcherIds = new Set(
            bundle.players
                .filter(player =>
                    this.isPitcher(player)
                )
                .map(player =>
                    player._id
                )
        )

        for (const assignment of bundle.availablePitchers) {
            assert.ok(
                activePitcherIds.has(
                    assignment.playerId
                )
            )
        }
    }

    private readPitchEnvironmentTarget(): PitchEnvironmentTarget {
        const filePath = path.resolve(
            dataDir,
            `${season}`,
            "_pitch_environment_target.json"
        )

        if (!fs.existsSync(filePath)) {
            throw new Error(`Pitch environment for ${season} was not found at ${filePath}.`)
        }

        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        ) as PitchEnvironmentTarget
    }

    private getGamePk(): number {
        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            throw new Error(
                `MLB schedule not found for season ${season}.`
            )
        }

        const scheduleDate = (schedule.data.dates ?? []).find(date =>
            String(date?.date ?? "") === gameDate
        )

        const game = (scheduleDate?.games ?? []).find(game =>
            Number(game?.teams?.away?.team?.id) === this.mlbTeam.id ||
            Number(game?.teams?.home?.team?.id) === this.mlbTeam.id
        )

        const gamePk = Number(
            game?.gamePk
        )

        if (!Number.isSafeInteger(gamePk) || gamePk <= 0) {
            throw new Error(
                `MLB game for ${this.mlbTeam.abbrev} was not found on ${gameDate}.`
            )
        }

        return gamePk
    }

}


const harness = new GameLineupTestHarness()


describe("GameLineupService player construction", function () {

    this.timeout(
        120000
    )

    before(async () => {
        await harness.prepare()
    })

    it("builds the engine team and active-roster players inside the TeamBundle", async () => {
        const bundle = await harness.buildBundle()

        harness.assertValidTeamBundle(
            bundle
        )

        assert.equal(
            bundle.players.length,
            harness.roster.length
        )

        assert.equal(
            new Set(
                bundle.players.map(player =>
                    player._id
                )
            ).size,
            bundle.players.length
        )

        for (const rosterPlayer of harness.roster) {
            assert.ok(
                bundle.players.some(player =>
                    player._id === rosterPlayer.playerId
                ),
                `Roster player ${rosterPlayer.fullName} (${rosterPlayer.playerId}) is missing.`
            )
        }
    })

    it("includes every active-roster pitcher in TeamBundle players", async () => {
        const bundle = await harness.buildBundle()

        const expectedPitcherIds = harness.roster
            .filter(player =>
                player.position === Position.PITCHER
            )
            .map(player =>
                player.playerId
            )
            .sort()

        const actualPitcherIds = bundle.players
            .filter(player =>
                harness.isPitcher(player)
            )
            .map(player =>
                player._id
            )
            .sort()

        assert.deepEqual(
            actualPitcherIds,
            expectedPitcherIds
        )
    })

    it("copies generated ratings and MLB player fields onto players", async () => {
        const bundle = await harness.buildBundle()

        const playerId = "668804"

        const rosterPlayer = harness.roster.find(player =>
            player.playerId === playerId
        )

        const ratedPlayer = harness.ratings.get(
            playerId
        )

        const databasePlayer = queries.getPlayer(
            Number(playerId)
        )

        const player = bundle.players.find(player =>
            player._id === playerId
        )

        assert.ok(
            rosterPlayer
        )

        assert.ok(
            ratedPlayer
        )

        assert.ok(
            databasePlayer
        )

        assert.ok(
            player
        )

        assert.equal(
            player.firstName,
            databasePlayer.firstName
        )

        assert.equal(
            player.lastName,
            databasePlayer.lastName
        )

        assert.equal(
            player.fullName,
            rosterPlayer.fullName
        )

        assert.equal(
            player.displayName,
            rosterPlayer.fullName
        )

        assert.equal(
            player.primaryPosition,
            rosterPlayer.position
        )

        assert.equal(
            player.age,
            harness.getAge(
                databasePlayer.birthDate,
                gameDate
            )
        )

        assert.equal(
            player.throws,
            harness.toHandedness(
                databasePlayer.throws
            )
        )

        assert.equal(
            player.hits,
            harness.toHandedness(
                databasePlayer.bats
            )
        )

        assert.deepEqual(
            player.hittingRatings,
            ratedPlayer.hittingRatings
        )

        assert.deepEqual(
            player.pitchRatings,
            ratedPlayer.pitchRatings
        )
    })

    it("builds simulation fields for every pitcher", async () => {
        const bundle = await harness.buildBundle()

        const pitchers = bundle.players.filter(player =>
            harness.isPitcher(player)
        )

        assert.ok(
            pitchers.length > 0
        )

        for (const pitcher of pitchers) {
            assert.ok(
                Number.isFinite(
                    pitcher.stamina
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.maxPitchCount
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.pitchRatings.power
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.pitchRatings.vsR.control
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.pitchRatings.vsL.control
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.pitchRatings.vsR.movement
                )
            )

            assert.ok(
                Number.isFinite(
                    pitcher.pitchRatings.vsL.movement
                )
            )
        }
    })

})
import {
    queries
} from "baseball-database"

import {
    Handedness,
    PitchingRoleType,
    Position
} from "../../sim/service/enums.js"

import type {
    Lineup,
    LineupPlayer,
    PitchingRole,
    Player,
    RotationPitcher,
    Team
} from "../../sim/service/interfaces.js"

import { MlbRosterService } from "./mlb-roster-service.js"
import { PitcherWorkloadService } from "./pitcher-workload-service.js"

import type {
    MlbRosterEntry,
    MlbTeam
} from "./mlb-roster-service.js"

import type {
    GeneratedPlayerRatings
} from "./player-rating-service.js"


const STARTER_MAX_PITCH_COUNT = 100

const BULLPEN_MAX_PITCH_COUNT: Record<string, number> = {
    [PitchingRoleType.CLOSER]: 25,
    [PitchingRoleType.SETUP]: 30,
    [PitchingRoleType.MIDDLE]: 40,
    [PitchingRoleType.LONG]: 60,
    [PitchingRoleType.MOP_UP]: 50
}

const YESTERDAY_FATIGUE_WEIGHT = 1
const DAYS_TWO_THROUGH_THREE_FATIGUE_WEIGHT = 0.5
const DAYS_FOUR_THROUGH_FIVE_FATIGUE_WEIGHT = 0.25
const BULLPEN_RECOVERY_CAPACITY_MULTIPLIER = 2

const BULLPEN_ROLE_ORDER = new Map<PitchingRoleType, number>([
    [PitchingRoleType.CLOSER, 1],
    [PitchingRoleType.SETUP, 2],
    [PitchingRoleType.MIDDLE, 3],
    [PitchingRoleType.LONG, 4],
    [PitchingRoleType.MOP_UP, 5]
])


class GameLineupService {

    private readonly providers: GameLineupProvider[]

    public constructor(
        private readonly mlbRosterService: MlbRosterService,
        private readonly pitcherWorkloadService: PitcherWorkloadService
    ) {
        const bullpenResolver = this.getAvailablePitchers.bind(this)

        this.providers = [
            new ConfirmedGameLineupProvider(bullpenResolver),
            new ProjectedGameLineupProvider(bullpenResolver),
            new PreviousSimilarGameLineupProvider(bullpenResolver),
            new FallbackGameLineupProvider(bullpenResolver)
        ]
    }

    public async build(
        gameDate: string,
        mlbTeam: MlbTeam,
        roster: MlbRosterEntry[],
        ratings: Map<string, GeneratedPlayerRatings>,
        gamePk?: number | string
    ): Promise<TeamBundle> {
        const missingPlayers: MlbRosterEntry[] = []

        const players = roster
            .map(entry => {
                const rated = ratings.get(
                    String(entry.playerId)
                )

                if (!rated) {
                    missingPlayers.push(
                        entry
                    )

                    return undefined
                }

                return this.buildPlayer(
                    gameDate,
                    entry,
                    rated
                )
            })
            .filter((player): player is Player =>
                player !== undefined
            )

        if (missingPlayers.length > 0) {
            throw new Error(
                `Missing generated ratings for ${mlbTeam.abbrev} active-roster players on ${gameDate}: ` +
                missingPlayers
                    .map(entry =>
                        `${entry.playerId}:${entry.fullName}`
                    )
                    .join(", ")
            )
        }

        const team: Team = {
            _id: String(mlbTeam.id),
            name: mlbTeam.name,
            abbrev: mlbTeam.abbrev,
            colors: {
                color1: "#222222",
                color2: "#dddddd"
            }
        } as Team

        const failures: string[] = []

        for (const provider of this.providers) {
            try {
                const bundle = await provider.build(
                    gameDate,
                    mlbTeam,
                    team,
                    players,
                    gamePk
                )

                if (!bundle) {
                    failures.push(
                        `${provider.name}: no bundle`
                    )

                    continue
                }

                const validationError = this.validate(
                    players,
                    bundle
                )

                if (validationError) {
                    failures.push(
                        `${provider.name}: ${validationError}`
                    )

                    continue
                }

                this.applyPitcherAvailability(
                    bundle
                )

                return bundle
            } catch (error: unknown) {
                failures.push(
                    `${provider.name}: ${this.getErrorMessage(error)}`
                )
            }
        }

        throw new Error(
            `No valid team bundle found for ${mlbTeam.abbrev} on ${gameDate}. ${failures.join(" | ")}`
        )
    }

    public async getRoster(gameDate: string, mlbTeam: MlbTeam, gamePk?: number | string): Promise<MlbRosterEntry[]> {
        const roster = await this.mlbRosterService.getRoster(
            gameDate,
            mlbTeam
        )

        return this.addConfirmedGamePlayersToRoster(
            gameDate,
            mlbTeam,
            roster,
            gamePk
        )
    }

    public buildPlayer(gameDate: string, entry: MlbRosterEntry, rated: GeneratedPlayerRatings): Player {
        const player = queries.getPlayer(
            Number(entry.playerId)
        )

        if (!player) {
            throw new Error(
                `Player ${entry.playerId} does not exist in baseball-database.`
            )
        }

        return {
            _id: String(entry.playerId),
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.fullName,
            displayName: player.fullName,
            primaryPosition: entry.position,
            throws: this.toHandedness(
                player.throws
            ),
            hits: this.toHandedness(
                player.bats
            ),
            age: this.getAge(
                player.birthDate,
                gameDate
            ),
            stamina: 0,
            maxPitchCount: 0,
            overallRating: entry.position === Position.PITCHER
                ? this.getAveragePitchingRating(rated.pitchRatings)
                : this.getAverageHittingRating(rated.hittingRatings),
            hittingRatings: rated.hittingRatings,
            pitchRatings: rated.pitchRatings,
            isRetired: false,
            zodiacSign: "Aries"
        } as Player
    }

    private async addConfirmedGamePlayersToRoster(gameDate: string, mlbTeam: MlbTeam, roster: MlbRosterEntry[], gamePk?: number | string): Promise<MlbRosterEntry[]> {
        const resolvedGamePk =
            gamePk ??
            this.getGameForTeam(
                gameDate,
                mlbTeam.id
            )?.gamePk

        if (!resolvedGamePk) {
            return roster
        }

        const game = queries.getGame(
            Number(resolvedGamePk)
        )

        if (!game) {
            return roster
        }

        const feed = game.data
        const side = this.getTeamSide(
            feed,
            mlbTeam.id
        )

        const entriesByPlayerId = new Map<string, MlbRosterEntry>(
            roster.map(entry => [
                entry.playerId,
                entry
            ])
        )

        const boxscorePlayers =
            feed?.liveData?.boxscore?.teams?.[side]?.players ??
            {}

        const confirmedStarters = Object.values(
            boxscorePlayers
        ) as any[]

        for (const boxscorePlayer of confirmedStarters) {
            const battingOrder = Number(
                boxscorePlayer?.battingOrder
            )

            const isStartingHitter =
                Number.isInteger(battingOrder) &&
                battingOrder >= 100 &&
                battingOrder <= 900 &&
                battingOrder % 100 === 0

            if (!isStartingHitter) {
                continue
            }

            const playerId = String(
                boxscorePlayer?.person?.id ??
                ""
            )

            if (
                !playerId ||
                entriesByPlayerId.has(playerId)
            ) {
                continue
            }

            entriesByPlayerId.set(
                playerId,
                {
                    playerId,
                    fullName: String(
                        boxscorePlayer?.person?.fullName ??
                        feed?.gameData?.players?.[`ID${playerId}`]?.fullName ??
                        playerId
                    ),
                    position: this.getConfirmedRosterPosition(
                        boxscorePlayer
                    )
                }
            )
        }

        const startingPitcherId = this.getStartingPitcherId(
            feed,
            side
        )

        if (
            startingPitcherId &&
            !entriesByPlayerId.has(startingPitcherId)
        ) {
            const feedPlayer =
                feed?.gameData?.players?.[`ID${startingPitcherId}`]

            const boxscorePlayer =
                boxscorePlayers[`ID${startingPitcherId}`]

            entriesByPlayerId.set(
                startingPitcherId,
                {
                    playerId: startingPitcherId,
                    fullName: String(
                        feedPlayer?.fullName ??
                        boxscorePlayer?.person?.fullName ??
                        startingPitcherId
                    ),
                    position: Position.PITCHER
                }
            )
        }

        return Array.from(
            entriesByPlayerId.values()
        )
    }

    private getConfirmedRosterPosition(boxscorePlayer: any): Position {
        const abbreviations = [
            ...(boxscorePlayer?.allPositions ?? []),
            boxscorePlayer?.position
        ]
            .map((entry: any) =>
                String(entry?.abbreviation ?? "")
            )
            .filter(abbreviation =>
                abbreviation &&
                abbreviation !== "PH" &&
                abbreviation !== "PR" &&
                abbreviation !== "P"
            )

        if (abbreviations.includes("DH")) {
            return Position.DESIGNATED_HITTER
        }

        for (const abbreviation of abbreviations) {
            if (abbreviation === "C") return Position.CATCHER
            if (abbreviation === "1B") return Position.FIRST_BASE
            if (abbreviation === "2B") return Position.SECOND_BASE
            if (abbreviation === "3B") return Position.THIRD_BASE
            if (abbreviation === "SS") return Position.SHORTSTOP
            if (abbreviation === "LF") return Position.LEFT_FIELD
            if (abbreviation === "CF") return Position.CENTER_FIELD
            if (abbreviation === "RF") return Position.RIGHT_FIELD
            if (abbreviation === "OF") return Position.CENTER_FIELD
        }

        return Position.DESIGNATED_HITTER
    }

    private applyPitcherAvailability(bundle: TeamBundle): void {
        const bullpenById = new Map(
            bundle.availablePitchers.map(assignment => [
                assignment.playerId,
                assignment
            ])
        )

        for (const player of bundle.players) {
            if (!this.isPitcher(player)) {
                player.stamina = 0
                player.maxPitchCount = 0
                continue
            }

            if (player._id === bundle.startingPitcher._id) {
                player.stamina = 1
                player.maxPitchCount = STARTER_MAX_PITCH_COUNT
                continue
            }

            const assignment = bullpenById.get(
                player._id
            )

            if (!assignment) {
                player.stamina = 0
                player.maxPitchCount = 0
                continue
            }

            const maxPitchCount = this.getAvailableBullpenPitchCount(
                assignment
            )

            player.maxPitchCount = maxPitchCount
            player.stamina = maxPitchCount > 0
                ? 1
                : 0
        }
    }

    private getAvailableBullpenPitchCount(assignment: PitchingRole): number {
        const workload = assignment as PitchingRole & {
            pitchesYesterday?: number
            pitchesLastThreeDays?: number
            pitchesLastFiveDays?: number
        }

        const pitchesYesterday = Math.max(
            0,
            Number(
                workload.pitchesYesterday ??
                0
            )
        )

        const pitchesLastThreeDays = Math.max(
            pitchesYesterday,
            Number(
                workload.pitchesLastThreeDays ??
                pitchesYesterday
            )
        )

        const pitchesLastFiveDays = Math.max(
            pitchesLastThreeDays,
            Number(
                workload.pitchesLastFiveDays ??
                pitchesLastThreeDays
            )
        )

        const pitchesDaysTwoThroughThree =
            pitchesLastThreeDays -
            pitchesYesterday

        const pitchesDaysFourThroughFive =
            pitchesLastFiveDays -
            pitchesLastThreeDays

        const fatigueLoad =
            pitchesYesterday * YESTERDAY_FATIGUE_WEIGHT +
            pitchesDaysTwoThroughThree * DAYS_TWO_THROUGH_THREE_FATIGUE_WEIGHT +
            pitchesDaysFourThroughFive * DAYS_FOUR_THROUGH_FIVE_FATIGUE_WEIGHT

        const roleMaxPitchCount = this.getRoleMaxPitchCount(
            assignment.role
        )

        const recoveryCapacity =
            roleMaxPitchCount *
            BULLPEN_RECOVERY_CAPACITY_MULTIPLIER

        const availableFraction = Math.max(
            0,
            Math.min(
                1,
                1 - fatigueLoad / recoveryCapacity
            )
        )

        return Math.round(
            roleMaxPitchCount *
            availableFraction
        )
    }

    private getRoleMaxPitchCount(role: PitchingRoleType): number {
        const maxPitchCount =
            BULLPEN_MAX_PITCH_COUNT[role]

        if (!maxPitchCount) {
            throw new Error(
                `No maximum pitch count configured for bullpen role ${role}.`
            )
        }

        return maxPitchCount
    }

    private async getAvailablePitchers(gameDate: string, mlbTeam: MlbTeam, players: Player[], startingPitcherId: string): Promise<PitchingRole[]> {
        const activePitcherIds = players
            .filter(player =>
                this.isPitcher(player)
            )
            .map(player =>
                player._id
            )
            .filter(playerId =>
                playerId !== startingPitcherId
            )

        const synthesized = await this.pitcherWorkloadService.getBullpenRoles(
            gameDate,
            activePitcherIds,
            startingPitcherId
        )

        return this.normalizeBullpenPriorities(
            synthesized.map(assignment => ({
                playerId: assignment.playerId,
                role: assignment.role,
                priority: assignment.priority,
                pitchesYesterday: assignment.workload.pitchesYesterday,
                pitchesLastThreeDays: assignment.workload.pitchesLastThreeDays,
                pitchesLastFiveDays: assignment.workload.pitchesLastFiveDays
            }))
        )
    }

    private normalizeBullpenPriorities<T extends PitchingRole>(assignments: T[]): T[] {
        const sorted = [
            ...assignments
        ].sort((a, b) => {
            const roleDifference =
                (BULLPEN_ROLE_ORDER.get(a.role) ?? 99) -
                (BULLPEN_ROLE_ORDER.get(b.role) ?? 99)

            return roleDifference ||
                a.priority - b.priority ||
                a.playerId.localeCompare(
                    b.playerId
                )
        })

        const nextPriorityByRole =
            new Map<PitchingRoleType, number>()

        return sorted.map(assignment => {
            const priority =
                (nextPriorityByRole.get(
                    assignment.role
                ) ?? 0) + 1

            nextPriorityByRole.set(
                assignment.role,
                priority
            )

            return {
                ...assignment,
                priority
            }
        })
    }

    private validate(players: Player[], bundle: TeamBundle): string | undefined {
        const playerIds = new Set(
            players.map(player =>
                player._id
            )
        )

        const pitcherIds = new Set(
            players
                .filter(player =>
                    this.isPitcher(player)
                )
                .map(player =>
                    player._id
                )
        )

        const starterId = bundle.startingPitcher._id

        if (!starterId) {
            return "Starting pitcher has no id."
        }

        const starter = players.find(player =>
            player._id === starterId
        )

        if (!starter) {
            return `Starting pitcher ${starterId} is not in players.`
        }

        if (!this.isPitcher(starter)) {
            return `Starting pitcher ${starterId} is not a pitcher.`
        }

        const lineup = bundle.lineup.order ?? []

        if (lineup.length !== 9) {
            return `Lineup has ${lineup.length} players instead of 9.`
        }

        const lineupPlayers = new Set<string>()

        for (const spot of lineup) {
            if (!spot._id) {
                return "Lineup contains a player without an id."
            }

            if (!spot.position) {
                return `Lineup player ${spot._id} has no position.`
            }

            if (!playerIds.has(spot._id)) {
                return `Lineup player ${spot._id} is not in players.`
            }

            if (lineupPlayers.has(spot._id)) {
                return `Lineup player ${spot._id} appears more than once.`
            }

            lineupPlayers.add(
                spot._id
            )
        }

        const expectedRoles = [
            PitchingRoleType.CLOSER,
            PitchingRoleType.SETUP,
            PitchingRoleType.MIDDLE,
            PitchingRoleType.LONG,
            PitchingRoleType.MOP_UP
        ]

        const bullpenPlayers = new Set<string>()

        for (const assignment of bundle.availablePitchers) {
            if (!assignment.playerId) {
                return "Bullpen contains a pitcher without an id."
            }

            if (!expectedRoles.includes(assignment.role)) {
                return `Bullpen pitcher ${assignment.playerId} has invalid role ${assignment.role}.`
            }

            if (
                !Number.isInteger(assignment.priority) ||
                assignment.priority < 1
            ) {
                return `Bullpen pitcher ${assignment.playerId} has invalid priority ${assignment.priority}.`
            }

            if (assignment.playerId === starterId) {
                return `Starting pitcher ${assignment.playerId} is also assigned to the bullpen.`
            }

            if (!pitcherIds.has(assignment.playerId)) {
                return `Bullpen pitcher ${assignment.playerId} is not an active pitcher.`
            }

            if (bullpenPlayers.has(assignment.playerId)) {
                return `Bullpen pitcher ${assignment.playerId} appears more than once.`
            }

            bullpenPlayers.add(
                assignment.playerId
            )
        }

        for (const role of expectedRoles) {
            const assignments = bundle.availablePitchers
                .filter(assignment =>
                    assignment.role === role
                )
                .sort((a, b) =>
                    a.priority - b.priority
                )

            if (assignments.length === 0) {
                return `Bullpen does not contain a ${role} assignment.`
            }

            for (let index = 0; index < assignments.length; index++) {
                if (assignments[index].priority !== index + 1) {
                    return `Bullpen role ${role} has priority ${assignments[index].priority} instead of ${index + 1}.`
                }
            }
        }

        return undefined
    }

    private getGameForTeam(gameDate: string, teamId: number): any | undefined {
        const schedule = queries.getSchedule(
            Number(gameDate.slice(0, 4))
        )

        if (!schedule) {
            return undefined
        }

        const scheduleDate = (schedule.data.dates ?? []).find(date =>
            String(date.date ?? "") === gameDate
        )

        return (scheduleDate?.games ?? []).find(game =>
            Number(game?.teams?.away?.team?.id) === teamId ||
            Number(game?.teams?.home?.team?.id) === teamId
        )
    }

    private getTeamSide(feed: any, teamId: number): "home" | "away" {
        const homeTeamId = Number(
            feed?.gameData?.teams?.home?.id
        )

        return homeTeamId === Number(teamId)
            ? "home"
            : "away"
    }

    private getStartingPitcherId(feed: any, side: "home" | "away"): string | undefined {
        const probablePitcherId =
            feed?.gameData?.probablePitchers?.[side]?.id

        if (probablePitcherId) {
            return String(
                probablePitcherId
            )
        }

        const pitchers =
            feed?.liveData?.boxscore?.teams?.[side]?.pitchers ??
            []

        if (pitchers.length > 0) {
            return String(
                pitchers[0]
            )
        }

        return undefined
    }

    private getAge(birthDate: string | null | undefined, gameDate: string): number {
        if (!birthDate) {
            return 27
        }

        const birth = new Date(
            `${birthDate}T12:00:00.000Z`
        )

        const date = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        if (
            Number.isNaN(birth.getTime()) ||
            Number.isNaN(date.getTime())
        ) {
            return 27
        }

        let age =
            date.getUTCFullYear() -
            birth.getUTCFullYear()

        const monthDifference =
            date.getUTCMonth() -
            birth.getUTCMonth()

        if (
            monthDifference < 0 ||
            (
                monthDifference === 0 &&
                date.getUTCDate() < birth.getUTCDate()
            )
        ) {
            age--
        }

        return age
    }

    private getAverageHittingRating(hittingRatings: GeneratedPlayerRatings["hittingRatings"]): number {
        return Math.round(
            (
                hittingRatings.arm +
                hittingRatings.defense +
                hittingRatings.speed +
                hittingRatings.steals +
                hittingRatings.vsL.contact +
                hittingRatings.vsL.gapPower +
                hittingRatings.vsL.homerunPower +
                hittingRatings.vsL.plateDiscipline +
                hittingRatings.vsR.contact +
                hittingRatings.vsR.gapPower +
                hittingRatings.vsR.homerunPower +
                hittingRatings.vsR.plateDiscipline
            ) /
            12
        )
    }

    private getAveragePitchingRating(pitchRatings: GeneratedPlayerRatings["pitchRatings"]): number {
        return Math.round(
            (
                pitchRatings.power +
                pitchRatings.vsL.control +
                pitchRatings.vsL.movement +
                pitchRatings.vsR.control +
                pitchRatings.vsR.movement
            ) /
            5
        )
    }


    private toHandedness(value: unknown): Handedness {
        if (value === Handedness.L || value === "L") {
            return Handedness.L
        }

        if (value === Handedness.S || value === "S") {
            return Handedness.S
        }

        return Handedness.R
    }

    private isPitcher(player: Player): boolean {
        return player.primaryPosition === Position.PITCHER
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message
        }

        if (typeof error === "string") {
            return error
        }

        if (error === undefined) {
            return "undefined error"
        }

        if (error === null) {
            return "null error"
        }

        try {
            return JSON.stringify(
                error
            )
        } catch {
            return String(
                error
            )
        }
    }

}


abstract class BaseGameLineupProvider implements GameLineupProvider {

    public constructor(private readonly bullpenResolver: BullpenResolver) {}

    public abstract readonly name: string

    public abstract build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>

    protected async buildTeamBundle(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], lineup: Lineup, startingPitcherId: string, lineupSource: GameLineupSource): Promise<TeamBundle> {
        const startingPitcher = this.buildStartingPitcher(
            players,
            startingPitcherId
        )

        if (!startingPitcher) {
            const rosterPitcherIds = players
                .filter(player =>
                    this.isPitcher(player)
                )
                .map(player =>
                    player._id
                )
                .join(", ")

            throw new Error(
                `Starting pitcher ${startingPitcherId} is not an active pitcher. Active pitchers: ${rosterPitcherIds}`
            )
        }

        const availablePitchers = await this.bullpenResolver(
            gameDate,
            mlbTeam,
            players,
            startingPitcherId
        )

        if (availablePitchers.length === 0) {
            throw new Error(
                `No bullpen assignments were built for ${mlbTeam.abbrev}.`
            )
        }

        return {
            team,
            players,
            lineup,
            startingPitcher,
            availablePitchers,
            lineupSource
        }
    }

    protected buildStartingPitcher(players: Player[], startingPitcherId: string): RotationPitcher | undefined {
        const player = players.find(player =>
            player._id === startingPitcherId
        )

        if (
            !player ||
            !this.isPitcher(player)
        ) {
            return undefined
        }

        return {
            _id: startingPitcherId
        }
    }

    protected findReplacement(players: Player[], used: Set<string>, position: Position): Player | undefined {
        return this.findBestPositionPlayer(
            players,
            used,
            position
        )
    }

    protected findBestPositionPlayer(players: Player[], used: Set<string>, position: Position): Player | undefined {
        const availablePlayers = players.filter(player =>
            !this.isPitcher(player) &&
            !used.has(player._id)
        )

        if (position === Position.DESIGNATED_HITTER) {
            return availablePlayers[0]
        }

        return availablePlayers
            .map(player => ({
                player,
                score: this.getPositionFitScore(
                    player,
                    position
                )
            }))
            .filter(candidate =>
                candidate.score > 0
            )
            .sort((a, b) =>
                b.score - a.score ||
                a.player._id.localeCompare(
                    b.player._id
                )
            )[0]?.player
    }

    protected isPitcher(player: Player): boolean {
        return player.primaryPosition === Position.PITCHER
    }

    protected playerCanPlay(player: Player, position: Position): boolean {
        return this.getPositionFitScore(
            player,
            position
        ) > 0
    }

    protected getPositionFitScore(player: Player, position: Position): number {
        if (this.isPitcher(player)) {
            return 0
        }

        if (position === Position.DESIGNATED_HITTER) {
            return 1
        }

        if (player.primaryPosition === position) {
            return 100
        }

        if (
            this.isOutfieldPosition(position) &&
            this.isOutfieldPosition(player.primaryPosition)
        ) {
            if (position === Position.CENTER_FIELD) {
                return player.primaryPosition === Position.CENTER_FIELD
                    ? 100
                    : 60
            }

            return 70
        }

        if (position === Position.FIRST_BASE) {
            if (player.primaryPosition === Position.THIRD_BASE) return 65
            if (player.primaryPosition === Position.CATCHER) return 55
            if (player.primaryPosition === Position.SECOND_BASE) return 45
        }

        if (position === Position.SECOND_BASE) {
            if (player.primaryPosition === Position.SHORTSTOP) return 70
            if (player.primaryPosition === Position.THIRD_BASE) return 55
        }

        if (position === Position.SHORTSTOP) {
            if (player.primaryPosition === Position.SECOND_BASE) return 65
            if (player.primaryPosition === Position.THIRD_BASE) return 45
        }

        if (position === Position.THIRD_BASE) {
            if (player.primaryPosition === Position.SHORTSTOP) return 65
            if (player.primaryPosition === Position.SECOND_BASE) return 50
            if (player.primaryPosition === Position.FIRST_BASE) return 45
        }

        return 0
    }

    protected addDays(gameDate: string, days: number): string {
        const date = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        date.setUTCDate(
            date.getUTCDate() +
            days
        )

        return date.toISOString().slice(0, 10)
    }

    protected isOutfieldPosition(position: Position): boolean {
        return position === Position.LEFT_FIELD ||
            position === Position.CENTER_FIELD ||
            position === Position.RIGHT_FIELD
    }

    protected toPosition(value: string | undefined): Position | undefined {
        if (value === "P") return Position.PITCHER
        if (value === "C") return Position.CATCHER
        if (value === "1B") return Position.FIRST_BASE
        if (value === "2B") return Position.SECOND_BASE
        if (value === "3B") return Position.THIRD_BASE
        if (value === "SS") return Position.SHORTSTOP
        if (value === "LF") return Position.LEFT_FIELD
        if (value === "CF") return Position.CENTER_FIELD
        if (value === "RF") return Position.RIGHT_FIELD
        if (value === "DH") return Position.DESIGNATED_HITTER

        return undefined
    }

    protected getScheduleGameForTeam(gameDate: string, teamId: number): any | undefined {
        const schedule = queries.getSchedule(
            Number(gameDate.slice(0, 4))
        )

        if (!schedule) {
            return undefined
        }

        const scheduleDate = (schedule.data.dates ?? []).find(date =>
            String(date.date ?? "") === gameDate
        )

        return (scheduleDate?.games ?? []).find(game =>
            Number(game?.teams?.away?.team?.id) === teamId ||
            Number(game?.teams?.home?.team?.id) === teamId
        )
    }

    protected getGameFeed(gamePk: number | string): any | undefined {
        return queries.getGame(
            Number(gamePk)
        )?.data
    }

    protected getTeamSide(feed: any, teamId: number): "home" | "away" {
        const homeId = Number(
            feed?.gameData?.teams?.home?.id
        )

        return homeId === Number(teamId)
            ? "home"
            : "away"
    }

    protected getStartingPitcherIdFromFeed(feed: any, side: "home" | "away"): string | undefined {
        const probablePitcherId =
            feed?.gameData?.probablePitchers?.[side]?.id

        if (probablePitcherId) {
            return String(
                probablePitcherId
            )
        }

        const pitchers =
            feed?.liveData?.boxscore?.teams?.[side]?.pitchers ??
            []

        if (pitchers.length > 0) {
            return String(
                pitchers[0]
            )
        }

        return undefined
    }

    protected getLineupFromFeed(feed: any, side: "home" | "away"): Lineup {
        const boxscorePlayers = Object.values(
            feed?.liveData?.boxscore?.teams?.[side]?.players ??
            {}
        ) as any[]

        const starters = boxscorePlayers
            .filter(player => {
                const battingOrder = Number(
                    player?.battingOrder
                )

                return Number.isInteger(battingOrder) &&
                    battingOrder >= 100 &&
                    battingOrder <= 900 &&
                    battingOrder % 100 === 0
            })
            .sort((a, b) =>
                Number(a.battingOrder) -
                Number(b.battingOrder)
            )

        const usedPositions = new Set<Position>()

        const order = starters.map(boxscorePlayer => {
            const playerId = String(
                boxscorePlayer?.person?.id ??
                ""
            )

            if (!playerId) {
                throw new Error(
                    "Starting lineup contains a player without an ID."
                )
            }

            const position = this.getStartingPosition(
                boxscorePlayer,
                usedPositions
            )

            if (!position) {
                const positions = [
                    ...(boxscorePlayer?.allPositions ?? []),
                    boxscorePlayer?.position
                ]
                    .map((entry: any) =>
                        String(entry?.abbreviation ?? "")
                    )
                    .filter(Boolean)
                    .join(", ")

                throw new Error(
                    `Starting lineup player ${playerId} has no usable position. Positions: ${positions || "(none)"}.`
                )
            }

            usedPositions.add(
                position
            )

            return {
                _id: playerId,
                position
            }
        })

        return {
            order,
            valid: order.length === 9
        }
    }

    protected getStartingPosition(boxscorePlayer: any, usedPositions: Set<Position>): Position | undefined {
        const abbreviations = [
            ...(boxscorePlayer?.allPositions ?? []),
            boxscorePlayer?.position
        ]
            .map((entry: any) =>
                String(entry?.abbreviation ?? "")
            )
            .filter(abbreviation =>
                abbreviation &&
                abbreviation !== "PH" &&
                abbreviation !== "PR"
            )

        if (
            abbreviations.includes("DH") &&
            !usedPositions.has(Position.DESIGNATED_HITTER)
        ) {
            return Position.DESIGNATED_HITTER
        }

        for (const abbreviation of abbreviations) {
            if (abbreviation === "P") {
                continue
            }

            if (abbreviation === "OF") {
                const outfieldPosition = this.getAvailableOutfieldPosition(
                    usedPositions
                )

                if (!usedPositions.has(outfieldPosition)) {
                    return outfieldPosition
                }

                continue
            }

            const position = this.toPosition(
                abbreviation
            )

            if (
                position &&
                !usedPositions.has(position)
            ) {
                return position
            }
        }

        return undefined
    }

    private getAvailableOutfieldPosition(usedPositions: Set<Position>): Position {
        const outfieldPositions = [
            Position.CENTER_FIELD,
            Position.RIGHT_FIELD,
            Position.LEFT_FIELD
        ]

        return outfieldPositions.find(position =>
            !usedPositions.has(position)
        ) ?? Position.LEFT_FIELD
    }

}


class ConfirmedGameLineupProvider extends BaseGameLineupProvider {

    public readonly name = "confirmed"

    public async build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined> {
        const resolvedGamePk =
            gamePk ??
            this.getScheduleGameForTeam(
                gameDate,
                mlbTeam.id
            )?.gamePk

        if (!resolvedGamePk) {
            throw new Error(
                `No scheduled game was found for ${mlbTeam.abbrev}.`
            )
        }

        const feed = this.getGameFeed(
            resolvedGamePk
        )

        if (!feed) {
            throw new Error(
                `Game feed ${resolvedGamePk} was not found.`
            )
        }

        const side = this.getTeamSide(
            feed,
            mlbTeam.id
        )

        const lineup = this.getLineupFromFeed(
            feed,
            side
        )

        const startingPitcherId = this.getStartingPitcherIdFromFeed(
            feed,
            side
        )

        if (!startingPitcherId) {
            throw new Error(
                `Game ${resolvedGamePk} does not contain a starting pitcher for ${mlbTeam.abbrev}.`
            )
        }

        if (
            !lineup.order ||
            lineup.order.length !== 9
        ) {
            throw new Error(
                `Game ${resolvedGamePk} produced ${lineup.order?.length ?? 0} lineup players for ${mlbTeam.abbrev}.`
            )
        }

        return this.buildTeamBundle(
            gameDate,
            mlbTeam,
            team,
            players,
            lineup,
            startingPitcherId,
            "confirmed"
        )
    }

}


class ProjectedGameLineupProvider extends BaseGameLineupProvider {

    public readonly name = "projected"

    public async build(_gameDate: string, _mlbTeam: MlbTeam, _team: Team, _players: Player[], _gamePk?: number | string): Promise<TeamBundle | undefined> {
        return undefined
    }

}


class PreviousSimilarGameLineupProvider extends BaseGameLineupProvider {

    public readonly name = "previous-similar"

    public async build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined> {
        const resolvedGamePk =
            gamePk ??
            this.getScheduleGameForTeam(
                gameDate,
                mlbTeam.id
            )?.gamePk

        if (!resolvedGamePk) {
            return undefined
        }

        const todayFeed = this.getGameFeed(
            resolvedGamePk
        )

        if (!todayFeed) {
            return undefined
        }

        const todaySide = this.getTeamSide(
            todayFeed,
            mlbTeam.id
        )

        const todayStartingPitcherId = this.getStartingPitcherIdFromFeed(
            todayFeed,
            todaySide
        )

        const opponentSide =
            todaySide === "home"
                ? "away"
                : "home"

        const opponentStartingPitcherId = this.getStartingPitcherIdFromFeed(
            todayFeed,
            opponentSide
        )

        const targetPitcherHand = this.getPitcherHandFromFeed(
            todayFeed,
            opponentStartingPitcherId
        )

        if (
            !todayStartingPitcherId ||
            !targetPitcherHand
        ) {
            return undefined
        }

        const lineup = this.getPreviousUsableLineupAgainstHand(
            gameDate,
            mlbTeam.id,
            players,
            targetPitcherHand
        )

        if (
            !lineup?.order ||
            lineup.order.length !== 9
        ) {
            return undefined
        }

        return this.buildTeamBundle(
            gameDate,
            mlbTeam,
            team,
            players,
            lineup,
            todayStartingPitcherId,
            "previous"
        )
    }

    private getPreviousUsableLineupAgainstHand(gameDate: string, teamId: number, players: Player[], targetPitcherHand: string): Lineup | undefined {
        const previousGames = this.getPreviousGames(
            gameDate,
            teamId
        )

        let fallbackLineup: Lineup | undefined

        for (const previousGame of previousGames) {
            const previousFeed = this.getGameFeed(
                previousGame.gamePk
            )

            if (!previousFeed) {
                continue
            }

            const previousSide = this.getTeamSide(
                previousFeed,
                teamId
            )

            const previousOpponentSide =
                previousSide === "home"
                    ? "away"
                    : "home"

            const previousOpponentStarterId = this.getStartingPitcherIdFromFeed(
                previousFeed,
                previousOpponentSide
            )

            const previousOpponentHand = this.getPitcherHandFromFeed(
                previousFeed,
                previousOpponentStarterId
            )

            const previousLineup = this.getLineupFromFeed(
                previousFeed,
                previousSide
            )

            if (
                !previousLineup.order ||
                previousLineup.order.length !== 9
            ) {
                continue
            }

            const repairedLineup = this.repairLineup(
                players,
                previousLineup
            )

            if (!repairedLineup) {
                continue
            }

            if (!fallbackLineup) {
                fallbackLineup = repairedLineup
            }

            if (previousOpponentHand === targetPitcherHand) {
                return repairedLineup
            }
        }

        return fallbackLineup
    }

    private getPreviousGames(gameDate: string, teamId: number): any[] {
        const season = Number(
            gameDate.slice(0, 4)
        )

        const schedule = queries.getSchedule(
            season
        )

        if (!schedule) {
            return []
        }

        const earliestDate = this.addDays(
            gameDate,
            -180
        )

        return (schedule.data.dates ?? [])
            .filter(date => {
                const dateValue = String(
                    date?.date ??
                    ""
                )

                return dateValue < gameDate &&
                    dateValue >= earliestDate
            })
            .flatMap(date =>
                (date?.games ?? [])
                    .filter(game =>
                        Number(game?.teams?.away?.team?.id) === teamId ||
                        Number(game?.teams?.home?.team?.id) === teamId
                    )
                    .map(game => ({
                        ...game,
                        scheduleDate: String(
                            date?.date ??
                            ""
                        )
                    }))
            )
            .sort((a, b) => {
                const dateDifference =
                    String(b.scheduleDate).localeCompare(
                        String(a.scheduleDate)
                    )

                if (dateDifference !== 0) {
                    return dateDifference
                }

                return Number(b.gamePk ?? 0) -
                    Number(a.gamePk ?? 0)
            })
    }

    private getPitcherHandFromFeed(feed: any, pitcherId: string | undefined): string | undefined {
        if (!pitcherId) {
            return undefined
        }

        return feed
            ?.gameData
            ?.players
            ?.[`ID${pitcherId}`]
            ?.pitchHand
            ?.code
    }

    private repairLineup(players: Player[], lineup: Lineup): Lineup | undefined {
        const playerIds = new Set(
            players.map(player =>
                player._id
            )
        )

        const used = new Set<string>()
        const repaired: LineupPlayer[] = []

        for (const spot of lineup.order ?? []) {
            if (
                !spot._id ||
                !spot.position
            ) {
                return undefined
            }

            if (
                playerIds.has(spot._id) &&
                !used.has(spot._id)
            ) {
                used.add(
                    spot._id
                )

                repaired.push(
                    spot
                )

                continue
            }

            const replacement = this.findReplacement(
                players,
                used,
                spot.position
            )

            if (!replacement) {
                return undefined
            }

            used.add(
                replacement._id
            )

            repaired.push({
                _id: replacement._id,
                position: spot.position
            })
        }

        if (repaired.length !== 9) {
            return undefined
        }

        return {
            order: repaired,
            valid: true
        }
    }

}


class FallbackGameLineupProvider extends BaseGameLineupProvider {

    public readonly name = "fallback"

    public async build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], _gamePk?: number | string): Promise<TeamBundle | undefined> {
        const startingPitcher = players.find(player =>
            this.isPitcher(player)
        )

        if (!startingPitcher) {
            throw new Error(
                `No active pitcher was available for ${mlbTeam.abbrev}.`
            )
        }

        const used = new Set<string>()
        const order: LineupPlayer[] = []
        const remainingPositions = [
            ...this.defensivePositions()
        ]

        while (remainingPositions.length > 0) {
            const position = this.getMostConstrainedPosition(
                players,
                used,
                remainingPositions
            )

            let player = this.findBestPositionPlayer(
                players,
                used,
                position
            )

            if (!player) {
                player = players
                    .filter(candidate =>
                        !this.isPitcher(candidate) &&
                        !used.has(candidate._id)
                    )
                    .map(candidate => ({
                        player: candidate,
                        remainingFits: remainingPositions
                            .filter(remainingPosition =>
                                remainingPosition !== position
                            )
                            .filter(remainingPosition =>
                                this.playerCanPlay(
                                    candidate,
                                    remainingPosition
                                )
                            )
                            .length
                    }))
                    .sort((a, b) =>
                        a.remainingFits - b.remainingFits ||
                        a.player._id.localeCompare(
                            b.player._id
                        )
                    )[0]?.player
            }

            if (!player) {
                throw new Error(
                    `Unable to fill position ${position} for ${mlbTeam.abbrev}.`
                )
            }

            used.add(
                player._id
            )

            order.push({
                _id: player._id,
                position
            })

            remainingPositions.splice(
                remainingPositions.indexOf(position),
                1
            )
        }

        const designatedHitter = this.findBestPositionPlayer(
            players,
            used,
            Position.DESIGNATED_HITTER
        )

        if (!designatedHitter) {
            throw new Error(
                `Unable to find a designated hitter for ${mlbTeam.abbrev}.`
            )
        }

        order.push({
            _id: designatedHitter._id,
            position: Position.DESIGNATED_HITTER
        })

        return this.buildTeamBundle(
            gameDate,
            mlbTeam,
            team,
            players,
            {
                order,
                valid: true
            },
            startingPitcher._id,
            "fallback"
        )
    }

    private getMostConstrainedPosition(players: Player[], used: Set<string>, positions: Position[]): Position {
        return [
            ...positions
        ]
            .map(position => ({
                position,
                candidates: players.filter(player =>
                    !used.has(player._id) &&
                    this.playerCanPlay(
                        player,
                        position
                    )
                ).length,
                priority: this.getPositionPriority(
                    position
                )
            }))
            .sort((a, b) =>
                a.candidates - b.candidates ||
                a.priority - b.priority
            )[0].position
    }

    private getPositionPriority(position: Position): number {
        const priorities = new Map<Position, number>([
            [Position.CATCHER, 1],
            [Position.SHORTSTOP, 2],
            [Position.CENTER_FIELD, 3],
            [Position.SECOND_BASE, 4],
            [Position.THIRD_BASE, 5],
            [Position.FIRST_BASE, 6],
            [Position.RIGHT_FIELD, 7],
            [Position.LEFT_FIELD, 8]
        ])

        return priorities.get(position) ?? 99
    }

    private defensivePositions(): Position[] {
        return [
            Position.CATCHER,
            Position.SHORTSTOP,
            Position.CENTER_FIELD,
            Position.SECOND_BASE,
            Position.THIRD_BASE,
            Position.FIRST_BASE,
            Position.RIGHT_FIELD,
            Position.LEFT_FIELD
        ]
    }

}


interface PitchingRoleWithWorkload extends PitchingRole {
    pitchesYesterday: number
    pitchesLastThreeDays: number
    pitchesLastFiveDays: number
}


type BullpenResolver = (gameDate: string, mlbTeam: MlbTeam, players: Player[], startingPitcherId: string) => Promise<PitchingRole[]>


interface GameLineupProvider {
    readonly name: string
    build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>
}


type GameLineupSource =
    | "confirmed"
    | "projected"
    | "previous"
    | "fallback"


interface TeamBundle {
    team: Team
    players: Player[]
    lineup: Lineup
    startingPitcher: RotationPitcher
    availablePitchers: PitchingRole[]
    lineupSource: GameLineupSource
}


export {
    ConfirmedGameLineupProvider,
    FallbackGameLineupProvider,
    GameLineupService,
    PreviousSimilarGameLineupProvider,
    ProjectedGameLineupProvider
}


export type {
    GameLineupProvider,
    GameLineupSource,
    PitchingRoleWithWorkload,
    TeamBundle
}
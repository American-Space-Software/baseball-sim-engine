import {
    PitchingRoleType
} from "../../sim/service/enums.js"
import type { PitcherAppearance } from "../repository/pitcher-appearance-repository.js"

import { PitcherAppearanceService } from "./pitcher-appearance-service.js"



const WORKLOAD_WINDOW_DAYS = 5
const ROLE_WINDOW_DAYS = 30

const MINIMUM_ROTATION_STARTS = 2
const MINIMUM_BULLPEN_PITCHERS = 5


class PitcherWorkloadService {

    public constructor(private readonly pitcherAppearanceService: PitcherAppearanceService) {}

    public async getPitcherWorkloads(gameDate: string, playerIds: string[]): Promise<Map<string, PitcherWorkload>> {
        const normalizedPlayerIds = this.normalizePlayerIds(playerIds)
        const appearances = await this.getAppearances(
            gameDate,
            normalizedPlayerIds,
            WORKLOAD_WINDOW_DAYS
        )

        const appearancesByPlayerId = this.groupAppearancesByPlayerId(
            normalizedPlayerIds,
            appearances
        )

        const workloads = new Map<string, PitcherWorkload>()

        for (const playerId of normalizedPlayerIds) {
            workloads.set(
                playerId,
                this.buildWorkload(
                    gameDate,
                    playerId,
                    appearancesByPlayerId.get(playerId) ?? []
                )
            )
        }

        return workloads
    }

    public async getPitcherWorkload(gameDate: string, playerId: string): Promise<PitcherWorkload> {
        const workloads = await this.getPitcherWorkloads(
            gameDate,
            [
                playerId
            ]
        )

        return workloads.get(
            String(playerId)
        ) ?? this.buildWorkload(
            gameDate,
            String(playerId),
            []
        )
    }

    public async getBullpenRoles(gameDate: string, playerIds: string[], startingPitcherId?: string): Promise<SynthesizedPitchingRole[]> {
        const normalizedStartingPitcherId = startingPitcherId
            ? String(startingPitcherId)
            : undefined

        const candidatePlayerIds = this.normalizePlayerIds(
            playerIds
        ).filter(playerId =>
            playerId !== normalizedStartingPitcherId
        )

        if (candidatePlayerIds.length < MINIMUM_BULLPEN_PITCHERS) {
            throw new Error(
                `Cannot synthesize bullpen roles with only ${candidatePlayerIds.length} pitchers.`
            )
        }

        const [
            roleAppearances,
            workloads
        ] = await Promise.all([
            this.getAppearances(
                gameDate,
                candidatePlayerIds,
                ROLE_WINDOW_DAYS
            ),
            this.getPitcherWorkloads(
                gameDate,
                candidatePlayerIds
            )
        ])

        const appearancesByPlayerId = this.groupAppearancesByPlayerId(
            candidatePlayerIds,
            roleAppearances
        )

        const candidateProfiles = candidatePlayerIds.map(playerId =>
            this.buildRoleProfile(
                playerId,
                appearancesByPlayerId.get(playerId) ?? []
            )
        )

        const profiles = this.selectBullpenProfiles(
            candidateProfiles
        )

        const roleByPlayerId = this.assignBullpenRoles(
            profiles
        )

        const priorities = new Map<PitchingRoleType, number>()

        const roles = profiles.map(profile => {
            const role = roleByPlayerId.get(
                profile.playerId
            )

            if (!role) {
                throw new Error(
                    `No synthesized bullpen role assigned to pitcher ${profile.playerId}.`
                )
            }

            const priority =
                (priorities.get(role) ?? 0) + 1

            priorities.set(
                role,
                priority
            )

            return {
                playerId: profile.playerId,
                role,
                priority,
                profile,
                workload: workloads.get(
                    profile.playerId
                ) ?? this.buildWorkload(
                    gameDate,
                    profile.playerId,
                    []
                )
            }
        })

        return this.sortRoles(
            roles
        )
    }

    private selectBullpenProfiles(profiles: PitcherRoleProfile[]): PitcherRoleProfile[] {
        const bullpenProfiles = profiles.filter(profile =>
            !this.isRotationStarter(profile)
        )

        if (bullpenProfiles.length >= MINIMUM_BULLPEN_PITCHERS) {
            return bullpenProfiles
        }

        const rotationProfiles = profiles
            .filter(profile =>
                this.isRotationStarter(profile)
            )
            .sort((a, b) => {
                const reliefDifference =
                    b.reliefAppearances -
                    a.reliefAppearances

                if (reliefDifference !== 0) {
                    return reliefDifference
                }

                const startDifference =
                    a.starts -
                    b.starts

                if (startDifference !== 0) {
                    return startDifference
                }

                const appearanceDifference =
                    a.appearances -
                    b.appearances

                if (appearanceDifference !== 0) {
                    return appearanceDifference
                }

                return a.playerId.localeCompare(
                    b.playerId
                )
            })

        const selected = [
            ...bullpenProfiles
        ]

        for (const profile of rotationProfiles) {
            if (selected.length >= MINIMUM_BULLPEN_PITCHERS) {
                break
            }

            selected.push(
                profile
            )
        }

        if (selected.length < MINIMUM_BULLPEN_PITCHERS) {
            throw new Error(
                `Cannot synthesize bullpen roles with only ${selected.length} eligible pitchers.`
            )
        }

        return selected
    }

    private isRotationStarter(profile: PitcherRoleProfile): boolean {
        if (profile.starts < MINIMUM_ROTATION_STARTS) {
            return false
        }

        return profile.starts > profile.reliefAppearances
    }

    private async getAppearances(gameDate: string, playerIds: string[], windowDays: number): Promise<PitcherAppearance[]> {
        const requestedPlayerIds = new Set(
            playerIds.map(playerId =>
                String(playerId)
            )
        )

        const appearanceDates = Array.from(
            {
                length: windowDays
            },
            (_value, index) =>
                this.addDays(
                    gameDate,
                    -(index + 1)
                )
        )

        const appearancesByDate = await Promise.all(
            appearanceDates.map(appearanceDate =>
                this.pitcherAppearanceService.getForDate(
                    appearanceDate
                )
            )
        )

        return appearancesByDate
            .flat()
            .filter(appearance =>
                requestedPlayerIds.has(
                    appearance.playerId
                )
            )
            .sort((a, b) =>
                a.gameDate.localeCompare(
                    b.gameDate
                ) ||
                a.gameId.localeCompare(
                    b.gameId
                )
            )
    }

    private buildRoleProfile(playerId: string, appearances: PitcherAppearance[]): PitcherRoleProfile {
        const reliefAppearances = appearances.filter(
            appearance =>
                appearance.gamesStarted <= 0
        )

        const starts = appearances.reduce(
            (total, appearance) =>
                total + appearance.gamesStarted,
            0
        )

        const saves = appearances.reduce(
            (total, appearance) =>
                total + appearance.saves,
            0
        )

        const holds = appearances.reduce(
            (total, appearance) =>
                total + appearance.holds,
            0
        )

        const blownSaves = appearances.reduce(
            (total, appearance) =>
                total + appearance.blownSaves,
            0
        )

        const gamesFinished = appearances.reduce(
            (total, appearance) =>
                total + appearance.gamesFinished,
            0
        )

        const outs = reliefAppearances.reduce(
            (total, appearance) =>
                total + appearance.outs,
            0
        )

        const pitches = reliefAppearances.reduce(
            (total, appearance) =>
                total + appearance.pitches,
            0
        )

        const entryInnings = reliefAppearances
            .map(appearance =>
                appearance.entryInning
            )
            .filter(
                (inning): inning is number =>
                    inning !== undefined
            )

        const lateInningAppearances = entryInnings.filter(
            inning =>
                inning >= 7
        ).length

        const multiInningAppearances = reliefAppearances.filter(
            appearance =>
                appearance.outs >= 6
        ).length

        const appearanceCount = reliefAppearances.length

        const averageOuts = this.safeDivide(
            outs,
            appearanceCount
        )

        const averagePitches = this.safeDivide(
            pitches,
            appearanceCount
        )

        const averageEntryInning = entryInnings.length > 0
            ? this.safeDivide(
                entryInnings.reduce(
                    (total, inning) =>
                        total + inning,
                    0
                ),
                entryInnings.length
            )
            : 0

        const closerScore =
            saves * 100 +
            gamesFinished * 12 +
            holds * 3 +
            lateInningAppearances * 2 -
            blownSaves * 2

        const setupScore =
            holds * 50 +
            lateInningAppearances * 6 +
            gamesFinished * 2 +
            saves * 2

        const longScore =
            averageOuts * 20 +
            averagePitches +
            multiInningAppearances * 15 -
            lateInningAppearances * 2

        const mopUpScore =
            (9 - Math.min(
                9,
                averageEntryInning || 5
            )) * 5 +
            Math.max(
                0,
                6 - averageOuts
            ) +
            Math.max(
                0,
                10 - closerScore
            ) +
            Math.max(
                0,
                10 - setupScore
            )

        return {
            playerId,
            appearances: appearances.length,
            reliefAppearances: appearanceCount,
            starts,
            saves,
            holds,
            blownSaves,
            gamesFinished,
            outs,
            pitches,
            averageOuts,
            averagePitches,
            averageEntryInning,
            lateInningAppearances,
            multiInningAppearances,
            closerScore,
            setupScore,
            longScore,
            mopUpScore
        }
    }

    private assignBullpenRoles(profiles: PitcherRoleProfile[]): Map<string, PitchingRoleType> {
        const assignments = new Map<string, PitchingRoleType>()

        const remaining = new Map(
            profiles.map(profile => [
                profile.playerId,
                profile
            ])
        )

        const closer = this.takeBest(
            remaining,
            profile =>
                profile.closerScore
        )

        assignments.set(
            closer.playerId,
            PitchingRoleType.CLOSER
        )

        const setup = this.takeBest(
            remaining,
            profile =>
                profile.setupScore
        )

        assignments.set(
            setup.playerId,
            PitchingRoleType.SETUP
        )

        const long = this.takeBest(
            remaining,
            profile =>
                profile.longScore
        )

        assignments.set(
            long.playerId,
            PitchingRoleType.LONG
        )

        const mopUp = this.takeBest(
            remaining,
            profile =>
                profile.mopUpScore
        )

        assignments.set(
            mopUp.playerId,
            PitchingRoleType.MOP_UP
        )

        const middleProfiles = [
            ...remaining.values()
        ].sort((a, b) => {
            const aScore =
                a.setupScore +
                a.lateInningAppearances

            const bScore =
                b.setupScore +
                b.lateInningAppearances

            return bScore - aScore ||
                a.playerId.localeCompare(
                    b.playerId
                )
        })

        if (middleProfiles.length === 0) {
            throw new Error(
                "Cannot synthesize bullpen without a middle reliever."
            )
        }

        for (const profile of middleProfiles) {
            assignments.set(
                profile.playerId,
                PitchingRoleType.MIDDLE
            )
        }

        return assignments
    }

    private takeBest(remaining: Map<string, PitcherRoleProfile>, score: (profile: PitcherRoleProfile) => number): PitcherRoleProfile {
        const best = [
            ...remaining.values()
        ].sort((a, b) => {
            const scoreDifference =
                score(b) -
                score(a)

            if (scoreDifference !== 0) {
                return scoreDifference
            }

            const appearanceDifference =
                b.reliefAppearances -
                a.reliefAppearances

            if (appearanceDifference !== 0) {
                return appearanceDifference
            }

            return a.playerId.localeCompare(
                b.playerId
            )
        })[0]

        if (!best) {
            throw new Error(
                "Not enough pitchers remain to synthesize bullpen roles."
            )
        }

        remaining.delete(
            best.playerId
        )

        return best
    }

    private sortRoles(roles: SynthesizedPitchingRole[]): SynthesizedPitchingRole[] {
        const roleOrder = new Map<PitchingRoleType, number>([
            [
                PitchingRoleType.CLOSER,
                1
            ],
            [
                PitchingRoleType.SETUP,
                2
            ],
            [
                PitchingRoleType.MIDDLE,
                3
            ],
            [
                PitchingRoleType.LONG,
                4
            ],
            [
                PitchingRoleType.MOP_UP,
                5
            ]
        ])

        const sorted = [
            ...roles
        ].sort((a, b) => {
            const roleDifference =
                (roleOrder.get(a.role) ?? 99) -
                (roleOrder.get(b.role) ?? 99)

            if (roleDifference !== 0) {
                return roleDifference
            }

            const roleScoreDifference =
                this.getRoleScore(
                    b.profile,
                    b.role
                ) -
                this.getRoleScore(
                    a.profile,
                    a.role
                )

            if (roleScoreDifference !== 0) {
                return roleScoreDifference
            }

            return a.playerId.localeCompare(
                b.playerId
            )
        })

        const priorities = new Map<PitchingRoleType, number>()

        for (const assignment of sorted) {
            const priority =
                (priorities.get(
                    assignment.role
                ) ?? 0) + 1

            assignment.priority = priority

            priorities.set(
                assignment.role,
                priority
            )
        }

        return sorted
    }

    private getRoleScore(profile: PitcherRoleProfile, role: PitchingRoleType): number {
        if (role === PitchingRoleType.CLOSER) {
            return profile.closerScore
        }

        if (role === PitchingRoleType.SETUP) {
            return profile.setupScore
        }

        if (role === PitchingRoleType.LONG) {
            return profile.longScore
        }

        if (role === PitchingRoleType.MOP_UP) {
            return profile.mopUpScore
        }

        return profile.setupScore
    }

    private groupAppearancesByPlayerId(playerIds: string[], appearances: PitcherAppearance[]): Map<string, PitcherAppearance[]> {
        const grouped = new Map<string, PitcherAppearance[]>()

        for (const playerId of playerIds) {
            grouped.set(
                playerId,
                []
            )
        }

        for (const appearance of appearances) {
            grouped.get(
                appearance.playerId
            )?.push(
                appearance
            )
        }

        return grouped
    }

    private buildWorkload(gameDate: string, playerId: string, appearances: PitcherAppearance[]): PitcherWorkload {
        const appearancesYesterday = appearances.filter(
            appearance =>
                this.daysBetween(
                    appearance.gameDate,
                    gameDate
                ) === 1
        )

        const appearancesLastThreeDays = appearances.filter(
            appearance => {
                const daysBack = this.daysBetween(
                    appearance.gameDate,
                    gameDate
                )

                return daysBack >= 1 &&
                    daysBack <= 3
            }
        )

        const appearancesLastFiveDays = appearances.filter(
            appearance => {
                const daysBack = this.daysBetween(
                    appearance.gameDate,
                    gameDate
                )

                return daysBack >= 1 &&
                    daysBack <= 5
            }
        )

        const lastAppearance = appearances.length > 0
            ? appearances[
                appearances.length - 1
            ]
            : undefined

        return {
            playerId,
            appearances: [
                ...appearances
            ],
            lastAppearanceDate:
                lastAppearance?.gameDate,
            lastAppearancePitchCount:
                lastAppearance?.pitches ?? 0,
            daysSinceLastAppearance:
                lastAppearance
                    ? this.daysBetween(
                        lastAppearance.gameDate,
                        gameDate
                    )
                    : undefined,
            appearancesYesterday:
                appearancesYesterday.length,
            appearancesLastThreeDays:
                appearancesLastThreeDays.length,
            appearancesLastFiveDays:
                appearancesLastFiveDays.length,
            consecutiveDaysPitched:
                this.getConsecutiveDaysPitched(
                    gameDate,
                    appearances
                ),
            pitchesYesterday:
                this.sumPitches(
                    appearancesYesterday
                ),
            pitchesLastThreeDays:
                this.sumPitches(
                    appearancesLastThreeDays
                ),
            pitchesLastFiveDays:
                this.sumPitches(
                    appearancesLastFiveDays
                )
        }
    }

    private getConsecutiveDaysPitched(gameDate: string, appearances: PitcherAppearance[]): number {
        const appearanceDates = new Set(
            appearances.map(appearance =>
                appearance.gameDate
            )
        )

        let consecutiveDays = 0

        for (
            let daysBack = 1;
            daysBack <= WORKLOAD_WINDOW_DAYS;
            daysBack++
        ) {
            const date = this.addDays(
                gameDate,
                -daysBack
            )

            if (!appearanceDates.has(date)) {
                break
            }

            consecutiveDays++
        }

        return consecutiveDays
    }

    private normalizePlayerIds(playerIds: string[]): string[] {
        return [
            ...new Set(
                playerIds
                    .map(playerId =>
                        String(playerId)
                    )
                    .filter(playerId =>
                        !!playerId
                    )
            )
        ]
    }

    private sumPitches(appearances: PitcherAppearance[]): number {
        return appearances.reduce(
            (total, appearance) =>
                total + appearance.pitches,
            0
        )
    }

    private safeDivide(numerator: number, denominator: number): number {
        return denominator > 0
            ? numerator / denominator
            : 0
    }

    private daysBetween(startDate: string, endDate: string): number {
        const start = new Date(
            `${startDate}T12:00:00.000Z`
        )

        const end = new Date(
            `${endDate}T12:00:00.000Z`
        )

        return Math.round(
            (
                end.getTime() -
                start.getTime()
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        )
    }

    private addDays(gameDate: string, days: number): string {
        const date = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        date.setUTCDate(
            date.getUTCDate() +
            days
        )

        return date.toISOString().slice(
            0,
            10
        )
    }

}


interface PitcherWorkload {
    playerId: string
    appearances: PitcherAppearance[]

    lastAppearanceDate?: string
    lastAppearancePitchCount: number
    daysSinceLastAppearance?: number

    appearancesYesterday: number
    appearancesLastThreeDays: number
    appearancesLastFiveDays: number

    consecutiveDaysPitched: number

    pitchesYesterday: number
    pitchesLastThreeDays: number
    pitchesLastFiveDays: number
}


interface PitcherRoleProfile {
    playerId: string
    appearances: number
    reliefAppearances: number
    starts: number

    saves: number
    holds: number
    blownSaves: number
    gamesFinished: number

    outs: number
    pitches: number

    averageOuts: number
    averagePitches: number
    averageEntryInning: number

    lateInningAppearances: number
    multiInningAppearances: number

    closerScore: number
    setupScore: number
    longScore: number
    mopUpScore: number
}


interface SynthesizedPitchingRole {
    playerId: string
    role: PitchingRoleType
    priority: number
    profile: PitcherRoleProfile
    workload: PitcherWorkload
}


export {
    PitcherWorkloadService
}

export type {
    PitcherRoleProfile,
    PitcherWorkload,
    SynthesizedPitchingRole
}
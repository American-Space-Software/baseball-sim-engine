import { PitchType } from "../../sim/service/enums.js"

import type {
    HittingRatings,
    PitchEnvironmentTarget,
    PitchRatings,
    PitchTypeMovementStat,
    PlayerRatingInput
} from "../../sim/service/interfaces.js"
import { PlayerRatingInputRepository } from "../../ratings/repository/player-rating-input-repository.js"
import { PlayerRatingSeasonInputRepository } from "../../ratings/repository/player-rating-season-input-repository.js"

import {
    clamp,
    getAverage,
    safeDiv
} from "../../importer/util.js"



interface GeneratedPlayerRatings {
    playerId: string
    hittingRatings: HittingRatings
    pitchRatings: PitchRatings
}


interface RatingWindow {
    name: string
    weight: number
    maximumAppearances?: number
    minimumDaysAgo?: number
    maximumDaysAgo?: number
    minimumPlateAppearances: number
}
interface WeightedRatingsSet {
    ratings: GeneratedPlayerRatings
    weight: number
}

interface PlayerRatingState {
    season: number
    currentDate: string
    pitchEnvironmentSignature: string
    careerInputs: Map<string, PlayerRatingInput>
    last162Inputs: Map<string, PlayerRatingInput>
    recentInputsByWindow: Map<string, Map<string, PlayerRatingInput>>
    ratingsByPlayerId: Map<string, GeneratedPlayerRatings>
}

interface RatingDateRange {
    startDate: string
    endDateExclusive: string
}

const ratingWindows: RatingWindow[] = [
    {
        name: "career",
        weight: 0.50,
        minimumPlateAppearances: 0
    },
    {
        name: "last-162",
        weight: 0.30,
        maximumAppearances: 162,
        minimumPlateAppearances: 0
    },
    {
        name: "16-30",
        weight: 0.12,
        minimumDaysAgo: 16,
        maximumDaysAgo: 30,
        minimumPlateAppearances: 25
    },
    {
        name: "8-15",
        weight: 0.06,
        minimumDaysAgo: 8,
        maximumDaysAgo: 15,
        minimumPlateAppearances: 15
    },
    {
        name: "1-7",
        weight: 0.02,
        minimumDaysAgo: 1,
        maximumDaysAgo: 7,
        minimumPlateAppearances: 10
    }
]


class PlayerRatingService {

    private readonly states: PlayerRatingState[] = []

    constructor(
        private readonly playerRatingInputRepository: PlayerRatingInputRepository,
        private readonly playerRatingSeasonInputRepository: PlayerRatingSeasonInputRepository
    ) {}


    public async buildPlayerRatingsForDate(season: number, gameDate: string, pitchEnvironment: PitchEnvironmentTarget, filterPlayerIds?: Set<string>): Promise<Map<string, GeneratedPlayerRatings>> {
        const startedAt = Date.now()
        const state = this.getOrCreateState(
            season,
            gameDate
        )

        const selectedPlayerIds = this.getSelectedPlayerIds(
            season,
            filterPlayerIds
        )

        const pitchEnvironmentSignature = JSON.stringify(
            pitchEnvironment
        )

        let affectedPlayerIds: Set<string>

        if (state.currentDate === `${season - 1}-01-01`) {
            affectedPlayerIds = this.initializeState(
                state,
                gameDate,
                selectedPlayerIds
            )
        } else if (state.currentDate < gameDate) {
            affectedPlayerIds = this.advanceState(
                state,
                gameDate,
                selectedPlayerIds
            )
        } else {
            affectedPlayerIds = this.loadMissingPlayers(
                state,
                gameDate,
                selectedPlayerIds
            )
        }

        if (state.pitchEnvironmentSignature !== pitchEnvironmentSignature) {
            affectedPlayerIds = new Set(
                selectedPlayerIds
            )
        }

        console.log(
            `Preparing ratings for ${selectedPlayerIds.size} players through ${gameDate}; ` +
            `${affectedPlayerIds.size} require rebuilding.`
        )

        this.rebuildPlayerRatings(
            state,
            pitchEnvironment,
            affectedPlayerIds
        )

        state.currentDate = gameDate
        state.pitchEnvironmentSignature = pitchEnvironmentSignature

        const ratings = new Map<string, GeneratedPlayerRatings>()

        for (const playerId of selectedPlayerIds) {
            const playerRatings = state.ratingsByPlayerId.get(
                playerId
            )

            if (!playerRatings) {
                continue
            }

            ratings.set(
                playerId,
                structuredClone(
                    playerRatings
                )
            )
        }

        console.log(
            `Built ${ratings.size} player ratings in ` +
            `${this.formatDuration(Date.now() - startedAt)}.`
        )

        return ratings
    }

    public clearCache(season?: number): void {
        if (season === undefined) {
            this.states.length = 0
            return
        }

        const stateIndex = this.states.findIndex(state =>
            state.season === season
        )

        if (stateIndex >= 0) {
            this.states.splice(
                stateIndex,
                1
            )
        }
    }

    private getOrCreateState(season: number, gameDate: string): PlayerRatingState {
        const existing = this.states.find(state =>
            state.season === season
        )

        if (
            existing &&
            gameDate >= existing.currentDate
        ) {
            return existing
        }

        if (existing) {
            this.states.splice(
                this.states.indexOf(existing),
                1
            )
        }

        const created: PlayerRatingState = {
            season,
            currentDate: `${season - 1}-01-01`,
            pitchEnvironmentSignature: "",
            careerInputs: new Map<string, PlayerRatingInput>(),
            last162Inputs: new Map<string, PlayerRatingInput>(),
            recentInputsByWindow: new Map<string, Map<string, PlayerRatingInput>>(),
            ratingsByPlayerId: new Map<string, GeneratedPlayerRatings>()
        }

        this.states.push(
            created
        )

        return created
    }

    private getSelectedPlayerIds(season: number, filterPlayerIds?: Set<string>): Set<string> {
        if (
            filterPlayerIds &&
            filterPlayerIds.size > 0
        ) {
            return new Set(
                Array.from(filterPlayerIds)
                    .map(playerId =>
                        String(playerId)
                    )
            )
        }

        return this.playerRatingInputRepository.getPlayerIdsForSeason(
            season
        )
    }

    private initializeState(state: PlayerRatingState, gameDate: string, selectedPlayerIds: Set<string>): Set<string> {
        const startedAt = Date.now()

        console.log(
            `Initializing rating inputs for ${selectedPlayerIds.size} players through ${gameDate}.`
        )

        const careerStartedAt = Date.now()

        state.careerInputs = this.getCareerInputs(
            state.season,
            gameDate,
            selectedPlayerIds
        )

        // console.log(
        //     `Loaded ${state.careerInputs.size} career inputs in ` +
        //     `${this.formatDuration(Date.now() - careerStartedAt)}.`
        // )

        const last162StartedAt = Date.now()

        state.last162Inputs = this.toInputMap(
            this.playerRatingInputRepository.getLastAppearances(
                gameDate,
                this.getLast162Window().maximumAppearances ?? 162,
                selectedPlayerIds
            )
        )

        // console.log(
        //     `Loaded ${state.last162Inputs.size} last-162 inputs in ` +
        //     `${this.formatDuration(Date.now() - last162StartedAt)}.`
        // )

        state.recentInputsByWindow.clear()

        for (const window of this.getRecentWindows()) {
            const windowStartedAt = Date.now()

            const dateRange = PlayerRatingService.getWindowDateRange(
                gameDate,
                window
            )

            const inputs = this.toInputMap(
                this.playerRatingInputRepository.getForDateRange(
                    dateRange.startDate,
                    dateRange.endDateExclusive,
                    selectedPlayerIds
                )
            )

            state.recentInputsByWindow.set(
                window.name,
                inputs
            )

            // console.log(
            //     `Loaded ${inputs.size} ${window.name} inputs in ` +
            //     `${this.formatDuration(Date.now() - windowStartedAt)}.`
            // )
        }

        console.log(
            `Initialized rating inputs for ${state.careerInputs.size} players in ` +
            `${this.formatDuration(Date.now() - startedAt)}.`
        )

        return new Set(
            selectedPlayerIds
        )
    }

    private advanceState(state: PlayerRatingState, gameDate: string, selectedPlayerIds: Set<string>): Set<string> {
        const startedAt = Date.now()
        const affectedPlayerIds = this.loadMissingPlayers(
            state,
            gameDate,
            selectedPlayerIds
        )

        const addedInputs = this.toInputMap(
            this.playerRatingInputRepository.getForDateRange(
                state.currentDate,
                gameDate,
                selectedPlayerIds
            )
        )

        for (const [playerId, addedInput] of addedInputs) {
            affectedPlayerIds.add(
                playerId
            )

            const existingCareerInput = state.careerInputs.get(
                playerId
            )

            state.careerInputs.set(
                playerId,
                existingCareerInput
                    ? this.addPlayerRatingInputs(existingCareerInput, addedInput)
                    : structuredClone(addedInput)
            )
        }

        for (const window of this.getRecentWindows()) {
            const previousRange = PlayerRatingService.getWindowDateRange(
                state.currentDate,
                window
            )

            const currentRange = PlayerRatingService.getWindowDateRange(
                gameDate,
                window
            )

            for (const changedRange of this.getChangedDateRanges(previousRange, currentRange)) {
                const changedInputs = this.toInputMap(
                    this.playerRatingInputRepository.getForDateRange(
                        changedRange.startDate,
                        changedRange.endDateExclusive,
                        selectedPlayerIds
                    )
                )

                this.addPlayerIds(
                    affectedPlayerIds,
                    changedInputs
                )
            }
        }

        if (affectedPlayerIds.size > 0) {
            const refreshedLast162Inputs = this.toInputMap(
                this.playerRatingInputRepository.getLastAppearances(
                    gameDate,
                    this.getLast162Window().maximumAppearances ?? 162,
                    affectedPlayerIds
                )
            )

            this.replaceInputs(
                state.last162Inputs,
                affectedPlayerIds,
                refreshedLast162Inputs
            )

            for (const window of this.getRecentWindows()) {
                const dateRange = PlayerRatingService.getWindowDateRange(
                    gameDate,
                    window
                )

                const refreshedInputs = this.toInputMap(
                    this.playerRatingInputRepository.getForDateRange(
                        dateRange.startDate,
                        dateRange.endDateExclusive,
                        affectedPlayerIds
                    )
                )

                const windowInputs =
                    state.recentInputsByWindow.get(window.name) ??
                    new Map<string, PlayerRatingInput>()

                this.replaceInputs(
                    windowInputs,
                    affectedPlayerIds,
                    refreshedInputs
                )

                state.recentInputsByWindow.set(
                    window.name,
                    windowInputs
                )
            }
        }

        console.log(
            `Advanced rating inputs from ${state.currentDate} to ${gameDate}; ` +
            `${affectedPlayerIds.size} players changed in ` +
            `${this.formatDuration(Date.now() - startedAt)}.`
        )

        return affectedPlayerIds
    }

    private loadMissingPlayers(state: PlayerRatingState, gameDate: string, selectedPlayerIds: Set<string>): Set<string> {
        const missingPlayerIds = new Set(
            Array.from(selectedPlayerIds).filter(playerId =>
                !state.careerInputs.has(playerId)
            )
        )

        if (missingPlayerIds.size === 0) {
            return missingPlayerIds
        }

        const careerInputs = this.getCareerInputs(
            state.season,
            gameDate,
            missingPlayerIds
        )

        const last162Inputs = this.toInputMap(
            this.playerRatingInputRepository.getLastAppearances(
                gameDate,
                this.getLast162Window().maximumAppearances ?? 162,
                missingPlayerIds
            )
        )

        this.replaceInputs(
            state.careerInputs,
            missingPlayerIds,
            careerInputs
        )

        this.replaceInputs(
            state.last162Inputs,
            missingPlayerIds,
            last162Inputs
        )

        for (const window of this.getRecentWindows()) {
            const dateRange = PlayerRatingService.getWindowDateRange(
                gameDate,
                window
            )

            const inputs = this.toInputMap(
                this.playerRatingInputRepository.getForDateRange(
                    dateRange.startDate,
                    dateRange.endDateExclusive,
                    missingPlayerIds
                )
            )

            const windowInputs =
                state.recentInputsByWindow.get(window.name) ??
                new Map<string, PlayerRatingInput>()

            this.replaceInputs(
                windowInputs,
                missingPlayerIds,
                inputs
            )

            state.recentInputsByWindow.set(
                window.name,
                windowInputs
            )
        }

        return missingPlayerIds
    }

    private getCareerInputs(season: number, gameDate: string, playerIds: Set<string>): Map<string, PlayerRatingInput> {
        const startedAt = Date.now()
        const careerInputs = new Map<string, PlayerRatingInput>()

        // console.log(
        //     `Loading prior-season rating inputs for ${playerIds.size} players before ${season}.`
        // )

        const seasonStartedAt = Date.now()

        const seasonInputs = this.playerRatingSeasonInputRepository.getBeforeSeason(
            season,
            playerIds
        )

        // console.log(
        //     `Loaded ${seasonInputs.length} prior-season rows in ` +
        //     `${this.formatDuration(Date.now() - seasonStartedAt)}.`
        // )

        const seasonMergeStartedAt = Date.now()

        for (const seasonInput of seasonInputs) {
            const existing = careerInputs.get(
                seasonInput.playerId
            )

            careerInputs.set(
                seasonInput.playerId,
                existing
                    ? this.addPlayerRatingInputs(
                        existing,
                        seasonInput.data
                    )
                    : structuredClone(
                        seasonInput.data
                    )
            )
        }

        // console.log(
        //     `Merged prior-season rows into ${careerInputs.size} players in ` +
        //     `${this.formatDuration(Date.now() - seasonMergeStartedAt)}.`
        // )

        // console.log(
        //     `Loading current-season rating inputs from ${season}-01-01 through ${gameDate}.`
        // )

        const currentSeasonStartedAt = Date.now()

        const currentSeasonInputs = this.playerRatingInputRepository.getForDateRange(
            `${season}-01-01`,
            gameDate,
            playerIds
        )

        // console.log(
        //     `Loaded ${currentSeasonInputs.length} current-season player inputs in ` +
        //     `${this.formatDuration(Date.now() - currentSeasonStartedAt)}.`
        // )

        const currentSeasonMergeStartedAt = Date.now()

        for (const currentSeasonInput of currentSeasonInputs) {
            const existing = careerInputs.get(
                currentSeasonInput.playerId
            )

            careerInputs.set(
                currentSeasonInput.playerId,
                existing
                    ? this.addPlayerRatingInputs(
                        existing,
                        currentSeasonInput
                    )
                    : structuredClone(
                        currentSeasonInput
                    )
            )
        }

        // console.log(
        //     `Merged current-season inputs into ${careerInputs.size} players in ` +
        //     `${this.formatDuration(Date.now() - currentSeasonMergeStartedAt)}.`
        // )

        // console.log(
        //     `Built career inputs for ${careerInputs.size} players in ` +
        //     `${this.formatDuration(Date.now() - startedAt)}.`
        // )

        return careerInputs
    }

    private rebuildPlayerRatings(state: PlayerRatingState, pitchEnvironment: PitchEnvironmentTarget, affectedPlayerIds: Set<string>): void {
        if (affectedPlayerIds.size === 0) {
            return
        }

        const careerWindow = this.getCareerWindow()
        const last162Window = this.getLast162Window()
        const recentWindows = this.getRecentWindows()

        for (const playerId of affectedPlayerIds) {
            const careerInput = state.careerInputs.get(
                playerId
            )

            if (!careerInput) {
                state.ratingsByPlayerId.delete(
                    playerId
                )

                continue
            }

            const ratingSets: WeightedRatingsSet[] = [
                {
                    weight: careerWindow.weight,
                    ratings: PlayerRatingService.buildPlayerRatings(
                        pitchEnvironment,
                        careerInput
                    )
                }
            ]

            const last162Input = state.last162Inputs.get(
                playerId
            )

            if (last162Input) {
                ratingSets.push({
                    weight: last162Window.weight,
                    ratings: PlayerRatingService.buildPlayerRatings(
                        pitchEnvironment,
                        last162Input
                    )
                })
            }

            for (const window of recentWindows) {
                const playerInput = state.recentInputsByWindow
                    .get(window.name)
                    ?.get(playerId)

                if (
                    !playerInput ||
                    !PlayerRatingService.hasMinimumWindowSample(
                        playerInput,
                        window
                    )
                ) {
                    continue
                }

                ratingSets.push({
                    weight: window.weight,
                    ratings: PlayerRatingService.buildPlayerRatings(
                        pitchEnvironment,
                        playerInput
                    )
                })
            }

            state.ratingsByPlayerId.set(
                playerId,
                PlayerRatingService.buildWeightedPlayerRatings(
                    ratingSets
                )
            )
        }
    }

    private addPlayerRatingInputs(existing: PlayerRatingInput, added: PlayerRatingInput): PlayerRatingInput {
        const merged = this.addRatingValues(
            existing,
            added,
            []
        ) as PlayerRatingInput

        merged.playerId = existing.playerId

        this.finalizePlayerRatingInput(
            merged
        )

        return merged
    }

    private addRatingValues(existing: any, added: any, path: string[]): any {
        if (typeof existing === "number" || typeof added === "number") {
            const existingValue = Number(
                existing ??
                0
            )

            const addedValue = Number(
                added ??
                0
            )

            if (
                path.at(-1)?.startsWith("avg") ||
                path.at(-1) === "exitVelocity"
            ) {
                return existingValue
            }

            return existingValue + addedValue
        }

        if (Array.isArray(existing) || Array.isArray(added)) {
            return structuredClone(
                existing ??
                added ??
                []
            )
        }

        if (
            existing &&
            typeof existing === "object" ||
            added &&
            typeof added === "object"
        ) {
            const result: Record<string, any> = {}
            const keys = new Set([
                ...Object.keys(existing ?? {}),
                ...Object.keys(added ?? {})
            ])

            for (const key of keys) {
                result[key] = this.addRatingValues(
                    existing?.[key],
                    added?.[key],
                    [
                        ...path,
                        key
                    ]
                )
            }

            return result
        }

        return structuredClone(
            existing ??
            added
        )
    }

    private finalizePlayerRatingInput(playerInput: PlayerRatingInput): void {
        const exitVelocity = playerInput.hitting.exitVelocity

        if (exitVelocity) {
            exitVelocity.avgExitVelo = exitVelocity.count > 0
                ? Number((exitVelocity.totalExitVelo / exitVelocity.count).toFixed(3))
                : 0
        }

        for (const pitchType of Object.values(playerInput.pitching.pitchTypes ?? {})) {
            if (!pitchType) {
                continue
            }

            pitchType.avgMph = pitchType.count > 0
                ? Number((pitchType.totalMph / pitchType.count).toFixed(3))
                : 0

            pitchType.avgHorizontalBreak = pitchType.count > 0
                ? Number((pitchType.totalHorizontalBreak / pitchType.count).toFixed(3))
                : 0

            pitchType.avgVerticalBreak = pitchType.count > 0
                ? Number((pitchType.totalVerticalBreak / pitchType.count).toFixed(3))
                : 0
        }
    }

    private toInputMap(inputs: PlayerRatingInput[]): Map<string, PlayerRatingInput> {
        return new Map(
            inputs.map(playerInput => [
                playerInput.playerId,
                playerInput
            ])
        )
    }

    private replaceInputs(target: Map<string, PlayerRatingInput>, playerIds: Set<string>, replacement: Map<string, PlayerRatingInput>): void {
        for (const playerId of playerIds) {
            target.delete(
                playerId
            )
        }

        for (const [playerId, playerInput] of replacement) {
            target.set(
                playerId,
                structuredClone(
                    playerInput
                )
            )
        }
    }

    private getCareerWindow(): RatingWindow {
        const window = ratingWindows.find(candidate =>
            candidate.name === "career"
        )

        if (!window) {
            throw new Error(
                "Career rating window must be configured."
            )
        }

        return window
    }

    private getLast162Window(): RatingWindow {
        const window = ratingWindows.find(candidate =>
            candidate.name === "last-162"
        )

        if (!window) {
            throw new Error(
                "Last-162 rating window must be configured."
            )
        }

        return window
    }

    private getRecentWindows(): RatingWindow[] {
        return ratingWindows.filter(window =>
            window.minimumDaysAgo !== undefined &&
            window.maximumDaysAgo !== undefined
        )
    }

    private getChangedDateRanges(previousRange: RatingDateRange, currentRange: RatingDateRange): RatingDateRange[] {
        if (
            previousRange.startDate === currentRange.startDate &&
            previousRange.endDateExclusive === currentRange.endDateExclusive
        ) {
            return []
        }

        if (
            currentRange.startDate >= previousRange.endDateExclusive ||
            previousRange.startDate >= currentRange.endDateExclusive
        ) {
            return [
                previousRange,
                currentRange
            ]
        }

        const ranges: RatingDateRange[] = []

        if (previousRange.startDate < currentRange.startDate) {
            ranges.push({
                startDate: previousRange.startDate,
                endDateExclusive: currentRange.startDate
            })
        } else if (currentRange.startDate < previousRange.startDate) {
            ranges.push({
                startDate: currentRange.startDate,
                endDateExclusive: previousRange.startDate
            })
        }

        if (previousRange.endDateExclusive < currentRange.endDateExclusive) {
            ranges.push({
                startDate: previousRange.endDateExclusive,
                endDateExclusive: currentRange.endDateExclusive
            })
        } else if (currentRange.endDateExclusive < previousRange.endDateExclusive) {
            ranges.push({
                startDate: currentRange.endDateExclusive,
                endDateExclusive: previousRange.endDateExclusive
            })
        }

        return ranges.filter(range =>
            range.startDate < range.endDateExclusive
        )
    }

    private addPlayerIds(target: Set<string>, inputs: Map<string, PlayerRatingInput>): void {
        for (const playerId of inputs.keys()) {
            target.add(
                String(playerId)
            )
        }
    }

    private static buildPlayerRatings(pitchEnvironment: PitchEnvironmentTarget, playerInput: PlayerRatingInput): GeneratedPlayerRatings {
        return {
            playerId: playerInput.playerId,
            hittingRatings: PlayerRatingService.buildHittingRatings(
                pitchEnvironment,
                playerInput
            ),
            pitchRatings: PlayerRatingService.buildPitchRatings(
                pitchEnvironment,
                playerInput
            )
        }
    }

    public static buildHittingRatings(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): HittingRatings {
        const avgRating = env.avgRating
        const hitter = playerInput.hitting

        if (hitter.pa <= 0) {
            return this.emptyHittingRatings(
                env,
                playerInput
            )
        }

        const vsR = playerInput.splits.hitting.vsR
        const vsL = playerInput.splits.hitting.vsL
        const leagueHitter = env.importReference.hitter

        const leagueAvg = env.outcome.avg
        const leagueBBRate = env.outcome.bbPercent
        const leagueSORate = env.outcome.soPercent
        const leagueEV = leagueHitter.physics.exitVelocity.avg

        const avg = safeDiv(hitter.hits, hitter.ab, leagueAvg)
        const bbRate = safeDiv(hitter.bb, hitter.pa, leagueBBRate)
        const soRate = safeDiv(hitter.so, hitter.pa, leagueSORate)
        const ev = hitter.exitVelocity?.avgExitVelo ?? leagueEV
        const chaseSwingRate = safeDiv(hitter.swingAtBalls, hitter.pitchesSeen - hitter.inZonePitches, env.swing.swingAtBallsPercent / 100)
        const babip = safeDiv(hitter.hits - hitter.homeRuns, hitter.ab - hitter.so - hitter.homeRuns, env.outcome.babip)

        const playerPowerOutcomeCount = this.getHitterPowerOutcomeCount(hitter)
        const leaguePowerOutcomeCount = this.getHitterPowerOutcomeCount(leagueHitter)

        const playerGap = Number(hitter.doubles ?? 0) + Number(hitter.triples ?? 0)
        const leagueGap = Number(leagueHitter.doubles ?? 0) + Number(leagueHitter.triples ?? 0)
        const playerHR = Number(hitter.homeRuns ?? 0)
        const leagueHR = Number(leagueHitter.homeRuns ?? 0)

        const playerXBH = playerGap + playerHR
        const leagueXBH = leagueGap + leagueHR

        const gapRate = safeDiv(playerGap, playerPowerOutcomeCount, safeDiv(leagueGap, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent))
        const leagueGapRate = safeDiv(leagueGap, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent)

        const hrRate = safeDiv(playerHR, playerPowerOutcomeCount, safeDiv(leagueHR, leaguePowerOutcomeCount, env.outcome.homeRunPercent))
        const leagueHRRate = safeDiv(leagueHR, leaguePowerOutcomeCount, env.outcome.homeRunPercent)

        const xbhRate = safeDiv(playerXBH, playerPowerOutcomeCount, safeDiv(leagueXBH, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent + env.outcome.homeRunPercent))
        const leagueXBHRate = safeDiv(leagueXBH, leaguePowerOutcomeCount, env.outcome.doublePercent + env.outcome.triplePercent + env.outcome.homeRunPercent)

        const hrShareOfXBH = safeDiv(playerHR, playerXBH, safeDiv(leagueHR, leagueXBH))
        const leagueHRShareOfXBH = safeDiv(leagueHR, leagueXBH)

        const gapShareOfXBH = safeDiv(playerGap, playerXBH, safeDiv(leagueGap, leagueXBH))
        const leagueGapShareOfXBH = safeDiv(leagueGap, leagueXBH)

        const contact = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(avg, leagueAvg, avgRating),
            this.getHigherIsBetterDelta(babip, env.outcome.babip, avgRating),
            this.averageDeltas([
                this.getLowerIsBetterDelta(soRate, leagueSORate, avgRating * 0.5)
            ])
        ]))

        const plateDiscipline = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(bbRate, leagueBBRate, avgRating),
            this.getLowerIsBetterDelta(chaseSwingRate, env.swing.swingAtBallsPercent / 100, avgRating)
        ]))

        const gapPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(gapRate, leagueGapRate, avgRating * 0.6),
            this.getHigherIsBetterDelta(xbhRate, leagueXBHRate, avgRating * 0.35),
            this.getHigherIsBetterDelta(gapShareOfXBH, leagueGapShareOfXBH, avgRating * 0.45)
        ]))

        const homerunPower = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(hrRate, leagueHRRate, avgRating * 1.25),
            this.getHigherIsBetterDelta(hrShareOfXBH, leagueHRShareOfXBH, avgRating * 0.75),
            this.getHigherIsBetterDelta(ev, leagueEV, avgRating * 0.15)
        ]))

        const { speed, steals } = this.getRunningRatings(
            env,
            playerInput
        )

        const { defense, arm } = this.getFieldingRatings(
            env,
            playerInput
        )

        return {
            speed,
            steals,
            defense,
            arm,
            contactProfile: this.getHitterContactProfile(
                env,
                playerInput
            ),
            vsR: {
                plateDiscipline: this.applyHittingSplit(env, plateDiscipline, vsR, hitter, "plateDiscipline"),
                contact: this.applyHittingSplit(env, contact, vsR, hitter, "contact"),
                gapPower: this.applyHittingSplit(env, gapPower, vsR, hitter, "gapPower"),
                homerunPower: this.applyHittingSplit(env, homerunPower, vsR, hitter, "homerunPower")
            },
            vsL: {
                plateDiscipline: this.applyHittingSplit(env, plateDiscipline, vsL, hitter, "plateDiscipline"),
                contact: this.applyHittingSplit(env, contact, vsL, hitter, "contact"),
                gapPower: this.applyHittingSplit(env, gapPower, vsL, hitter, "gapPower"),
                homerunPower: this.applyHittingSplit(env, homerunPower, vsL, hitter, "homerunPower")
            }
        }
    }

    private static getRunningRatings(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): { speed: number, steals: number } {
        const avgRating = env.avgRating
        const hitter = playerInput.hitting
        const running = playerInput.running
        const leagueHitter = env.importReference.hitter
        const leagueRunning = env.importReference.running

        const playerPA = Number(hitter.pa ?? 0)
        const leaguePA = Number(leagueHitter.pa ?? 0)

        const playerPowerOutcomeCount = this.getHitterPowerOutcomeCount(hitter)
        const leaguePowerOutcomeCount = this.getHitterPowerOutcomeCount(leagueHitter)

        const playerSbAttempts = Number(running.sbAttempts ?? 0)
        const playerSb = Number(running.sb ?? 0)
        const playerCs = Math.max(0, playerSbAttempts - playerSb)

        const leagueSbAttempts = Number(leagueRunning.sbAttempts ?? 0)
        const leagueSb = Number(leagueRunning.sb ?? 0)
        const leagueCs = Math.max(0, leagueSbAttempts - leagueSb)

        const playerTriplesRate = safeDiv(Number(hitter.triples ?? 0), playerPowerOutcomeCount)
        const leagueTriplesRate = safeDiv(Number(leagueHitter.triples ?? 0), leaguePowerOutcomeCount)

        const playerAttemptRate = safeDiv(playerSbAttempts, playerPA)
        const leagueAttemptRate = safeDiv(leagueSbAttempts, leaguePA)

        const playerStealRate = safeDiv(playerSb, playerPA)
        const leagueStealRate = safeDiv(leagueSb, leaguePA)

        const playerSuccessRate = safeDiv(playerSb, playerSb + playerCs)
        const leagueSuccessRate = safeDiv(leagueSb, leagueSb + leagueCs)

        const speed = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(playerTriplesRate, leagueTriplesRate, avgRating),
            this.getHigherIsBetterDelta(playerAttemptRate, leagueAttemptRate, avgRating * 0.5),
            this.getHigherIsBetterDelta(playerSuccessRate, leagueSuccessRate, avgRating * 0.35)
        ]))

        const steals = this.rating(env, avgRating + this.averageDeltas([
            this.getHigherIsBetterDelta(playerStealRate, leagueStealRate, avgRating),
            this.getHigherIsBetterDelta(playerAttemptRate, leagueAttemptRate, avgRating),
            this.getHigherIsBetterDelta(playerSuccessRate, leagueSuccessRate, avgRating * 0.75)
        ]))

        return {
            speed,
            steals
        }
    }

    private static getHitterPowerOutcomeCount(hitter: any): number {
        return Math.max(0, Number(hitter.ab ?? 0) - Number(hitter.so ?? 0))
    }

    private static applyHittingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "plateDiscipline" | "contact" | "gapPower" | "homerunPower"): number {
        if (!split || split.pa <= 0 || overall.pa <= 0) return baseRating

        const avgRating = env.avgRating
        const reliability = safeDiv(split.pa, overall.pa)

        const splitAvg = safeDiv(split.hits, split.ab, safeDiv(overall.hits, overall.ab))
        const overallAvg = safeDiv(overall.hits, overall.ab)

        const splitBB = safeDiv(split.bb, split.pa, safeDiv(overall.bb, overall.pa))
        const overallBB = safeDiv(overall.bb, overall.pa)

        const splitSO = safeDiv(split.so, split.pa, safeDiv(overall.so, overall.pa))
        const overallSO = safeDiv(overall.so, overall.pa)

        const splitBabip = safeDiv(split.hits - split.homeRuns, split.ab - split.so - split.homeRuns, safeDiv(overall.hits - overall.homeRuns, overall.ab - overall.so - overall.homeRuns))
        const overallBabip = safeDiv(overall.hits - overall.homeRuns, overall.ab - overall.so - overall.homeRuns)

        const splitGap = Number(split.doubles ?? 0) + Number(split.triples ?? 0)
        const overallGap = Number(overall.doubles ?? 0) + Number(overall.triples ?? 0)

        const splitHR = Number(split.homeRuns ?? 0)
        const overallHR = Number(overall.homeRuns ?? 0)

        const splitXBH = splitGap + splitHR
        const overallXBH = overallGap + overallHR

        const splitGapRate = safeDiv(splitGap, this.getHitterPowerOutcomeCount(split), safeDiv(overallGap, this.getHitterPowerOutcomeCount(overall)))
        const overallGapRate = safeDiv(overallGap, this.getHitterPowerOutcomeCount(overall))

        const splitHRRate = safeDiv(splitHR, this.getHitterPowerOutcomeCount(split), safeDiv(overallHR, this.getHitterPowerOutcomeCount(overall)))
        const overallHRRate = safeDiv(overallHR, this.getHitterPowerOutcomeCount(overall))

        const splitXBHRate = safeDiv(splitXBH, this.getHitterPowerOutcomeCount(split), safeDiv(overallXBH, this.getHitterPowerOutcomeCount(overall)))
        const overallXBHRate = safeDiv(overallXBH, this.getHitterPowerOutcomeCount(overall))

        const splitHRShareOfXBH = safeDiv(splitHR, splitXBH, safeDiv(overallHR, overallXBH))
        const overallHRShareOfXBH = safeDiv(overallHR, overallXBH)

        const splitGapShareOfXBH = safeDiv(splitGap, splitXBH, safeDiv(overallGap, overallXBH))
        const overallGapShareOfXBH = safeDiv(overallGap, overallXBH)

        const splitEV = split.exitVelocity > 0 ? split.exitVelocity : overall.exitVelocity?.avgExitVelo
        const overallEV = overall.exitVelocity?.avgExitVelo

        let delta = 0

        if (ratingType === "plateDiscipline") {
            delta = this.getHigherIsBetterDelta(splitBB, overallBB, avgRating)
        }

        if (ratingType === "contact") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitAvg, overallAvg, avgRating),
                this.getHigherIsBetterDelta(splitBabip, overallBabip, avgRating),
                this.averageDeltas([
                    this.getLowerIsBetterDelta(splitSO, overallSO, avgRating * 0.5)
                ])
            ])
        }

        if (ratingType === "gapPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitGapRate, overallGapRate, avgRating * 0.6),
                this.getHigherIsBetterDelta(splitXBHRate, overallXBHRate, avgRating * 0.35),
                this.getHigherIsBetterDelta(splitGapShareOfXBH, overallGapShareOfXBH, avgRating * 0.45)
            ])
        }

        if (ratingType === "homerunPower") {
            delta = this.sumDeltas([
                this.getHigherIsBetterDelta(splitHRRate, overallHRRate, avgRating * 1.25),
                this.getHigherIsBetterDelta(splitHRShareOfXBH, overallHRShareOfXBH, avgRating * 0.75),
                this.getHigherIsBetterDelta(splitEV, overallEV, avgRating * 0.15)
            ])
        }

        return this.rating(env, baseRating + (delta * reliability))
    }

    public static buildPitchRatings(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): PitchRatings {
        const avgRating = env.avgRating
        const pitcher = playerInput.pitching

        if (pitcher.battersFaced <= 0) {
            return this.emptyPitchRatings(
                env
            )
        }

        const leaguePitcher = env.importReference.pitcher
        const vsR = playerInput.splits.pitching.vsR
        const vsL = playerInput.splits.pitching.vsL

        const powerScale = avgRating * 2

        const soRate = safeDiv(pitcher.so, pitcher.battersFaced, env.outcome.soPercent)
        const bbRate = safeDiv(pitcher.bbAllowed, pitcher.battersFaced, env.outcome.bbPercent)

        const pitcherPowerOutcomeCount = this.getPitcherPowerOutcomeCount(pitcher)
        const leaguePitcherPowerOutcomeCount = this.getPitcherPowerOutcomeCount(leaguePitcher)

        const leagueGapAllowedRate = safeDiv(
            leaguePitcher.doublesAllowed + leaguePitcher.triplesAllowed,
            leaguePitcherPowerOutcomeCount,
            env.outcome.doublePercent + env.outcome.triplePercent
        )

        const leagueHRAllowedRate = safeDiv(
            leaguePitcher.homeRunsAllowed,
            leaguePitcherPowerOutcomeCount,
            env.outcome.homeRunPercent
        )

        const gapAllowedRate = safeDiv(
            pitcher.doublesAllowed + pitcher.triplesAllowed,
            pitcherPowerOutcomeCount,
            leagueGapAllowedRate
        )

        const hrAllowedRate = safeDiv(
            pitcher.homeRunsAllowed,
            pitcherPowerOutcomeCount,
            leagueHRAllowedRate
        )

        const leagueZoneContactAllowed = env.swing.inZoneContactPercent / 100
        const leagueChaseContactAllowed = env.swing.outZoneContactPercent / 100

        const zoneContactAllowed = safeDiv(
            pitcher.inZoneContactAllowed,
            pitcher.swingAtStrikesAllowed,
            leagueZoneContactAllowed
        )

        const chaseContactAllowed = safeDiv(
            pitcher.outZoneContactAllowed,
            pitcher.swingAtBallsAllowed,
            leagueChaseContactAllowed
        )

        const playerFastball = this.getFastballVelocity(
            playerInput
        )

        const leagueFastball = this.getLeagueFastballVelocity(
            env
        )

        const playerMovement = this.getPitchMovement(
            playerInput
        )

        const leagueMovement = this.getLeaguePitchMovement(
            env
        )

        const power = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(soRate, env.outcome.soPercent, powerScale),
            this.getHigherIsBetterDelta(playerFastball, leagueFastball, powerScale),
            this.averageDeltas([
                this.getLowerIsBetterDelta(zoneContactAllowed, leagueZoneContactAllowed, avgRating),
                this.getLowerIsBetterDelta(chaseContactAllowed, leagueChaseContactAllowed, avgRating)
            ])
        ]))

        const control = this.rating(env, avgRating + this.sumDeltas([
            this.getLowerIsBetterDelta(bbRate, env.outcome.bbPercent, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(
                    safeDiv(pitcher.strikesThrown, pitcher.pitchesThrown),
                    safeDiv(leaguePitcher.strikesThrown, leaguePitcher.pitchesThrown),
                    avgRating
                ),
                this.getHigherIsBetterDelta(
                    safeDiv(pitcher.pitchesThrown - pitcher.ballsThrown, pitcher.pitchesThrown),
                    safeDiv(leaguePitcher.pitchesThrown - leaguePitcher.ballsThrown, leaguePitcher.pitchesThrown),
                    avgRating
                )
            ])
        ]))

        const movement = this.rating(env, avgRating + this.sumDeltas([
            this.averageDeltas([
                this.getLowerIsBetterDelta(gapAllowedRate, leagueGapAllowedRate, avgRating),
                this.getLowerIsBetterDelta(hrAllowedRate, leagueHRAllowedRate, avgRating)
            ]),
            this.averageDeltas([
                this.getLowerIsBetterDelta(zoneContactAllowed, leagueZoneContactAllowed, avgRating),
                this.getLowerIsBetterDelta(chaseContactAllowed, leagueChaseContactAllowed, avgRating),
                this.getHigherIsBetterDelta(playerMovement, leagueMovement, avgRating)
            ])
        ]))

        return {
            power,
            contactProfile: this.getPitcherContactProfile(
                env,
                playerInput
            ),
            vsR: {
                control: this.applyPitchingSplit(env, control, vsR, pitcher, "control"),
                movement: this.applyPitchingSplit(env, movement, vsR, pitcher, "movement")
            },
            vsL: {
                control: this.applyPitchingSplit(env, control, vsL, pitcher, "control"),
                movement: this.applyPitchingSplit(env, movement, vsL, pitcher, "movement")
            },
            pitches: this.getPitchTypes(
                playerInput
            )
        }
    }

    private static sumDeltas(values: number[]): number {
        return values
            .filter(value => Number.isFinite(value))
            .reduce((sum, value) => sum + value, 0)
    }

    private static getPitcherPowerOutcomeCount(pitcher: any): number {
        const battersFaced = Number(pitcher.battersFaced ?? 0)
        const walks = Number(pitcher.bbAllowed ?? pitcher.bb ?? 0)
        const hbp = Number(pitcher.hbpAllowed ?? pitcher.hbp ?? 0)
        const strikeouts = Number(pitcher.so ?? 0)
        const atBats = Number(pitcher.atBats ?? pitcher.ab ?? Math.max(0, battersFaced - walks - hbp))

        return Math.max(0, atBats - strikeouts)
    }    

    private static applyPitchingSplit(env: PitchEnvironmentTarget, baseRating: number, split: any, overall: any, ratingType: "control" | "movement"): number {
        if (!split || split.battersFaced <= 0 || overall.battersFaced <= 0) return baseRating

        const avgRating = env.avgRating
        const reliability = safeDiv(split.battersFaced, overall.battersFaced)

        const splitBB = safeDiv(split.bbAllowed, split.battersFaced, safeDiv(overall.bbAllowed, overall.battersFaced))
        const overallBB = safeDiv(overall.bbAllowed, overall.battersFaced)

        const splitSO = safeDiv(split.so, split.battersFaced, safeDiv(overall.so, overall.battersFaced))
        const overallSO = safeDiv(overall.so, overall.battersFaced)

        const splitGapAllowedRate = safeDiv(
            split.doublesAllowed + split.triplesAllowed,
            this.getPitcherPowerOutcomeCount(split),
            safeDiv(overall.doublesAllowed + overall.triplesAllowed, this.getPitcherPowerOutcomeCount(overall))
        )

        const overallGapAllowedRate = safeDiv(
            overall.doublesAllowed + overall.triplesAllowed,
            this.getPitcherPowerOutcomeCount(overall)
        )

        const splitHRAllowedRate = safeDiv(
            split.homeRunsAllowed,
            this.getPitcherPowerOutcomeCount(split),
            safeDiv(overall.homeRunsAllowed, this.getPitcherPowerOutcomeCount(overall))
        )

        const overallHRAllowedRate = safeDiv(
            overall.homeRunsAllowed,
            this.getPitcherPowerOutcomeCount(overall)
        )

        let delta = 0

        if (ratingType === "control") {
            delta = this.averageDeltas([
                this.getLowerIsBetterDelta(splitBB, overallBB, avgRating),
                this.getHigherIsBetterDelta(splitSO, overallSO, avgRating)
            ])
        }

        if (ratingType === "movement") {
            delta = this.averageDeltas([
                this.getLowerIsBetterDelta(splitGapAllowedRate, overallGapAllowedRate, avgRating),
                this.getLowerIsBetterDelta(splitHRAllowedRate, overallHRAllowedRate, avgRating)
            ])
        }

        return this.rating(env, baseRating + (delta * reliability))
    }

    private static getHitterContactProfile(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): { groundball: number, flyBall: number, lineDrive: number } {
        return this.buildContactProfile(
            {
                groundball: Number(playerInput.hitting.groundBalls ?? 0),
                flyBall: Number(playerInput.hitting.flyBalls ?? 0),
                lineDrive: Number(playerInput.hitting.lineDrives ?? 0)
            },
            env
        )
    }

    private static getPitcherContactProfile(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): { groundball: number, flyBall: number, lineDrive: number } {
        return this.buildContactProfile(
            {
                groundball: Number(playerInput.pitching.groundBallsAllowed ?? 0),
                flyBall: Number(playerInput.pitching.flyBallsAllowed ?? 0),
                lineDrive: Number(playerInput.pitching.lineDrivesAllowed ?? 0)
            },
            env
        )
    }

    private static buildContactProfile(values: { groundball: number, flyBall: number, lineDrive: number }, env: PitchEnvironmentTarget): { groundball: number, flyBall: number, lineDrive: number } {
        const environment = env.battedBall.contactRollInput
        const environmentTotal = environment.groundball + environment.flyBall + environment.lineDrive
        const sampleTotal = values.groundball + values.flyBall + values.lineDrive

        if (sampleTotal <= 0 || environmentTotal <= 0) {
            return {
                groundball: environment.groundball,
                flyBall: environment.flyBall,
                lineDrive: environment.lineDrive
            }
        }

        return this.allocateToHundred({
            groundball: values.groundball + environment.groundball,
            flyBall: values.flyBall + environment.flyBall,
            lineDrive: values.lineDrive + environment.lineDrive
        })
    }

    private static getPitchTypes(playerInput: PlayerRatingInput): PitchType[] {
        const pitchTypes = playerInput.pitching.pitchTypes ?? {}
        const validPitchTypes = new Set(
            Object.values(PitchType) as PitchType[]
        )

        const pitches = Object.entries(pitchTypes)
            .filter(([pitchType, stat]) =>
                validPitchTypes.has(pitchType as PitchType) &&
                !!stat &&
                Number(stat.count ?? 0) > 0
            )
            .sort((a, b) =>
                Number(b[1]?.count ?? 0) -
                Number(a[1]?.count ?? 0)
            )
            .slice(0, 5)
            .map(([pitchType]) =>
                pitchType as PitchType
            )

        return pitches.length > 0
            ? pitches
            : [
                PitchType.FF
            ]
    }

    private static getFastballVelocity(playerInput: PlayerRatingInput): number {
        const pitchTypes = playerInput.pitching.pitchTypes ?? {}

        const fastballs = [
            pitchTypes[PitchType.FF],
            pitchTypes[PitchType.SI],
            pitchTypes[PitchType.FC]
        ].filter((pitch): pitch is PitchTypeMovementStat =>
            !!pitch &&
            pitch.count > 0
        )

        if (fastballs.length === 0) {
            return 0
        }

        return Math.max(
            ...fastballs.map(pitch =>
                pitch.avgMph
            )
        )
    }

    private static getLeagueFastballVelocity(env: PitchEnvironmentTarget): number {
        const pitchTypes = env.importReference.pitcher.physics.byPitchType ?? {}
        const fastballs = [pitchTypes[PitchType.FF], pitchTypes[PitchType.SI], pitchTypes[PitchType.FC]].filter(p => !!p && p.count > 0)

        if (fastballs.length === 0) return env.importReference.pitcher.physics.velocity.avg

        return Math.max(...fastballs.map(p => p.avgVelocity))
    }

    private static getPitchMovement(playerInput: PlayerRatingInput): number {
        const entries = Object.values(
            playerInput.pitching.pitchTypes ??
            {}
        ).filter((pitch): pitch is PitchTypeMovementStat =>
            !!pitch &&
            pitch.count > 0
        )

        const total = entries.reduce(
            (sum, pitch) =>
                sum + pitch.count,
            0
        )

        if (total <= 0) {
            return 0
        }

        return entries.reduce(
            (sum, pitch) =>
                sum + (
                    (
                        Math.abs(pitch.avgHorizontalBreak) +
                        Math.abs(pitch.avgVerticalBreak)
                    ) *
                    pitch.count
                ),
            0
        ) / total
    }

    private static getLeaguePitchMovement(env: PitchEnvironmentTarget): number {
        const entries = Object.values(env.importReference.pitcher.physics.byPitchType ?? {}).filter(p => !!p && p.count > 0)
        const total = entries.reduce((sum, p) => sum + p.count, 0)

        if (total <= 0) {
            return Math.abs(env.importReference.pitcher.physics.horizontalBreak.avg) + Math.abs(env.importReference.pitcher.physics.verticalBreak.avg)
        }

        return entries.reduce((sum, p) => sum + ((Math.abs(p.avgHorizontalBreak) + Math.abs(p.avgVerticalBreak)) * p.count), 0) / total
    }

    private static emptyHittingRatings(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): HittingRatings {
        const low = env.avgRating / 2
        const avgRating = env.avgRating

        const fieldingRatings = this.getFieldingRatings(
            env,
            playerInput
        )

        return {
            speed: avgRating,
            steals: avgRating,
            defense: fieldingRatings.defense,
            arm: fieldingRatings.arm,
            contactProfile: {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            },
            vsR: {
                plateDiscipline: low,
                contact: low,
                gapPower: low,
                homerunPower: low
            },
            vsL: {
                plateDiscipline: low,
                contact: low,
                gapPower: low,
                homerunPower: low
            }
        }
    }

    private static emptyPitchRatings(env: PitchEnvironmentTarget): PitchRatings {
        const low = env.avgRating / 2

        return {
            power: low,
            contactProfile: {
                groundball: env.battedBall.contactRollInput.groundball,
                flyBall: env.battedBall.contactRollInput.flyBall,
                lineDrive: env.battedBall.contactRollInput.lineDrive
            },
            vsR: {
                control: low,
                movement: low
            },
            vsL: {
                control: low,
                movement: low
            },
            pitches: [
                PitchType.FF
            ]
        }
    }

    private static getFieldingRatings(env: PitchEnvironmentTarget, playerInput: PlayerRatingInput): { defense: number, arm: number } {
        const avgRating = env.avgRating
        const fielding = playerInput.fielding
        const leagueFielding = env.importReference.fielding

        const errors = Number(fielding.errors ?? 0)
        const assists = Number(fielding.assists ?? 0)
        const putouts = Number(fielding.putouts ?? 0)
        const chances = errors + assists + putouts

        if (chances <= 0) {
            return {
                defense: avgRating,
                arm: avgRating
            }
        }

        const leagueChances = Number(leagueFielding.chances ?? 0)
        const leagueErrors = Number(leagueFielding.errors ?? 0)
        const leagueAssists = Number(leagueFielding.assists ?? 0)
        const leaguePutouts = Number(leagueFielding.putouts ?? 0)

        const fieldingPct = safeDiv(chances - errors, chances)
        const leagueFieldingPct = safeDiv(leagueChances - leagueErrors, leagueChances)

        const assistShare = safeDiv(assists, chances)
        const leagueAssistShare = safeDiv(leagueAssists, leagueChances)

        const putoutShare = safeDiv(putouts, chances)
        const leaguePutoutShare = safeDiv(leaguePutouts, leagueChances)

        const playerOutfieldAssistShare = safeDiv(Number(fielding.outfieldAssists ?? 0), chances)
        const leagueOutfieldAssistShare = safeDiv(Number(leagueFielding.outfieldAssists ?? 0), leagueChances)

        const playerCatcherCaughtStealing = Number(fielding.catcherCaughtStealing ?? 0)
        const playerCatcherStolenBasesAllowed = Number(fielding.catcherStolenBasesAllowed ?? 0)
        const leagueCatcherCaughtStealing = Number(leagueFielding.catcherCaughtStealing ?? 0)
        const leagueCatcherStolenBasesAllowed = Number(leagueFielding.catcherStolenBasesAllowed ?? 0)

        const catcherThrowRate = safeDiv(
            playerCatcherCaughtStealing,
            playerCatcherCaughtStealing +
            playerCatcherStolenBasesAllowed
        )

        const leagueCatcherThrowRate = safeDiv(
            leagueCatcherCaughtStealing,
            leagueCatcherCaughtStealing +
            leagueCatcherStolenBasesAllowed
        )

        const defense = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(fieldingPct, leagueFieldingPct, avgRating),
            this.averageDeltas([
                this.getHigherIsBetterDelta(assistShare, leagueAssistShare, avgRating * 0.5),
                this.getHigherIsBetterDelta(putoutShare, leaguePutoutShare, avgRating * 0.5)
            ])
        ]))

        const arm = this.rating(env, avgRating + this.sumDeltas([
            this.getHigherIsBetterDelta(assistShare, leagueAssistShare, avgRating),
            this.getHigherIsBetterDelta(playerOutfieldAssistShare, leagueOutfieldAssistShare, avgRating),
            this.getHigherIsBetterDelta(catcherThrowRate, leagueCatcherThrowRate, avgRating)
        ]))

        return {
            defense,
            arm
        }
    }

    private static allocateToHundred(values: { groundball: number, flyBall: number, lineDrive: number }): { groundball: number, flyBall: number, lineDrive: number } {
        const minimum = 1
        const available = 100 - minimum * 3
        const total = values.groundball + values.flyBall + values.lineDrive

        if (total <= 0) {
            return {
                groundball: 34,
                flyBall: 33,
                lineDrive: 33
            }
        }

        const exact = [
            { key: "groundball" as const, value: minimum + (values.groundball / total) * available },
            { key: "flyBall" as const, value: minimum + (values.flyBall / total) * available },
            { key: "lineDrive" as const, value: minimum + (values.lineDrive / total) * available }
        ]

        const rounded = exact.map(item => ({
            key: item.key,
            value: Math.floor(item.value),
            remainder: item.value - Math.floor(item.value)
        }))

        let remaining = 100 - rounded.reduce((sum, item) => sum + item.value, 0)

        rounded.sort((a, b) => b.remainder - a.remainder)

        for (const item of rounded) {
            if (remaining <= 0) {
                break
            }

            item.value++
            remaining--
        }

        return {
            groundball: rounded.find(item => item.key === "groundball")!.value,
            flyBall: rounded.find(item => item.key === "flyBall")!.value,
            lineDrive: rounded.find(item => item.key === "lineDrive")!.value
        }
    }

    private static averageDeltas(values: number[]): number {
        const finite = values.filter(value => Number.isFinite(value))

        if (finite.length === 0) return 0

        return getAverage(finite)
    }

    private static rating(env: PitchEnvironmentTarget, value: number): number {
        const n = Number(value)

        if (!Number.isFinite(n)) return env.avgRating

        const avgRating = Number(env.avgRating ?? 100)
        const minRating = Math.round(avgRating * 0.3)
        const maxRating = Math.round(avgRating * 1.7)

        return clamp(Math.round(n), minRating, maxRating)
    }

    static getHigherIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (!Number.isFinite(playerRate) || !Number.isFinite(baselineRate) || !Number.isFinite(scale)) return 0
        if (playerRate <= 0 || baselineRate <= 0 || scale <= 0) return 0

        const ratio = playerRate / baselineRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    static getLowerIsBetterDelta(playerRate: number, baselineRate: number, scale: number): number {
        if (!Number.isFinite(playerRate) || !Number.isFinite(baselineRate) || !Number.isFinite(scale)) return 0
        if (playerRate <= 0 || baselineRate <= 0 || scale <= 0) return 0

        const ratio = baselineRate / playerRate
        const centered = ratio - 1
        const damped = centered / (1 + Math.abs(centered))

        return damped * scale
    }

    private static getWindowDateRange(gameDate: string, window: RatingWindow): {
        startDate: string
        endDateExclusive: string
    } {
        if (
            window.minimumDaysAgo === undefined ||
            window.maximumDaysAgo === undefined
        ) {
            throw new Error(
                `Rating window ${window.name} does not define a calendar range.`
            )
        }

        const startDate = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        const endDateExclusive = new Date(
            `${gameDate}T12:00:00.000Z`
        )

        startDate.setUTCDate(
            startDate.getUTCDate() -
            window.maximumDaysAgo
        )

        endDateExclusive.setUTCDate(
            endDateExclusive.getUTCDate() -
            window.minimumDaysAgo +
            1
        )

        return {
            startDate: startDate.toISOString().slice(0, 10),
            endDateExclusive: endDateExclusive.toISOString().slice(0, 10)
        }
    }

    private static hasMinimumWindowSample(playerInput: PlayerRatingInput, window: RatingWindow): boolean {
        const hasPitchingHistory =
            Number(
                playerInput.pitching.games ??
                0
            ) > 0 ||
            Number(
                playerInput.pitching.battersFaced ??
                0
            ) > 0 ||
            Number(
                playerInput.pitching.outs ??
                0
            ) > 0

        const hasHittingHistory =
            Number(
                playerInput.hitting.games ??
                0
            ) > 0 ||
            Number(
                playerInput.hitting.pa ??
                0
            ) > 0

        if (
            hasPitchingHistory &&
            !hasHittingHistory
        ) {
            return true
        }

        const plateAppearances = Number(
            playerInput.hitting.pa ??
            0
        )

        return Number.isFinite(
            plateAppearances
        ) &&
            plateAppearances >=
            window.minimumPlateAppearances
    }

    private static buildWeightedPlayerRatings(ratingsSets: WeightedRatingsSet[]): GeneratedPlayerRatings {
        if (ratingsSets.length === 0) {
            throw new Error(
                "Cannot build weighted player ratings without rating sets."
            )
        }

        const totalWeight = ratingsSets.reduce(
            (total, set) =>
                total + set.weight,
            0
        )

        if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
            throw new Error(
                `Cannot build weighted player ratings with total weight ${totalWeight}.`
            )
        }

        const normalizedSets = ratingsSets.map(set => ({
            ratings: set.ratings,
            weight: set.weight / totalWeight
        }))

        const source = normalizedSets[0].ratings

        return {
            playerId: source.playerId,
            hittingRatings: this.blendRatingValues(
                normalizedSets.map(set => ({
                    value: set.ratings.hittingRatings,
                    weight: set.weight
                })),
                source.hittingRatings
            ),
            pitchRatings: this.blendRatingValues(
                normalizedSets.map(set => ({
                    value: set.ratings.pitchRatings,
                    weight: set.weight
                })),
                source.pitchRatings
            )
        }
    }

    private static blendRatingValues(values: {
        value: any
        weight: number
    }[], source: any): any {
        if (typeof source === "number") {
            return values.reduce(
                (total, entry) => {
                    const value = Number(
                        entry.value
                    )

                    return total + (
                        Number.isFinite(value)
                            ? value * entry.weight
                            : 0
                    )
                },
                0
            )
        }

        if (Array.isArray(source)) {
            return structuredClone(
                source
            )
        }

        if (!source || typeof source !== "object") {
            return source
        }

        const result: Record<string, any> = {}

        for (const key of Object.keys(source)) {
            result[key] = this.blendRatingValues(
                values.map(entry => ({
                    value: entry.value?.[key],
                    weight: entry.weight
                })),
                source[key]
            )
        }

        return result
    }


    private formatDuration(milliseconds: number): string {
        if (milliseconds < 1000) {
            return `${Math.round(milliseconds)}ms`
        }

        const seconds = milliseconds / 1000

        if (seconds < 60) {
            return `${seconds.toFixed(2)}s`
        }

        const minutes = Math.floor(
            seconds /
            60
        )

        const remainingSeconds = Math.round(
            seconds %
            60
        )

        return `${minutes}m ${remainingSeconds}s`
    }    
}

export {
    PlayerRatingService
}

export type {
    GeneratedPlayerRatings,
    RatingWindow
}
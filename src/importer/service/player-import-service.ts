import fs from "fs"
import path from "path"

import {  queries } from "baseball-database"

import type { StatExport } from "baseball-database"
import type { PlayerImportRaw } from "../../sim/service/interfaces.js"

import { StatAccumulatorService } from "./stat-accumulator-service.js"

class PlayerImportService {

    private readonly importCache = new Map<string, Map<string, PlayerImportRaw>>()
    private readonly states: PlayerImportState[] = []

    public constructor(
        private readonly baseDataDir: string,
        private readonly statAccumulatorService: StatAccumulatorService
    ) {}

    public async buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        const cutoffDate = this.isCurrentSeason(season) ? this.getTomorrowUtcDate() : `${season + 1}-01-01`
        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const resultsFilePath = this.getResultsFilePath(season)

        if (!forceFullReimport) {
            const cachedResults = await this.readResultsFile(resultsFilePath)

            if (cachedResults && cachedResults.season === season && this.samePlayerIds(cachedResults.playerIds, normalizedPlayerIds)) {
                return this.resultsFileToPlayerMap(cachedResults.players)
            }
        }

        const players = await this.buildCorePlayerImports(season, cutoffDate, filterPlayerIds, forceFullReimport)

        await this.writeResultsFile(resultsFilePath, season, normalizedPlayerIds, players)

        return players
    }

    public async buildSeasonPlayerImportRaw(season: number, playerId: string, forceFullReimport = false): Promise<PlayerImportRaw | undefined> {
        const players = await this.buildSeasonPlayerImports(season, new Set([String(playerId)]), forceFullReimport)

        return players.get(String(playerId))
    }

    public async buildCorePlayerImports(season: number, gameDate: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        this.validateIsoDate(gameDate)

        if (forceFullReimport) {
            this.clearCache(season)
        }

        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const cacheKey = this.getCacheKey(
            "core",
            season,
            gameDate,
            normalizedPlayerIds
        )

        const cached = this.importCache.get(
            cacheKey
        )

        if (cached) {
            return this.clonePlayerImportMap(
                cached
            )
        }

        const existingState = this.states.find(state =>
            state.season === season
        )

        if (!existingState) {
            console.log(
                `Building player imports through ${gameDate}.`
            )
        } else if (existingState.currentDate < gameDate) {
            console.log(
                `Advancing player imports from ${existingState.currentDate} to ${gameDate}.`
            )
        }

        const state = await this.getOrCreateState(
            season,
            gameDate
        )

        await this.advanceState(
            state,
            gameDate,
            filterPlayerIds
        )

        const players = this.filterPlayerImports(
            state.players,
            filterPlayerIds
        )

        if (
            filterPlayerIds &&
            filterPlayerIds.size > 0
        ) {
            this.importCache.set(
                cacheKey,
                this.clonePlayerImportMap(
                    players
                )
            )
        }

        return players

    }

    

    public async buildDateRangePlayerImports(season: number, startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        this.validateIsoDate(startDate)
        this.validateIsoDate(endDateExclusive)

        if (startDate >= endDateExclusive) {
            throw new Error(`Start date ${startDate} must be before end date ${endDateExclusive}.`)
        }

        if (forceFullReimport) {
            this.clearCache(season)
        }

        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const cacheKey = this.getCacheKey("range", season, `${startDate}:${endDateExclusive}`, normalizedPlayerIds)
        const cached = this.importCache.get(cacheKey)

        if (cached) {
            return this.clonePlayerImportMap(cached)
        }

        const statExports = this.loadDatedStatExports(startDate, endDateExclusive)
        const selections = this.buildDateRangeSelections(statExports, filterPlayerIds)
        const players = this.buildFromExports(season, statExports, selections)

        this.importCache.set(cacheKey, this.clonePlayerImportMap(players))

        return players
    }

    public async getAppearanceCountsBeforeDate(season: number, gameDate: string, filterPlayerIds?: Set<string>): Promise<Map<string, number>> {
        this.validateIsoDate(gameDate)

        const state = await this.getOrCreateState(
            season,
            gameDate
        )

        await this.advanceState(
            state,
            gameDate
        )

        const playerIds = filterPlayerIds && filterPlayerIds.size > 0
            ? Array.from(filterPlayerIds)
                .map(playerId => String(playerId))
                .sort((a, b) => a.localeCompare(b))
            : Object.keys(state.appearancesByPlayer)
                .sort((a, b) => a.localeCompare(b))

        const counts = new Map<string, number>()

        for (const playerId of playerIds) {
            counts.set(
                playerId,
                Math.min(
                    162,
                    state.appearancesByPlayer[playerId]?.length ?? 0
                )
            )
        }

        return counts
    }

    public clearCache(season?: number): void {
        if (season === undefined) {
            this.importCache.clear()
            this.states.length = 0
            return
        }

        for (const key of Array.from(this.importCache.keys())) {
            if (key.includes(`:${season}:`)) {
                this.importCache.delete(key)
            }
        }

        const stateIndex = this.states.findIndex(state => state.season === season)

        if (stateIndex >= 0) {
            this.states.splice(stateIndex, 1)
        }
    }

    private async getOrCreateState(season: number, gameDate: string): Promise<PlayerImportState> {
        const existing = this.states.find(state =>
            state.season === season
        )

        if (existing && gameDate >= existing.currentDate) {
            return existing
        }

        if (existing) {
            this.states.splice(
                this.states.indexOf(existing),
                1
            )
        }

        const created: PlayerImportState = {
            season,
            currentDate: `${season - 1}-01-01`,
            statExports: [],
            players: new Map<string, PlayerImportRaw>(),
            appearancesByPlayer: {}
        }

        this.states.push(created)

        return created
    }

    private async advanceState(state: PlayerImportState, gameDate: string, filterPlayerIds?: Set<string>): Promise<void> {
        if (gameDate < state.currentDate) {
            throw new Error(
                `Cannot move player import state backward from ${state.currentDate} to ${gameDate}.`
            )
        }

        if (state.currentDate === gameDate) {
            return
        }

        for (const key of Array.from(this.importCache.keys())) {
            if (key.startsWith(`core:${state.season}:${gameDate}:`)) {
                this.importCache.delete(
                    key
                )
            }
        }

        const startedAt = Date.now()
        const startDate = state.currentDate
        const statExport = this.getStatExport(
            startDate,
            gameDate
        )

        const boundedStatExport = this.filterStatExportByDateRange(
            statExport,
            startDate,
            gameDate
        )

        const addedStatExports = this.splitStatExportByDate(
            boundedStatExport
        )

        state.statExports.push(
            ...addedStatExports
        )

        this.addAppearancesToState(
            state,
            addedStatExports
        )

        state.currentDate = gameDate

        const exportsBeforeRemoval = state.statExports.length

        this.removeUnneededDates(
            state
        )

        const removedDates =
            exportsBeforeRemoval -
            state.statExports.length

        const rebuildingAllPlayers =
            state.players.size === 0

        const affectedPlayerIds = rebuildingAllPlayers
            ? filterPlayerIds
            : this.getPlayerIdsFromExports(
                addedStatExports
            )

        const selections = this.buildCoreSelections(
            state,
            affectedPlayerIds
        )

        const selectedGameCount = this.getSelectedGameCount(
            selections
        )

        console.log(
            `Loaded stat exports from ${startDate} through ${this.addDays(gameDate, -1)}: ` +
            `${boundedStatExport.games.length} games, ${boundedStatExport.appearances.length} appearances, ` +
            `${boundedStatExport.plateAppearances.length} plate appearances, ${boundedStatExport.pitches.length} pitches, ` +
            `${removedDates} old dates removed, ${state.statExports.length} retained, ` +
            `${this.formatDuration(Date.now() - startedAt)}.`
        )

        if (
            selections.length === 0 ||
            selectedGameCount === 0
        ) {
            return
        }

        console.log(
            `${rebuildingAllPlayers ? "Building" : "Updating"} ` +
            `${selections.length} player imports across ${selectedGameCount} games.`
        )

        const accumulationStartedAt = Date.now()

        const rebuiltPlayers = this.buildFromState(
            state.season,
            state,
            selections
        )

        if (rebuildingAllPlayers) {
            state.players.clear()
        } else {
            for (const playerId of affectedPlayerIds ?? []) {
                state.players.delete(
                    String(playerId)
                )
            }
        }

        for (const [playerId, player] of rebuiltPlayers) {
            const normalizedPlayerId = String(
                playerId
            )

            state.players.set(
                normalizedPlayerId,
                player
            )
        }

        console.log(
            `${rebuildingAllPlayers ? "Built" : "Updated"} ${rebuiltPlayers.size} player imports ` +
            `in ${this.formatDuration(Date.now() - accumulationStartedAt)}.`
        )
    }

    private filterStatExportByDateRange(statExport: StatExport, startDate: string, endDateExclusive: string): StatExport {
        const games = statExport.games.filter(game =>
            game.gameDate >= startDate &&
            game.gameDate < endDateExclusive
        )

        const gamePks = new Set(
            games.map(game =>
                Number(game.gamePk)
            )
        )

        return {
            games,
            appearances: statExport.appearances.filter(appearance =>
                gamePks.has(
                    Number(appearance.gamePk)
                )
            ),
            plateAppearances: statExport.plateAppearances.filter(plateAppearance =>
                gamePks.has(
                    Number(plateAppearance.gamePk)
                )
            ),
            pitches: statExport.pitches.filter(pitch =>
                gamePks.has(
                    Number(pitch.gamePk)
                )
            ),
            runnerMovements: statExport.runnerMovements.filter(runnerMovement =>
                gamePks.has(
                    Number(runnerMovement.gamePk)
                )
            ),
            fieldingCredits: statExport.fieldingCredits.filter(fieldingCredit =>
                gamePks.has(
                    Number(fieldingCredit.gamePk)
                )
            ),
            defensiveEvents: statExport.defensiveEvents.filter(defensiveEvent =>
                gamePks.has(
                    Number(defensiveEvent.gamePk)
                )
            )
        }
    }    

    private addAppearancesToState(state: PlayerImportState, statExports: DatedStatExport[]): void {
        for (const datedExport of statExports) {
            for (const appearance of datedExport.statExport.appearances) {
                const playerId = String(appearance.playerId)
                const appearances = state.appearancesByPlayer[playerId] ?? []

                appearances.push({
                    gamePk: Number(appearance.gamePk),
                    date: datedExport.date
                })

                state.appearancesByPlayer[playerId] = appearances
            }
        }

        for (const appearances of Object.values(state.appearancesByPlayer)) {
            appearances.sort((a, b) =>
                a.date.localeCompare(b.date) ||
                a.gamePk - b.gamePk
            )
        }
    }    

    private getStatExport(startDate: string, endDateExclusive: string): StatExport {
        return queries.getStatExport(startDate, endDateExclusive)
    }

    private getPlayerIdsFromExports(statExports: DatedStatExport[]): Set<string> {
        const playerIds = new Set<string>()

        for (const datedExport of statExports) {
            for (const appearance of datedExport.statExport.appearances) {
                playerIds.add(
                    String(appearance.playerId)
                )
            }
        }

        return playerIds
    }    

    private splitStatExportByDate(statExport: StatExport): DatedStatExport[] {
        const dates = Array.from(
            new Set(
                statExport.games.map(game =>
                    game.gameDate
                )
            )
        ).sort()

        return dates.map(date => ({
            date,
            statExport: this.filterStatExportByDate(
                statExport,
                date
            )
        }))
    }  

    private filterStatExportByDate(statExport: StatExport, gameDate: string): StatExport {
        const games = statExport.games.filter(game =>
            game.gameDate === gameDate
        )

        const gamePks = new Set(
            games.map(game =>
                Number(game.gamePk)
            )
        )

        return {
            games,
            appearances: statExport.appearances.filter(appearance =>
                gamePks.has(Number(appearance.gamePk))
            ),
            plateAppearances: statExport.plateAppearances.filter(plateAppearance =>
                gamePks.has(Number(plateAppearance.gamePk))
            ),
            pitches: statExport.pitches.filter(pitch =>
                gamePks.has(Number(pitch.gamePk))
            ),
            runnerMovements: statExport.runnerMovements.filter(runnerMovement =>
                gamePks.has(Number(runnerMovement.gamePk))
            ),
            fieldingCredits: statExport.fieldingCredits.filter(fieldingCredit =>
                gamePks.has(Number(fieldingCredit.gamePk))
            ),
            defensiveEvents: statExport.defensiveEvents.filter(defensiveEvent =>
                gamePks.has(Number(defensiveEvent.gamePk))
            )
        }
    }    

    private removeUnneededDates(state: PlayerImportState): void {
        const requiredStartDate = this.getRequiredStartDate(state)

        if (!requiredStartDate) {
            return
        }

        while (state.statExports.length > 0 && state.statExports[0].date < requiredStartDate) {
            state.statExports.shift()
        }

        for (const [playerId, appearances] of Object.entries(state.appearancesByPlayer)) {
            const retainedAppearances = appearances.filter(appearance =>
                appearance.date >= requiredStartDate
            )

            if (retainedAppearances.length === 0) {
                delete state.appearancesByPlayer[playerId]
                continue
            }

            state.appearancesByPlayer[playerId] = retainedAppearances
        }
    }

    private getRequiredStartDate(state: PlayerImportState): string | undefined {
        let requiredStartDate: string | undefined

        for (const appearances of Object.values(state.appearancesByPlayer)) {
            const firstRequiredAppearance = appearances[
                Math.max(
                    0,
                    appearances.length - 162
                )
            ]

            if (!firstRequiredAppearance) {
                continue
            }

            if (!requiredStartDate || firstRequiredAppearance.date < requiredStartDate) {
                requiredStartDate = firstRequiredAppearance.date
            }
        }

        return requiredStartDate
    }

    private buildCoreSelections(state: PlayerImportState, filterPlayerIds?: Set<string>): PlayerImportSelection[] {
        const playerIds = filterPlayerIds && filterPlayerIds.size > 0
            ? Array.from(filterPlayerIds)
                .map(playerId => String(playerId))
                .sort((a, b) => a.localeCompare(b))
            : Object.keys(state.appearancesByPlayer)
                .sort((a, b) => a.localeCompare(b))

        return playerIds.map(playerId => ({
            playerId,
            gamePks: (state.appearancesByPlayer[playerId] ?? [])
                .slice(-162)
                .map(appearance =>
                    appearance.gamePk
                )
        }))
    }

    private filterPlayerImports(players: Map<string, PlayerImportRaw>, filterPlayerIds?: Set<string>): Map<string, PlayerImportRaw> {
        if (!filterPlayerIds || filterPlayerIds.size === 0) {
            return players
        }

        const filtered = new Map<string, PlayerImportRaw>()

        for (const playerId of filterPlayerIds) {
            const normalizedPlayerId = String(
                playerId
            )

            const player = players.get(
                normalizedPlayerId
            )

            if (!player) {
                continue
            }

            filtered.set(
                normalizedPlayerId,
                structuredClone(
                    player
                )
            )
        }

        return filtered
    }
    
    private buildDateRangeSelections(statExports: DatedStatExport[], filterPlayerIds?: Set<string>): PlayerImportSelection[] {
        return this.resolvePlayerIds(statExports, filterPlayerIds).map(playerId => ({
            playerId,
            gamePks: this.getPlayerAppearances(statExports, playerId).map(appearance => Number(appearance.gamePk))
        }))
    }

    private buildFromState(season: number, state: PlayerImportState, selections: PlayerImportSelection[]): Map<string, PlayerImportRaw> {
        return this.buildFromExports(
            season,
            state.statExports,
            selections,
            true
        )
    }

    private buildFromExports(season: number, statExports: DatedStatExport[], selections: PlayerImportSelection[], logProgress = false): Map<string, PlayerImportRaw> {
        const accumulatedPlayers = new Map<string, PlayerImportRaw>()

        if (selections.length === 0) {
            return accumulatedPlayers
        }

        const selectedGameCount = this.getSelectedGameCount(
            selections
        )

        if (selectedGameCount === 0) {
            return accumulatedPlayers
        }

        const startedAt = Date.now()

        if (logProgress) {
            console.log(
                `Starting stat accumulation for ${selections.length} players across ${selectedGameCount} games.`
            )
        }

        this.statAccumulatorService.accumulateStatExportsIntoPlayerImports(
            season,
            statExports,
            selections,
            accumulatedPlayers
        )

        this.finalizePlayers(
            accumulatedPlayers
        )

        const players = new Map<string, PlayerImportRaw>()

        for (const [playerId, player] of accumulatedPlayers) {
            const normalizedPlayerId = String(
                playerId
            )

            players.set(
                normalizedPlayerId,
                {
                    ...player,
                    playerId: normalizedPlayerId
                }
            )
        }

        if (logProgress) {
            console.log(
                `Completed stat accumulation for ${players.size} players in ${this.formatDuration(Date.now() - startedAt)}.`
            )
        }

        return this.clonePlayerImportMap(
            players
        )
    }

    private getSelectedGameCount(selections: PlayerImportSelection[]): number {
        const gamePks = new Set<number>()

        for (const selection of selections) {
            for (const gamePk of selection.gamePks) {
                gamePks.add(gamePk)
            }
        }

        return gamePks.size
    }    

    private loadDatedStatExports(startDate: string, endDateExclusive: string): DatedStatExport[] {
        return this.splitStatExportByDate(
            this.getStatExport(
                startDate,
                endDateExclusive
            )
        )
    }

    private resolvePlayerIds(statExports: DatedStatExport[], filterPlayerIds?: Set<string>): string[] {
        if (filterPlayerIds && filterPlayerIds.size > 0) {
            return Array.from(filterPlayerIds)
                .map(playerId => String(playerId))
                .sort((a, b) => a.localeCompare(b))
        }

        const playerIds = new Set<string>()

        for (const datedExport of statExports) {
            for (const appearance of datedExport.statExport.appearances) {
                playerIds.add(String(appearance.playerId))
            }
        }

        return Array.from(playerIds).sort((a, b) => a.localeCompare(b))
    }

    private getPlayerAppearances(statExports: DatedStatExport[], playerId: string): PlayerAppearanceReference[] {
        const appearances: PlayerAppearanceReference[] = []

        for (const datedExport of statExports) {
            for (const appearance of datedExport.statExport.appearances) {
                if (String(appearance.playerId) !== playerId) {
                    continue
                }

                appearances.push({
                    gamePk: Number(appearance.gamePk),
                    date: datedExport.date
                })
            }
        }

        return appearances.sort((a, b) =>
            a.date.localeCompare(b.date) ||
            a.gamePk - b.gamePk
        )
    }

    private finalizePlayers(players: Map<string, PlayerImportRaw>): void {
        for (const player of players.values()) {
            this.finalizePlayer(player)
        }
    }

    private finalizePlayer(player: PlayerImportRaw): void {
        player.hitting.exitVelocity.avgExitVelo = player.hitting.exitVelocity.count > 0
            ? Number((player.hitting.exitVelocity.totalExitVelo / player.hitting.exitVelocity.count).toFixed(3))
            : 0

        player.hitting.launchAngle.avgLaunchAngle = player.hitting.launchAngle.count > 0
            ? Number((player.hitting.launchAngle.totalLaunchAngle / player.hitting.launchAngle.count).toFixed(3))
            : 0

        player.hitting.distance.avgDistance = player.hitting.distance.count > 0
            ? Number((player.hitting.distance.totalDistance / player.hitting.distance.count).toFixed(3))
            : 0

        player.hitting.coordinates.avgCoordX = player.hitting.coordinates.count > 0
            ? Number((player.hitting.coordinates.totalCoordX / player.hitting.coordinates.count).toFixed(3))
            : 0

        player.hitting.coordinates.avgCoordY = player.hitting.coordinates.count > 0
            ? Number((player.hitting.coordinates.totalCoordY / player.hitting.coordinates.count).toFixed(3))
            : 0

        player.pitching.exitVelocityAllowed.avgExitVelo = player.pitching.exitVelocityAllowed.count > 0
            ? Number((player.pitching.exitVelocityAllowed.totalExitVelo / player.pitching.exitVelocityAllowed.count).toFixed(3))
            : 0

        player.pitching.launchAngleAllowed.avgLaunchAngle = player.pitching.launchAngleAllowed.count > 0
            ? Number((player.pitching.launchAngleAllowed.totalLaunchAngle / player.pitching.launchAngleAllowed.count).toFixed(3))
            : 0

        player.pitching.distanceAllowed.avgDistance = player.pitching.distanceAllowed.count > 0
            ? Number((player.pitching.distanceAllowed.totalDistance / player.pitching.distanceAllowed.count).toFixed(3))
            : 0

        player.pitching.coordinatesAllowed.avgCoordX = player.pitching.coordinatesAllowed.count > 0
            ? Number((player.pitching.coordinatesAllowed.totalCoordX / player.pitching.coordinatesAllowed.count).toFixed(3))
            : 0

        player.pitching.coordinatesAllowed.avgCoordY = player.pitching.coordinatesAllowed.count > 0
            ? Number((player.pitching.coordinatesAllowed.totalCoordY / player.pitching.coordinatesAllowed.count).toFixed(3))
            : 0

        for (const pitchTypeStat of Object.values(player.pitching.pitchTypes ?? {})) {
            if (!pitchTypeStat) {
                continue
            }

            pitchTypeStat.avgMph = pitchTypeStat.count > 0
                ? Number((pitchTypeStat.totalMph / pitchTypeStat.count).toFixed(3))
                : 0

            pitchTypeStat.avgHorizontalBreak = pitchTypeStat.count > 0
                ? Number((pitchTypeStat.totalHorizontalBreak / pitchTypeStat.count).toFixed(3))
                : 0

            pitchTypeStat.avgVerticalBreak = pitchTypeStat.count > 0
                ? Number((pitchTypeStat.totalVerticalBreak / pitchTypeStat.count).toFixed(3))
                : 0
        }

        delete (player as any).__hittingGameIds
        delete (player as any).__pitchingGameIds
        delete (player as any).__fieldingGameIds
        delete (player as any).__fieldingPositionsByGame
        delete (player as any).__fieldedBallPlayKeys
        delete (player as any).__outsAtPosition
        delete (player as any).__splitExitVelocity
    }

    private normalizePlayerIds(filterPlayerIds?: Set<string>): string[] {
        if (!filterPlayerIds || filterPlayerIds.size === 0) {
            return []
        }

        return Array.from(filterPlayerIds)
            .map(playerId => String(playerId).trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
    }

    private samePlayerIds(a: string[], b: string[]): boolean {
        if (a.length !== b.length) {
            return false
        }

        for (let index = 0; index < a.length; index++) {
            if (a[index] !== b[index]) {
                return false
            }
        }

        return true
    }

    private getCacheKey(type: string, season: number, dateKey: string, playerIds: string[]): string {
        return [
            type,
            season,
            dateKey,
            playerIds.length > 0 ? playerIds.join(",") : "*"
        ].join(":")
    }

    private getResultsFilePath(season: number): string {
        return path.join(this.baseDataDir, String(season), "_results.json")
    }

    private async readResultsFile(filePath: string): Promise<PlayerImportResultsFile | undefined> {
        if (!await this.fileExists(filePath)) {
            return undefined
        }

        const data = JSON.parse(await fs.promises.readFile(filePath, "utf8"))

        if (!data || !Array.isArray(data.players) || !Array.isArray(data.playerIds)) {
            return undefined
        }

        return {
            season: Number(data.season),
            playerIds: data.playerIds.map((playerId: unknown) => String(playerId)),
            players: data.players
        }
    }

    private async writeResultsFile(filePath: string, season: number, playerIds: string[], players: Map<string, PlayerImportRaw>): Promise<void> {
        const data = {
            season,
            playerIds,
            generatedAt: new Date().toISOString(),
            players: Array.from(players.values())
        }

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
    }

    private resultsFileToPlayerMap(players: PlayerImportRaw[]): Map<string, PlayerImportRaw> {
        const result = new Map<string, PlayerImportRaw>()

        for (const player of players) {
            result.set(String(player.playerId), structuredClone(player))
        }

        return result
    }

    private clonePlayerImportMap(players: Map<string, PlayerImportRaw>): Map<string, PlayerImportRaw> {
        const result = new Map<string, PlayerImportRaw>()

        for (const [playerId, player] of players) {
            const normalizedPlayerId = String(
                playerId
            )

            result.set(
                normalizedPlayerId,
                {
                    ...structuredClone(player),
                    playerId: normalizedPlayerId
                }
            )
        }

        return result
    }

    private validateIsoDate(value: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(`Invalid date: ${value}.`)
        }

        const parsed = new Date(`${value}T12:00:00.000Z`)

        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
            throw new Error(`Invalid date: ${value}.`)
        }
    }

    private addDays(value: string, days: number): string {
        const date = new Date(`${value}T12:00:00.000Z`)

        date.setUTCDate(date.getUTCDate() + days)

        return date.toISOString().slice(0, 10)
    }

    private isCurrentSeason(season: number): boolean {
        return season === new Date().getUTCFullYear()
    }

    private getTomorrowUtcDate(): string {
        const date = new Date()

        date.setUTCDate(date.getUTCDate() + 1)

        return date.toISOString().slice(0, 10)
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK)

            return true
        } catch {
            return false
        }
    }

    private formatDuration(milliseconds: number): string {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`
        }

        const seconds = milliseconds / 1000

        if (seconds < 60) {
            return `${seconds.toFixed(2)}s`
        }

        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = Math.round(seconds % 60)

        return `${minutes}m ${remainingSeconds}s`
    }    
}

interface DatedStatExport {
    date: string
    statExport: StatExport
}

interface PlayerImportState {
    season: number
    currentDate: string
    statExports: DatedStatExport[]
    players: Map<string, PlayerImportRaw>
    appearancesByPlayer: Record<string, PlayerAppearanceReference[]>
}

interface PlayerImportSelection {
    playerId: string
    gamePks: number[]
}

interface PlayerAppearanceReference {
    gamePk: number
    date: string
}

interface PlayerImportResultsFile {
    season: number
    playerIds: string[]
    players: PlayerImportRaw[]
}

export {
    PlayerImportService
}

export type {
    DatedStatExport,
    PlayerImportSelection,
    PlayerImportState
}
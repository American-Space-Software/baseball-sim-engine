import fs from "fs"
import path from "path"

import {
    downloadSeason as downloadDatabaseSeason,
    getGame as getDatabaseGame,
    getSchedule as getDatabaseSchedule
} from "baseball-database"

import type { PlayerImportRaw } from "../../sim/service/interfaces.js"

import { StatAccumulatorService } from "./stat-accumulator-service.js"

class PlayerImportService {

    private readonly importCache = new Map<string, Map<string, PlayerImportRaw>>()
    private readonly appearanceIndexes = new Map<number, Promise<PlayerAppearanceIndex>>()
    private readonly gameFeeds = new Map<number, any>()

    public constructor(
        private readonly baseDataDir: string, 
        private readonly statAccumulatorService: StatAccumulatorService
    ) {}

    public async buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        const cutoffDate = this.isCurrentSeason(season)
            ? this.getTomorrowUtcDate()
            : `${season + 1}-01-01`

        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const resultsFilePath = this.getResultsFilePath(season)

        if (!forceFullReimport) {
            const cachedResults = await this.readResultsFile(resultsFilePath)

            if (cachedResults && cachedResults.season === season && this.samePlayerIds(cachedResults.playerIds, normalizedPlayerIds)) {
                return this.resultsFileToPlayerMap(cachedResults.players)
            }
        }

        const players = await this.buildCorePlayerImports(
            season,
            cutoffDate,
            filterPlayerIds,
            forceFullReimport
        )

        await this.writeResultsFile(
            resultsFilePath,
            season,
            normalizedPlayerIds,
            players
        )

        return players
    }

    public async buildSeasonPlayerImportRaw(season: number, playerId: string, forceFullReimport = false): Promise<PlayerImportRaw | undefined> {
        const players = await this.buildSeasonPlayerImports(
            season,
            new Set([String(playerId)]),
            forceFullReimport
        )

        return players.get(String(playerId))
    }

    public async buildCorePlayerImports(season: number, gameDate: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        this.validateIsoDate(gameDate)

        if (forceFullReimport) {
            this.clearCache(season)
        }

        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const cacheKey = this.getCacheKey("core", season, gameDate, normalizedPlayerIds)
        const cached = this.importCache.get(cacheKey)

        if (cached) {
            return this.clonePlayerImportMap(cached)
        }

        const appearanceIndex = await this.getAppearanceIndex(season)
        const playerIds = this.resolvePlayerIds(
            appearanceIndex,
            filterPlayerIds
        )

        const selectedGames = new Map<string, SelectedGame>()

        for (const playerId of playerIds) {
            const appearances = (appearanceIndex.appearancesByPlayerId.get(playerId) ?? [])
                .filter(appearance => appearance.gameDate < gameDate)
                .slice(-162)

            for (const appearance of appearances) {
                this.addSelectedGamePlayer(
                    selectedGames,
                    appearance,
                    playerId
                )
            }
        }

        const players = await this.buildFromSelectedGames(
            season,
            selectedGames
        )

        this.importCache.set(
            cacheKey,
            this.clonePlayerImportMap(players)
        )

        return players
    }

    public async buildDateRangePlayerImports(season: number, startDate: string, endDateExclusive: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        this.validateIsoDate(startDate)
        this.validateIsoDate(endDateExclusive)

        if (startDate >= endDateExclusive) {
            throw new Error(
                `Start date ${startDate} must be before end date ${endDateExclusive}.`
            )
        }

        if (forceFullReimport) {
            this.clearCache(season)
        }

        const normalizedPlayerIds = this.normalizePlayerIds(filterPlayerIds)
        const cacheKey = this.getCacheKey(
            "range",
            season,
            `${startDate}:${endDateExclusive}`,
            normalizedPlayerIds
        )

        const cached = this.importCache.get(cacheKey)

        if (cached) {
            return this.clonePlayerImportMap(cached)
        }

        const appearanceIndex = await this.getAppearanceIndex(season)
        const playerIds = this.resolvePlayerIds(
            appearanceIndex,
            filterPlayerIds
        )

        const selectedGames = new Map<string, SelectedGame>()

        for (const playerId of playerIds) {
            const appearances = appearanceIndex.appearancesByPlayerId.get(playerId) ?? []

            for (const appearance of appearances) {
                if (appearance.gameDate < startDate || appearance.gameDate >= endDateExclusive) {
                    continue
                }

                this.addSelectedGamePlayer(
                    selectedGames,
                    appearance,
                    playerId
                )
            }
        }

        const players = await this.buildFromSelectedGames(
            season,
            selectedGames
        )

        this.importCache.set(
            cacheKey,
            this.clonePlayerImportMap(players)
        )

        return players
    }

    public async getAppearanceCountsBeforeDate(season: number, gameDate: string, filterPlayerIds?: Set<string>): Promise<Map<string, number>> {
        this.validateIsoDate(gameDate)

        const appearanceIndex = await this.getAppearanceIndex(season)
        const playerIds = this.resolvePlayerIds(
            appearanceIndex,
            filterPlayerIds
        )

        const counts = new Map<string, number>()

        for (const playerId of playerIds) {
            const appearances = appearanceIndex.appearancesByPlayerId.get(playerId) ?? []

            counts.set(
                playerId,
                appearances
                    .filter(appearance => appearance.gameDate < gameDate)
                    .slice(-162)
                    .length
            )
        }

        return counts
    }

    public buildFromGameFeeds(season: number, gameFeeds: PlayerImportGameFeed[]): Map<string, PlayerImportRaw> {
        const players = new Map<string, PlayerImportRaw>()

        for (const gameFeed of gameFeeds) {
            if (!gameFeed.gamePk || !gameFeed.data || gameFeed.playerIds.length === 0) {
                continue
            }

            this.accumulateGame(
                season,
                gameFeed.gamePk,
                gameFeed.data,
                players,
                new Set(
                    gameFeed.playerIds.map(playerId =>
                        String(playerId)
                    )
                )
            )
        }

        this.finalizePlayers(players)

        return this.clonePlayerImportMap(players)
    }

    public clearCache(season?: number): void {
        if (season === undefined) {
            this.importCache.clear()
            this.appearanceIndexes.clear()
            this.gameFeeds.clear()
            return
        }

        for (const key of Array.from(this.importCache.keys())) {
            if (key.includes(`:${season}:`)) {
                this.importCache.delete(key)
            }
        }

        this.appearanceIndexes.delete(season)

        for (const key of Array.from(this.gameFeeds.keys())) {
            const game = getDatabaseGame(key)
            const gameSeason = Number(
                game?.data?.gameData?.game?.season ??
                game?.data?.gameData?.datetime?.originalDate?.slice(0, 4) ??
                0
            )

            if (gameSeason === season || gameSeason === season - 1) {
                this.gameFeeds.delete(key)
            }
        }
    }

    private async buildFromSelectedGames(season: number, selectedGames: Map<string, SelectedGame>): Promise<Map<string, PlayerImportRaw>> {
        const gameFeeds: PlayerImportGameFeed[] = []

        const games = Array.from(selectedGames.values()).sort((a, b) => {
            if (a.gameDate !== b.gameDate) {
                return a.gameDate.localeCompare(b.gameDate)
            }

            return a.gamePk - b.gamePk
        })

        for (const selectedGame of games) {
            gameFeeds.push({
                sourceSeason: selectedGame.sourceSeason,
                gamePk: selectedGame.gamePk,
                data: await this.getGameFeed(selectedGame.gamePk),
                playerIds: Array.from(selectedGame.playerIds)
            })
        }

        return this.buildFromGameFeeds(
            season,
            gameFeeds
        )
    }

    private async getAppearanceIndex(season: number): Promise<PlayerAppearanceIndex> {
        const existing = this.appearanceIndexes.get(season)

        if (existing) {
            return await existing
        }

        const pending = this.buildAppearanceIndex(season)

        this.appearanceIndexes.set(
            season,
            pending
        )

        try {
            return await pending
        } catch (error) {
            this.appearanceIndexes.delete(season)
            throw error
        }
    }

    private async buildAppearanceIndex(season: number): Promise<PlayerAppearanceIndex> {
        const appearancesByPlayerId = new Map<string, PlayerGameReference[]>()

        const scheduleRows = [
            ...await this.getSeasonScheduleGames(season - 1),
            ...await this.getSeasonScheduleGames(season)
        ].sort((a, b) =>
            a.gameDate.localeCompare(b.gameDate) ||
            a.gamePk - b.gamePk
        )

        console.log(
            `Building player appearance index from ${scheduleRows.length} completed games for seasons ${season - 1}-${season}.`
        )

        for (let index = 0; index < scheduleRows.length; index++) {
            const scheduleRow = scheduleRows[index]
            const feed = await this.getGameFeed(scheduleRow.gamePk)

            if (!this.isGameComplete(feed)) {
                continue
            }

            for (const playerId of this.getParticipatingPlayerIds(feed)) {
                const appearances =
                    appearancesByPlayerId.get(playerId) ??
                    []

                appearances.push(scheduleRow)

                appearancesByPlayerId.set(
                    playerId,
                    appearances
                )
            }

            if ((index + 1) % 250 === 0 || index === scheduleRows.length - 1) {
                console.log(
                    `Indexed ${index + 1}/${scheduleRows.length} completed games and ${appearancesByPlayerId.size} players.`
                )
            }
        }

        return {
            season,
            appearancesByPlayerId
        }
    }

    private async getSeasonScheduleGames(sourceSeason: number): Promise<PlayerGameReference[]> {
        await downloadDatabaseSeason(sourceSeason)

        const storedSchedule = getDatabaseSchedule(sourceSeason)

        if (!storedSchedule) {
            throw new Error(
                `Schedule ${sourceSeason} was not found after synchronization.`
            )
        }

        const games: PlayerGameReference[] = []

        for (const date of storedSchedule.data?.dates ?? []) {
            const gameDate = String(date?.date ?? "")

            if (!gameDate) {
                continue
            }

            for (const game of date?.games ?? []) {
                const gamePk = Number(game?.gamePk)

                if (!gamePk || !this.isCompletedScheduleGame(game)) {
                    continue
                }

                games.push({
                    sourceSeason,
                    gamePk,
                    gameDate
                })
            }
        }

        return games
    }

    private async getGameFeed(gamePk: number): Promise<any> {
        if (this.gameFeeds.has(gamePk)) {
            return this.gameFeeds.get(gamePk)
        }

        const storedGame = getDatabaseGame(gamePk)

        if (!storedGame) {
            throw new Error(
                `Game ${gamePk} was not found in baseball-database.`
            )
        }

        this.gameFeeds.set(
            gamePk,
            storedGame.data
        )

        return storedGame.data
    }

    private resolvePlayerIds(appearanceIndex: PlayerAppearanceIndex, filterPlayerIds?: Set<string>): Set<string> {
        if (filterPlayerIds && filterPlayerIds.size > 0) {
            return new Set(
                Array.from(filterPlayerIds).map(playerId =>
                    String(playerId)
                )
            )
        }

        return new Set(
            appearanceIndex.appearancesByPlayerId.keys()
        )
    }

    private addSelectedGamePlayer(selectedGames: Map<string, SelectedGame>, appearance: PlayerGameReference, playerId: string): void {
        const key = this.getGameKey(
            appearance.sourceSeason,
            appearance.gamePk
        )

        const selectedGame = selectedGames.get(key) ?? {
            sourceSeason: appearance.sourceSeason,
            gamePk: appearance.gamePk,
            gameDate: appearance.gameDate,
            playerIds: new Set<string>()
        }

        selectedGame.playerIds.add(playerId)

        selectedGames.set(
            key,
            selectedGame
        )
    }

    private accumulateGame(season: number, gamePk: number, gameData: any, players: Map<string, PlayerImportRaw>, filterPlayerIds?: Set<string>): void {
        this.statAccumulatorService.accumulateGameIntoSeasonPlayerImports(
            season,
            gamePk,
            gameData,
            players,
            filterPlayerIds
        )
    }

    private finalizePlayers(players: Map<string, PlayerImportRaw>): void {
        for (const player of players.values()) {
            this.finalizePlayer(player)
        }
    }

    private finalizePlayer(player: PlayerImportRaw): void {
        player.hitting.exitVelocity.avgExitVelo =
            player.hitting.exitVelocity.count > 0
                ? Number((
                    player.hitting.exitVelocity.totalExitVelo /
                    player.hitting.exitVelocity.count
                ).toFixed(3))
                : 0

        for (const pitchTypeStat of Object.values(player.pitching.pitchTypes ?? {})) {
            if (!pitchTypeStat) {
                continue
            }

            pitchTypeStat.avgMph = pitchTypeStat.count > 0
                ? Number((
                    pitchTypeStat.totalMph /
                    pitchTypeStat.count
                ).toFixed(3))
                : 0

            pitchTypeStat.avgHorizontalBreak = pitchTypeStat.count > 0
                ? Number((
                    pitchTypeStat.totalHorizontalBreak /
                    pitchTypeStat.count
                ).toFixed(3))
                : 0

            pitchTypeStat.avgVerticalBreak = pitchTypeStat.count > 0
                ? Number((
                    pitchTypeStat.totalVerticalBreak /
                    pitchTypeStat.count
                ).toFixed(3))
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

    private getParticipatingPlayerIds(gameData: any): Set<string> {
        const playerIds = new Set<string>()

        for (const side of ["home", "away"] as const) {
            const team =
                gameData
                    ?.liveData
                    ?.boxscore
                    ?.teams
                    ?.[side]

            for (const playerId of team?.battingOrder ?? []) {
                playerIds.add(
                    String(playerId)
                )
            }

            for (const playerId of team?.pitchers ?? []) {
                playerIds.add(
                    String(playerId)
                )
            }

            for (const [key, player] of Object.entries(team?.players ?? {})) {
                const typedPlayer = player as any

                const playerId =
                    typedPlayer?.person?.id ??
                    key.replace(/^ID/, "")

                if (!playerId) {
                    continue
                }

                const batting = typedPlayer?.stats?.batting
                const pitching = typedPlayer?.stats?.pitching
                const fielding = typedPlayer?.stats?.fielding

                const appeared =
                    Number(batting?.plateAppearances ?? 0) > 0 ||
                    Number(batting?.atBats ?? 0) > 0 ||
                    Number(pitching?.numberOfPitches ?? 0) > 0 ||
                    Number(pitching?.battersFaced ?? 0) > 0 ||
                    Number(fielding?.gamesStarted ?? 0) > 0

                if (appeared) {
                    playerIds.add(
                        String(playerId)
                    )
                }
            }
        }

        return playerIds
    }

    private isCompletedScheduleGame(game: any): boolean {
        const abstractState = String(
            game?.status?.abstractGameState ?? ""
        )

        const detailedState = String(
            game?.status?.detailedState ?? ""
        )

        const codedState = String(
            game?.status?.codedGameState ?? ""
        )

        return abstractState === "Final" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early" ||
            codedState === "F"
    }

    private isGameComplete(gameData: any): boolean {
        const abstractState = String(
            gameData?.gameData?.status?.abstractGameState ?? ""
        )

        const detailedState = String(
            gameData?.gameData?.status?.detailedState ?? ""
        )

        const codedState = String(
            gameData?.gameData?.status?.codedGameState ?? ""
        )

        return abstractState === "Final" ||
            detailedState === "Final" ||
            detailedState === "Game Over" ||
            detailedState === "Completed Early" ||
            codedState === "F"
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
            playerIds.length > 0
                ? playerIds.join(",")
                : "*"
        ].join(":")
    }

    private getGameKey(sourceSeason: number, gamePk: number): string {
        return `${sourceSeason}:${gamePk}`
    }

    private getResultsFilePath(season: number): string {
        return path.join(
            this.baseDataDir,
            String(season),
            "_results.json"
        )
    }

    private async readResultsFile(filePath: string): Promise<PlayerImportResultsFile | undefined> {
        if (!await this.fileExists(filePath)) {
            return undefined
        }

        const data = JSON.parse(
            await fs.promises.readFile(
                filePath,
                "utf8"
            )
        )

        if (
            !data ||
            !Array.isArray(data.players) ||
            !Array.isArray(data.playerIds)
        ) {
            return undefined
        }

        return {
            season: Number(data.season),
            playerIds: data.playerIds.map(
                (playerId: unknown) =>
                    String(playerId)
            ),
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

        await fs.promises.mkdir(
            path.dirname(filePath),
            {
                recursive: true
            }
        )

        await fs.promises.writeFile(
            filePath,
            JSON.stringify(data, null, 2),
            "utf8"
        )
    }

    private resultsFileToPlayerMap(players: PlayerImportRaw[]): Map<string, PlayerImportRaw> {
        const result = new Map<string, PlayerImportRaw>()

        for (const player of players) {
            result.set(
                String(player.playerId),
                structuredClone(player)
            )
        }

        return result
    }

    private clonePlayerImportMap(players: Map<string, PlayerImportRaw>): Map<string, PlayerImportRaw> {
        const result = new Map<string, PlayerImportRaw>()

        for (const [playerId, player] of players) {
            result.set(
                playerId,
                structuredClone(player)
            )
        }

        return result
    }

    private validateIsoDate(value: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(
                `Invalid date: ${value}.`
            )
        }

        const parsed = new Date(
            `${value}T12:00:00.000Z`
        )

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== value
        ) {
            throw new Error(
                `Invalid date: ${value}.`
            )
        }
    }

    private isCurrentSeason(season: number): boolean {
        return season === new Date().getUTCFullYear()
    }

    private getTomorrowUtcDate(): string {
        const date = new Date()

        date.setUTCDate(
            date.getUTCDate() + 1
        )

        return date.toISOString().slice(0, 10)
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(
                filePath,
                fs.constants.F_OK
            )

            return true
        } catch {
            return false
        }
    }
}

interface PlayerImportGameFeed {
    sourceSeason: number
    gamePk: number
    data: any
    playerIds: string[]
}

interface PlayerGameReference {
    sourceSeason: number
    gamePk: number
    gameDate: string
}

interface PlayerAppearanceIndex {
    season: number
    appearancesByPlayerId: Map<string, PlayerGameReference[]>
}

interface SelectedGame {
    sourceSeason: number
    gamePk: number
    gameDate: string
    playerIds: Set<string>
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
    PlayerImportGameFeed,
    PlayerGameReference,
    PlayerAppearanceIndex
}
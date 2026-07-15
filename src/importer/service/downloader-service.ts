import fs from "fs"
import path from "path"
import MLBStatsAPI from "mlb-stats-api"
import {
    PlayerImportRaw
} from "../../sim/service/interfaces.js"
import { Handedness, PitchType, Position } from "../../sim/service/enums.js"
import { StatAccumulatorService } from "./stat-accumulator-service.js"

class DownloaderService {

    private readonly scheduleCacheMs = 1000 * 60 * 60
    private api: MLBStatsAPI
    private throttleMs: number
    private baseDataDir: string
    private seasonImportCache: Map<string, Map<string, PlayerImportRaw>>
    private statAccumulatorService:StatAccumulatorService

    constructor(baseDataDir: string, throttleMs = 200) {
        this.api = new MLBStatsAPI()
        this.throttleMs = throttleMs
        this.baseDataDir = baseDataDir
        this.seasonImportCache = new Map()
        this.statAccumulatorService = new StatAccumulatorService()
    }

    async downloadSeasonGames(season: number, onGame: (gamePk: number, data: any) => Promise<void>, forceFullReimport = false): Promise<Set<number>> {
        const games = await this.getSeasonGames(season)
        const completedGamePks = new Set<number>()
        const failedGames: { gamePk: number; gameDate: string; error: string }[] = []

        console.log(`Processing ${games.length} games for season ${season}`)

        for (let i = 0; i < games.length; i++) {
            const game = games[i]
            const gamePk = Number(game.gamePk)
            const gameDate = this.getGameDate(game)

            if (!gamePk || !gameDate) continue
            if (this.isFutureGameDate(gameDate)) continue

            try {
                const result = await this.getOrDownloadGame(
                    season,
                    gamePk,
                    gameDate,
                    forceFullReimport
                )

                if (!this.isGameComplete(result.data)) {
                    console.log(
                        `Skipped ${i + 1}/${games.length} ` +
                        `(gamePk: ${gamePk}, status: ${this.getGameStatus(result.data)})`
                    )

                    if (result.downloaded) {
                        await this.sleep(this.throttleMs)
                    }

                    continue
                }

                completedGamePks.add(gamePk)
                await onGame(gamePk, result.data)

                console.log(
                    `Processed ${i + 1}/${games.length} ` +
                    `(gamePk: ${gamePk}, date: ${gameDate})`
                )

                if (result.downloaded) {
                    await this.sleep(this.throttleMs)
                }
            } catch (err: any) {
                const error = String(err?.message ?? err)

                failedGames.push({
                    gamePk,
                    gameDate,
                    error
                })

                console.error(
                    `Failed game ${gamePk} (${gameDate}):`,
                    error
                )
            }
        }

        const missingFiles: { gamePk: number; gameDate: string; filePath: string }[] = []

        for (const game of games) {
            const gamePk = Number(game.gamePk)
            const gameDate = this.getGameDate(game)

            if (!gamePk || !gameDate) continue
            if (this.isFutureGameDate(gameDate)) continue

            const filePath = this.getGameFilePath(season, gamePk)

            if (!await this.fileExists(filePath)) {
                missingFiles.push({
                    gamePk,
                    gameDate,
                    filePath
                })
            }
        }

        if (failedGames.length > 0 || missingFiles.length > 0) {
            throw new Error(
                [
                    `Season ${season} game synchronization failed.`,
                    `Download failures: ${failedGames.length}`,
                    ...failedGames.map(row =>
                        `${row.gameDate} gamePk=${row.gamePk}: ${row.error}`
                    ),
                    `Missing files: ${missingFiles.length}`,
                    ...missingFiles.map(row =>
                        `${row.gameDate} gamePk=${row.gamePk}: ${row.filePath}`
                    )
                ].join("\n")
            )
        }

        console.log(
            `Finished processing season ${season}: ` +
            `${completedGamePks.size} completed games, ` +
            `${games.length} scheduled games verified`
        )

        return completedGamePks
    }

    async buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        const cutoffDate = this.isCurrentSeason(season)
            ? this.getTomorrowUtcDate()
            : `${season + 1}-01-01`

        return await this.buildRollingPlayerImports(
            season,
            cutoffDate,
            this.getResultsFilePath(season),
            filterPlayerIds,
            forceFullReimport
        )
    }

    private async buildRollingPlayerImports(season: number, cutoffDate: string, resultsFilePath: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        const effectiveFilterPlayerIds = filterPlayerIds && filterPlayerIds.size > 0
            ? new Set(
                Array.from(filterPlayerIds).map(
                    playerId => String(playerId)
                )
            )
            : undefined

        const normalizedPlayerIds = this.normalizePlayerIds(
            effectiveFilterPlayerIds
        )

        if (!forceFullReimport) {
            const cachedResults = await this.readResultsFile(
                resultsFilePath
            )

            if (
                cachedResults &&
                cachedResults.season === season &&
                this.samePlayerIds(
                    cachedResults.playerIds,
                    normalizedPlayerIds
                )
            ) {
                return this.resultsFileToPlayerMap(
                    cachedResults.players
                )
            }
        }

        const cacheKey = this.getRollingCacheKey(
            season,
            cutoffDate,
            normalizedPlayerIds
        )

        if (
            !forceFullReimport &&
            this.seasonImportCache.has(cacheKey)
        ) {
            return this.clonePlayerImportMap(
                this.seasonImportCache.get(cacheKey)!
            )
        }

        const players = new Map<string, PlayerImportRaw>()
        const playerGameCounts = new Map<string, number>()
        const completedGamePks = new Set<number>()

        const failedGames: {
            gamePk: number
            gameDate: string
            sourceSeason: number
            error: string
        }[] = []

        const games = await this.getRollingGamesBeforeDate(
            season,
            cutoffDate
        )

        console.log(
            `Processing ${games.length} games before ${cutoffDate} ` +
            `from seasons ${season - 1}-${season} for rolling ${season} player imports`
        )

        for (let i = 0; i < games.length; i++) {
            const row = games[i]

            const gamePk = Number(
                row.game?.gamePk
            )

            const gameDate = this.getGameDate(
                row.game
            )

            if (!gamePk || !gameDate) {
                continue
            }

            try {
                const result = await this.getOrDownloadGame(
                    row.sourceSeason,
                    gamePk,
                    gameDate,
                    forceFullReimport
                )

                if (!this.isGameComplete(result.data)) {
                    console.log(
                        `Skipped ${i + 1}/${games.length} ` +
                        `(gamePk: ${gamePk}, status: ${this.getGameStatus(result.data)})`
                    )

                    if (result.downloaded) {
                        await this.sleep(
                            this.throttleMs
                        )
                    }

                    continue
                }

                const participatingPlayerIds = this.getParticipatingPlayerIds(
                    result.data
                )

                const eligiblePlayerIds = new Set<string>()

                for (const playerId of participatingPlayerIds) {
                    if (
                        effectiveFilterPlayerIds &&
                        !effectiveFilterPlayerIds.has(playerId)
                    ) {
                        continue
                    }

                    const gamesAccumulated = playerGameCounts.get(
                        playerId
                    ) ?? 0

                    if (gamesAccumulated >= 162) {
                        continue
                    }

                    eligiblePlayerIds.add(
                        playerId
                    )
                }

                if (eligiblePlayerIds.size === 0) {
                    if (
                        effectiveFilterPlayerIds &&
                        this.everyFilteredPlayerHasEnoughGames(
                            effectiveFilterPlayerIds,
                            playerGameCounts
                        )
                    ) {
                        break
                    }

                    continue
                }

                this.accumulateGameIntoSeasonPlayerImports(
                    season,
                    gamePk,
                    result.data,
                    players,
                    eligiblePlayerIds
                )

                for (const playerId of eligiblePlayerIds) {
                    playerGameCounts.set(
                        playerId,
                        (playerGameCounts.get(playerId) ?? 0) + 1
                    )
                }

                completedGamePks.add(
                    gamePk
                )

                console.log(
                    `Processed ${i + 1}/${games.length} ` +
                    `(gamePk: ${gamePk}, date: ${gameDate}, ` +
                    `sourceSeason: ${row.sourceSeason}, ` +
                    `eligiblePlayers: ${eligiblePlayerIds.size})`
                )

                if (result.downloaded) {
                    await this.sleep(
                        this.throttleMs
                    )
                }

                if (
                    effectiveFilterPlayerIds &&
                    this.everyFilteredPlayerHasEnoughGames(
                        effectiveFilterPlayerIds,
                        playerGameCounts
                    )
                ) {
                    break
                }
            } catch (err: any) {
                const error = String(
                    err?.message ??
                    err
                )

                failedGames.push({
                    gamePk,
                    gameDate,
                    sourceSeason: row.sourceSeason,
                    error
                })

                console.error(
                    `Failed game ${gamePk} (${gameDate}):`,
                    error
                )
            }
        }

        if (failedGames.length > 0) {
            throw new Error(
                [
                    `Failed to synchronize ${failedGames.length} game feeds for rolling season ${season} before ${cutoffDate}.`,
                    ...failedGames.map(row =>
                        `${row.gameDate} gamePk=${row.gamePk} sourceSeason=${row.sourceSeason}: ${row.error}`
                    )
                ].join("\n")
            )
        }

        for (const player of players.values()) {
            this.finalizePlayerImportRaw(
                player
            )
        }

        const result = this.clonePlayerImportMap(
            players
        )

        this.seasonImportCache.set(
            cacheKey,
            this.clonePlayerImportMap(result)
        )

        await this.writeResultsFile(
            resultsFilePath,
            season,
            normalizedPlayerIds,
            result,
            Array.from(completedGamePks).sort(
                (a, b) => a - b
            )
        )

        console.log(
            `Finished rolling ${season} player imports before ${cutoffDate}: ${result.size} players`
        )

        return result
    }    

    async buildPlayerImportsForDate(season: number, gameDate: string, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        this.validateIsoDate(
            gameDate
        )

        if (!gameDate.startsWith(`${season}-`)) {
            throw new Error(
                `Game date ${gameDate} does not belong to season ${season}.`
            )
        }

        return await this.buildRollingPlayerImports(
            season,
            gameDate,
            this.getDatedResultsFilePath(
                season,
                gameDate
            ),
            filterPlayerIds,
            forceFullReimport
        )
    }    

    async getSeasonHomeFieldAdvantage(season: number): Promise<number> {
        const games = await this.getSeasonGames(season)

        let completedGames = 0
        let homeWins = 0

        for (const game of games) {
            const awayScore = Number(game?.teams?.away?.score)
            const homeScore = Number(game?.teams?.home?.score)

            if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) {
                continue
            }

            if (awayScore === homeScore) {
                continue
            }

            completedGames++

            if (homeScore > awayScore) {
                homeWins++
            }
        }

        if (completedGames === 0) {
            throw new Error(`No completed regular-season games found for season ${season}`)
        }

        const homeWinPercent = homeWins / completedGames

        return Number((homeWinPercent - 0.5).toFixed(4))
    }
    
    private async getRollingGamesBeforeDate(season: number, cutoffDate: string): Promise<{ sourceSeason: number, game: any }[]> {
        const previousSeasonGames = await this.getSeasonGames(
            season - 1
        )

        const currentSeasonGames = await this.getSeasonGames(
            season
        )

        const uniqueGames = new Map<number, {
            sourceSeason: number
            game: any
        }>()

        const rows = [
            ...previousSeasonGames.map(game => ({
                sourceSeason: season - 1,
                game
            })),
            ...currentSeasonGames.map(game => ({
                sourceSeason: season,
                game
            }))
        ]

        for (const row of rows) {
            const gamePk = Number(
                row.game?.gamePk
            )

            const gameDate = this.getGameDate(
                row.game
            )

            if (!gamePk || !gameDate) {
                continue
            }

            if (gameDate >= cutoffDate) {
                continue
            }

            uniqueGames.set(
                gamePk,
                row
            )
        }

        return Array.from(
            uniqueGames.values()
        ).sort((a, b) => {
            const aTime = this.getGameSortTime(
                a.game
            )

            const bTime = this.getGameSortTime(
                b.game
            )

            if (aTime !== bTime) {
                return bTime - aTime
            }

            return Number(
                b.game?.gamePk ?? 0
            ) - Number(
                a.game?.gamePk ?? 0
            )
        })
    }

    private getGameSortTime(game: any): number {
        const dateValue =
            game?.gameDate ??
            game?.officialDate

        const time =
            new Date(dateValue).getTime()

        return Number.isFinite(time)
            ? time
            : 0
    }

    private getParticipatingPlayerIds(gameData: any): Set<string> {
        const playerIds =
            new Set<string>()

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
                const typedPlayer =
                    player as any

                const playerId =
                    typedPlayer?.person?.id ??
                    key.replace(/^ID/, "")

                if (!playerId) continue

                const batting =
                    typedPlayer?.stats?.batting

                const pitching =
                    typedPlayer?.stats?.pitching

                const fielding =
                    typedPlayer?.stats?.fielding

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

    private everyFilteredPlayerHasEnoughGames(filterPlayerIds: Set<string>, playerGameCounts: Map<string, number>): boolean {
        for (const playerId of filterPlayerIds) {
            if (
                (playerGameCounts.get(playerId) ?? 0) < 162
            ) {
                return false
            }
        }

        return true
    }

    private getDatedResultsFilePath(season: number, cutoffDate: string): string {
        return path.join(
            this.baseDataDir,
            String(season),
            "rolling",
            `${cutoffDate}.json`
        )
    }

    private getRollingCacheKey(season: number, cutoffDate: string, playerIds: string[]): string {
        return [
            season,
            cutoffDate,
            playerIds.length > 0
                ? playerIds.join(",")
                : "*"
        ].join(":")
    }

    private getTomorrowUtcDate(): string {
        const date = new Date()

        date.setUTCDate(
            date.getUTCDate() + 1
        )

        return date
            .toISOString()
            .slice(0, 10)
    }

    private validateIsoDate(value: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(
                `Invalid date: ${value}.`
            )
        }

        const parsed = new Date(
            `${value}T00:00:00.000Z`
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

    async buildSeasonPlayerImportRaw(season: number, playerId: string, forceFullReimport = false): Promise<PlayerImportRaw | undefined> {
        const players = await this.buildSeasonPlayerImports(season, undefined, forceFullReimport)
        return players.get(playerId)
    }

    clearSeasonImportCache(season?: number): void {
        if (season === undefined) {
            this.seasonImportCache.clear()
            return
        }

        for (const key of Array.from(this.seasonImportCache.keys())) {
            if (key.startsWith(`${season}:`)) {
                this.seasonImportCache.delete(key)
            }
        }
    }

    private getResultsFilePath(season: number): string {
        return path.join(this.baseDataDir, String(season), `_results.json`)
    }

    private normalizePlayerIds(filterPlayerIds?: Set<string>): string[] {
        if (!filterPlayerIds || filterPlayerIds.size === 0) return []
        return Array.from(filterPlayerIds).map(id => String(id).trim()).filter(id => !!id).sort((a, b) => a.localeCompare(b))
    }

    private samePlayerIds(a: string[], b: string[]): boolean {
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
        return true
    }

    private async readResultsFile(filePath: string): Promise<{ season: number, playerIds: string[], completedGamePks: number[], players: PlayerImportRaw[] } | undefined> {
        if (!await this.fileExists(filePath)) return undefined

        const data = await this.readJson(filePath)

        if (!data || !Array.isArray(data.players) || !Array.isArray(data.playerIds)) {
            return undefined
        }

        return {
            season: Number(data.season),
            playerIds: data.playerIds.map((id: unknown) => String(id)),
            completedGamePks: Array.isArray(data.completedGamePks)
                ? data.completedGamePks.map((gamePk: unknown) => Number(gamePk)).filter(Number.isFinite)
                : [],
            players: data.players
        }
    }

    private resultsFileToPlayerMap(players: PlayerImportRaw[]): Map<string, PlayerImportRaw> {
        const map = new Map<string, PlayerImportRaw>()
        for (const p of players) map.set(p.playerId, structuredClone(p))
        return map
    }

    private async writeResultsFile(filePath: string, season: number, playerIds: string[], players: Map<string, PlayerImportRaw>, completedGamePks: number[]): Promise<void> {
        const data = {
            season,
            playerIds,
            completedGamePks,
            generatedAt: new Date().toISOString(),
            players: Array.from(players.values())
        }

        await this.ensureDir(path.dirname(filePath))
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
    }

    private clonePlayerImportMap(players: Map<string, PlayerImportRaw>): Map<string, PlayerImportRaw> {
        const clone = new Map<string, PlayerImportRaw>()

        for (const [playerId, player] of players.entries()) {
            clone.set(playerId, structuredClone(player))
        }

        return clone
    }

    private finalizePlayerImportRaw(player: PlayerImportRaw): void {
        player.hitting.exitVelocity.avgExitVelo = player.hitting.exitVelocity.count > 0
            ? Number((player.hitting.exitVelocity.totalExitVelo / player.hitting.exitVelocity.count).toFixed(3))
            : 0

        for (const pitchTypeStat of Object.values(player.pitching.pitchTypes ?? {})) {
            if (!pitchTypeStat) continue

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

    private accumulateGameIntoSeasonPlayerImports(season: number, gamePk: number, gameData: any, players: Map<string, PlayerImportRaw>, filterPlayerIds?: Set<string>): void {
        return this.statAccumulatorService.accumulateGameIntoSeasonPlayerImports(season, gamePk, gameData, players, filterPlayerIds)
    }

    private async getSeasonGames(season: number): Promise<any[]> {
        const result = await this.getOrDownloadSchedule(season)
        const dates = result.data?.dates ?? []
        const games: any[] = []
        const seenGamePks = new Set<number>()

        for (const date of dates) {
            for (const game of date.games ?? []) {
                const gamePk = Number(game?.gamePk)
                if (!gamePk) continue
                if (seenGamePks.has(gamePk)) continue

                seenGamePks.add(gamePk)
                games.push(game)
            }
        }

        games.sort((a, b) => {
            const aDate = this.getGameDate(a) ?? ""
            const bDate = this.getGameDate(b) ?? ""

            if (aDate !== bDate) return aDate.localeCompare(bDate)

            const aGamePk = Number(a?.gamePk ?? 0)
            const bGamePk = Number(b?.gamePk ?? 0)

            return aGamePk - bGamePk
        })

        return games
    }


    private async getOrDownloadSchedule(season: number): Promise<{ data: any, downloaded: boolean }> {
        const filePath = this.getScheduleFilePath(season)
        const fileExists = await this.fileExists(filePath)

        if (fileExists) {
            const shouldRefresh = this.isCurrentSeason(season) &&
                !await this.isFileFresh(filePath, this.scheduleCacheMs)

            if (!shouldRefresh) {
                return {
                    data: await this.readJson(filePath),
                    downloaded: false
                }
            }
        }

        const data = await this.downloadSchedule(season)

        await this.ensureDir(path.dirname(filePath))
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")

        return {
            data,
            downloaded: true
        }
    }

    private async downloadSchedule(season: number): Promise<any> {
        const res = await this.api.getSchedule({
            params: {
                sportId: 1,
                startDate: `${season}-01-01`,
                endDate: `${season}-12-31`,
                gameTypes: "R"
            }
        })

        return res.data
    }

    private async getOrDownloadGame(season: number, gamePk: number, gameDate?: string, forceFullReimport = false): Promise<{ data: any, downloaded: boolean }> {
        const filePath = this.getGameFilePath(season, gamePk)

        if (!forceFullReimport && await this.fileExists(filePath)) {
            const cachedData = await this.readJson(filePath)

            if (this.isGameTerminal(cachedData)) {
                return {
                    data: cachedData,
                    downloaded: false
                }
            }

            if (gameDate && this.isFutureGameDate(gameDate)) {
                return {
                    data: cachedData,
                    downloaded: false
                }
            }
        }

        const data = await this.downloadGame(gamePk)

        await this.ensureDir(path.dirname(filePath))
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")

        return {
            data,
            downloaded: true
        }
    }

    private getScheduleFilePath(season: number): string {
        return path.join(this.baseDataDir, "schedule", `${season}.json`)
    }

    private getGameFilePath(season: number, gamePk: number): string {
        return path.join(this.baseDataDir, String(season), `${gamePk}.json`)
    }

    private getGameDate(game: any): string | undefined {
        return game?.officialDate ?? game?.gameDate?.slice(0, 10)
    }

    private isCurrentSeason(season: number): boolean {
        return season === new Date().getUTCFullYear()
    }

    private isFutureGameDate(gameDate: string): boolean {
        const game = new Date(`${gameDate}T00:00:00.000Z`)

        if (Number.isNaN(game.getTime())) return false

        const now = new Date()
        const todayUtc = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        )

        return game.getTime() > todayUtc
    }

    private isGameComplete(gameData: any): boolean {
        const abstractState = String(
            gameData?.gameData?.status?.abstractGameState ?? ""
        )

        const codedState = String(
            gameData?.gameData?.status?.codedGameState ?? ""
        )

        const detailedState = String(
            gameData?.gameData?.status?.detailedState ?? ""
        )

        return abstractState === "Final" ||
            codedState === "F" ||
            detailedState === "Final" ||
            detailedState === "Completed Early"
    }

    private isGameTerminal(gameData: any): boolean {
        if (this.isGameComplete(gameData)) return true

        const detailedState = String(
            gameData?.gameData?.status?.detailedState ?? ""
        ).toLowerCase()

        return detailedState.includes("cancelled") ||
            detailedState.includes("canceled") ||
            detailedState.includes("postponed")
    }

    private getGameStatus(gameData: any): string {
        return String(
            gameData?.gameData?.status?.detailedState ??
            gameData?.gameData?.status?.abstractGameState ??
            gameData?.gameData?.status?.codedGameState ??
            "unknown"
        )
    }

    private async isFileFresh(filePath: string, maxAgeMs: number): Promise<boolean> {
        const stat = await fs.promises.stat(filePath).catch(() => undefined)

        if (!stat?.isFile()) return false

        return Date.now() - stat.mtimeMs <= maxAgeMs
    }

    private async downloadGame(gamePk: number): Promise<any> {
        const res = await this.api.getGameFeed({
            pathParams: { gamePk },
            params: {
                hydrate: "credits,alignment,flags,officials"
            }
        })

        return res.data
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    private async readJson(filePath: string): Promise<any> {
        const text = await fs.promises.readFile(filePath, "utf8")
        return JSON.parse(text)
    }

    private async ensureDir(dirPath: string): Promise<void> {
        await fs.promises.mkdir(dirPath, { recursive: true })
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }




}

export {
    DownloaderService
}
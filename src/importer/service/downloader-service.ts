import fs from "fs"
import path from "path"
import MLBStatsAPI from "mlb-stats-api"
import {
    PlayerImportRaw
} from "../../sim/service/interfaces.js"
import { Handedness, PitchType, Position } from "../../sim/service/enums.js"
import { StatAccumulatorService } from "./stat-accumulator-service.js"

class DownloaderService {

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

    async downloadSeasonGames(season: number, onGame: (gamePk: number, data: any) => Promise<void>, forceFullReimport = false): Promise<void> {
        const games = await this.getSeasonGames(season)

        console.log(`Processing ${games.length} games for season ${season}`)

        for (let i = 0; i < games.length; i++) {
            const game = games[i]
            const gamePk = Number(game.gamePk)
            const gameDate = this.getGameDate(game)

            if (!gameDate) continue

            try {
                const result = await this.getOrDownloadGame(season, gamePk, gameDate, forceFullReimport)
                await onGame(gamePk, result.data)

                console.log(`Processed ${i + 1}/${games.length} (gamePk: ${gamePk}, date: ${gameDate})`)

                if (result.downloaded) {
                    await this.sleep(this.throttleMs)
                }

            } catch (err: any) {
                console.error(`Failed game ${gamePk}:`, err?.message ?? err)
            }
        }

        console.log(`Finished downloading season ${season}`)
    }

    async buildSeasonPlayerImports(season: number, filterPlayerIds?: Set<string>, forceFullReimport = false): Promise<Map<string, PlayerImportRaw>> {
        const effectiveFilterPlayerIds = filterPlayerIds && filterPlayerIds.size > 0
            ? filterPlayerIds
            : undefined

        const normalizedPlayerIds = this.normalizePlayerIds(effectiveFilterPlayerIds)
        const resultsFilePath = this.getResultsFilePath(season)

        if (!forceFullReimport) {
            const cachedResults = await this.readResultsFile(resultsFilePath)
            if (cachedResults && this.samePlayerIds(cachedResults.playerIds, normalizedPlayerIds)) {
                return this.resultsFileToPlayerMap(cachedResults.players)
            }
        }

        const cacheKey = this.getSeasonCacheKey(season, forceFullReimport)

        if (!effectiveFilterPlayerIds && this.seasonImportCache.has(cacheKey)) {
            const cached = this.clonePlayerImportMap(this.seasonImportCache.get(cacheKey)!)
            await this.writeResultsFile(resultsFilePath, season, normalizedPlayerIds, cached)
            return cached
        }

        if (effectiveFilterPlayerIds) {
            const fullSeasonCacheKey = this.getSeasonCacheKey(season, false)

            if (!forceFullReimport && this.seasonImportCache.has(fullSeasonCacheKey)) {
                const filtered = this.filterPlayerImportMap(this.seasonImportCache.get(fullSeasonCacheKey)!, effectiveFilterPlayerIds)
                await this.writeResultsFile(resultsFilePath, season, normalizedPlayerIds, filtered)
                return filtered
            }
        }

        const players = new Map<string, PlayerImportRaw>()

        await this.downloadSeasonGames(season, async (gamePk, data) => {
            this.accumulateGameIntoSeasonPlayerImports(season, gamePk, data, players, effectiveFilterPlayerIds)
        }, forceFullReimport)

        for (const player of players.values()) {
            this.finalizePlayerImportRaw(player)
        }

        if (!effectiveFilterPlayerIds) {
            this.seasonImportCache.set(cacheKey, this.clonePlayerImportMap(players))
        }

        const result = this.clonePlayerImportMap(players)
        await this.writeResultsFile(resultsFilePath, season, normalizedPlayerIds, result)

        return result
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

    private async readResultsFile(filePath: string): Promise<{ season: number, playerIds: string[], players: PlayerImportRaw[] } | undefined> {
        if (!await this.fileExists(filePath)) return undefined
        const data = await this.readJson(filePath)
        if (!data || !Array.isArray(data.players) || !Array.isArray(data.playerIds)) return undefined
        return { season: Number(data.season), playerIds: data.playerIds, players: data.players }
    }

    private resultsFileToPlayerMap(players: PlayerImportRaw[]): Map<string, PlayerImportRaw> {
        const map = new Map<string, PlayerImportRaw>()
        for (const p of players) map.set(p.playerId, structuredClone(p))
        return map
    }

    private async writeResultsFile(filePath: string, season: number, playerIds: string[], players: Map<string, PlayerImportRaw>): Promise<void> {
        const data = { season, playerIds, players: Array.from(players.values()) }
        await this.ensureDir(path.dirname(filePath))
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
    }

    private getSeasonCacheKey(season: number, forceFullReimport: boolean): string {
        return `${season}:${forceFullReimport ? "force" : "normal"}`
    }

    private clonePlayerImportMap(players: Map<string, PlayerImportRaw>): Map<string, PlayerImportRaw> {
        const clone = new Map<string, PlayerImportRaw>()

        for (const [playerId, player] of players.entries()) {
            clone.set(playerId, structuredClone(player))
        }

        return clone
    }

    private filterPlayerImportMap(players: Map<string, PlayerImportRaw>, filterPlayerIds: Set<string>): Map<string, PlayerImportRaw> {
        const filtered = new Map<string, PlayerImportRaw>()

        for (const playerId of filterPlayerIds) {
            const player = players.get(playerId)
            if (player) {
                filtered.set(playerId, structuredClone(player))
            }
        }

        return filtered
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

    private mapHandedness(code?: string): Handedness {
        switch (code) {
            case "L":
                return Handedness.L
            case "S":
                return Handedness.S
            default:
                return Handedness.R
        }
    }

    private async getOrDownloadSchedule(season: number): Promise<{ data: any, downloaded: boolean }> {
        const filePath = this.getScheduleFilePath(season)

        if (await this.fileExists(filePath)) {
            return {
                data: await this.readJson(filePath),
                downloaded: false
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
        const shouldRefresh = !forceFullReimport && this.shouldRefreshRecentGame(gameDate)

        if (!forceFullReimport && !shouldRefresh && await this.fileExists(filePath)) {
            return {
                data: await this.readJson(filePath),
                downloaded: false
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

    private shouldRefreshRecentGame(gameDate?: string): boolean {
        if (!gameDate) return false

        const today = new Date()
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

        const game = new Date(`${gameDate}T00:00:00Z`)
        if (Number.isNaN(game.getTime())) return false

        const gameUtc = Date.UTC(game.getUTCFullYear(), game.getUTCMonth(), game.getUTCDate())
        const diffDays = Math.floor((todayUtc - gameUtc) / (24 * 60 * 60 * 1000))

        return diffDays >= 0 && diffDays <= 5
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
import fs from "fs"
import path from "path"


interface CachedResponse<T> {
    downloadedAt: string
    data: T
}


class DownloaderService {

    public constructor(
        private readonly baseDataDir: string,
        private readonly cacheMs: number
    ) {}

    public async readOrDownloadShared<T>(relativePath: string, download: () => Promise<T>): Promise<T> {
        const filePath = path.join(
            this.baseDataDir,
            relativePath
        )

        if (await this.isFresh(filePath)) {
            return await this.readCached<T>(
                filePath
            )
        }

        const data = await download()

        await this.writeCached(
            filePath,
            data
        )

        return data
    }

    private async isFresh(filePath: string): Promise<boolean> {
        const stat = await fs.promises.stat(
            filePath
        ).catch(() => undefined)

        if (!stat?.isFile()) {
            return false
        }

        const ageMs = Date.now() - stat.mtimeMs

        return ageMs <= this.cacheMs
    }

    private async readCached<T>(filePath: string): Promise<T> {
        const raw = JSON.parse(
            await fs.promises.readFile(
                filePath,
                "utf8"
            )
        ) as CachedResponse<T>

        return raw.data
    }

    private async writeCached<T>(filePath: string, data: T): Promise<void> {
        await fs.promises.mkdir(
            path.dirname(filePath),
            {
                recursive: true
            }
        )

        const payload: CachedResponse<T> = {
            downloadedAt: new Date().toISOString(),
            data
        }

        await fs.promises.writeFile(
            filePath,
            JSON.stringify(payload, null, 2),
            "utf8"
        )
    }

}


export {
    DownloaderService
}
declare class DownloaderService {
    private readonly baseDataDir;
    private readonly cacheMs;
    constructor(baseDataDir: string, cacheMs: number);
    readOrDownloadShared<T>(relativePath: string, download: () => Promise<T>): Promise<T>;
    private isFresh;
    private readCached;
    private writeCached;
}
export { DownloaderService };

interface SimVersion {
    version: number;
    hash: string;
}
declare class SimVersionService {
    private readonly dataDir;
    private readonly season;
    private readonly games;
    private readonly rootDir;
    constructor(dataDir: string);
    generate(): SimVersion;
    read(): SimVersion | undefined;
    private getPitchEnvironment;
    private hashGame;
    private hash;
    private readPackageJson;
    private writePackageJson;
    private getPackageJsonPath;
}
export type { SimVersion };
export { SimVersionService };

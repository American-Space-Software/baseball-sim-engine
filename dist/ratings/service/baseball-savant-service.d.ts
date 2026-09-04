import type { StadiumEnvironment } from "baseball-sim-engine";
import { DownloaderService } from "./downloader-service.js";
import type { MlbTeam } from "./mlb-roster-service.js";
declare class BaseballSavantService {
    private readonly downloaderService;
    constructor(downloaderService: DownloaderService);
    getParkFactorPage(season: number, rollingYears?: number): Promise<string>;
    getParkFactors(season: number, rollingYears?: number): Promise<BaseballSavantParkFactor[]>;
    getStadiumEnvironment(venueId: string | number, season: number, rollingYears?: number): Promise<StadiumEnvironment | undefined>;
    getStadiumEnvironments(season: number, teams: MlbTeam[], rollingYears?: number): Promise<StadiumEnvironment[]>;
    parseParkFactors(html: string): BaseballSavantParkFactor[];
    private parseParkFactor;
    private createStadiumEnvironment;
    private getNumber;
}
interface BaseballSavantParkFactor {
    venueId: string;
    venueName: string;
    teamId: string;
    teamName: string;
    yearRange: string;
    season: number;
    rollingYears: number;
    plateAppearances: number;
    parkFactor: number;
    runs: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    walks: number;
    strikeouts: number;
}
export { BaseballSavantService };
export type { BaseballSavantParkFactor };

import { PlayerStatRepository } from "../repository/player-stat-repository.js";
import { StatService } from "../../sim/service/stat-service.js";
import { HitterStatLine, PitcherStatLine } from "../../sim/service/interfaces.js";
declare class PlayerStatService {
    private readonly statService;
    private readonly playerStatRepository;
    constructor(statService: StatService, playerStatRepository: PlayerStatRepository);
    getStats(endDateExclusive: string, filterPlayerIds?: Set<string>): Map<string, PlayerStats>;
    getCareerHitterStats(playerId: string, endDateExclusive: string): HitterStatLine;
    getCareerPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine;
    getSeasonHitterStats(playerId: string, endDateExclusive: string): HitterStatLine[];
    getSeasonPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine[];
    private getSeasonAge;
    private aggregateRows;
    private toHitterStatLine;
    private toPitcherStatLine;
}
interface HitterSeasonStats {
    season: number;
    age?: number;
    teamId?: number;
    teamAbbrev?: string;
    stats: HitterStatLine;
}
interface PitcherSeasonStats {
    season: number;
    age?: number;
    teamId?: number;
    teamAbbrev?: string;
    stats: PitcherStatLine;
}
interface PlayerStats {
    careerHitterStats: HitterStatLine;
    careerPitcherStats: PitcherStatLine;
    currentSeasonHitterStats?: HitterStatLine;
    currentSeasonPitcherStats?: PitcherStatLine;
    seasonHitterStats: HitterSeasonStats[];
    seasonPitcherStats: PitcherSeasonStats[];
}
export { PlayerStatService };
export type { HitterSeasonStats, PitcherSeasonStats, PlayerStats };

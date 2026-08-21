import { HitterStatLine, PitcherStatLine, StatService } from "../../sim/index.js";
import { PlayerStatRepository } from "../repository/player-stat-repository.js";
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
    stats: HitterStatLine;
}
interface PitcherSeasonStats {
    season: number;
    age?: number;
    stats: PitcherStatLine;
}
interface PlayerStats {
    careerHitterStats: HitterStatLine;
    careerPitcherStats: PitcherStatLine;
    seasonHitterStats: HitterSeasonStats[];
    seasonPitcherStats: PitcherSeasonStats[];
}
export { PlayerStatService };
export type { HitterSeasonStats, PitcherSeasonStats, PlayerStats };

import { HitterStatLine, PitcherStatLine, StatService } from "../../sim/index.js";
import { PlayerStatRepository } from "../repository/player-stat-repository.js";
declare class PlayerStatService {
    private readonly statService;
    private readonly playerStatRepository;
    constructor(statService: StatService, playerStatRepository: PlayerStatRepository);
    getCareerHitterStats(playerId: string, endDateExclusive: string): HitterStatLine;
    getCareerPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine;
    getSeasonHitterStats(playerId: string, endDateExclusive: string): HitterStatLine[];
    getSeasonPitcherStats(playerId: string, endDateExclusive: string): PitcherStatLine[];
    private toHitterStatLine;
    private toPitcherStatLine;
}
export { PlayerStatService };

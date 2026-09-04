import { TeamRatingRepository } from "../repository/team-rating-repository.js";
import type { TeamRatingSnapshot } from "../repository/team-rating-repository.js";
declare const GLICKO_SETTINGS: {
    tau: number;
    rating: number;
    rd: number;
    vol: number;
};
declare class TeamRatingService {
    private readonly teamRatingRepository;
    constructor(teamRatingRepository: TeamRatingRepository);
    getRatingsForDate(gameDate: string): Promise<TeamRatingSnapshot>;
    private updateRatingPeriod;
    private getOrCreatePlayer;
    private getCompletedDates;
    private getTeamIds;
    private createDefaultRatings;
    private createDefaultRating;
    private isCompletedGameWithScore;
    private addDays;
    private validateDate;
}
export { GLICKO_SETTINGS, TeamRatingService };

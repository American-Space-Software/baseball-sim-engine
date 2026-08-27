import { Position } from "../../sim/service/enums.js";
import type { Lineup, PitchingRole, Player, RotationPitcher, Team } from "../../sim/service/interfaces.js";
import { MlbRosterService } from "./mlb-roster-service.js";
import { PitcherWorkloadService } from "./pitcher-workload-service.js";
import type { MlbRosterEntry, MlbTeam } from "./mlb-roster-service.js";
import type { GeneratedPlayerRatings } from "./player-rating-service.js";
declare class GameLineupService {
    private readonly mlbRosterService;
    private readonly pitcherWorkloadService;
    private readonly providers;
    constructor(mlbRosterService: MlbRosterService, pitcherWorkloadService: PitcherWorkloadService);
    build(gameDate: string, mlbTeam: MlbTeam, roster: MlbRosterEntry[], ratings: Map<string, GeneratedPlayerRatings>, gamePk?: number | string): Promise<TeamBundle>;
    getRoster(gameDate: string, mlbTeam: MlbTeam, gamePk?: number | string): Promise<MlbRosterEntry[]>;
    buildPlayer(gameDate: string, entry: MlbRosterEntry, rated: GeneratedPlayerRatings): Player;
    private addConfirmedGamePlayersToRoster;
    private getConfirmedRosterPosition;
    private applyPitcherAvailability;
    private getAvailableBullpenPitchCount;
    private getRoleMaxPitchCount;
    private getAvailablePitchers;
    private normalizeBullpenPriorities;
    private validate;
    private getGameForTeam;
    private getTeamSide;
    private getStartingPitcherId;
    private getAge;
    private getAverageHittingRating;
    private getAveragePitchingRating;
    private toHandedness;
    private isPitcher;
    private getErrorMessage;
}
declare abstract class BaseGameLineupProvider implements GameLineupProvider {
    private readonly bullpenResolver;
    constructor(bullpenResolver: BullpenResolver);
    abstract readonly name: string;
    abstract build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>;
    protected buildTeamBundle(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], lineup: Lineup, startingPitcherId: string, lineupSource: GameLineupSource): Promise<TeamBundle>;
    protected buildStartingPitcher(players: Player[], startingPitcherId: string): RotationPitcher | undefined;
    protected findReplacement(players: Player[], used: Set<string>, position: Position): Player | undefined;
    protected findBestPositionPlayer(players: Player[], used: Set<string>, position: Position): Player | undefined;
    protected isPitcher(player: Player): boolean;
    protected playerCanPlay(player: Player, position: Position): boolean;
    protected getPositionFitScore(player: Player, position: Position): number;
    protected addDays(gameDate: string, days: number): string;
    protected isOutfieldPosition(position: Position): boolean;
    protected toPosition(value: string | undefined): Position | undefined;
    protected getScheduleGameForTeam(gameDate: string, teamId: number): any | undefined;
    protected getGameFeed(gamePk: number | string): any | undefined;
    protected getTeamSide(feed: any, teamId: number): "home" | "away";
    protected getStartingPitcherIdFromFeed(feed: any, side: "home" | "away"): string | undefined;
    protected getLineupFromFeed(feed: any, side: "home" | "away"): Lineup;
    protected getStartingPosition(boxscorePlayer: any, usedPositions: Set<Position>): Position | undefined;
    private getAvailableOutfieldPosition;
}
declare class ConfirmedGameLineupProvider extends BaseGameLineupProvider {
    readonly name = "confirmed";
    build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>;
}
declare class ProjectedGameLineupProvider extends BaseGameLineupProvider {
    readonly name = "projected";
    build(_gameDate: string, _mlbTeam: MlbTeam, _team: Team, _players: Player[], _gamePk?: number | string): Promise<TeamBundle | undefined>;
}
declare class PreviousSimilarGameLineupProvider extends BaseGameLineupProvider {
    readonly name = "previous-similar";
    build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>;
    private getPreviousUsableLineupAgainstHand;
    private getPreviousGames;
    private getPitcherHandFromFeed;
    private repairLineup;
}
declare class FallbackGameLineupProvider extends BaseGameLineupProvider {
    readonly name = "fallback";
    build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], _gamePk?: number | string): Promise<TeamBundle | undefined>;
    private getMostConstrainedPosition;
    private getPositionPriority;
    private defensivePositions;
}
interface PitchingRoleWithWorkload extends PitchingRole {
    pitchesYesterday: number;
    pitchesLastThreeDays: number;
    pitchesLastFiveDays: number;
}
type BullpenResolver = (gameDate: string, mlbTeam: MlbTeam, players: Player[], startingPitcherId: string) => Promise<PitchingRole[]>;
interface GameLineupProvider {
    readonly name: string;
    build(gameDate: string, mlbTeam: MlbTeam, team: Team, players: Player[], gamePk?: number | string): Promise<TeamBundle | undefined>;
}
type GameLineupSource = "confirmed" | "projected" | "previous" | "fallback";
interface TeamBundle {
    team: Team;
    players: Player[];
    lineup: Lineup;
    startingPitcher: RotationPitcher;
    availablePitchers: PitchingRole[];
    lineupSource: GameLineupSource;
}
export { ConfirmedGameLineupProvider, FallbackGameLineupProvider, GameLineupService, PreviousSimilarGameLineupProvider, ProjectedGameLineupProvider };
export type { GameLineupProvider, GameLineupSource, PitchingRoleWithWorkload, TeamBundle };

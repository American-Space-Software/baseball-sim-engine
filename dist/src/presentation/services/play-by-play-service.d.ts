import { PitchType } from "../../sim/service/enums.js";
import type { Game, Pitch, Play } from "../../sim/service/interfaces.js";
declare class PlayByPlayService {
    getPlayDescriptions(game: Game, play: Play): PlayDescription[];
    getPlayByPlay(game: Game): PlayByPlayEntry[];
    getGameStartDescriptions(game: Game): PlayDescription[];
    getInningStartDescriptions(play: Play): PlayDescription[];
    private getGameRecapDescriptions;
    private getPlayResultDescription;
    private getMatchupDescription;
    private getPitchDescription;
    private getRunnerRecapDescription;
    private getRunnerDescription;
    private getSubstitutionDescriptions;
    private getLineupSubstitutionText;
    private getLineupSubstitutionTextWithoutOutgoingPlayer;
    private getSubstitutionDescriptionSeed;
    private getRunnersPhrase;
    private describeZoneNeutral;
    private describeZoneOffPlate;
    private getContactDescription;
    private getContactDescriptionOut;
    private getShallowDeepDescription;
    private getPositionDescription;
    private getPositionDescriptionNoun;
    getPitchTypeFull(pitchType: PitchType): string;
    private getGamePlayers;
    private getTeamName;
    private isBatterRunnerPrimaryEvent;
    private isGameEndingPlay;
    private isHit;
    private isToOF;
    private getOutsPhrase;
    private ordinal;
    private hash;
    private pick;
    private pickSubstitutionText;
    private tidy;
}
interface PlayDescription {
    type: PlayDescriptionType;
    text: string;
    meta?: {
        pitch?: Pitch;
    };
}
interface PlayByPlayEntry {
    descriptions: PlayDescription[];
    play: Play;
}
declare enum PlayDescriptionType {
    RECAP = "RECAP",
    RESULT = "RESULT",
    SUBSTITUTION = "SUBSTITUTION"
}
export { PlayByPlayService, PlayDescription, PlayByPlayEntry, PlayDescriptionType };

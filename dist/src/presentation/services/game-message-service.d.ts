interface GameMessage {
    text: string;
    type: string;
}
interface GameMessageSync {
    clear: boolean;
    messages: GameMessage[];
}
declare class GameMessageService {
    getSync(existingMessages: GameMessage[], allMessages: GameMessage[]): GameMessageSync;
    getNewMessages(existingMessages: GameMessage[], allMessages: GameMessage[]): GameMessage[];
    private isSameMessage;
}
export { GameMessageService };
export type { GameMessage, GameMessageSync };

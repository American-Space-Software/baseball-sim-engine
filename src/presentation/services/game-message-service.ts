interface GameMessage {
    text: string
    type: string
}

interface GameMessageSync {
    clear: boolean
    messages: GameMessage[]
}


class GameMessageService {

    public getSync(existingMessages: GameMessage[], allMessages: GameMessage[]): GameMessageSync {
        const clear = existingMessages.length > 0 && !this.isSameMessage(existingMessages[0], allMessages[0])

        return {
            clear,
            messages: clear ? allMessages : this.getNewMessages(existingMessages, allMessages)
        }
    }

    public getNewMessages(existingMessages: GameMessage[], allMessages: GameMessage[]): GameMessage[] {
        let index = 0

        while (index < existingMessages.length && index < allMessages.length && this.isSameMessage(existingMessages[index], allMessages[index])) {
            index++
        }

        return allMessages.slice(index)
    }

    private isSameMessage(first?: GameMessage, second?: GameMessage): boolean {
        return Boolean(first && second && first.text === second.text && first.type === second.type)
    }

}


export {
    GameMessageService
}


export type {
    GameMessage,
    GameMessageSync
}
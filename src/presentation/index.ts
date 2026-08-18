import { PlayByPlayEntry, PlayByPlayService, PlayDescription, PlayDescriptionType } from "./services/play-by-play-service.js"

const playByPlayService = new PlayByPlayService()


export {
    playByPlayService,
    PlayByPlayService, 
    PlayDescription, 
    PlayByPlayEntry, 
    PlayDescriptionType
}
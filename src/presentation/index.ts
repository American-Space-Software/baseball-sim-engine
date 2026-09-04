import {
    PlayByPlayService,
    PlayDescriptionType
} from "./services/play-by-play-service.js"

import type {
    PlayByPlayEntry,
    PlayDescription
} from "./services/play-by-play-service.js"

import {
    AtBatState,
    GameViewService,
    GameWebService
} from "./services/game-web-service.js"

import type {
    GameBoxscoreViewModel,
    GameLineScoreViewModel,
    GameTeamLineScoreViewModel,
    GameViewModel
} from "./services/game-web-service.js"

import {
    BoxscoreService
} from "./services/boxscore-service.js"

import type {
    BoxscoreInfoViewModel,
    BoxscorePlayerRow,
    BoxscoreStatSummary
} from "./services/boxscore-service.js"

import {
    GameMessageService
} from "./services/game-message-service.js"

import type {
    GameMessage,
    GameMessageSync
} from "./services/game-message-service.js"

import {
    GamePlaybackService
} from "./services/game-playback-service.js"

import type {
    GamePlaybackComplete,
    GamePlaybackOptions,
    GamePlaybackState,
    GamePlaybackUpdate
} from "./services/game-playback-service.js"


import {
    TeamComponentService
} from "./services/team-component-service.js"

import LineScoreComponent from "./components/linescore.f7.html"
import GameLogComponent from "./components/gamelog.f7.html"
import GameStateComponent from "./components/game-state.f7.html"
import BoxscoreComponent from "./components/boxscore.f7.html"
import GameInProgressComponent from "./components/full-in-progress.f7.html"


const playByPlayService = new PlayByPlayService()
const gameWebService = new GameWebService(playByPlayService)
const gameViewService = new GameViewService(playByPlayService)
const gameMessageService = new GameMessageService()
const boxscoreService = new BoxscoreService()
const teamComponentService = new TeamComponentService()


export {
    playByPlayService,
    gameWebService,
    gameViewService,
    gameMessageService,
    boxscoreService,
    teamComponentService,

    PlayByPlayService,
    PlayDescriptionType,

    AtBatState,
    GameViewService,
    GameWebService,

    BoxscoreService,
    GameMessageService,
    GamePlaybackService,
    TeamComponentService,

    LineScoreComponent,
    GameLogComponent,
    GameStateComponent,
    BoxscoreComponent,
    GameInProgressComponent
}


export type {
    PlayByPlayEntry,
    PlayDescription,

    GameBoxscoreViewModel,
    GameLineScoreViewModel,
    GameTeamLineScoreViewModel,
    GameViewModel,

    BoxscoreInfoViewModel,
    BoxscorePlayerRow,
    BoxscoreStatSummary,

    GameMessage,
    GameMessageSync,

    GamePlaybackComplete,
    GamePlaybackOptions,
    GamePlaybackState,
    GamePlaybackUpdate
}
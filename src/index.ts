import { BaseResult, Contact, Handedness, HomeAway, OfficialPlayResult, OfficialRunnerResult, PitchCall, PitchType, PitchZone, PlayResult, Position, ShallowDeep, ThrowResult } from "./service/enums.js"
import { InningEndingEvent, LeagueAverage } from "./service/interfaces.js"
import { PlayerImporterService } from "../test/service/player-importer-service.js"
import { RollChartService } from "./service/roll-chart-service.js"
import { GameInfo, GamePlayers, Matchup, RunnerActions, SimRolls, SimService } from "./service/sim-service.js"

import { StatService } from "./service/stat-service.js"

let rollChartService = new RollChartService()
let statService = new StatService()


let simRolls = new SimRolls(rollChartService)
let gamePlayers = new GamePlayers(rollChartService)
let runnerActions = new RunnerActions(rollChartService, simRolls)
let gameInfo = new GameInfo(gamePlayers)
        

let defaultLeagueAverage = {} as LeagueAverage
let simService = new SimService(rollChartService, simRolls, runnerActions, gameInfo, defaultLeagueAverage)


export {
  simService,
  SimService,
  StatService,
  RollChartService,
  PlayerImporterService,
  PlayResult,
  Contact,
  ShallowDeep,
  PitchZone,
  PitchCall,
  PitchType,
  BaseResult,
  Handedness,
  Position,
  OfficialPlayResult,
  OfficialRunnerResult,
  ThrowResult,
  HomeAway,
  InningEndingEvent,
}

export {
  AtBatInfo,
  Rolls,
  PlayerChange
} from "./service/sim-service.js"


export type {
  StartGameCommand,
  ThrowRoll,
  DefensiveCredit,
  PitchEnvironmentTarget,
  Game,
  Player,
  TeamInfo,
  Team,  
  LastPlay,
  UpcomingMatchup,
  LeagueAverage,
  Lineup,
  LineupPlayer,
  RotationPitcher,
  HalfInning,
  RunnerResult,
  Score,
  Pitch,
  RunnerEvent,
  Play,
  Count,
  PitcherChange,
  HitterChange,
  PitchResultCount,
  HitResultCount,
  MatchupHandedness,
  GamePlayer,
  GamePlayerBio,
  HitterStatLine,
  PitcherStatLine,
  Colors,
  ContactProfile,
  PitchRatings,
  PitchingHandednessRatings,
  HittingRatings,
  HittingHandednessRatings,
  RollChart,
  ContactTypeRollInput,
  FielderChanceRollInput,
  ShallowDeepRollInput,
  HitterHandednessRollInput,
  PitcherHandednessRollInput,
  PowerRollInput,
  ShallowDeepChance,
  FielderChance,
  PlayerFromStatsCommand,
  PlayerHittingStats,
  PlayerPitchingStats,
  PlayerFieldingStats,
  PlayerRunningStats,
  PlayerSplitsStats,
  PlayerHittingSplitStats,
  PlayerPitchingSplitStats,
  PlayerImportBaseline,
  PlayerImportRaw,
  PitchEnvironmentTuning,
} from "./service/interfaces.js"
import { BaseResult, Contact, Handedness, HomeAway, OfficialPlayResult, OfficialRunnerResult, PitchCall, PitchingRoleType, PitchType, PitchZone, PlayResult, Position, ShallowDeep, ThrowResult } from "./service/enums.js"
import { InningEndingEvent, PitchEnvironmentTarget, PitchingRole, RatingTuning } from "./service/interfaces.js"
import { PitchEnvironmentService } from "../importer/service/pitch-environment-service.js"
import { RollChartService } from "./service/roll-chart-service.js"
import { GameInfo, GamePlayers, Matchup, SimRolls, SimService } from "./service/sim-service.js"

import { StatService } from "./service/stat-service.js"


import defaultPitchEnvironmentTargetJson from "../../data/2025/_pitch_environment_target.json" with { type: "json" }
import { RunnerService } from "./service/runner-service.js"
import { SubstitutionService } from "./service/substitution-service.js"

let rollChartService = new RollChartService()
let statService = new StatService()


let simRolls = new SimRolls(rollChartService)
let gamePlayers = new GamePlayers()
let runnerService = new RunnerService(simRolls)
let gameInfo = new GameInfo(gamePlayers)
let substitutionService = new SubstitutionService()
        

let defaultPitchEnvironmentTarget = defaultPitchEnvironmentTargetJson as unknown as PitchEnvironmentTarget
let simService = new SimService(rollChartService, simRolls, runnerService, gameInfo, substitutionService, defaultPitchEnvironmentTarget)


export {
  simService,
  SimService,
  StatService,
  RollChartService,
  PitchEnvironmentService,
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
  PitchingRoleType,
  GameInfo
}

export {
  AtBatInfo,
  Rolls,
  PlayerChange
} from "./service/sim-service.js"


export type {
  StartGameCommand,
  PitchingRole,
  ThrowRoll,
  DefensiveCredit,
  PitchEnvironmentTarget,
  Game,
  Player,
  TeamInfo,
  Team,  
  LastPlay,
  UpcomingMatchup,
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
  PlayerImportRaw,
  PitchEnvironmentTuning,
  RatingTuning
} from "./service/interfaces.js"
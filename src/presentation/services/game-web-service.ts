import {
    Handedness,
    PitchCall,
    Position
} from "../../sim/service/enums.js"

import type {
    Game,
    GamePlayer,
    MatchupHandedness,
    Pitch,
    Play
} from "../../sim/service/interfaces.js"

import {
    PlayByPlayService,
    PlayDescriptionType
} from "./play-by-play-service.js"

import type {
    PlayByPlayEntry,
    PlayDescription
} from "./play-by-play-service.js"


class GameWebService {

    public constructor(private readonly playByPlayService: PlayByPlayService) {}

    public getGameViewModel(game: Game): GameViewModel {
        const linescore = this.getLineScore(game)

        const awayBoxscore: GameBoxscoreViewModel = {
            side: "AWAY",
            team: game.away,
            isComplete: game.isComplete,
            isTopInning: game.isTopInning
        }

        const homeBoxscore: GameBoxscoreViewModel = {
            side: "HOME",
            team: game.home,
            isComplete: game.isComplete,
            isTopInning: game.isTopInning
        }

        const viewModel: GameViewModel = {
            game,
            linescore,
            awayBoxscore,
            homeBoxscore,
            atBatBoxscore: game.isTopInning ? awayBoxscore : homeBoxscore,
            isTopInning: game.isTopInning,
            currentInning: game.currentInning,
            balls: game.count?.balls ?? 0,
            strikes: game.count?.strikes ?? 0,
            outs: game.count?.outs ?? 0,
            score: game.score,
            showHitter: false,
            showPitcher: false
        }

        if (!game.isStarted) {
            return viewModel
        }

        const players = this.getGamePlayers(game)
        const offense = this.getOffense(game)
        const defense = this.getDefense(game)
        const currentPlay = this.getCurrentPlay(game)
        const hitter = this.getHitter(game, currentPlay)
        const pitcher = this.getPitcher(game)

        const runner1B = this.getPlayer(players, offense.runner1BId)
        const runner2B = this.getPlayer(players, offense.runner2BId)
        const runner3B = this.getPlayer(players, offense.runner3BId)

        const winningPitcher = game.isComplete ? this.getPlayer(players, game.winningPitcherId) : undefined
        const losingPitcher = game.isComplete ? this.getPlayer(players, game.losingPitcherId) : undefined

        const catcher = this.getDefender(defense, Position.CATCHER)
        const firstBase = this.getDefender(defense, Position.FIRST_BASE)
        const secondBase = this.getDefender(defense, Position.SECOND_BASE)
        const thirdBase = this.getDefender(defense, Position.THIRD_BASE)
        const shortstop = this.getDefender(defense, Position.SHORTSTOP)
        const leftField = this.getDefender(defense, Position.LEFT_FIELD)
        const centerField = this.getDefender(defense, Position.CENTER_FIELD)
        const rightField = this.getDefender(defense, Position.RIGHT_FIELD)

        return {
            ...viewModel,
            runner1B,
            runner2B,
            runner3B,
            hitter,
            pitcher,
            awayPlayer: game.isTopInning ? hitter : pitcher,
            homePlayer: game.isTopInning ? pitcher : hitter,
            matchupHandedness: hitter && pitcher ? this.getMatchupHandedness(hitter, pitcher) : undefined,
            defense,
            catcher,
            firstBase,
            secondBase,
            thirdBase,
            shortstop,
            leftField,
            centerField,
            rightField,
            winningPitcher,
            losingPitcher,
            showHitter: hitter !== undefined,
            showPitcher: pitcher !== undefined
        }
    }

    public getLineScore(game: Game): GameLineScoreViewModel {
        const inningCount = Math.max(9, game.currentInning)
        const awayInnings = Array<number | undefined>(inningCount).fill(undefined)
        const homeInnings = Array<number | undefined>(inningCount).fill(undefined)

        let awayHits = 0
        let homeHits = 0
        let awayErrors = 0
        let homeErrors = 0

        for (const halfInning of game.halfInnings ?? []) {
            const inningIndex = halfInning.num - 1
            const runs = halfInning.linescore?.runs ?? 0
            const hits = halfInning.linescore?.hits ?? 0
            const errors = halfInning.linescore?.errors ?? 0

            if (halfInning.top) {
                awayInnings[inningIndex] = runs
                awayHits += hits
                awayErrors += errors
            } else {
                homeInnings[inningIndex] = runs
                homeHits += hits
                homeErrors += errors
            }
        }

        return {
            currentInning: game.currentInning,
            isTopInning: game.isTopInning,
            isComplete: game.isComplete,
            away: {
                name: game.away.abbrev,
                innings: awayInnings,
                runs: game.score.away,
                hits: awayHits,
                errors: awayErrors
            },
            home: {
                name: game.home.abbrev,
                innings: homeInnings,
                runs: game.score.home,
                hits: homeHits,
                errors: homeErrors
            }
        }
    }

    public getCurrentDescriptions(game: Game): PlayDescription[] {
        const descriptions: PlayDescription[] = []
        const atBatState = this.getAtBatState(game)
        const play = atBatState === AtBatState.ENDED ? this.getLastPlay(game) : this.getCurrentPlay(game)

        if ((game.halfInnings?.length ?? 0) === 0) {
            descriptions.push(...this.playByPlayService.getGameStartDescriptions(game))
        } else if (play && this.isFirstPlayOfHalfInning(game, play)) {
            descriptions.push(...this.playByPlayService.getInningStartDescriptions(play))
        }

        if (play) {
            descriptions.push(...this.playByPlayService.getPlayDescriptions(game, play))
        }

        return descriptions
    }

    public getPlayByPlay(game: Game): PlayByPlayEntry[] {
        return this.playByPlayService.getPlayByPlay(game)
    }

    public getAtBatState(game: Game): AtBatState | undefined {
        const currentPlay = this.getCurrentPlay(game)

        if (currentPlay) {
            return (currentPlay.pitchLog?.pitches?.length ?? 0) > 0 ? AtBatState.ONGOING : AtBatState.STARTED
        }

        if (this.getLastPlay(game)?.result !== undefined) {
            return AtBatState.ENDED
        }

        return undefined
    }

    public getCurrentPlay(game: Game): Play | undefined {
        const plays = this.getPlays(game)

        for (let index = plays.length - 1; index >= 0; index--) {
            if (plays[index].result === undefined) {
                return plays[index]
            }
        }

        return undefined
    }

    public getLastPlay(game: Game): Play | undefined {
        const plays = this.getPlays(game)

        for (let index = plays.length - 1; index >= 0; index--) {
            if (plays[index].result !== undefined) {
                return plays[index]
            }
        }

        return undefined
    }

    public getPlays(game: Game): Play[] {
        return (game.halfInnings ?? []).flatMap(halfInning => halfInning.plays ?? [])
    }

    public getGamePlayers(game: Game): Record<string, GamePlayer> {
        const players: Record<string, GamePlayer> = {}

        for (const player of [...game.away.players, ...game.home.players]) {
            players[player._id] = player
        }

        return players
    }

    public getOffense(game: Game): GameTeam {
        return game.isTopInning ? game.away : game.home
    }

    public getDefense(game: Game): GameTeam {
        return game.isTopInning ? game.home : game.away
    }

    public getHitter(game: Game, currentPlay = this.getCurrentPlay(game)): GamePlayer | undefined {
        if (game.isComplete || !currentPlay) {
            return undefined
        }

        return this.getGamePlayers(game)[currentPlay.hitterId]
    }

    public getPitcher(game: Game): GamePlayer | undefined {
        if (game.isComplete) {
            return undefined
        }

        const defense = this.getDefense(game)

        return defense.players.find(player => player._id === defense.currentPitcherId)
    }

    public getMatchupHandedness(hitter: GamePlayer, pitcher: GamePlayer): MatchupHandedness {
        const hits = hitter.hits === Handedness.S ? pitcher.throws === Handedness.L ? Handedness.R : Handedness.L : hitter.hits

        return {
            throws: pitcher.throws,
            hits,
            vsSameHand: hits === pitcher.throws
        }
    }

    private getPlayer(players: Record<string, GamePlayer>, playerId?: string): GamePlayer | undefined {
        return playerId ? players[playerId] : undefined
    }

    private getDefender(team: GameTeam, position: Position): GamePlayer | undefined {
        return team.players.find(player => player.currentPosition === position)
    }

    private isFirstPlayOfHalfInning(game: Game, play: Play): boolean {
        const halfInning = (game.halfInnings ?? []).find(candidate => candidate.num === play.inningNum && candidate.top === play.inningTop)

        return halfInning?.plays?.[0]?.index === play.index
    }

}


class GameViewService {

    public constructor(private readonly playByPlayService: PlayByPlayService) {}

    public getEffectiveHittingRatings(hitter: GamePlayer, pitcherHandedness: Handedness) {
        return pitcherHandedness === Handedness.R ? hitter.hittingRatings.vsR : hitter.hittingRatings.vsL
    }

    public getEffectivePitchRatings(pitcher: GamePlayer, hitterHandedness: Handedness) {
        const ratings = hitterHandedness === Handedness.R ? pitcher.pitchRatings.vsR : pitcher.pitchRatings.vsL

        return {
            power: pitcher.pitchRatings.power,
            control: ratings.control,
            movement: ratings.movement
        }
    }

    public getPitcherRatingsText(pitcher: GamePlayer, hitterHandedness: Handedness): string {
        const ratings = this.getEffectivePitchRatings(pitcher, hitterHandedness)

        return `POW ${ratings.power.toFixed(0)}, CON ${ratings.control.toFixed(0)}, MOV ${ratings.movement.toFixed(0)}`
    }

    public getHitterRatingsText(hitter: GamePlayer, pitcherHandedness: Handedness): string {
        const ratings = this.getEffectiveHittingRatings(hitter, pitcherHandedness)

        return `CON ${ratings.contact.toFixed(0)}, GAP ${ratings.gapPower.toFixed(0)}, HR ${ratings.homerunPower.toFixed(0)}, EYE ${ratings.plateDiscipline.toFixed(0)}`
    }

    public getPitcherGameStats(pitcher: GamePlayer): string {
        return `${pitcher.pitchResult.ip} IP, ${pitcher.pitchResult.er} ER, ${pitcher.pitchResult.so} K, ${pitcher.pitchResult.bb} BB, ${pitcher.pitchResult.pitches} PC`
    }

    public getPitcherGameStatsShort(pitcher: GamePlayer): string {
        return `${pitcher.pitchResult.ip} IP, ${pitcher.pitchResult.er} ER, ${pitcher.pitchResult.so} K`
    }

    public getHitterGameStats(hitter: GamePlayer): string {
        const values: string[] = []

        values.push(`${hitter.hitResult.hits}/${hitter.hitResult.atBats}`)

        if (hitter.hitResult.bb > 0) {
            values.push(`${hitter.hitResult.bb > 1 ? hitter.hitResult.bb : ""} BB`.trim())
        }

        if (hitter.hitResult.hbp > 0) {
            values.push(`${hitter.hitResult.hbp > 1 ? hitter.hitResult.hbp : ""} HBP`.trim())
        }

        if (hitter.hitResult.doubles > 0) {
            values.push(`${hitter.hitResult.doubles > 1 ? hitter.hitResult.doubles : ""} 2B`.trim())
        }

        if (hitter.hitResult.triples > 0) {
            values.push(`${hitter.hitResult.triples > 1 ? hitter.hitResult.triples : ""} 3B`.trim())
        }

        if (hitter.hitResult.homeRuns > 0) {
            values.push(`${hitter.hitResult.homeRuns > 1 ? hitter.hitResult.homeRuns : ""} HR`.trim())
        }

        if (hitter.hitResult.rbi > 0) {
            values.push(`${hitter.hitResult.rbi > 1 ? hitter.hitResult.rbi : ""} RBI`.trim())
        }

        return values.join(", ")
    }

    public getHitterGameStatsShort(hitter: GamePlayer): string {
        return `${hitter.hitResult.hits}/${hitter.hitResult.atBats}`
    }

    public getPitchHeader(pitch: Pitch): string {
        if (!pitch.quality) {
            return ""
        }

        return `${this.getPitchResultDescription(pitch)} - ${pitch.count.balls}-${pitch.count.strikes} - ${pitch.quality.velocity?.toFixed(1)} MPH ${this.playByPlayService.getPitchTypeFull(pitch.type)}`
    }

    public getInPlayHeader(pitch: Pitch): string {
        if (!pitch.contactQuality) {
            return ""
        }

        return `EV ${pitch.contactQuality.exitVelocity.toFixed(1)} MPH / LA ${pitch.contactQuality.launchAngle.toFixed(1)}° / Dst ${pitch.contactQuality.distance?.toFixed(0)} ft`
    }

    public getPitchResultDescription(pitch: Pitch): string {
        if (pitch.isWP) {
            return "Wild Pitch"
        }

        if (pitch.isPB) {
            return "Passed Ball"
        }

        switch (pitch.result) {
            case PitchCall.BALL:
                return "Ball"
            case PitchCall.STRIKE:
                return pitch.swing ? "Swinging Strike" : "Called Strike"
            case PitchCall.FOUL:
                return "Foul Ball"
            case PitchCall.IN_PLAY:
                return "In Play"
            default:
                return pitch.swing ? "Swinging Strike" : "Ball"
        }
    }

    public getNumberWithOrdinal(value: number): string {
        const remainder = value % 100

        if (remainder >= 11 && remainder <= 13) {
            return `${value}th`
        }

        switch (value % 10) {
            case 1:
                return `${value}st`
            case 2:
                return `${value}nd`
            case 3:
                return `${value}rd`
            default:
                return `${value}th`
        }
    }

    public getBalls(total: number, filled: number): string {
        return Array.from({ length: total }, (_, index) => index < filled ? "🟡" : "⚪").join("")
    }

    public getMessagesFromPlayDescriptions(descriptions: PlayDescription[]) {
        return descriptions.map(description => {
            const message: any = {
                text: description.text,
                type: "received",
                name: "Gamelog"
            }

            if (description.meta?.pitch) {
                if (description.type === PlayDescriptionType.RESULT) {
                    message.header = this.getInPlayHeader(description.meta.pitch)
                } else {
                    message.header = this.getPitchHeader(description.meta.pitch)
                }
            }

            return message
        })
    }

}


enum AtBatState {
    STARTED = "STARTED",
    ONGOING = "ONGOING",
    ENDED = "ENDED"
}


type GameTeam = Game["away"]


interface GameTeamLineScoreViewModel {
    name: string
    innings: Array<number | undefined>
    runs: number
    hits: number
    errors: number
}


interface GameLineScoreViewModel {
    currentInning: number
    isTopInning: boolean
    isComplete: boolean
    away: GameTeamLineScoreViewModel
    home: GameTeamLineScoreViewModel
}


interface GameBoxscoreViewModel {
    side: "AWAY" | "HOME"
    team: GameTeam
    isComplete: boolean
    isTopInning: boolean
}


interface GameViewModel {
    game: Game
    linescore: GameLineScoreViewModel

    awayBoxscore: GameBoxscoreViewModel
    homeBoxscore: GameBoxscoreViewModel
    atBatBoxscore: GameBoxscoreViewModel

    isTopInning: boolean
    currentInning: number
    balls: number
    strikes: number
    outs: number
    score: Game["score"]

    runner1B?: GamePlayer
    runner2B?: GamePlayer
    runner3B?: GamePlayer

    hitter?: GamePlayer
    pitcher?: GamePlayer

    awayPlayer?: GamePlayer
    homePlayer?: GamePlayer

    matchupHandedness?: MatchupHandedness
    defense?: GameTeam

    catcher?: GamePlayer
    firstBase?: GamePlayer
    secondBase?: GamePlayer
    thirdBase?: GamePlayer
    shortstop?: GamePlayer
    leftField?: GamePlayer
    centerField?: GamePlayer
    rightField?: GamePlayer

    winningPitcher?: GamePlayer
    losingPitcher?: GamePlayer

    showHitter: boolean
    showPitcher: boolean
}


export {
    AtBatState,
    GameViewService,
    GameWebService
}


export type {
    GameBoxscoreViewModel,
    GameLineScoreViewModel,
    GameTeamLineScoreViewModel,
    GameViewModel
}
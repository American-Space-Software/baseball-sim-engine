import { Position, PitchingRoleType, Handedness } from "./enums.js"
import { Game, GamePlayer, TeamInfo } from "./interfaces.js"

class SubstitutionService {

    public changePitcher(game: Game, team: TeamInfo, newPitcherId: string): void {

        const previousPitcherId = team.currentPitcherId

        if (!previousPitcherId) {
            throw new Error("No current pitcher found.")
        }

        if (previousPitcherId === newPitcherId) {
            throw new Error("New pitcher is already the current pitcher.")
        }

        const newPitcher = this.validateIncomingPlayer(game, team, newPitcherId)

        if (!newPitcher.pitchRatings) {
            throw new Error("New pitcher must have pitch ratings.")
        }

        if (newPitcher.positions.includes(Position.PITCHER) && this.getPitcherPitchesRemaining(newPitcher) <= 0) {
            throw new Error("New pitcher does not have enough pitches remaining.")
        }

        this.replaceLineupPlayer(game, team, previousPitcherId, newPitcherId, Position.PITCHER, true)
    }

    public changeHitter(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string): void {

        const outPlayer = team.players.find(p => p._id === outPlayerId)

        if (!outPlayer) {
            throw new Error(`Outgoing hitter ${outPlayerId} not found.`)
        }

        if (outPlayerId === inPlayerId) {
            throw new Error("New hitter is already the current hitter.")
        }

        if (!team.lineupIds.includes(outPlayerId)) {
            throw new Error("Outgoing hitter was not found in the lineup.")
        }

        this.replaceLineupPlayer(game, team, outPlayerId, inPlayerId, outPlayer.currentPosition, false)
    }

    public changeFielder(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string, position: Position): void {

        const outPlayer = team.players.find(p => p._id === outPlayerId)

        if (!outPlayer) {
            throw new Error(`Outgoing player ${outPlayerId} not found.`)
        }

        if (outPlayer.currentPosition !== position) {
            throw new Error("Outgoing player is not currently playing that position.")
        }

        this.replaceLineupPlayer(game, team, outPlayerId, inPlayerId, position, false)
    }

    public changeRunner(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string): void {

        const outPlayer = team.players.find(p => p._id === outPlayerId)

        if (!outPlayer) {
            throw new Error(`Outgoing runner ${outPlayerId} not found.`)
        }

        const isRunner1B = team.runner1BId === outPlayerId
        const isRunner2B = team.runner2BId === outPlayerId
        const isRunner3B = team.runner3BId === outPlayerId

        if (!isRunner1B && !isRunner2B && !isRunner3B) {
            throw new Error("Outgoing runner is not currently on base.")
        }

        this.replaceLineupPlayer(game, team, outPlayerId, inPlayerId, outPlayer.currentPosition, false)

        if (isRunner1B) {
            team.runner1BId = inPlayerId
        } else if (isRunner2B) {
            team.runner2BId = inPlayerId
        } else {
            team.runner3BId = inPlayerId
        }
    }

    private replaceLineupPlayer(game: Game, team: TeamInfo, outPlayerId: string, inPlayerId: string, toPosition: Position, isPitchingChange: boolean): void {

        const outPlayer = team.players.find(p => p._id === outPlayerId)
        const inPlayer = this.validateIncomingPlayer(game, team, inPlayerId)

        if (!outPlayer) {
            throw new Error(`Outgoing player ${outPlayerId} not found.`)
        }

        const lineupIndex = team.lineupIds.findIndex(id => id === outPlayerId)

        if (lineupIndex < 0) {
            throw new Error("Outgoing player was not found in the lineup.")
        }

        if (!inPlayer.positions.includes(toPosition) && !(isPitchingChange && toPosition === Position.PITCHER && inPlayer.pitchRatings)) {
            throw new Error(`Incoming player cannot play ${toPosition}.`)
        }

        const fromPosition = outPlayer.currentPosition

        team.lineupIds[lineupIndex] = inPlayerId

        outPlayer.currentPosition = undefined
        outPlayer.lineupIndex = undefined

        inPlayer.currentPosition = toPosition
        inPlayer.lineupIndex = lineupIndex

        if (isPitchingChange) {
            team.currentPitcherId = inPlayerId
        }

        game.substitutions.push({
            inning: game.currentInning,
            top: game.isTopInning,
            teamId: team._id,
            outPlayerId,
            inPlayerId,
            lineupIndex,
            fromPosition,
            toPosition,
            isPitchingChange
        })
    }

    public getAvailablePitchers(game: Game, team: TeamInfo): GamePlayer[] {

        const usedPlayerIds = this.getUsedPlayerIds(game, team)

        const availablePitcherIds = new Set(
            team.availablePitchers.map(p => p.playerId)
        )

        return team.players.filter(p =>
            availablePitcherIds.has(p._id) &&
            p.positions.includes(Position.PITCHER) &&
            p._id !== team.currentPitcherId &&
            !team.lineupIds.includes(p._id) &&
            !usedPlayerIds.has(p._id) &&
            this.getPitcherPitchesRemaining(p) > 0
        )
    }

    public getNextPitcher(game: Game, team: TeamInfo): GamePlayer {

        const availablePitchers = this.getAvailablePitchers(game, team)

        if (availablePitchers.length <= 0) {
            const usedPlayerIds = this.getUsedPlayerIds(game, team)

            return team.players.find(p =>
                !p.positions.includes(Position.PITCHER) &&
                p._id !== team.currentPitcherId &&
                !team.lineupIds.includes(p._id) &&
                team.runner1BId !== p._id &&
                team.runner2BId !== p._id &&
                team.runner3BId !== p._id &&
                !usedPlayerIds.has(p._id) &&
                p.pitchRatings
            )
        }

        const teamScore = game.away._id === team._id ? game.score.away : game.score.home
        const opponentScore = game.away._id === team._id ? game.score.home : game.score.away
        const lead = teamScore - opponentScore

        const role = this.getPitchingRoleForLead(game, lead)

        return availablePitchers
            .sort((a, b) => {
                const aRole = team.availablePitchers.find(r => r.playerId === a._id)
                const bRole = team.availablePitchers.find(r => r.playerId === b._id)

                if (aRole?.role === role && bRole?.role !== role) return -1
                if (bRole?.role === role && aRole?.role !== role) return 1

                if (aRole && bRole) return aRole.priority - bRole.priority
                if (aRole) return -1
                if (bRole) return 1

                return b.stamina - a.stamina
            })[0]
    }

    public getNextHitter(game: Game, offense: TeamInfo, defense: TeamInfo): GamePlayer | undefined {

        if (!this.shouldConsiderHitterChange(game, offense)) {
            return undefined
        }

        const currentHitterId = offense.lineupIds[offense.currentHitterIndex]
        const currentHitter = offense.players.find(p => p._id === currentHitterId)
        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)

        if (!currentHitter || !pitcher || !currentHitter.currentPosition) {
            return undefined
        }

        const usedPlayerIds = this.getUsedPlayerIds(game, offense)

        const availableHitters = offense.players.filter(p =>
            p._id !== currentHitterId &&
            p._id !== offense.currentPitcherId &&
            !offense.lineupIds.includes(p._id) &&
            offense.runner1BId !== p._id &&
            offense.runner2BId !== p._id &&
            offense.runner3BId !== p._id &&
            !usedPlayerIds.has(p._id) &&
            p.positions.includes(currentHitter.currentPosition)
        )

        if (availableHitters.length <= 0) {
            return undefined
        }

        const currentRatings = pitcher.throws === Handedness.L
            ? currentHitter.hittingRatings.vsL
            : currentHitter.hittingRatings.vsR

        const currentValue =
            currentRatings.contact +
            currentRatings.plateDiscipline +
            currentRatings.gapPower +
            currentRatings.homerunPower

        const best = availableHitters
            .map(player => {
                const ratings = pitcher.throws === Handedness.L
                    ? player.hittingRatings.vsL
                    : player.hittingRatings.vsR

                const value =
                    ratings.contact +
                    ratings.plateDiscipline +
                    ratings.gapPower +
                    ratings.homerunPower

                return {
                    player,
                    improvement: value - currentValue
                }
            })
            .sort((a, b) => b.improvement - a.improvement)[0]

        if (!best || best.improvement < 20) {
            return undefined
        }

        return best.player
    }

    public getPitcherPitchesRemaining(pitcher: GamePlayer): number {

        if (!pitcher.positions.includes(Position.PITCHER)) {
            return 100
        }

        const maxPitchCount = Math.max(0, Math.round(pitcher.maxPitchCount * pitcher.stamina))

        return Math.max(0, maxPitchCount - pitcher.pitchResult.pitches)
    }

    public getPitchingRoleForLead(game:Game, lead:number) : PitchingRoleType {
        return game.currentInning >= 9 && lead >= 1 && lead <= 3 ? PitchingRoleType.CLOSER :
        game.currentInning >= 7 && lead >= -1 && lead <= 3 ? PitchingRoleType.SETUP :
        game.currentInning <= 5 ? PitchingRoleType.LONG :
        Math.abs(lead) >= 5 ? PitchingRoleType.MOP_UP :
        PitchingRoleType.MIDDLE

    }

    public changePitcherIfNeeded(game: Game, defense: TeamInfo): boolean {

        const pitcher = defense.players.find(p => p._id === defense.currentPitcherId)!

        if (this.getPitcherPitchesRemaining(pitcher) > 0) {
            return false
        }

        const nextPitcher = this.getNextPitcher(game, defense)

        if (!nextPitcher) {
            return false
        }

        this.changePitcher(game, defense, nextPitcher._id)

        return true
    }

    public getFatigueScale(pitcher:GamePlayer) {

        const pitchesRemaining = this.getPitcherPitchesRemaining(pitcher)

        let fatigueScale = 1

        //Don't apply fatigue to position players.
        if (pitcher.positions.includes(Position.PITCHER) && pitchesRemaining <= 0) {
            fatigueScale = 0.5
        }

        return fatigueScale
    }

    private validateIncomingPlayer(game: Game, team: TeamInfo, incomingPlayerId: string): GamePlayer {
        const incomingPlayer = team.players.find(p => p._id === incomingPlayerId)

        if (!incomingPlayer) {
            throw new Error(`Incoming player ${incomingPlayerId} not found.`)
        }

        if (team.lineupIds.includes(incomingPlayerId)) {
            throw new Error("Incoming player is already in the lineup.")
        }

        if (team.currentPitcherId === incomingPlayerId) {
            throw new Error("Incoming player is already the current pitcher.")
        }

        if (team.runner1BId === incomingPlayerId || team.runner2BId === incomingPlayerId || team.runner3BId === incomingPlayerId) {
            throw new Error("Incoming player is currently on base.")
        }

        if (this.getUsedPlayerIds(game, team).has(incomingPlayerId)) {
            throw new Error("Incoming player has already left this game.")
        }

        return incomingPlayer
    }

    private getUsedPlayerIds(game: Game, team: TeamInfo): Set<string> {
        return new Set(
            game.substitutions
                .filter(s => s.teamId === team._id && s.outPlayerId)
                .map(s => s.outPlayerId)
        )
    }

    private shouldConsiderHitterChange(game: Game, offense: TeamInfo): boolean {

        if (game.currentInning < 7) {
            return false
        }

        const offenseScore = game.away._id === offense._id ? game.score.away : game.score.home
        const defenseScore = game.away._id === offense._id ? game.score.home : game.score.away
        const deficit = defenseScore - offenseScore
        const lead = offenseScore - defenseScore

        if (Math.abs(lead) >= 6) {
            return false
        }

        if (game.currentInning >= 9) {
            return true
        }

        if (game.currentInning >= 8 && deficit >= 0 && deficit <= 4) {
            return true
        }

        if (game.currentInning >= 7 && deficit >= 1 && deficit <= 3) {
            return true
        }

        return false
    }

    
}

export {
    SubstitutionService
}
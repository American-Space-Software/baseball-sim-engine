import {
    PitchingRoleType,
    Position
} from "../../sim/service/enums.js"

import type {
    Player,
    PitchingRole
} from "../../sim/service/interfaces.js"

import type {
    TeamBundle
} from "../../ratings/service/game-lineup-service.js"


class TeamComponentService {

    public getStartingPitcher(teamBundle: TeamBundle): Player {
        const pitcher = this.getPlayer(teamBundle, teamBundle.startingPitcher._id)

        if (!pitcher) {
            throw new Error(`Starting pitcher ${teamBundle.startingPitcher._id} was not found.`)
        }

        return pitcher
    }

    public getDisplayHitters(teamBundle: TeamBundle): Player[] {
        return teamBundle.lineup.order.map(spot => this.getPlayer(teamBundle, spot._id)).filter((player): player is Player => player !== undefined)
    }

    public getDisplayAvailableHitters(teamBundle: TeamBundle): Player[] {
        const lineupIds = new Set(teamBundle.lineup.order.map(spot => spot._id))

        return teamBundle.players.filter(player => !this.isPitcher(player) && !lineupIds.has(player._id))
    }

    public getDisplayAvailablePitchers(teamBundle: TeamBundle): Array<Player & { role?: PitchingRoleType, priority?: number }> {
        return teamBundle.availablePitchers.map(assignment => ({
            ...this.getRequiredPlayer(teamBundle, assignment.playerId),
            role: assignment.role,
            priority: assignment.priority
        }))
    }

    public setStartingPitcher(teamBundle: TeamBundle, playerId: string): void {
        const player = this.getRequiredPlayer(teamBundle, playerId)

        if (!this.isPitcher(player)) {
            throw new Error(`Invalid starting pitcher: ${playerId}.`)
        }

        if (teamBundle.startingPitcher._id === playerId) {
            return
        }

        const previousStartingPitcherId = teamBundle.startingPitcher._id
        const selectedBullpenIndex = teamBundle.availablePitchers.findIndex(assignment => assignment.playerId === playerId)

        if (selectedBullpenIndex >= 0) {
            teamBundle.availablePitchers[selectedBullpenIndex].playerId = previousStartingPitcherId
        } else {
            teamBundle.availablePitchers.push({
                playerId: previousStartingPitcherId,
                role: PitchingRoleType.MIDDLE,
                priority: this.getNextPriority(teamBundle.availablePitchers, PitchingRoleType.MIDDLE)
            })
        }

        teamBundle.startingPitcher = {
            _id: playerId
        }
    }

    public moveHitter(teamBundle: TeamBundle, selectedPlayerId: string, targetPlayerId: string): void {
        const selectedPlayer = this.getRequiredPlayer(teamBundle, selectedPlayerId)
        const targetPlayer = this.getRequiredPlayer(teamBundle, targetPlayerId)

        if (this.isPitcher(selectedPlayer) || this.isPitcher(targetPlayer)) {
            throw new Error("Pitchers cannot be moved through the hitter lineup.")
        }

        const selectedLineupIndex = teamBundle.lineup.order.findIndex(spot => spot._id === selectedPlayerId)
        const targetLineupIndex = teamBundle.lineup.order.findIndex(spot => spot._id === targetPlayerId)

        if (selectedLineupIndex >= 0 && targetLineupIndex >= 0) {
            this.swapLineupOrder(teamBundle, selectedLineupIndex, targetLineupIndex)
            return
        }

        if (selectedLineupIndex >= 0) {
            this.replaceLineupPlayer(teamBundle, selectedLineupIndex, targetPlayer)
            return
        }

        if (targetLineupIndex >= 0) {
            this.replaceLineupPlayer(teamBundle, targetLineupIndex, selectedPlayer)
            return
        }

        throw new Error("At least one hitter must currently be in the lineup.")
    }

    public moveHitterToLineup(teamBundle: TeamBundle, playerId: string, lineupIndex: number): void {
        const player = this.getRequiredPlayer(teamBundle, playerId)
        const spot = teamBundle.lineup.order[lineupIndex]

        if (!spot) {
            throw new Error(`Invalid lineup index: ${lineupIndex}.`)
        }

        if (this.isPitcher(player)) {
            throw new Error("Pitchers cannot be added to the hitting lineup.")
        }

        const currentLineupIndex = teamBundle.lineup.order.findIndex(candidate => candidate._id === playerId)

        if (currentLineupIndex >= 0) {
            this.swapLineupOrder(teamBundle, currentLineupIndex, lineupIndex)
            return
        }

        if (!this.playerCanPlay(player, spot.position)) {
            throw new Error(`${player.fullName} cannot play ${spot.position}.`)
        }

        teamBundle.lineup.order[lineupIndex] = {
            ...spot,
            _id: playerId
        }
    }

    public moveBullpenPitcher(teamBundle: TeamBundle, selectedPlayerId: string, targetPlayerId: string): void {
        const selectedPlayer = this.getRequiredPlayer(teamBundle, selectedPlayerId)
        const targetPlayer = this.getRequiredPlayer(teamBundle, targetPlayerId)

        if (!this.isPitcher(selectedPlayer) || !this.isPitcher(targetPlayer)) {
            throw new Error("Only pitchers can be moved in the bullpen.")
        }

        if (selectedPlayerId === teamBundle.startingPitcher._id) {
            this.setStartingPitcher(teamBundle, targetPlayerId)
            return
        }

        if (targetPlayerId === teamBundle.startingPitcher._id) {
            this.setStartingPitcher(teamBundle, selectedPlayerId)
            return
        }

        const selectedIndex = teamBundle.availablePitchers.findIndex(assignment => assignment.playerId === selectedPlayerId)
        const targetIndex = teamBundle.availablePitchers.findIndex(assignment => assignment.playerId === targetPlayerId)

        if (selectedIndex < 0 || targetIndex < 0) {
            throw new Error("Both pitchers must have bullpen assignments.")
        }

        const selectedAssignmentPlayerId = teamBundle.availablePitchers[selectedIndex].playerId
        const targetAssignmentPlayerId = teamBundle.availablePitchers[targetIndex].playerId

        teamBundle.availablePitchers[selectedIndex].playerId = targetAssignmentPlayerId
        teamBundle.availablePitchers[targetIndex].playerId = selectedAssignmentPlayerId
    }

    public setBullpenRole(teamBundle: TeamBundle, playerId: string, role: PitchingRoleType, priority = 1): void {
        const player = this.getRequiredPlayer(teamBundle, playerId)

        if (!this.isPitcher(player)) {
            throw new Error(`${player.fullName} is not a pitcher.`)
        }

        if (playerId === teamBundle.startingPitcher._id) {
            throw new Error("The starting pitcher cannot have a bullpen role.")
        }

        const assignment = teamBundle.availablePitchers.find(assignment => assignment.playerId === playerId)

        if (assignment) {
            assignment.role = role
            assignment.priority = priority
            return
        }

        teamBundle.availablePitchers.push({
            playerId,
            role,
            priority
        })
    }

    public setBullpenPriority(teamBundle: TeamBundle, playerId: string, priority: number): void {
        if (!Number.isInteger(priority) || priority < 1) {
            throw new Error(`Invalid bullpen priority: ${priority}.`)
        }

        const assignment = teamBundle.availablePitchers.find(assignment => assignment.playerId === playerId)

        if (!assignment) {
            throw new Error(`Bullpen assignment for ${playerId} was not found.`)
        }

        assignment.priority = priority
    }

    public getBullpenRoleDisplay(role?: PitchingRoleType): string {
        if (role === PitchingRoleType.CLOSER) return "Closer"
        if (role === PitchingRoleType.SETUP) return "Setup"
        if (role === PitchingRoleType.MIDDLE) return "Middle Relief"
        if (role === PitchingRoleType.LONG) return "Long Relief"
        if (role === PitchingRoleType.MOP_UP) return "Mop Up"

        return ""
    }

    public playerCanPlay(player: Player, position: Position): boolean {
        return this.getPositionFitScore(player, position) > 0
    }

    private getPlayer(teamBundle: TeamBundle, playerId?: string): Player | undefined {
        if (!playerId) {
            return undefined
        }

        return teamBundle.players.find(player => player._id === playerId)
    }

    private getRequiredPlayer(teamBundle: TeamBundle, playerId: string): Player {
        const player = this.getPlayer(teamBundle, playerId)

        if (!player) {
            throw new Error(`Player ${playerId} was not found.`)
        }

        return player
    }

    private swapLineupOrder(teamBundle: TeamBundle, firstIndex: number, secondIndex: number): void {
        const firstSpot = teamBundle.lineup.order[firstIndex]

        teamBundle.lineup.order[firstIndex] = teamBundle.lineup.order[secondIndex]
        teamBundle.lineup.order[secondIndex] = firstSpot
    }

    private replaceLineupPlayer(teamBundle: TeamBundle, lineupIndex: number, player: Player): void {
        const spot = teamBundle.lineup.order[lineupIndex]

        if (!this.playerCanPlay(player, spot.position)) {
            throw new Error(`${player.fullName} cannot play ${spot.position}.`)
        }

        teamBundle.lineup.order[lineupIndex] = {
            ...spot,
            _id: player._id
        }
    }

    private isPitcher(player: Player): boolean {
        return player.primaryPosition === Position.PITCHER
    }

    private getPositionFitScore(player: Player, position: Position): number {
        if (this.isPitcher(player)) {
            return 0
        }

        if (position === Position.DESIGNATED_HITTER) {
            return 1
        }

        return player.primaryPosition === position ? 100 : 0
    }

    private getNextPriority(assignments: PitchingRole[], role: PitchingRoleType): number {
        const priorities = assignments.filter(assignment => assignment.role === role).map(assignment => assignment.priority ?? 0)

        return priorities.length > 0 ? Math.max(...priorities) + 1 : 1
    }

}


export {
    TeamComponentService
}
import { SimService } from "../../sim/index.js"
import { Handedness, PitchingRoleType, PitchType, Position } from "../../sim/service/enums.js"
import { Game, HitResultCount, Lineup, PitchEnvironmentTarget, PitchingRole, PitchResultCount, Player, RotationPitcher, Team } from "../../sim/service/interfaces.js"

class BaselineGameService {

    constructor(
        private simService:SimService
    ) {}

    public buildStartedBaselineGame(pitchEnvironment: PitchEnvironmentTarget, gameId: string = "baseline-game"): Game {

        const awayPlayers = this.buildBaselinePlayers()
        const homePlayers = this.buildBaselinePlayers()

        const awayLineup = this.buildBaselineLineup(awayPlayers)
        const homeLineup = this.buildBaselineLineup(homePlayers)

        const awayStartingPitcher: RotationPitcher = {
            _id: awayPlayers.find(p => p.primaryPosition === Position.PITCHER)!._id
        }

        const homeStartingPitcher: RotationPitcher = {
            _id: homePlayers.find(p => p.primaryPosition === Position.PITCHER)!._id
        }

        const buildAvailablePitchers = (players: Player[], startingPitcher: RotationPitcher): PitchingRole[] => {
            return players
                .filter(p => p.primaryPosition === Position.PITCHER && p._id !== startingPitcher._id)
                .map((p, index) => ({
                    playerId: p._id,
                    role:
                        index === 0 ? PitchingRoleType.CLOSER :
                        index <= 2 ? PitchingRoleType.SETUP :
                        index <= 4 ? PitchingRoleType.MIDDLE :
                        index <= 6 ? PitchingRoleType.LONG :
                        PitchingRoleType.MOP_UP,
                    priority: index
                }))
        }

        const awayAvailablePitchers = buildAvailablePitchers(awayPlayers, awayStartingPitcher)
        const homeAvailablePitchers = buildAvailablePitchers(homePlayers, homeStartingPitcher)

        const awayTeam: Team = {
            _id: `${gameId}-away`,
            name: "Away",
            abbrev: "AWAY",
            colors: {
                color1: "#ff0000",
                color2: "#ffffff"
            }
        }

        const homeTeam: Team = {
            _id: `${gameId}-home`,
            name: "Home",
            abbrev: "HOME",
            colors: {
                color1: "#0000ff",
                color2: "#ffffff"
            }
        }

        const game: Game = { _id: gameId } as Game

        this.simService.initGame(game)

        return this.simService.startGame({
            game,
            away: awayTeam,
            awayTeamOptions: {},
            awayPlayers,
            awayLineup,
            awayStartingPitcher,
            awayAvailablePitchers,

            home: homeTeam,
            homeTeamOptions: {},
            homePlayers,
            homeLineup,
            homeStartingPitcher,
            homeAvailablePitchers,

            pitchEnvironmentTarget: pitchEnvironment,
            date: new Date()
        })
    }  

    public buildStartedBaselineGameWithPlayer(pitchEnvironment: PitchEnvironmentTarget, player: Player, gameId: string = "baseline-player-game"): Game {
        const awayPlayers = this.buildBaselinePlayers()
        const homePlayers = this.buildBaselinePlayers()

        if (player.primaryPosition === Position.PITCHER) {
            this.replaceBaselineStartingPitcher(awayPlayers, player)
        } else {
            this.replaceBaselineLineupPlayer(awayPlayers, player)
        }

        const awayLineup = this.buildBaselineLineup(awayPlayers)
        const homeLineup = this.buildBaselineLineup(homePlayers)

        const awayStartingPitcher: RotationPitcher = {
            _id: awayPlayers.find(p => p.primaryPosition === Position.PITCHER)!._id
        }

        const homeStartingPitcher: RotationPitcher = {
            _id: homePlayers.find(p => p.primaryPosition === Position.PITCHER)!._id
        }

        const buildAvailablePitchers = (players: Player[], startingPitcher: RotationPitcher): PitchingRole[] => {
            return players
                .filter(p => p.primaryPosition === Position.PITCHER && p._id !== startingPitcher._id)
                .map((p, index) => ({
                    playerId: p._id,
                    role:
                        index === 0 ? PitchingRoleType.CLOSER :
                        index <= 2 ? PitchingRoleType.SETUP :
                        index <= 4 ? PitchingRoleType.MIDDLE :
                        index <= 6 ? PitchingRoleType.LONG :
                        PitchingRoleType.MOP_UP,
                    priority: index
                }))
        }

        const awayAvailablePitchers = buildAvailablePitchers(awayPlayers, awayStartingPitcher)
        const homeAvailablePitchers = buildAvailablePitchers(homePlayers, homeStartingPitcher)

        const awayTeam: Team = {
            _id: `${gameId}-away`,
            name: "Away",
            abbrev: "AWAY",
            colors: {
                color1: "#ff0000",
                color2: "#ffffff"
            }
        }

        const homeTeam: Team = {
            _id: `${gameId}-home`,
            name: "Home",
            abbrev: "HOME",
            colors: {
                color1: "#0000ff",
                color2: "#ffffff"
            }
        }

        const game: Game = { _id: gameId } as Game

        this.simService.initGame(game)

        return this.simService.startGame({
            game,
            away: awayTeam,
            awayTeamOptions: {},
            awayPlayers,
            awayLineup,
            awayStartingPitcher,
            awayAvailablePitchers,

            home: homeTeam,
            homeTeamOptions: {},
            homePlayers,
            homeLineup,
            homeStartingPitcher,
            homeAvailablePitchers,

            pitchEnvironmentTarget: pitchEnvironment,
            date: new Date()
        })
    }

    private replaceBaselineLineupPlayer(players: Player[], player: Player): void {
        const targetPosition = player.primaryPosition === Position.DESIGNATED_HITTER
            ? Position.FIRST_BASE
            : player.primaryPosition

        const index = players.findIndex(p => p.primaryPosition === targetPosition)

        if (index === -1) {
            throw new Error(`No baseline lineup player found for position ${targetPosition}`)
        }

        players[index] = {
            ...player,
            primaryPosition: targetPosition
        }
    }

    private replaceBaselineStartingPitcher(players: Player[], player: Player): void {
        const index = players.findIndex(p => p._id === "sp-1")

        if (index === -1) {
            throw new Error("No baseline starting pitcher found.")
        }

        players[index] = {
            ...player,
            stamina: 1,
            maxPitchCount: player.maxPitchCount ?? 100
        } as Player
    }

    public buildBaselinePlayer(id: string, position: Position): Player {
        return {
            _id: id,
            firstName: "Baseline",
            lastName: id,
            get fullName() { return `${this.firstName} ${this.lastName}` },
            get displayName() { return this.fullName },
            primaryPosition: position,
            zodiacSign: "Aries",
            throws: Handedness.R,
            hits: Handedness.R,
            isRetired: false,
            stamina: this.getBaselineStamina(position, id),
            maxPitchCount: 100,
            overallRating: 100,
            pitchRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                power: 100,
                vsL: { control: 100, movement: 100 },
                vsR: { control: 100, movement: 100 },
                pitches: [PitchType.FF, PitchType.CU, PitchType.SL, PitchType.FO]
            },
            hittingRatings: {
                contactProfile: { groundball: 43, flyBall: 35, lineDrive: 22 },
                speed: 100,
                steals: 100,
                arm: 100,
                defense: 100,
                vsL: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 },
                vsR: { contact: 100, gapPower: 100, homerunPower: 100, plateDiscipline: 100 }
            },
           
            age: 27
        } as Player
    }

    public buildBaselinePlayers(): Player[] {
        return [
            this.buildBaselinePlayer("c-1", Position.CATCHER),
            this.buildBaselinePlayer("1b-1", Position.FIRST_BASE),
            this.buildBaselinePlayer("2b-1", Position.SECOND_BASE),
            this.buildBaselinePlayer("3b-1", Position.THIRD_BASE),
            this.buildBaselinePlayer("ss-1", Position.SHORTSTOP),
            this.buildBaselinePlayer("lf-1", Position.LEFT_FIELD),
            this.buildBaselinePlayer("cf-1", Position.CENTER_FIELD),
            this.buildBaselinePlayer("rf-1", Position.RIGHT_FIELD),

            this.buildBaselinePlayer("c-2", Position.CATCHER),
            this.buildBaselinePlayer("if-1", Position.SECOND_BASE),
            this.buildBaselinePlayer("if-2", Position.THIRD_BASE),
            this.buildBaselinePlayer("of-1", Position.LEFT_FIELD),
            this.buildBaselinePlayer("util-1", Position.SHORTSTOP),

            this.buildBaselinePlayer("sp-1", Position.PITCHER),
            this.buildBaselinePlayer("sp-2", Position.PITCHER),
            this.buildBaselinePlayer("sp-3", Position.PITCHER),
            this.buildBaselinePlayer("sp-4", Position.PITCHER),
            this.buildBaselinePlayer("sp-5", Position.PITCHER),

            this.buildBaselinePlayer("rp-1", Position.PITCHER),
            this.buildBaselinePlayer("rp-2", Position.PITCHER),
            this.buildBaselinePlayer("rp-3", Position.PITCHER),
            this.buildBaselinePlayer("rp-4", Position.PITCHER),
            this.buildBaselinePlayer("rp-5", Position.PITCHER),
            this.buildBaselinePlayer("rp-6", Position.PITCHER),
            this.buildBaselinePlayer("rp-7", Position.PITCHER),
            this.buildBaselinePlayer("rp-8", Position.PITCHER)
        ]
    }

    public buildBaselineLineup(players: Player[]): Lineup {
        const startingPitchers = players
            .filter(p => p.primaryPosition === Position.PITCHER)
            .slice(0, 5)

        const starterForPosition = (position: Position): Player => {
            const player = players.find(p => p.primaryPosition === position)

            if (!player) {
                throw new Error(`No baseline player found for position ${position}`)
            }

            return player
        }

        return {
            order: [
                starterForPosition(Position.CATCHER),
                starterForPosition(Position.FIRST_BASE),
                starterForPosition(Position.SECOND_BASE),
                starterForPosition(Position.THIRD_BASE),
                starterForPosition(Position.SHORTSTOP),
                starterForPosition(Position.LEFT_FIELD),
                starterForPosition(Position.CENTER_FIELD),
                starterForPosition(Position.RIGHT_FIELD),
                startingPitchers[0]
            ].map(p => ({
                _id: p._id,
                position: p.primaryPosition
            }))
        } as Lineup
    }



    public mergeHitResults(total: HitResultCount, current: HitResultCount): HitResultCount {
        total = total || {} as HitResultCount
        current = current || {} as HitResultCount

        for (const key of Object.keys(current)) {
            const typedKey = key as keyof HitResultCount

            if (typeof current[typedKey] === "number") {
                ; (total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
            }
        }

        return total
    }

    public mergePitchResults(total: PitchResultCount, current: PitchResultCount): PitchResultCount {
        total = total || {} as PitchResultCount
        current = current || {} as PitchResultCount

        for (const key of Object.keys(current)) {
            const typedKey = key as keyof PitchResultCount

            if (typeof current[typedKey] === "number") {
                ; (total[typedKey] as number) = ((total[typedKey] as number) || 0) + (current[typedKey] as number)
            }
        }

        return total
    }

    private getBaselineStamina (position: Position, id: string): number {
        if (position !== Position.PITCHER) return 0
        if (id.includes("sp")) return 1
        return 0.25
    }

}

export {
    BaselineGameService
}
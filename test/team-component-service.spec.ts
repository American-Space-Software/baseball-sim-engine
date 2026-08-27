import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    PitchingRoleType,
    Position
} from "../src/sim/service/enums.js"

import type {
    Player
} from "../src/sim/service/interfaces.js"

import type {
    TeamBundle
} from "../src/ratings/service/game-lineup-service.js"

import {
    TeamComponentService
} from "../src/presentation/services/team-component-service.js"


describe("TeamComponentService", function () {

    it("returns the starting pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const pitcher = service.getStartingPitcher(teamBundle)

        assert.equal(pitcher._id, "pitcher-1")
        assert.equal(pitcher.fullName, "Pitcher One")
    })

    it("throws when the starting pitcher is not in the player collection", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        teamBundle.startingPitcher = {
            _id: "missing"
        }

        assert.throws(
            () => service.getStartingPitcher(teamBundle),
            /Starting pitcher missing was not found/
        )
    })

    it("builds display hitters from lineup order", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const hitters = service.getDisplayHitters(teamBundle)

        assert.equal(hitters.length, 9)
        assert.equal(hitters[0]._id, "hitter-1")
        assert.equal(hitters[0].fullName, "Hitter One")
        assert.equal(hitters[8]._id, "hitter-9")
    })

    it("builds available hitters from players not in the lineup", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const hitters = service.getDisplayAvailableHitters(teamBundle)

        assert.deepEqual(
            hitters.map(player => player._id),
            [
                "bench-1",
                "bench-2",
                "bench-3",
                "bench-4",
                "bench-5"
            ]
        )
    })

    it("does not include pitchers among available hitters", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const hitters = service.getDisplayAvailableHitters(teamBundle)

        assert.equal(
            hitters.some(player => player.primaryPosition === Position.PITCHER),
            false
        )
    })

    it("builds available pitchers from bullpen assignments", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const pitchers = service.getDisplayAvailablePitchers(teamBundle)

        assert.deepEqual(
            pitchers.map(player => player._id),
            [
                "pitcher-2",
                "pitcher-3",
                "pitcher-4",
                "pitcher-5",
                "pitcher-6",
                "pitcher-7"
            ]
        )

        assert.equal(
            pitchers.some(player => player._id === "pitcher-1"),
            false
        )

        assert.equal(
            pitchers.some(player => player._id === "pitcher-8"),
            false
        )
    })

    it("adds bullpen role and priority to display pitchers", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        const pitchers = service.getDisplayAvailablePitchers(teamBundle)
        const closer = pitchers.find(player => player._id === "pitcher-2")

        assert.ok(closer)
        assert.equal(closer.role, PitchingRoleType.CLOSER)
        assert.equal(closer.priority, 1)
    })

    it("changes the starting pitcher and moves the old starter into the selected bullpen slot", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.setStartingPitcher(teamBundle, "pitcher-2")

        assert.equal(teamBundle.startingPitcher._id, "pitcher-2")

        const closer = teamBundle.availablePitchers.find(assignment => assignment.role === PitchingRoleType.CLOSER && assignment.priority === 1)

        assert.ok(closer)
        assert.equal(closer.playerId, "pitcher-1")
    })

    it("adds the previous starter to middle relief when the new starter has no bullpen assignment", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        teamBundle.availablePitchers = teamBundle.availablePitchers.filter(assignment => assignment.playerId !== "pitcher-8")

        service.setStartingPitcher(teamBundle, "pitcher-8")

        assert.equal(teamBundle.startingPitcher._id, "pitcher-8")

        const previousStarter = teamBundle.availablePitchers.find(assignment => assignment.playerId === "pitcher-1")

        assert.ok(previousStarter)
        assert.equal(previousStarter.role, PitchingRoleType.MIDDLE)
        assert.equal(previousStarter.priority, 4)
    })

    it("does nothing when setting the current starting pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()
        const originalAssignments = JSON.stringify(teamBundle.availablePitchers)

        service.setStartingPitcher(teamBundle, "pitcher-1")

        assert.equal(teamBundle.startingPitcher._id, "pitcher-1")
        assert.equal(JSON.stringify(teamBundle.availablePitchers), originalAssignments)
    })

    it("rejects a hitter as the starting pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.setStartingPitcher(teamBundle, "hitter-1"),
            /Invalid starting pitcher/
        )
    })

    it("swaps batting order while keeping defensive positions with the hitters", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveHitter(teamBundle, "hitter-1", "hitter-2")

        assert.deepEqual(
            teamBundle.lineup.order[0],
            {
                _id: "hitter-2",
                position: Position.FIRST_BASE
            }
        )

        assert.deepEqual(
            teamBundle.lineup.order[1],
            {
                _id: "hitter-1",
                position: Position.CATCHER
            }
        )
    })

    it("replaces a lineup hitter with an available hitter", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveHitter(teamBundle, "bench-1", "hitter-1")

        assert.equal(teamBundle.lineup.order[0]._id, "bench-1")
        assert.equal(teamBundle.lineup.order[0].position, Position.CATCHER)
    })

    it("replaces a lineup hitter when the selected player is already in the lineup and the target is available", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveHitter(teamBundle, "hitter-1", "bench-1")

        assert.equal(teamBundle.lineup.order[0]._id, "bench-1")
        assert.equal(teamBundle.lineup.order[0].position, Position.CATCHER)
    })

    it("throws when neither hitter is currently in the lineup", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveHitter(teamBundle, "bench-1", "bench-2"),
            /At least one hitter must currently be in the lineup/
        )
    })

    it("rejects pitchers in hitter movement", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveHitter(teamBundle, "pitcher-1", "hitter-1"),
            /Pitchers cannot be moved through the hitter lineup/
        )
    })

    it("moves an available hitter directly into a lineup position", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveHitterToLineup(teamBundle, "bench-1", 0)

        assert.equal(teamBundle.lineup.order[0]._id, "bench-1")
        assert.equal(teamBundle.lineup.order[0].position, Position.CATCHER)
    })

    it("moves an existing lineup hitter to another batting-order position", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveHitterToLineup(teamBundle, "hitter-1", 1)

        assert.deepEqual(
            teamBundle.lineup.order[0],
            {
                _id: "hitter-2",
                position: Position.FIRST_BASE
            }
        )

        assert.deepEqual(
            teamBundle.lineup.order[1],
            {
                _id: "hitter-1",
                position: Position.CATCHER
            }
        )
    })

    it("rejects an invalid lineup index", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveHitterToLineup(teamBundle, "bench-1", 99),
            /Invalid lineup index/
        )
    })

    it("rejects a pitcher moved into the hitting lineup", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveHitterToLineup(teamBundle, "pitcher-1", 0),
            /Pitchers cannot be added to the hitting lineup/
        )
    })

    it("rejects a hitter that cannot play the target position", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveHitterToLineup(teamBundle, "bench-2", 0),
            /cannot play/
        )
    })

    it("allows any non-pitcher at designated hitter", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.equal(
            service.playerCanPlay(getPlayer(teamBundle, "bench-2"), Position.DESIGNATED_HITTER),
            true
        )
    })

    it("allows a player's primary position", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()
        const catcher = getPlayer(teamBundle, "hitter-1")

        assert.equal(
            service.playerCanPlay(catcher, Position.CATCHER),
            true
        )
    })

    it("does not allow a pitcher to play a hitter position", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.equal(
            service.playerCanPlay(getPlayer(teamBundle, "pitcher-1"), Position.DESIGNATED_HITTER),
            false
        )
    })

    it("swaps two bullpen pitchers while preserving bullpen slots", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveBullpenPitcher(teamBundle, "pitcher-2", "pitcher-3")

        assert.deepEqual(
            teamBundle.availablePitchers[0],
            {
                playerId: "pitcher-3",
                role: PitchingRoleType.CLOSER,
                priority: 1
            }
        )

        assert.deepEqual(
            teamBundle.availablePitchers[1],
            {
                playerId: "pitcher-2",
                role: PitchingRoleType.SETUP,
                priority: 1
            }
        )
    })

    it("changes the starter when moving the starting pitcher against a bullpen pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveBullpenPitcher(teamBundle, "pitcher-1", "pitcher-2")

        assert.equal(teamBundle.startingPitcher._id, "pitcher-2")
        assert.equal(teamBundle.availablePitchers[0].playerId, "pitcher-1")
    })

    it("changes the starter when the target pitcher is the starting pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.moveBullpenPitcher(teamBundle, "pitcher-2", "pitcher-1")

        assert.equal(teamBundle.startingPitcher._id, "pitcher-2")
        assert.equal(teamBundle.availablePitchers[0].playerId, "pitcher-1")
    })

    it("rejects hitters in bullpen movement", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveBullpenPitcher(teamBundle, "hitter-1", "pitcher-2"),
            /Only pitchers can be moved in the bullpen/
        )
    })

    it("rejects bullpen movement when both pitchers do not have assignments", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.moveBullpenPitcher(teamBundle, "pitcher-2", "pitcher-8"),
            /Both pitchers must have bullpen assignments/
        )
    })

    it("changes an existing bullpen role and priority", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.setBullpenRole(teamBundle, "pitcher-2", PitchingRoleType.MIDDLE, 3)

        const assignment = teamBundle.availablePitchers.find(assignment => assignment.playerId === "pitcher-2")

        assert.ok(assignment)
        assert.equal(assignment.role, PitchingRoleType.MIDDLE)
        assert.equal(assignment.priority, 3)
    })

    it("adds a bullpen assignment for an unassigned pitcher", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.setBullpenRole(teamBundle, "pitcher-8", PitchingRoleType.LONG, 1)

        assert.deepEqual(
            teamBundle.availablePitchers.find(assignment => assignment.playerId === "pitcher-8"),
            {
                playerId: "pitcher-8",
                role: PitchingRoleType.LONG,
                priority: 1
            }
        )
    })

    it("does not allow the starting pitcher to receive a bullpen role", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.setBullpenRole(teamBundle, "pitcher-1", PitchingRoleType.MIDDLE),
            /starting pitcher cannot have a bullpen role/i
        )
    })

    it("does not allow a hitter to receive a bullpen role", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.setBullpenRole(teamBundle, "hitter-1", PitchingRoleType.MIDDLE),
            /is not a pitcher/
        )
    })

    it("changes bullpen priority", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        service.setBullpenPriority(teamBundle, "pitcher-4", 4)

        assert.equal(
            teamBundle.availablePitchers.find(assignment => assignment.playerId === "pitcher-4")?.priority,
            4
        )
    })

    it("rejects invalid bullpen priority", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.setBullpenPriority(teamBundle, "pitcher-2", 0),
            /Invalid bullpen priority/
        )

        assert.throws(
            () => service.setBullpenPriority(teamBundle, "pitcher-2", 1.5),
            /Invalid bullpen priority/
        )
    })

    it("throws when changing priority for a pitcher without a bullpen assignment", function () {
        const service = new TeamComponentService()
        const teamBundle = createTeamBundle()

        assert.throws(
            () => service.setBullpenPriority(teamBundle, "pitcher-8", 1),
            /Bullpen assignment for pitcher-8 was not found/
        )
    })

    it("formats bullpen role names", function () {
        const service = new TeamComponentService()

        assert.equal(service.getBullpenRoleDisplay(PitchingRoleType.CLOSER), "Closer")
        assert.equal(service.getBullpenRoleDisplay(PitchingRoleType.SETUP), "Setup")
        assert.equal(service.getBullpenRoleDisplay(PitchingRoleType.MIDDLE), "Middle Relief")
        assert.equal(service.getBullpenRoleDisplay(PitchingRoleType.LONG), "Long Relief")
        assert.equal(service.getBullpenRoleDisplay(PitchingRoleType.MOP_UP), "Mop Up")
        assert.equal(service.getBullpenRoleDisplay(undefined), "")
    })

})


function createTeamBundle(): TeamBundle {
    return {
        team: {
            _id: "team",
            name: "Test Team",
            abbrev: "TST"
        },

        players: [
            buildPlayer("hitter-1", "Hitter One", Position.CATCHER),
            buildPlayer("hitter-2", "Hitter Two", Position.FIRST_BASE),
            buildPlayer("hitter-3", "Hitter Three", Position.SECOND_BASE),
            buildPlayer("hitter-4", "Hitter Four", Position.SHORTSTOP),
            buildPlayer("hitter-5", "Hitter Five", Position.THIRD_BASE),
            buildPlayer("hitter-6", "Hitter Six", Position.LEFT_FIELD),
            buildPlayer("hitter-7", "Hitter Seven", Position.RIGHT_FIELD),
            buildPlayer("hitter-8", "Hitter Eight", Position.CENTER_FIELD),
            buildPlayer("hitter-9", "Hitter Nine", Position.DESIGNATED_HITTER),

            buildPlayer("bench-1", "Bench One", Position.CATCHER),
            buildPlayer("bench-2", "Bench Two", Position.FIRST_BASE),
            buildPlayer("bench-3", "Bench Three", Position.SECOND_BASE),
            buildPlayer("bench-4", "Bench Four", Position.LEFT_FIELD),
            buildPlayer("bench-5", "Bench Five", Position.CENTER_FIELD),

            buildPlayer("pitcher-1", "Pitcher One", Position.PITCHER),
            buildPlayer("pitcher-2", "Pitcher Two", Position.PITCHER),
            buildPlayer("pitcher-3", "Pitcher Three", Position.PITCHER),
            buildPlayer("pitcher-4", "Pitcher Four", Position.PITCHER),
            buildPlayer("pitcher-5", "Pitcher Five", Position.PITCHER),
            buildPlayer("pitcher-6", "Pitcher Six", Position.PITCHER),
            buildPlayer("pitcher-7", "Pitcher Seven", Position.PITCHER),
            buildPlayer("pitcher-8", "Pitcher Eight", Position.PITCHER)
        ],

        lineup: {
            order: [
                { _id: "hitter-1", position: Position.CATCHER },
                { _id: "hitter-2", position: Position.FIRST_BASE },
                { _id: "hitter-3", position: Position.SECOND_BASE },
                { _id: "hitter-4", position: Position.SHORTSTOP },
                { _id: "hitter-5", position: Position.THIRD_BASE },
                { _id: "hitter-6", position: Position.LEFT_FIELD },
                { _id: "hitter-7", position: Position.RIGHT_FIELD },
                { _id: "hitter-8", position: Position.CENTER_FIELD },
                { _id: "hitter-9", position: Position.DESIGNATED_HITTER }
            ],
            valid: true
        },

        startingPitcher: {
            _id: "pitcher-1"
        },

        availablePitchers: [
            {
                playerId: "pitcher-2",
                role: PitchingRoleType.CLOSER,
                priority: 1
            },
            {
                playerId: "pitcher-3",
                role: PitchingRoleType.SETUP,
                priority: 1
            },
            {
                playerId: "pitcher-4",
                role: PitchingRoleType.SETUP,
                priority: 2
            },
            {
                playerId: "pitcher-5",
                role: PitchingRoleType.MIDDLE,
                priority: 1
            },
            {
                playerId: "pitcher-6",
                role: PitchingRoleType.MIDDLE,
                priority: 2
            },
            {
                playerId: "pitcher-7",
                role: PitchingRoleType.MIDDLE,
                priority: 3
            }
        ]
    } as TeamBundle
}


function buildPlayer(playerId: string, fullName: string, primaryPosition: Position): Player {
    return {
        _id: playerId,
        fullName,
        primaryPosition
    } as Player
}


function getPlayer(teamBundle: TeamBundle, playerId: string): Player {
    const player = teamBundle.players.find(player => player._id === playerId)

    if (!player) {
        throw new Error(`Test player ${playerId} was not found.`)
    }

    return player
}
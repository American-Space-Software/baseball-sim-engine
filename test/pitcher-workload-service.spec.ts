import assert from "node:assert/strict"

import {
    describe,
    it
} from "node:test"

import type {
    PitcherAppearance
} from "../src/ratings/repository/pitcher-appearance-repository.js"

import {
    PitcherWorkloadService
} from "../src/ratings/service/pitcher-workload-service.js"

import type {
    PitcherAppearanceService
} from "../src/ratings/service/pitcher-appearance-service.js"


const GAME_DATE = "2009-04-07"


const buildAppearance = (playerId: string, gameDate: string, gameId: number, started: boolean): PitcherAppearance => ({
    playerId,
    playerName: `Pitcher ${playerId}`,
    gameId: String(gameId),
    gameDate,
    teamId: "1",
    pitches: started ? 90 : 15,
    outs: started ? 18 : 3,
    inningsPitched: started ? 6 : 1,
    battersFaced: started ? 24 : 4,
    gamesStarted: started ? 1 : 0,
    gamesFinished: started ? 0 : 1,
    saves: 0,
    holds: 0,
    blownSaves: 0,
    entryInning: started ? 1 : 7
})


class TestHarness {

    public buildService(appearances: PitcherAppearance[]): PitcherWorkloadService {
        const byDate = new Map<string, PitcherAppearance[]>()

        for (const appearance of appearances) {
            const dateAppearances = byDate.get(
                appearance.gameDate
            ) ?? []

            dateAppearances.push(
                appearance
            )

            byDate.set(
                appearance.gameDate,
                dateAppearances
            )
        }

        const pitcherAppearanceService = {
            getForDate: async (gameDate: string) =>
                structuredClone(
                    byDate.get(gameDate) ?? []
                )
        } as PitcherAppearanceService

        return new PitcherWorkloadService(
            pitcherAppearanceService
        )
    }

    public buildRelievers(playerIds: string[], dates: string[]): PitcherAppearance[] {
        return playerIds.flatMap((playerId, playerIndex) =>
            dates.map((gameDate, dateIndex) =>
                buildAppearance(
                    playerId,
                    gameDate,
                    5000 + playerIndex * 100 + dateIndex,
                    false
                )
            )
        )
    }

}


const harness = new TestHarness()


describe("PitcherWorkloadService role classification", () => {

    it("uses the pitcher's most recent appearances across the offseason", async () => {
        const starterAppearances = [
            buildAppearance("101", "2009-04-05", 1001, true),
            buildAppearance("101", "2008-09-28", 1002, true),
            buildAppearance("101", "2008-09-23", 1003, true),
            buildAppearance("101", "2008-09-18", 1004, true),
            buildAppearance("101", "2008-09-13", 1005, true),
            buildAppearance("101", "2008-09-08", 1006, true),
            buildAppearance("101", "2008-09-03", 1007, true),
            buildAppearance("101", "2008-08-29", 1008, true)
        ]

        const relieverIds = [
            "201",
            "202",
            "203",
            "204",
            "205",
            "206"
        ]

        const appearances = [
            ...starterAppearances,
            ...harness.buildRelievers(
                relieverIds,
                [
                    "2009-04-06",
                    "2009-04-04"
                ]
            )
        ]

        const service = harness.buildService(
            appearances
        )

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                "101",
                ...relieverIds
            ]
        )

        assert.equal(
            roles.some(role =>
                role.playerId === "101"
            ),
            false
        )

        assert.deepEqual(
            roles
                .map(role =>
                    role.playerId
                )
                .sort(),
            [
                ...relieverIds
            ].sort()
        )
    })


    it("moves a recent starter into the bullpen after relief usage becomes more recent", async () => {
        const switchedPitcher = [
            buildAppearance("301", "2009-04-06", 2001, false),
            buildAppearance("301", "2009-04-05", 2002, false),
            buildAppearance("301", "2009-04-04", 2003, false),
            buildAppearance("301", "2008-09-28", 2004, true),
            buildAppearance("301", "2008-09-23", 2005, true),
            buildAppearance("301", "2008-09-18", 2006, true),
            buildAppearance("301", "2008-09-13", 2007, true),
            buildAppearance("301", "2008-09-08", 2008, true)
        ]

        const relieverIds = [
            "302",
            "303",
            "304",
            "305",
            "306"
        ]

        const service = harness.buildService([
            ...switchedPitcher,
            ...harness.buildRelievers(
                relieverIds,
                [
                    "2009-04-06",
                    "2009-04-05"
                ]
            )
        ])

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                "301",
                ...relieverIds
            ]
        )

        const switchedRole = roles.find(role =>
            role.playerId === "301"
        )

        assert.ok(
            switchedRole
        )

        assert.equal(
            switchedRole.profile.starts,
            5
        )

        assert.equal(
            switchedRole.profile.reliefAppearances,
            3
        )

        assert.ok(
            switchedRole.profile.reliefScore >
            switchedRole.profile.starterScore
        )
    })


    it("moves a recent reliever out of the bullpen after starter usage becomes more recent", async () => {
        const switchedPitcher = [
            buildAppearance("401", "2009-04-06", 3001, true),
            buildAppearance("401", "2009-04-05", 3002, true),
            buildAppearance("401", "2009-04-04", 3003, true),
            buildAppearance("401", "2008-09-28", 3004, false),
            buildAppearance("401", "2008-09-27", 3005, false),
            buildAppearance("401", "2008-09-26", 3006, false),
            buildAppearance("401", "2008-09-25", 3007, false),
            buildAppearance("401", "2008-09-24", 3008, false)
        ]

        const relieverIds = [
            "402",
            "403",
            "404",
            "405",
            "406"
        ]

        const service = harness.buildService([
            ...switchedPitcher,
            ...harness.buildRelievers(
                relieverIds,
                [
                    "2009-04-06",
                    "2009-04-05"
                ]
            )
        ])

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                "401",
                ...relieverIds
            ]
        )

        assert.equal(
            roles.some(role =>
                role.playerId === "401"
            ),
            false
        )
    })


    it("ignores appearances older than the most recent eight for role classification", async () => {
        const recentRelief = [
            "2009-04-06",
            "2009-04-05",
            "2009-04-04",
            "2009-04-03",
            "2008-09-28",
            "2008-09-27",
            "2008-09-26",
            "2008-09-25"
        ].map((gameDate, index) =>
            buildAppearance(
                "501",
                gameDate,
                4000 + index,
                false
            )
        )

        const olderStarts = [
            "2008-09-20",
            "2008-09-15",
            "2008-09-10",
            "2008-09-05"
        ].map((gameDate, index) =>
            buildAppearance(
                "501",
                gameDate,
                4100 + index,
                true
            )
        )

        const relieverIds = [
            "502",
            "503",
            "504",
            "505",
            "506"
        ]

        const service = harness.buildService([
            ...recentRelief,
            ...olderStarts,
            ...harness.buildRelievers(
                relieverIds,
                [
                    "2009-04-06",
                    "2009-04-05"
                ]
            )
        ])

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                "501",
                ...relieverIds
            ]
        )

        const role = roles.find(current =>
            current.playerId === "501"
        )

        assert.ok(
            role
        )

        assert.equal(
            role.profile.appearances,
            8
        )

        assert.equal(
            role.profile.starts,
            0
        )

        assert.equal(
            role.profile.reliefAppearances,
            8
        )
    })


    it("excludes the four strongest rotation pitchers after today's starter", async () => {
        const rotationIds = [
            "601",
            "602",
            "603",
            "604",
            "605"
        ]

        const bullpenIds = [
            "606",
            "607",
            "608",
            "609",
            "610"
        ]

        const appearances = [
            ...rotationIds.flatMap((playerId, playerIndex) =>
                [
                    "2009-04-06",
                    "2009-04-01",
                    "2008-09-28",
                    "2008-09-23",
                    "2008-09-18",
                    "2008-09-13",
                    "2008-09-08",
                    "2008-09-03"
                ].map((gameDate, appearanceIndex) =>
                    buildAppearance(
                        playerId,
                        gameDate,
                        6000 + playerIndex * 100 + appearanceIndex,
                        true
                    )
                )
            ),
            ...harness.buildRelievers(
                bullpenIds,
                [
                    "2009-04-06",
                    "2009-04-05"
                ]
            )
        ]

        const service = harness.buildService(
            appearances
        )

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                ...rotationIds,
                ...bullpenIds
            ]
        )

        const excludedRotationIds = rotationIds.filter(playerId =>
            !roles.some(role =>
                role.playerId === playerId
            )
        )

        assert.equal(
            excludedRotationIds.length,
            4
        )

        const availableRotationIds = rotationIds.filter(playerId =>
            roles.some(role =>
                role.playerId === playerId
            )
        )

        assert.equal(
            availableRotationIds.length,
            1
        )

        const availableRotation = roles.find(role =>
            role.playerId === availableRotationIds[0]
        )

        assert.ok(
            availableRotation
        )

        assert.ok(
            availableRotation.profile.starterScore >
            availableRotation.profile.reliefScore
        )

        assert.deepEqual(
            roles
                .map(role =>
                    role.playerId
                )
                .sort(),
            [
                ...bullpenIds,
                availableRotationIds[0]
            ].sort()
        )
    })


    it("keeps a normal five-man rotation out of the bullpen", async () => {
        const todaysStarterId = "701"

        const otherRotationIds = [
            "702",
            "703",
            "704",
            "705"
        ]

        const bullpenIds = [
            "706",
            "707",
            "708",
            "709",
            "710",
            "711",
            "712",
            "713"
        ]

        const rotationAppearances = [
            todaysStarterId,
            ...otherRotationIds
        ].flatMap((playerId, playerIndex) =>
            [
                "2009-04-06",
                "2009-04-01",
                "2008-09-28",
                "2008-09-23",
                "2008-09-18",
                "2008-09-13",
                "2008-09-08",
                "2008-09-03"
            ].map((gameDate, appearanceIndex) =>
                buildAppearance(
                    playerId,
                    gameDate,
                    7000 + playerIndex * 100 + appearanceIndex,
                    true
                )
            )
        )

        const service = harness.buildService([
            ...rotationAppearances,
            ...harness.buildRelievers(
                bullpenIds,
                [
                    "2009-04-06",
                    "2009-04-05"
                ]
            )
        ])

        const roles = await service.getBullpenRoles(
            GAME_DATE,
            [
                todaysStarterId,
                ...otherRotationIds,
                ...bullpenIds
            ],
            todaysStarterId
        )

        assert.deepEqual(
            roles
                .map(role =>
                    role.playerId
                )
                .sort(),
            [
                ...bullpenIds
            ].sort()
        )

        for (const playerId of [
            todaysStarterId,
            ...otherRotationIds
        ]) {
            assert.equal(
                roles.some(role =>
                    role.playerId === playerId
                ),
                false
            )
        }
    })

})

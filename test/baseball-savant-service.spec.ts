import assert from "assert"
import path from "path"

import {
    BaseballSavantService
} from "../src/ratings/service/baseball-savant-service.js"

import {
    DownloaderService
} from "../src/ratings/service/downloader-service.js"


describe("BaseballSavantService", () => {

    const dataDir = path.resolve(
        "test",
        "data"
    )

    const downloaderService = new DownloaderService(
        dataDir,
        1000 * 60 * 60
    )

    const baseballSavantService = new BaseballSavantService(
        downloaderService
    )

    const teams = [
        {
            id: 115,
            name: "Colorado Rockies",
            abbrev: "COL"
        }
    ]

    it("downloads and parses real Baseball Savant park factors", async () => {
        const rows = await baseballSavantService.getParkFactors(
            2026,
            3
        )

        assert.ok(
            rows.length >= 30,
            `Expected at least 30 Baseball Savant park-factor rows, actual=${rows.length}`
        )

        const coorsField = rows.find(row =>
            row.venueId === "19"
        )

        assert.ok(
            coorsField,
            "Expected Baseball Savant data to contain Coors Field."
        )

        assert.equal(
            coorsField.venueName,
            "Coors Field"
        )

        assert.equal(
            coorsField.teamId,
            "115"
        )

        assert.equal(
            coorsField.teamName,
            "Rockies"
        )

        assert.equal(
            coorsField.season,
            2026
        )

        assert.equal(
            coorsField.rollingYears,
            3
        )

        assert.equal(
            coorsField.yearRange,
            "2024-2026"
        )

        assert.ok(
            coorsField.plateAppearances > 0
        )

        assert.ok(
            coorsField.singles > 0
        )

        assert.ok(
            coorsField.doubles > 0
        )

        assert.ok(
            coorsField.triples > 0
        )

        assert.ok(
            coorsField.homeRuns > 0
        )

        assert.ok(
            coorsField.walks > 0
        )

        assert.ok(
            coorsField.strikeouts > 0
        )
    })

    it("returns the same Baseball Savant park factors from the downloader cache", async () => {
        const first = await baseballSavantService.getParkFactors(
            2026,
            3
        )

        const second = await baseballSavantService.getParkFactors(
            2026,
            3
        )

        assert.deepEqual(
            second,
            first
        )
    })

    it("creates the real Coors Field stadium environment", async () => {
        const stadiumEnvironment = await baseballSavantService.getStadiumEnvironment(
            19,
            2026,
            3
        )

        assert.ok(
            stadiumEnvironment
        )

        assert.equal(
            stadiumEnvironment.venue,
            "Coors Field"
        )

        assert.equal(
            stadiumEnvironment.team,
            "Rockies"
        )

        assert.equal(
            stadiumEnvironment.yearRange,
            "2024-2026"
        )

        assert.ok(
            stadiumEnvironment.singles > 1
        )

        assert.ok(
            stadiumEnvironment.doubles > 1
        )

        assert.ok(
            stadiumEnvironment.triples > 1
        )

        assert.ok(
            stadiumEnvironment.hr > 1
        )

        assert.ok(
            stadiumEnvironment.strikeouts < 1
        )
    })

    it("creates stadium environments for the full Baseball Savant park-factor list", async () => {
        const parkFactors = await baseballSavantService.getParkFactors(
            2026,
            3
        )

        const stadiumEnvironments = await baseballSavantService.getStadiumEnvironments(
            2026,
            teams,
            3
        )

        assert.ok(
            stadiumEnvironments.length > 0
        )

        assert.ok(
            stadiumEnvironments.length <= parkFactors.length
        )

        const coorsField = stadiumEnvironments.find(environment =>
            environment.venue === "Coors Field"
        )

        assert.ok(
            coorsField,
            "Expected stadium environments to contain Coors Field."
        )

        assert.equal(
            coorsField.team,
            "COL"
        )

        assert.equal(
            coorsField.yearRange,
            "2024-2026"
        )

        assert.ok(
            stadiumEnvironments.every(environment =>
                environment.singles > 0 &&
                environment.doubles > 0 &&
                environment.triples > 0 &&
                environment.hr > 0 &&
                environment.walks > 0 &&
                environment.strikeouts > 0
            )
        )
    })

    it("returns undefined when Baseball Savant has no matching venue", async () => {
        const stadiumEnvironment = await baseballSavantService.getStadiumEnvironment(
            "missing-venue",
            2026,
            3
        )

        assert.equal(
            stadiumEnvironment,
            undefined
        )
    })

    it("downloads park-factor lists for arbitrary seasons", async () => {
        const rows = await baseballSavantService.getParkFactors(
            2025,
            3
        )

        assert.ok(
            rows.length >= 30,
            `Expected at least 30 Baseball Savant park-factor rows for 2025, actual=${rows.length}`
        )

        assert.ok(
            rows.every(row =>
                row.season === 2025
            ),
            "Every parsed park-factor row should match the requested season."
        )
    })

})

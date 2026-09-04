import type {
    StadiumEnvironment
} from "baseball-sim-engine"

import {
    DownloaderService
} from "./downloader-service.js"

import type {
    MlbTeam
} from "./mlb-roster-service.js"


class BaseballSavantService {

    public constructor(
        private readonly downloaderService: DownloaderService
    ) {}

    public async getParkFactorPage(season: number, rollingYears: number = 3): Promise<string> {
        return await this.downloaderService.readOrDownloadShared(
            `baseball-savant/park-factors/${season}-${rollingYears}.json`,
            async () => {
                const url = new URL(
                    "https://baseballsavant.mlb.com/leaderboard/statcast-park-factors"
                )

                url.searchParams.set(
                    "type",
                    "year"
                )

                url.searchParams.set(
                    "year",
                    String(season)
                )

                url.searchParams.set(
                    "batSide",
                    ""
                )

                url.searchParams.set(
                    "stat",
                    "index_wOBA"
                )

                url.searchParams.set(
                    "condition",
                    "All"
                )

                url.searchParams.set(
                    "rolling",
                    String(rollingYears)
                )

                url.searchParams.set(
                    "parks",
                    "all"
                )

                const response = await fetch(
                    url
                )

                if (!response.ok) {
                    throw new Error(
                        `Unable to download Baseball Savant park factors for ${season}.`
                    )
                }

                return await response.text()
            }
        )
    }

    public async getParkFactors(season: number, rollingYears: number = 3): Promise<BaseballSavantParkFactor[]> {
        const html = await this.getParkFactorPage(
            season,
            rollingYears
        )

        return this.parseParkFactors(
            html
        )
    }

    public async getStadiumEnvironment(venueId: string | number, season: number, rollingYears: number = 3): Promise<StadiumEnvironment | undefined> {
        const parkFactors = await this.getParkFactors(
            season,
            rollingYears
        )

        const parkFactor = parkFactors.find(row =>
            row.venueId === String(
                venueId
            )
        )

        if (!parkFactor) {
            return undefined
        }

        return this.createStadiumEnvironment(
            parkFactor,
            parkFactor.teamName
        )
    }

    public async getStadiumEnvironments(season: number, teams: MlbTeam[], rollingYears: number = 3): Promise<StadiumEnvironment[]> {
        const parkFactors = await this.getParkFactors(
            season,
            rollingYears
        )

        return parkFactors
            .map(parkFactor => {
                const team = teams.find(team =>
                    String(
                        team.id
                    ) === parkFactor.teamId
                )

                return this.createStadiumEnvironment(
                    parkFactor,
                    team?.abbrev ?? ""
                )
            })
            .filter((environment): environment is StadiumEnvironment =>
                environment !== undefined
            )
    }

    public parseParkFactors(html: string): BaseballSavantParkFactor[] {
        const dataMatch = html.match(
            /var data = (\[.*?\]);\s*var queryString/s
        )

        if (!dataMatch?.[1]) {
            throw new Error(
                "Baseball Savant park factor page does not contain embedded data."
            )
        }

        const rows = JSON.parse(
            dataMatch[1]
        )

        if (!Array.isArray(rows)) {
            throw new Error(
                "Baseball Savant park factor data is not an array."
            )
        }

        return rows.map(row =>
            this.parseParkFactor(
                row
            )
        )
    }

    private parseParkFactor(row: any): BaseballSavantParkFactor {
        const venueId = String(
            row?.venue_id ?? ""
        )

        const venueName = String(
            row?.venue_name ?? ""
        )

        if (!venueId) {
            throw new Error(
                `Baseball Savant park factor row is missing venue_id venue=${venueName}.`
            )
        }

        if (!venueName) {
            throw new Error(
                `Baseball Savant park factor row is missing venue_name venueId=${venueId}.`
            )
        }

        return {
            venueId,
            venueName,

            teamId: String(
                row?.main_team_id ?? ""
            ),

            teamName: String(
                row?.name_display_club ?? ""
            ),

            yearRange: String(
                row?.year_range ?? ""
            ),

            season: this.getNumber(
                row?.key_year,
                "season",
                venueName
            ),

            rollingYears: this.getNumber(
                row?.key_num_years_rolling,
                "rolling years",
                venueName
            ),

            plateAppearances: this.getNumber(
                row?.n_pa,
                "plate appearances",
                venueName
            ),

            parkFactor: this.getNumber(
                row?.index_woba,
                "park factor",
                venueName
            ),

            runs: this.getNumber(
                row?.index_runs,
                "runs",
                venueName
            ),

            singles: this.getNumber(
                row?.index_1b,
                "singles",
                venueName
            ),

            doubles: this.getNumber(
                row?.index_2b,
                "doubles",
                venueName
            ),

            triples: this.getNumber(
                row?.index_3b,
                "triples",
                venueName
            ),

            homeRuns: this.getNumber(
                row?.index_hr,
                "home runs",
                venueName
            ),

            walks: this.getNumber(
                row?.index_bb,
                "walks",
                venueName
            ),

            strikeouts: this.getNumber(
                row?.index_so,
                "strikeouts",
                venueName
            )
        }
    }

    private createStadiumEnvironment(parkFactor: BaseballSavantParkFactor, team: string): StadiumEnvironment | undefined {
        const factors = [
            parkFactor.singles,
            parkFactor.doubles,
            parkFactor.triples,
            parkFactor.homeRuns,
            parkFactor.walks,
            parkFactor.strikeouts
        ]

        if (
            factors.some(factor =>
                !Number.isFinite(factor) ||
                factor <= 0
            )
        ) {
            return undefined
        }

        return {
            team,
            venue: parkFactor.venueName,
            yearRange: parkFactor.yearRange,
            singles: parkFactor.singles / 100,
            doubles: parkFactor.doubles / 100,
            triples: parkFactor.triples / 100,
            hr: parkFactor.homeRuns / 100,
            walks: parkFactor.walks / 100,
            strikeouts: parkFactor.strikeouts / 100
        }
    }

    private getNumber(value: unknown, label: string, venueName: string): number {
        const parsed = Number(
            value
        )

        if (!Number.isFinite(parsed)) {
            throw new Error(
                `Invalid Baseball Savant ${label} value ${value} for ${venueName}.`
            )
        }

        return parsed
    }

}


interface BaseballSavantParkFactor {
    venueId: string
    venueName: string
    teamId: string
    teamName: string
    yearRange: string
    season: number
    rollingYears: number
    plateAppearances: number
    parkFactor: number
    runs: number
    singles: number
    doubles: number
    triples: number
    homeRuns: number
    walks: number
    strikeouts: number
}


export {
    BaseballSavantService
}


export type {
    BaseballSavantParkFactor
}
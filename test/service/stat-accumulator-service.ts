import { Handedness, PitchType, Position } from "../../src/service/enums.js"
import { ExitVelocityStat, PitchTypeMovementStat, PlayerFieldingPositionRaw, PlayerHittingSplitStats, PlayerImportRaw, PlayerPitchingSplitStats, PlayerRunningStatsRaw } from "../../src/service/interfaces.js"

class StatAccumulatorService {

    private readonly IN_ZONE = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])

    private readonly PA_EVENTS = new Set([
        "single",
        "double",
        "triple",
        "home_run",
        "walk",
        "intent_walk",
        "hit_by_pitch",
        "strikeout",
        "strikeout_double_play",
        "field_out",
        "force_out",
        "grounded_into_double_play",
        "double_play",
        "fielders_choice",
        "field_error",
        "sac_fly",
        "sac_bunt",
        "fielders_choice_out",
        "other_out"
    ])

    private readonly NON_AB_EVENTS = new Set([
        "walk",
        "intent_walk",
        "hit_by_pitch",
        "sac_fly",
        "sac_bunt",
        "catcher_interf"
    ])

    private readonly HIT_EVENTS = new Set([
        "single",
        "double",
        "triple",
        "home_run"
    ])

    private readonly DEFENSIVE_POSITIONS = new Set<Position>([
        Position.PITCHER,
        Position.CATCHER,
        Position.FIRST_BASE,
        Position.SECOND_BASE,
        Position.THIRD_BASE,
        Position.SHORTSTOP,
        Position.LEFT_FIELD,
        Position.CENTER_FIELD,
        Position.RIGHT_FIELD
    ])

    private readonly INFIELD_POSITIONS = new Set<Position>([
        Position.PITCHER,
        Position.CATCHER,
        Position.FIRST_BASE,
        Position.SECOND_BASE,
        Position.THIRD_BASE,
        Position.SHORTSTOP
    ])

    private readonly SIMPLE_LOCATION_POSITIONS: Record<string, Position> = {
        "1": Position.PITCHER,
        "2": Position.CATCHER,
        "3": Position.FIRST_BASE,
        "4": Position.SECOND_BASE,
        "5": Position.THIRD_BASE,
        "6": Position.SHORTSTOP,
        "7": Position.LEFT_FIELD,
        "8": Position.CENTER_FIELD,
        "9": Position.RIGHT_FIELD
    }

    public accumulateGameIntoSeasonPlayerImports(season: number, gamePk: number, gameData: any, players: Map<string, PlayerImportRaw>, filterPlayerIds?: Set<string>): void {
        const allPlays = gameData?.allPlays ?? gameData?.liveData?.plays?.allPlays ?? []
        const seenPlays = new Set<string>()

        const homeFieldAlignment = new Map<Position, string>()
        const awayFieldAlignment = new Map<Position, string>()

        this.initializeAlignmentFromBoxscoreTeam(gamePk, gameData?.liveData?.boxscore?.teams?.home, homeFieldAlignment, players)
        this.initializeAlignmentFromBoxscoreTeam(gamePk, gameData?.liveData?.boxscore?.teams?.away, awayFieldAlignment, players)

        for (const play of allPlays) {
            const atBatIndex = Number(play?.atBatIndex ?? play?.about?.atBatIndex)
            const playKey = `${gamePk}:${atBatIndex}`

            if (Number.isFinite(atBatIndex)) {
                if (seenPlays.has(playKey)) continue
                seenPlays.add(playKey)
            }

            const batterId = String(play?.matchup?.batter?.id ?? "")
            const pitcherId = String(play?.matchup?.pitcher?.id ?? "")

            const runnerIds = new Set<string>(
                (play?.runners ?? [])
                    .map((runner: any) => String(runner?.details?.runner?.id ?? ""))
                    .filter((id: string) => !!id)
            )

            const creditedFielderIds = new Set<string>(
                (play?.runners ?? [])
                    .flatMap((runner: any) => runner?.credits ?? [])
                    .map((credit: any) => String(credit?.player?.id ?? ""))
                    .filter((id: string) => !!id)
            )

            const isTopInning = play?.about?.isTopInning === true
            const defendingAlignment = isTopInning ? homeFieldAlignment : awayFieldAlignment

            this.applyDefensiveSubstitutionHints(gamePk, play, defendingAlignment, players)

            if (pitcherId) {
                defendingAlignment.set(Position.PITCHER, pitcherId)
            }

            for (const event of play?.playEvents ?? []) {
                const eventCode = String(event?.details?.code ?? "")
                if (event?.type === "pickoff" || eventCode === "1" || eventCode === "2" || eventCode === "3") {
                    const runnerId = this.getPickoffRunnerId(play, eventCode)
                    if (!runnerId) continue
                    if (filterPlayerIds && !filterPlayerIds.has(runnerId)) continue

                    const runnerRaw = this.getOrCreate(players, runnerId)
                    runnerRaw.running.pickoffAttemptsFaced++
                }
            }

            const shouldTrackPlay = !filterPlayerIds
                || (!!batterId && filterPlayerIds.has(batterId))
                || (!!pitcherId && filterPlayerIds.has(pitcherId))
                || Array.from(runnerIds).some(id => filterPlayerIds.has(id))
                || Array.from(creditedFielderIds).some(id => filterPlayerIds.has(id))
                || Array.from(defendingAlignment.values()).some(id => filterPlayerIds.has(id))

            if (!shouldTrackPlay) continue

            const batterTracked = !!batterId && (!filterPlayerIds || filterPlayerIds.has(batterId))
            const pitcherTracked = !!pitcherId && (!filterPlayerIds || filterPlayerIds.has(pitcherId))

            const batter = batterTracked
                ? this.getOrCreate(players, batterId, play?.matchup?.batter?.fullName, play?.matchup?.batSide?.code, undefined, "hitter")
                : undefined

            const pitcher = pitcherTracked
                ? this.getOrCreate(players, pitcherId, play?.matchup?.pitcher?.fullName, undefined, play?.matchup?.pitchHand?.code, "pitcher")
                : undefined

            if (batter && !batter.hitting.behaviorByCount) {
                batter.hitting.behaviorByCount = this.emptyBehaviorByCountRaw()
            }

            if (pitcher && !pitcher.pitching.behaviorByCount) {
                pitcher.pitching.behaviorByCount = this.emptyBehaviorByCountRaw()
            }

            this.markHittingGame(gamePk, batter)
            this.markPitchingGame(gamePk, pitcher)

            if (pitcher) {
                this.markFieldingPosition(gamePk, pitcher, Position.PITCHER)
                defendingAlignment.set(Position.PITCHER, pitcher.playerId)
            }

            const hittingSplitKey = play?.matchup?.pitchHand?.code === "L" ? "vsL" : "vsR"
            const pitchingSplitKey = play?.matchup?.batSide?.code === "L" ? "vsL" : "vsR"

            const eventType = String(play?.result?.eventType ?? "")
            const isPA = this.PA_EVENTS.has(eventType)
            const isAB = isPA && !this.NON_AB_EVENTS.has(eventType)
            const isHit = this.HIT_EVENTS.has(eventType)

            const startOuts = Number(play?.playEvents?.[0]?.count?.outs ?? play?.count?.outs ?? 0)
            const hasRunnerOnFirstAtStart = (play?.runners ?? []).some((runner: any) => runner?.movement?.originBase === "1B")
            const hasDoublePlayOpportunity = hasRunnerOnFirstAtStart && startOuts < 2

            if (batter && isPA) {
                batter.hitting.pa++
                batter.splits.hitting[hittingSplitKey].pa++

                if (isAB) {
                    batter.hitting.ab++
                    batter.splits.hitting[hittingSplitKey].ab++
                }

                if (isHit) {
                    batter.hitting.hits++
                    batter.splits.hitting[hittingSplitKey].hits++
                }

                if (eventType === "double") {
                    batter.hitting.doubles++
                    batter.splits.hitting[hittingSplitKey].doubles++
                }

                if (eventType === "triple") {
                    batter.hitting.triples++
                    batter.splits.hitting[hittingSplitKey].triples++
                }

                if (eventType === "home_run") {
                    batter.hitting.homeRuns++
                    batter.splits.hitting[hittingSplitKey].homeRuns++
                }

                if (eventType === "walk" || eventType === "intent_walk") {
                    batter.hitting.bb++
                    batter.splits.hitting[hittingSplitKey].bb++
                }

                if (eventType.includes("strikeout")) {
                    batter.hitting.so++
                    batter.splits.hitting[hittingSplitKey].so++
                }

                if (eventType === "hit_by_pitch") {
                    batter.hitting.hbp++
                    batter.splits.hitting[hittingSplitKey].hbp++
                }
            }

            if (pitcher && isPA) {
                pitcher.pitching.battersFaced++
                pitcher.splits.pitching[pitchingSplitKey].battersFaced++

                if (isHit) {
                    pitcher.pitching.hitsAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].hitsAllowed++
                }

                if (eventType === "double") {
                    pitcher.pitching.doublesAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].doublesAllowed++
                }

                if (eventType === "triple") {
                    pitcher.pitching.triplesAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].triplesAllowed++
                }

                if (eventType === "home_run") {
                    pitcher.pitching.homeRunsAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].homeRunsAllowed++
                }

                if (eventType === "walk" || eventType === "intent_walk") {
                    pitcher.pitching.bbAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].bbAllowed++
                }

                if (eventType.includes("strikeout")) {
                    pitcher.pitching.so++
                    pitcher.splits.pitching[pitchingSplitKey].so++
                }

                if (eventType === "hit_by_pitch") {
                    pitcher.pitching.hbpAllowed++
                    pitcher.splits.pitching[pitchingSplitKey].hbpAllowed++
                }
            }

            let prePitchBalls = 0
            let prePitchStrikes = 0

            for (const event of play?.playEvents ?? []) {
                if (event?.isPitch !== true) continue

                const details = event?.details ?? {}
                const pitchData = event?.pitchData ?? {}
                const hitData = event?.hitData ?? {}
                const callCode = details?.call?.code ?? details?.code ?? ""

                const isBall = details?.isBall === true || callCode === "*B"
                const isStrike = details?.isStrike === true
                const isInPlay = details?.isInPlay === true
                const isStrikeOutcome = isStrike || isInPlay
                const isSwing = callCode === "S" || callCode === "F" || callCode === "T" || callCode === "W" || isInPlay
                const isContact = callCode === "F" || callCode === "T" || isInPlay
                const isFoul = callCode === "F" || callCode === "T"
                const zone = Number(pitchData?.zone)
                const inZone = this.IN_ZONE.has(zone)

                const pitchType = this.mapPitchType(String(details?.type?.code ?? ""))
                const startSpeed = Number(pitchData?.startSpeed)
                const horizontalBreak = Number(pitchData?.breaks?.breakHorizontal)
                const verticalBreak = Number(pitchData?.breaks?.breakVertical)
                const launchSpeed = Number(hitData?.launchSpeed)

                if (batter) {
                    batter.hitting.pitchesSeen++

                    if (isBall) batter.hitting.ballsSeen++
                    if (isStrikeOutcome) batter.hitting.strikesSeen++

                    if (isSwing) batter.hitting.swings++
                    if (isSwing && inZone) batter.hitting.swingAtStrikes++
                    if (isSwing && !inZone) batter.hitting.swingAtBalls++

                    if (callCode === "C") batter.hitting.calledStrikes++
                    if (callCode === "S" || callCode === "W") batter.hitting.swingingStrikes++

                    if (inZone) batter.hitting.inZonePitches++

                    if (isContact && inZone) batter.hitting.inZoneContact++
                    if (isContact && !inZone) batter.hitting.outZoneContact++

                    if (isFoul) batter.hitting.fouls++
                    if (isInPlay) batter.hitting.ballsInPlay++

                    this.incrementInZoneByCount(batter.hitting.inZoneByCount, prePitchBalls, prePitchStrikes, inZone)
                    this.incrementBehaviorByCount(batter.hitting.behaviorByCount, prePitchBalls, prePitchStrikes, inZone, isSwing, isContact, isInPlay, isFoul)

                    if (isInPlay) {
                        this.addExitVelocity(batter.hitting.exitVelocity, launchSpeed)
                        this.addExitVelocity(this.getSplitExitVelocityStore(batter)[hittingSplitKey], launchSpeed)
                        this.syncSplitExitVelocityAverage(batter, hittingSplitKey)

                        switch (hitData?.trajectory) {
                            case "ground_ball":
                                batter.hitting.groundBalls++
                                break
                            case "fly_ball":
                                batter.hitting.flyBalls++
                                break
                            case "line_drive":
                                batter.hitting.lineDrives++
                                break
                            case "popup":
                                batter.hitting.popups++
                                break
                        }
                    }
                }

                if (pitcher) {
                    pitcher.pitching.pitchesThrown++

                    if (isBall) pitcher.pitching.ballsThrown++
                    if (isStrikeOutcome) pitcher.pitching.strikesThrown++

                    if (isSwing) pitcher.pitching.swingsInduced++
                    if (isSwing && inZone) pitcher.pitching.swingAtStrikesAllowed++
                    if (isSwing && !inZone) pitcher.pitching.swingAtBallsAllowed++

                    if (isContact && inZone) pitcher.pitching.inZoneContactAllowed++
                    if (isContact && !inZone) pitcher.pitching.outZoneContactAllowed++

                    if (isFoul) pitcher.pitching.foulsAllowed++
                    if (isInPlay) pitcher.pitching.ballsInPlayAllowed++

                    this.incrementInZoneByCount(pitcher.pitching.inZoneByCount, prePitchBalls, prePitchStrikes, inZone)
                    this.incrementBehaviorByCount(pitcher.pitching.behaviorByCount, prePitchBalls, prePitchStrikes, inZone, isSwing, isContact, isInPlay, isFoul)
                    this.addPitchTypeData(pitcher, pitchType, startSpeed, horizontalBreak, verticalBreak)

                    if (isInPlay) {
                        switch (hitData?.trajectory) {
                            case "ground_ball":
                                pitcher.pitching.groundBallsAllowed++
                                break
                            case "fly_ball":
                                pitcher.pitching.flyBallsAllowed++
                                break
                            case "line_drive":
                                pitcher.pitching.lineDrivesAllowed++
                                break
                            case "popup":
                                pitcher.pitching.popupsAllowed++
                                break
                        }
                    }
                }

                const postPitchBalls = Number(event?.count?.balls)
                const postPitchStrikes = Number(event?.count?.strikes)

                if (Number.isFinite(postPitchBalls)) {
                    prePitchBalls = Math.max(0, Math.min(3, postPitchBalls))
                }

                if (Number.isFinite(postPitchStrikes)) {
                    prePitchStrikes = Math.max(0, Math.min(2, postPitchStrikes))
                }
            }

            const outsOnPlay = isPA
                ? (play?.runners ?? []).filter((runner: any) => runner?.movement?.isOut === true).length
                : 0

            if (pitcher && outsOnPlay > 0) {
                pitcher.pitching.outs += outsOnPlay
                pitcher.splits.pitching[pitchingSplitKey].outs += outsOnPlay
            }

            if (outsOnPlay > 0) {
                for (const [position, playerId] of defendingAlignment.entries()) {
                    if (!playerId) continue
                    if (filterPlayerIds && !filterPlayerIds.has(playerId)) continue

                    const defender = this.getOrCreate(players, playerId)
                    this.addOutsOnField(gamePk, defender, position, outsOnPlay)
                }
            }

            const inPlayEvent = this.getInPlayEvent(play)
            const hitData = inPlayEvent?.hitData ?? {}
            const hitTrajectory = String(hitData?.trajectory ?? "")
            const isGroundBallDoublePlayChance = hasDoublePlayOpportunity && hitTrajectory === "ground_ball"
            const isDoublePlayTurn = (eventType === "grounded_into_double_play" || eventType === "double_play") && outsOnPlay >= 2

            const fieldedBallCredits = (play?.runners ?? [])
                .flatMap((runner: any) => runner?.credits ?? [])
                .filter((credit: any) => String(credit?.credit ?? "") === "f_fielded_ball")

            if (fieldedBallCredits.length === 1) {
                const credit = fieldedBallCredits[0]
                const fielderId = String(credit?.player?.id ?? "")
                const posAbbr = String(credit?.position?.abbreviation ?? "").trim()
                const mappedPosition = this.mapPositionAbbreviation(posAbbr)

                if (fielderId && mappedPosition && (!filterPlayerIds || filterPlayerIds.has(fielderId))) {
                    const primaryFielder = this.getOrCreate(players, fielderId)
                    defendingAlignment.set(mappedPosition, fielderId)
                    this.markFieldingPosition(gamePk, primaryFielder, mappedPosition)
                }
            }

            const doublePlayOpportunityFielders = new Set<string>()
            const doublePlayFielders = new Set<string>()

            for (const runner of play?.runners ?? []) {
                for (const credit of runner?.credits ?? []) {
                    const fielderId = String(credit?.player?.id ?? "")
                    if (!fielderId) continue
                    if (filterPlayerIds && !filterPlayerIds.has(fielderId)) continue

                    const posAbbr = String(credit?.position?.abbreviation ?? "").trim()
                    const mappedPosition = this.mapPositionAbbreviation(posAbbr)

                    const fielder = this.getOrCreate(players, fielderId)
                    const creditType = String(credit?.credit ?? "")
                    const runnerIsOut = runner?.movement?.isOut === true

                    if (mappedPosition) {
                        defendingAlignment.set(mappedPosition, fielderId)
                        this.markFieldingPosition(gamePk, fielder, mappedPosition)
                    }

                    if (
                        isGroundBallDoublePlayChance &&
                        mappedPosition &&
                        this.INFIELD_POSITIONS.has(mappedPosition) &&
                        (creditType === "f_fielded_ball" || creditType === "f_assist" || creditType === "f_putout")
                    ) {
                        const opportunityKey = `${fielderId}:${mappedPosition}`
                        if (!doublePlayOpportunityFielders.has(opportunityKey)) {
                            doublePlayOpportunityFielders.add(opportunityKey)
                            this.incrementDoublePlayOpportunity(fielder, mappedPosition)
                        }
                    }

                    if (creditType === "f_putout") {
                        fielder.fielding.putouts++
                        fielder.fielding.chances++

                        if (mappedPosition) {
                            const positionStats = this.getOrCreatePositionFielding(fielder, mappedPosition)
                            positionStats.putouts++
                            positionStats.chances++
                            positionStats.outsRecorded++
                        }
                    }

                    if (creditType === "f_assist") {
                        fielder.fielding.assists++
                        fielder.fielding.chances++
                        this.incrementThrowAttempt(fielder, mappedPosition, runnerIsOut)
                        this.markOutfieldAssistIfApplicable(fielder, posAbbr, creditType, playKey)

                        if (mappedPosition) {
                            const positionStats = this.getOrCreatePositionFielding(fielder, mappedPosition)
                            positionStats.assists++
                            positionStats.chances++
                        }
                    }

                    if (creditType === "f_assist" && posAbbr === "C" && eventType.startsWith("caught_stealing")) {
                        fielder.fielding.catcherCaughtStealing++
                    }

                    if (creditType === "f_assist" && posAbbr === "C" && eventType === "other_out") {
                        fielder.fielding.catcherCaughtStealing++
                    }

                    if (creditType === "f_fielded_ball" && ["LF", "CF", "RF"].includes(posAbbr) && mappedPosition) {
                        defendingAlignment.set(mappedPosition, fielderId)
                        this.markFieldingPosition(gamePk, fielder, mappedPosition)
                    }

                    if (creditType === "f_fielded_ball") {
                        this.incrementFieldedBall(fielder, mappedPosition, hitTrajectory || undefined)
                    }

                    if (
                        isDoublePlayTurn &&
                        runnerIsOut &&
                        mappedPosition &&
                        this.INFIELD_POSITIONS.has(mappedPosition) &&
                        (creditType === "f_assist" || creditType === "f_putout")
                    ) {
                        const doublePlayKey = `${fielderId}:${mappedPosition}`
                        if (!doublePlayFielders.has(doublePlayKey)) {
                            doublePlayFielders.add(doublePlayKey)
                            fielder.fielding.doublePlays++
                            const positionStats = this.getOrCreatePositionFielding(fielder, mappedPosition)
                            positionStats.doublePlays++
                        }
                    }
                }

                const runnerId = String(runner?.details?.runner?.id ?? "")
                if (!runnerId) continue
                if (filterPlayerIds && !filterPlayerIds.has(runnerId)) continue

                const runnerRaw = this.getOrCreate(players, runnerId, runner?.details?.runner?.fullName)
                this.markHittingGame(gamePk, runnerRaw)

                const runnerEventType = String(runner?.details?.eventType ?? "")
                const movementReason = String(runner?.details?.movementReason ?? "")
                const originBase = runner?.movement?.originBase ?? null
                const endBase = runner?.movement?.end ?? null
                const isOut = runner?.movement?.isOut === true

                this.updateRunningBaseOccupancy(runnerRaw, originBase, endBase)
                this.updateRunningExtraBaseTaken(runnerRaw, runnerEventType, originBase, endBase)
                this.updateAdditionalRunningStats(runnerRaw, runnerEventType, movementReason, originBase, endBase, isOut)

                if (runnerEventType.startsWith("stolen_base")) {
                    runnerRaw.running.sb++
                    runnerRaw.running.sbAttempts++

                    for (const credit of runner?.credits ?? []) {
                        const fielderId = String(credit?.player?.id ?? "")
                        const posAbbr = String(credit?.position?.abbreviation ?? "")
                        if (!fielderId || posAbbr !== "C") continue
                        if (filterPlayerIds && !filterPlayerIds.has(fielderId)) continue

                        const catcher = this.getOrCreate(players, fielderId)
                        catcher.fielding.catcherStolenBasesAllowed++
                        defendingAlignment.set(Position.CATCHER, fielderId)
                        this.markFieldingPosition(gamePk, catcher, Position.CATCHER)
                    }
                }

                if (runnerEventType.startsWith("caught_stealing")) {
                    runnerRaw.running.cs++
                    runnerRaw.running.sbAttempts++
                }
            }
        }
    }

    private emptyExitVelocityStat(): ExitVelocityStat {
        return {
            count: 0,
            totalExitVelo: 0,
            avgExitVelo: 0
        }
    }

    private emptyPitchTypeMovementStat(): PitchTypeMovementStat {
        return {
            count: 0,
            totalMph: 0,
            avgMph: 0,
            totalHorizontalBreak: 0,
            avgHorizontalBreak: 0,
            totalVerticalBreak: 0,
            avgVerticalBreak: 0
        }
    }

    private emptyFieldingPositionRaw(): PlayerFieldingPositionRaw {
        return {
            chances: 0,
            putouts: 0,
            assists: 0,
            errors: 0,
            doublePlays: 0,
            doublePlayOpportunities: 0,
            outsRecorded: 0,
            fieldedBalls: 0,
            groundBallsFielded: 0,
            flyBallsFielded: 0,
            lineDrivesFielded: 0,
            popupsFielded: 0,
            throwsAttempted: 0,
            successfulThrowOuts: 0,
            battedBallOpportunitiesByLocation: {}
        }
    }

    private emptyRunningRaw(): PlayerRunningStatsRaw {
        return {
            sb: 0,
            cs: 0,
            sbAttempts: 0,
            timesOnFirst: 0,
            timesOnSecond: 0,
            timesOnThird: 0,
            firstToThird: 0,
            firstToHome: 0,
            secondToHome: 0,
            extraBaseTaken: 0,
            extraBaseOpportunities: 0,
            pickedOff: 0,
            pickoffAttemptsFaced: 0,
            advancedOnGroundOut: 0,
            advancedOnFlyOut: 0,
            tagUps: 0,
            heldOnBase: 0
        }
    }

    private emptyHitSplit(): PlayerHittingSplitStats {
        return {
            pa: 0,
            ab: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            bb: 0,
            so: 0,
            hbp: 0,
            exitVelocity: 0
        }
    }

    private emptyPitchSplit(): PlayerPitchingSplitStats {
        return {
            battersFaced: 0,
            outs: 0,
            hitsAllowed: 0,
            doublesAllowed: 0,
            triplesAllowed: 0,
            homeRunsAllowed: 0,
            bbAllowed: 0,
            so: 0,
            hbpAllowed: 0
        }
    }

    private emptyInZoneByCountRaw(): { balls: number, strikes: number, inZone: number, total: number }[] {
        return [
            { balls: 0, strikes: 0, inZone: 0, total: 0 },
            { balls: 0, strikes: 1, inZone: 0, total: 0 },
            { balls: 0, strikes: 2, inZone: 0, total: 0 },
            { balls: 1, strikes: 0, inZone: 0, total: 0 },
            { balls: 1, strikes: 1, inZone: 0, total: 0 },
            { balls: 1, strikes: 2, inZone: 0, total: 0 },
            { balls: 2, strikes: 0, inZone: 0, total: 0 },
            { balls: 2, strikes: 1, inZone: 0, total: 0 },
            { balls: 2, strikes: 2, inZone: 0, total: 0 },
            { balls: 3, strikes: 0, inZone: 0, total: 0 },
            { balls: 3, strikes: 1, inZone: 0, total: 0 },
            { balls: 3, strikes: 2, inZone: 0, total: 0 }
        ]
    }

    private incrementInZoneByCount(buckets: { balls: number, strikes: number, inZone: number, total: number }[], balls: number, strikes: number, inZone: boolean): void {
        const bucket = buckets.find(item => item.balls === balls && item.strikes === strikes)
        if (!bucket) return

        bucket.total++

        if (inZone) {
            bucket.inZone++
        }
    }

    private getOrCreatePositionFielding(player: PlayerImportRaw, position: Position): PlayerFieldingPositionRaw {
        const existing = player.fielding.positionStats[position]
        if (existing) return existing

        const created = this.emptyFieldingPositionRaw()
        player.fielding.positionStats[position] = created
        return created
    }

    private getSplitExitVelocityStore(player: PlayerImportRaw): { vsL: ExitVelocityStat, vsR: ExitVelocityStat } {
        const existing = (player as any).__splitExitVelocity
        if (existing) return existing

        const created = {
            vsL: this.emptyExitVelocityStat(),
            vsR: this.emptyExitVelocityStat()
        }

        ;(player as any).__splitExitVelocity = created
        return created
    }

    private syncSplitExitVelocityAverage(player: PlayerImportRaw, splitKey: "vsL" | "vsR"): void {
        const store = this.getSplitExitVelocityStore(player)[splitKey]
        player.splits.hitting[splitKey].exitVelocity = store.count > 0
            ? Number((store.totalExitVelo / store.count).toFixed(3))
            : 0
    }

    private incrementFieldedBall(player: PlayerImportRaw, position: Position | undefined, trajectory?: string): void {
        player.fielding.fieldedBalls++

        if (trajectory === "ground_ball") player.fielding.groundBallsFielded++
        if (trajectory === "fly_ball") player.fielding.flyBallsFielded++
        if (trajectory === "line_drive") player.fielding.lineDrivesFielded++
        if (trajectory === "popup") player.fielding.popupsFielded++

        const locationKey = position
            ? Object.entries(this.SIMPLE_LOCATION_POSITIONS).find(([_, pos]) => pos === position)?.[0]
            : undefined

        if (locationKey) {
            player.fielding.battedBallOpportunitiesByLocation[locationKey] =
                (player.fielding.battedBallOpportunitiesByLocation[locationKey] ?? 0) + 1
        }

        if (position) {
            const positionStats = this.getOrCreatePositionFielding(player, position)

            positionStats.fieldedBalls++

            if (trajectory === "ground_ball") positionStats.groundBallsFielded++
            if (trajectory === "fly_ball") positionStats.flyBallsFielded++
            if (trajectory === "line_drive") positionStats.lineDrivesFielded++
            if (trajectory === "popup") positionStats.popupsFielded++

            if (locationKey) {
                positionStats.battedBallOpportunitiesByLocation[locationKey] =
                    (positionStats.battedBallOpportunitiesByLocation[locationKey] ?? 0) + 1
            }
        }
    }

    private incrementThrowAttempt(player: PlayerImportRaw, position: Position | undefined, wasOut: boolean): void {
        player.fielding.throwsAttempted++

        if (position) {
            const positionStats = this.getOrCreatePositionFielding(player, position)
            positionStats.throwsAttempted++

            if (wasOut) {
                positionStats.successfulThrowOuts++
                positionStats.outsRecorded++
            }
        }

        if (wasOut) {
            player.fielding.successfulThrowOuts++
        }
    }

    private incrementDoublePlayOpportunity(player: PlayerImportRaw, position: Position | undefined): void {
        if (!position || !this.INFIELD_POSITIONS.has(position)) return

        player.fielding.doublePlayOpportunities++
        const positionStats = this.getOrCreatePositionFielding(player, position)
        positionStats.doublePlayOpportunities++
    }

    private getPickoffRunnerId(play: any, baseCode: string): string {
        if (baseCode === "1") return String(play?.matchup?.postOnFirst?.id ?? "")
        if (baseCode === "2") return String(play?.matchup?.postOnSecond?.id ?? "")
        if (baseCode === "3") return String(play?.matchup?.postOnThird?.id ?? "")
        return ""
    }

    private getOrCreate(players: Map<string, PlayerImportRaw>, id: string, fullName?: string, bats?: string, throws?: string, role?: "hitter" | "pitcher"): PlayerImportRaw {
        let existing = players.get(id)

        if (existing) {
            if (!existing.firstName && fullName) {
                const parts = fullName.split(" ")
                existing.firstName = parts.shift() ?? ""
                existing.lastName = parts.join(" ")
            }

            if (bats && !existing.bats) existing.bats = this.mapHandedness(bats)
            if (throws && !existing.throws) existing.throws = this.mapHandedness(throws)

            if (role && existing.primaryRole !== role) {
                existing.primaryRole = "twoWay"
            }

            if (!existing.hitting.behaviorByCount) {
                existing.hitting.behaviorByCount = this.emptyBehaviorByCountRaw()
            }

            if (!existing.pitching.behaviorByCount) {
                existing.pitching.behaviorByCount = this.emptyBehaviorByCountRaw()
            }

            return existing
        }

        const parts = (fullName ?? "").split(" ")
        const firstName = parts.shift() ?? ""
        const lastName = parts.join(" ")

        const created: PlayerImportRaw = {
            playerId: id,
            firstName,
            lastName,
            age: undefined,
            primaryPosition: Position.DESIGNATED_HITTER,
            secondaryPositions: [],
            throws: this.mapHandedness(throws),
            bats: this.mapHandedness(bats),
            primaryRole: role ?? "hitter",

            hitting: {
                games: 0,
                pa: 0,
                ab: 0,
                hits: 0,
                doubles: 0,
                triples: 0,
                homeRuns: 0,
                bb: 0,
                so: 0,
                hbp: 0,
                groundBalls: 0,
                flyBalls: 0,
                lineDrives: 0,
                popups: 0,
                pitchesSeen: 0,
                ballsSeen: 0,
                strikesSeen: 0,
                swings: 0,
                swingAtBalls: 0,
                swingAtStrikes: 0,
                calledStrikes: 0,
                swingingStrikes: 0,
                inZonePitches: 0,
                inZoneContact: 0,
                outZoneContact: 0,
                fouls: 0,
                ballsInPlay: 0,
                inZoneByCount: this.emptyInZoneByCountRaw(),
                behaviorByCount: this.emptyBehaviorByCountRaw(),
                exitVelocity: this.emptyExitVelocityStat()
            },

            pitching: {
                games: 0,
                starts: 0,
                battersFaced: 0,
                outs: 0,
                hitsAllowed: 0,
                doublesAllowed: 0,
                triplesAllowed: 0,
                homeRunsAllowed: 0,
                bbAllowed: 0,
                so: 0,
                hbpAllowed: 0,
                groundBallsAllowed: 0,
                flyBallsAllowed: 0,
                lineDrivesAllowed: 0,
                popupsAllowed: 0,
                pitchesThrown: 0,
                ballsThrown: 0,
                strikesThrown: 0,
                swingsInduced: 0,
                swingAtBallsAllowed: 0,
                swingAtStrikesAllowed: 0,
                inZoneContactAllowed: 0,
                outZoneContactAllowed: 0,
                foulsAllowed: 0,
                ballsInPlayAllowed: 0,
                inZoneByCount: this.emptyInZoneByCountRaw(),
                behaviorByCount: this.emptyBehaviorByCountRaw(),
                pitchTypes: {}
            },

            fielding: {
                gamesAtPosition: {},
                inningsAtPosition: {},
                errors: 0,
                assists: 0,
                putouts: 0,
                doublePlays: 0,
                doublePlayOpportunities: 0,
                outfieldAssists: 0,
                catcherCaughtStealing: 0,
                catcherStolenBasesAllowed: 0,
                passedBalls: 0,
                fieldedBalls: 0,
                groundBallsFielded: 0,
                flyBallsFielded: 0,
                lineDrivesFielded: 0,
                popupsFielded: 0,
                throwsAttempted: 0,
                successfulThrowOuts: 0,
                battedBallOpportunitiesByLocation: {},
                chances: 0,
                positionStats: {}
            },

            running: this.emptyRunningRaw(),

            splits: {
                hitting: {
                    vsL: this.emptyHitSplit(),
                    vsR: this.emptyHitSplit()
                },
                pitching: {
                    vsL: this.emptyPitchSplit(),
                    vsR: this.emptyPitchSplit()
                }
            }
        }

        ;(created as any).__hittingGameIds = new Set<number>()
        ;(created as any).__pitchingGameIds = new Set<number>()
        ;(created as any).__fieldingGameIds = new Set<number>()
        ;(created as any).__fieldingPositionsByGame = new Map<number, Set<Position>>()
        ;(created as any).__fieldedBallPlayKeys = new Set<string>()
        ;(created as any).__outsAtPosition = {}
        ;(created as any).__splitExitVelocity = {
            vsL: this.emptyExitVelocityStat(),
            vsR: this.emptyExitVelocityStat()
        }

        players.set(id, created)
        return created
    }

    private markHittingGame(gamePk: number, player: PlayerImportRaw | undefined): void {
        if (!player) return

        const seen = ((player as any).__hittingGameIds ??= new Set<number>()) as Set<number>

        if (!seen.has(gamePk)) {
            seen.add(gamePk)
            player.hitting.games++
        }
    }

    private markPitchingGame(gamePk: number, player: PlayerImportRaw | undefined): void {
        if (!player) return

        const seen = ((player as any).__pitchingGameIds ??= new Set<number>()) as Set<number>

        if (!seen.has(gamePk)) {
            seen.add(gamePk)
            player.pitching.games++
        }
    }

    private mapPositionAbbreviation(abbr: string): Position | undefined {
        switch (abbr) {
            case "P":
                return Position.PITCHER
            case "C":
                return Position.CATCHER
            case "1B":
                return Position.FIRST_BASE
            case "2B":
                return Position.SECOND_BASE
            case "3B":
                return Position.THIRD_BASE
            case "SS":
                return Position.SHORTSTOP
            case "LF":
                return Position.LEFT_FIELD
            case "CF":
                return Position.CENTER_FIELD
            case "RF":
                return Position.RIGHT_FIELD
            default:
                return undefined
        }
    }

    private mapPitchType(code: string): PitchType | undefined {
        switch (code) {
            case "FF":
                return PitchType.FF
            case "CU":
                return PitchType.CU
            case "CH":
                return PitchType.CH
            case "FC":
                return PitchType.FC
            case "FO":
                return PitchType.FO
            case "KN":
                return PitchType.KN
            case "KC":
                return PitchType.KC
            case "SC":
                return PitchType.SC
            case "SI":
                return PitchType.SI
            case "SL":
                return PitchType.SL
            case "SV":
                return PitchType.SV
            case "FS":
                return PitchType.FS
            case "ST":
                return PitchType.ST
            default:
                return undefined
        }
    }

    private addPitchTypeData(player: PlayerImportRaw, pitchType: PitchType | undefined, startSpeed: number | undefined, horizontalBreak: number | undefined, verticalBreak: number | undefined): void {
        if (!pitchType) return

        const current = player.pitching.pitchTypes[pitchType] ?? this.emptyPitchTypeMovementStat()

        if (Number.isFinite(startSpeed) && (startSpeed as number) > 0) {
            current.count++
            current.totalMph += startSpeed as number
        }

        if (Number.isFinite(horizontalBreak)) {
            current.totalHorizontalBreak += horizontalBreak as number
        }

        if (Number.isFinite(verticalBreak)) {
            current.totalVerticalBreak += verticalBreak as number
        }

        if (current.count > 0) {
            current.avgMph = Number((current.totalMph / current.count).toFixed(3))
            current.avgHorizontalBreak = Number((current.totalHorizontalBreak / current.count).toFixed(3))
            current.avgVerticalBreak = Number((current.totalVerticalBreak / current.count).toFixed(3))
        }

        player.pitching.pitchTypes[pitchType] = current
    }

    private addExitVelocity(stat: ExitVelocityStat, launchSpeed: number | undefined): void {
        if (!Number.isFinite(launchSpeed) || (launchSpeed as number) <= 0) return

        stat.count++
        stat.totalExitVelo += launchSpeed as number
        stat.avgExitVelo = Number((stat.totalExitVelo / stat.count).toFixed(3))
    }

    private markFieldingPosition(gamePk: number, player: PlayerImportRaw, position: Position): void {
        const seenGames = ((player as any).__fieldingGameIds ??= new Set<number>()) as Set<number>
        const positionsByGame = ((player as any).__fieldingPositionsByGame ??= new Map<number, Set<Position>>()) as Map<number, Set<Position>>

        seenGames.add(gamePk)

        let gamePositions = positionsByGame.get(gamePk)
        if (!gamePositions) {
            gamePositions = new Set<Position>()
            positionsByGame.set(gamePk, gamePositions)
        }

        if (!gamePositions.has(position)) {
            gamePositions.add(position)
            player.fielding.gamesAtPosition[position] = (player.fielding.gamesAtPosition[position] ?? 0) + 1
        }

        this.getOrCreatePositionFielding(player, position)

        if (player.primaryPosition === Position.DESIGNATED_HITTER) {
            player.primaryPosition = position
        } else if (player.primaryPosition !== position && !player.secondaryPositions.includes(position)) {
            player.secondaryPositions.push(position)
        }
    }

    private addOutsOnField(gamePk: number, player: PlayerImportRaw, position: Position, outs: number): void {
        if (!outs || outs <= 0) return
        if (!this.DEFENSIVE_POSITIONS.has(position)) return

        const outsAtPosition = ((player as any).__outsAtPosition ??= {}) as Partial<Record<Position, number>>
        outsAtPosition[position] = (outsAtPosition[position] ?? 0) + outs
        player.fielding.inningsAtPosition[position] = Number(((outsAtPosition[position] ?? 0) / 3).toFixed(3))

        this.markFieldingPosition(gamePk, player, position)
    }

    private markOutfieldAssistIfApplicable(player: PlayerImportRaw, posAbbr: string, creditType: string, playKey: string): void {
        if (creditType !== "f_assist") return
        if (!["LF", "CF", "RF"].includes(posAbbr)) return

        const seen = ((player as any).__fieldedBallPlayKeys ??= new Set<string>()) as Set<string>
        const dedupeKey = `ofa:${playKey}`

        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey)
            player.fielding.outfieldAssists++
        }
    }

    private updateRunningBaseOccupancy(player: PlayerImportRaw, originBase: string | null | undefined, endBase: string | null | undefined): void {
        if (!endBase) return

        if (originBase == null) {
            if (endBase === "1B") player.running.timesOnFirst++
            if (endBase === "2B") player.running.timesOnSecond++
            if (endBase === "3B") player.running.timesOnThird++
        }
    }

    private updateRunningExtraBaseTaken(player: PlayerImportRaw, eventType: string, originBase: string | null | undefined, endBase: string | null | undefined): void {
        if (!originBase || !endBase) return

        if (eventType === "single") {
            if (originBase === "1B") {
                player.running.extraBaseOpportunities++
                if (endBase === "3B" || endBase === "score") {
                    player.running.extraBaseTaken++
                }
                if (endBase === "3B") player.running.firstToThird++
                if (endBase === "score") player.running.firstToHome++
            }

            if (originBase === "2B") {
                player.running.extraBaseOpportunities++
                if (endBase === "score") {
                    player.running.extraBaseTaken++
                    player.running.secondToHome++
                }
            }
        }

        if (eventType === "double") {
            if (originBase === "1B") {
                player.running.extraBaseOpportunities++
                if (endBase === "score") {
                    player.running.extraBaseTaken++
                    player.running.firstToHome++
                }
            }
        }
    }

    private updateAdditionalRunningStats(player: PlayerImportRaw, eventType: string, movementReason: string, originBase: string | null | undefined, endBase: string | null | undefined, isOut: boolean): void {
        if (eventType.startsWith("picked_off")) {
            player.running.pickedOff++
        }

        if (!originBase) return

        if (!isOut && movementReason === "r_adv_play") {
            if (eventType === "field_out") {
                player.running.advancedOnGroundOut++
            }

            if (eventType === "sac_fly") {
                player.running.advancedOnFlyOut++
                player.running.tagUps++
            }

            if (eventType === "field_out" && originBase === "3B" && endBase === "score") {
                player.running.tagUps++
            }

            if (endBase === originBase) {
                player.running.heldOnBase++
            }
        }
    }

    private getInPlayEvent(play: any): any | undefined {
        return (play?.playEvents ?? []).find((event: any) => event?.isPitch === true && event?.details?.isInPlay === true)
    }

    private initializeAlignmentFromBoxscoreTeam(gamePk: number, teamBox: any, alignment: Map<Position, string>, players: Map<string, PlayerImportRaw>): void {
        const playersById = teamBox?.players ?? {}

        for (const boxPlayer of Object.values(playersById) as any[]) {
            const playerId = String(boxPlayer?.person?.id ?? "")
            if (!playerId) continue

            const fieldingStats = boxPlayer?.stats?.fielding
            const allPositions = Array.isArray(boxPlayer?.allPositions) ? boxPlayer.allPositions : []
            const player = this.getOrCreate(
                players,
                playerId,
                boxPlayer?.person?.fullName,
                boxPlayer?.batSide?.code,
                boxPlayer?.pitchHand?.code
            )

            if (typeof fieldingStats?.errors === "number") {
                player.fielding.errors += Number(fieldingStats.errors ?? 0)
            }

            if (typeof fieldingStats?.passedBall === "number" || typeof fieldingStats?.passedBalls === "number") {
                player.fielding.passedBalls += Number(fieldingStats?.passedBall ?? fieldingStats?.passedBalls ?? 0)
            }

            if (typeof fieldingStats?.doublePlays === "number") {
                player.fielding.doublePlays += Number(fieldingStats.doublePlays ?? 0)
            }

            const inningValueRaw =
                fieldingStats?.innings
                ?? fieldingStats?.inningsPlayed
                ?? fieldingStats?.inn
                ?? fieldingStats?.partialInnings

            const inningValue = Number(inningValueRaw)

            for (const pos of allPositions) {
                const abbr = String(pos?.abbreviation ?? "").trim()
                const mapped = this.mapPositionAbbreviation(abbr)
                if (!mapped) continue

                alignment.set(mapped, playerId)
                this.markFieldingPosition(gamePk, player, mapped)

                if (Number.isFinite(inningValue) && inningValue > 0) {
                    player.fielding.inningsAtPosition[mapped] = Math.max(
                        player.fielding.inningsAtPosition[mapped] ?? 0,
                        inningValue
                    )
                }
            }
        }
    }

    private maybeApplyAlignmentHint(gamePk: number, rawPlayerId: any, rawPosition: any, defendingAlignment: Map<Position, string>, players: Map<string, PlayerImportRaw>, fullName?: string): void {
        const playerId = String(rawPlayerId ?? "")
        const mappedPosition = this.mapPositionAbbreviation(String(rawPosition ?? "").trim())
        if (!playerId || !mappedPosition) return

        defendingAlignment.set(mappedPosition, playerId)

        const player = this.getOrCreate(players, playerId, fullName)
        this.markFieldingPosition(gamePk, player, mappedPosition)
    }

    private applyDefensiveSubstitutionHints(gamePk: number, play: any, defendingAlignment: Map<Position, string>, players: Map<string, PlayerImportRaw>): void {
        const candidateEvents = [
            ...(play?.playEvents ?? []),
            play
        ]

        for (const ev of candidateEvents) {
            const details = ev?.details ?? ev ?? {}
            const replacements = [
                details?.replacedPlayer,
                details?.replacingPlayer,
                details?.player,
                details?.substitution,
                details?.positionSwitch
            ].filter(Boolean)

            const directPosition =
                details?.position?.abbreviation
                ?? details?.toPosition?.abbreviation
                ?? details?.position?.code
                ?? details?.toPosition?.code

            const directPlayerId =
                details?.player?.id
                ?? details?.replacingPlayer?.id
                ?? details?.substitution?.player?.id
                ?? details?.person?.id

            const directPlayerName =
                details?.player?.fullName
                ?? details?.replacingPlayer?.fullName
                ?? details?.substitution?.player?.fullName
                ?? details?.person?.fullName

            this.maybeApplyAlignmentHint(gamePk, directPlayerId, directPosition, defendingAlignment, players, directPlayerName)

            for (const rep of replacements) {
                const repPlayerId = rep?.id ?? rep?.player?.id ?? rep?.person?.id
                const repPlayerName = rep?.fullName ?? rep?.player?.fullName ?? rep?.person?.fullName
                const repPosition =
                    rep?.position?.abbreviation
                    ?? rep?.toPosition?.abbreviation
                    ?? rep?.abbreviation

                this.maybeApplyAlignmentHint(gamePk, repPlayerId, repPosition, defendingAlignment, players, repPlayerName)
            }
        }
    }

    private emptyBehaviorByCountRaw(): { balls: number; strikes: number; zonePitches: number; chasePitches: number; zoneSwings: number; chaseSwings: number; zoneContact: number; chaseContact: number; zoneMisses: number; chaseMisses: number; zoneFouls: number; chaseFouls: number; zoneBallsInPlay: number; chaseBallsInPlay: number }[] {
        return [
            { balls: 0, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 0, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 0, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 1, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 2, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 0, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 1, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 },
            { balls: 3, strikes: 2, zonePitches: 0, chasePitches: 0, zoneSwings: 0, chaseSwings: 0, zoneContact: 0, chaseContact: 0, zoneMisses: 0, chaseMisses: 0, zoneFouls: 0, chaseFouls: 0, zoneBallsInPlay: 0, chaseBallsInPlay: 0 }
        ]
    }

    private incrementBehaviorByCount(buckets: { balls: number; strikes: number; zonePitches: number; chasePitches: number; zoneSwings: number; chaseSwings: number; zoneContact: number; chaseContact: number; zoneMisses: number; chaseMisses: number; zoneFouls: number; chaseFouls: number; zoneBallsInPlay: number; chaseBallsInPlay: number }[], balls: number, strikes: number, inZone: boolean, isSwing: boolean, isContact: boolean, isInPlay: boolean, isFoul: boolean): void {
        const bucket = buckets.find(item => item.balls === balls && item.strikes === strikes)
        if (!bucket) return

        if (inZone) {
            bucket.zonePitches++

            if (isSwing) {
                bucket.zoneSwings++
            }

            if (isContact) {
                bucket.zoneContact++
            }

            if (isSwing && !isContact) {
                bucket.zoneMisses++
            }

            if (isFoul) {
                bucket.zoneFouls++
            }

            if (isInPlay) {
                bucket.zoneBallsInPlay++
            }
        } else {
            bucket.chasePitches++

            if (isSwing) {
                bucket.chaseSwings++
            }

            if (isContact) {
                bucket.chaseContact++
            }

            if (isSwing && !isContact) {
                bucket.chaseMisses++
            }

            if (isFoul) {
                bucket.chaseFouls++
            }

            if (isInPlay) {
                bucket.chaseBallsInPlay++
            }
        }
    }

    private mapHandedness(value?: string): Handedness {
        if (value === "L") return Handedness.L
        if (value === "R") return Handedness.R
        if (value === "S") return Handedness.S
        return Handedness.R
    }
}

export {
    StatAccumulatorService
}
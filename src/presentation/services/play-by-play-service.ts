import {
    BaseResult,
    Contact,
    OfficialPlayResult,
    OfficialRunnerResult,
    PitchCall,
    PitchType,
    PitchZone,
    PlayResult,
    Position,
    ShallowDeep
} from "../../sim/service/enums.js"

import type {
    Count,
    Game,
    GamePlayer,
    Pitch,
    Play,
    RunnerEvent
} from "../../sim/service/interfaces.js"




class PlayByPlayService {

    public getPlayDescriptions(game: Game, play: Play): PlayDescription[] {
        const descriptions: PlayDescription[] = []
        const gamePlayers = this.getGamePlayers(game)
        const hitter = gamePlayers[play.hitterId]
        let inPlayPitch: Pitch | undefined

        descriptions.push(...this.getSubstitutionDescriptions(game, play))

        descriptions.push({
            type: PlayDescriptionType.RECAP,
            text: this.getMatchupDescription(play, hitter)
        })

        const pitches = play.pitchLog?.pitches ?? []

        for (let index = 0; index < pitches.length; index++) {
            const pitch = pitches[index]

            if (pitch.result === PitchCall.IN_PLAY) {
                inPlayPitch = pitch
            }

            descriptions.push({
                type: PlayDescriptionType.RECAP,
                text: this.getPitchDescription(pitch),
                meta: {
                    pitch
                }
            })

            const runnerEvents = play.runner?.events?.filter(event => event.pitchIndex === index) ?? []

            for (const runnerEvent of runnerEvents) {
                if (this.isBatterRunnerPrimaryEvent(play, runnerEvent)) {
                    continue
                }

                const runnerText = this.getRunnerDescription(game, runnerEvent)

                if (runnerText) {
                    descriptions.push({
                        type: PlayDescriptionType.RECAP,
                        text: runnerText
                    })
                }
            }
        }

        const fielderPlayer = play.fielderId ? gamePlayers[play.fielderId] : undefined

        descriptions.push(...this.getPlayResultDescription(play, hitter, fielderPlayer, inPlayPitch))
        descriptions.push(...this.getRunnerRecapDescription(game, play))

        let announcedScoreThisPlay = false
        const runs = play.runner?.result?.end?.scored?.length ?? 0

        if (runs > 0) {
            descriptions.push({
                type: PlayDescriptionType.RECAP,
                text: runs === 1 ? "1 run scores." : `${runs} runs score.`
            })

            descriptions.push({
                type: PlayDescriptionType.RECAP,
                text: `The score is ${play.score.end?.away ?? play.score.start.away} - ${play.score.end?.home ?? play.score.start.home}.`
            })

            announcedScoreThisPlay = true
        }

        if ((play.runner?.result?.end?.out?.length ?? 0) > 0) {
            const outs = play.count.end?.outs ?? 0

            if (outs === 3) {
                descriptions.push({
                    type: PlayDescriptionType.RECAP,
                    text: "There's 3 outs and the inning is complete."
                })

                if (this.isGameEndingPlay(game, play)) {
                    descriptions.push(...this.getGameRecapDescriptions(game, play))
                } else {
                    const half = play.inningTop ? "top" : "bottom"
                    const away = play.score.end?.away ?? play.score.start.away
                    const home = play.score.end?.home ?? play.score.start.home
                    const inningEndScoreLine = announcedScoreThisPlay
                        ? `End of the ${half} of the ${this.ordinal(play.inningNum)}. It's ${away} - ${home}.`
                        : `We'll switch sides. The score is ${away} - ${home}.`

                    descriptions.push({
                        type: PlayDescriptionType.RECAP,
                        text: inningEndScoreLine
                    })
                }
            } else {
                descriptions.push({
                    type: PlayDescriptionType.RECAP,
                    text: `There ${this.getOutsPhrase(outs)}.`
                })
            }
        }

        return descriptions
    }

    public getPlayByPlay(game: Game): PlayByPlayEntry[] {
        const results: PlayByPlayEntry[] = []

        for (const halfInning of [...(game.halfInnings ?? [])].reverse()) {
            for (const play of [...halfInning.plays].reverse()) {
                results.push({
                    descriptions: this.getPlayDescriptions(game, play),
                    play
                })
            }
        }

        return results
    }

    public getGameStartDescriptions(game: Game): PlayDescription[] {
        const gamePlayers = this.getGamePlayers(game)
        const awayPitcher = game.away.currentPitcherId ? gamePlayers[game.away.currentPitcherId] : undefined
        const homePitcher = game.home.currentPitcherId ? gamePlayers[game.home.currentPitcherId] : undefined
        const awayName = this.getTeamName(game.away)
        const homeName = this.getTeamName(game.home)
        const descriptions: PlayDescription[] = [{ type: PlayDescriptionType.RECAP, text: `${awayName} at ${homeName}.` }]

        if (awayPitcher) {
            descriptions.push({ type: PlayDescriptionType.RECAP, text: `${awayPitcher.fullName} gets the start for ${awayName}.` })
        }

        if (homePitcher) {
            descriptions.push({ type: PlayDescriptionType.RECAP, text: `${homePitcher.fullName} gets the start for ${homeName}.` })
        }

        return descriptions
    }

    public getInningStartDescriptions(play: Play): PlayDescription[] {
        const seed = (play.index ?? 0) * 1009 + this.hash(String(play.inningNum ?? "")) * 3 + (play.inningTop ? 7 : 11) + this.hash(`${play.score.start.away}-${play.score.start.home}`) * 13 + this.hash(JSON.stringify(play.runner?.result?.start ?? {})) * 17 + this.hash(String(play.count.start.outs ?? 0)) * 19
        const half = play.inningTop ? "top" : "bottom"
        const away = play.score.start.away
        const home = play.score.start.home
        const scorePhrase = away === home ? `It's tied ${away}-${home}` : away > home ? `The visitors lead ${away}-${home}` : `The home team leads ${home}-${away}`
        const outs = play.count.start.outs
        const outsPhrase = outs === 0 ? "no outs" : outs === 1 ? "one out" : outs === 2 ? "two outs" : `${outs} outs`
        const outsSentence = outs === 1 ? `There's ${outsPhrase}` : `There are ${outsPhrase}`
        const runnersPhrase = this.getRunnersPhrase(play.runner.result.start)
        const inningOrd = this.ordinal(play.inningNum)
        const phrases = [
            () => `We move to the ${half} of the ${inningOrd}. ${scorePhrase}. ${outsSentence} and ${runnersPhrase}.`,
            () => `Now in the ${half} of the ${inningOrd}. ${scorePhrase}. ${outsSentence} with ${runnersPhrase}.`,
            () => `To the ${half} of the ${inningOrd} we go. ${scorePhrase}. ${outsSentence}; ${runnersPhrase}.`,
            () => `Here in the ${half} of the ${inningOrd}. ${scorePhrase}. ${outsSentence} and ${runnersPhrase}.`,
            () => `${half[0].toUpperCase() + half.slice(1)} ${inningOrd}. ${scorePhrase}. ${outsSentence} and ${runnersPhrase}.`
        ]

        return [{ type: PlayDescriptionType.RECAP, text: this.pick(phrases, seed)() }]
    }

    private getGameRecapDescriptions(game: Game, play: Play): PlayDescription[] {
        const awayName = this.getTeamName(game.away)
        const homeName = this.getTeamName(game.home)
        const away = play.score.end?.away ?? play.score.start.away
        const home = play.score.end?.home ?? play.score.start.home
        const winnerName = away === home ? null : away > home ? awayName : homeName
        const seed = (play.index ?? 0) * 1009 + this.hash(String(game._id ?? "")) * 3 + this.hash(String(play.inningNum ?? "")) * 7 + (play.inningTop ? 11 : 13) + this.hash(`${away}-${home}`) * 17
        const ballgamePhrases = [() => "That's the ballgame.", () => "And this one is over.", () => "Ballgame."]
        const winnerPhrases = winnerName ? [() => `${winnerName} win it.`, () => `${winnerName} come away with the win.`, () => `${winnerName} take this one.`, () => `Final: ${winnerName} on top.`] : [() => "This one ends in a tie.", () => "They finish even.", () => "All square at the end."]
        const margin = Math.abs(away - home)
        const gameTagPhrases = away === home ? [] : margin === 1 ? [() => "A one-run game to the end.", () => "A tight one-run finish."] : margin >= 6 ? [() => "A comfortable win in the end.", () => "They pull away for the win."] : [() => "A solid win in the end.", () => "They get it done today."]
        const descriptions: PlayDescription[] = [
            { type: PlayDescriptionType.RECAP, text: this.pick(ballgamePhrases, seed)() },
            { type: PlayDescriptionType.RECAP, text: this.pick(winnerPhrases, seed + 23)() }
        ]

        if (gameTagPhrases.length > 0) {
            descriptions.push({ type: PlayDescriptionType.RECAP, text: this.pick(gameTagPhrases, seed + 41)() })
        }

        descriptions.push({ type: PlayDescriptionType.RECAP, text: `The final score is ${away} - ${home}.` })

        return descriptions
    }

    private getPlayResultDescription(play: Play, hitter: GamePlayer, fielderPlayer?: GamePlayer, inPlayPitch?: Pitch): PlayDescription[] {
        const descriptions: PlayDescription[] = []
        const seed = (play.index ?? 0) * 1009 + this.hash(String(play.hitterId ?? "")) + this.hash(String(play.pitcherId ?? "")) * 3 + this.hash(String(play.fielderId ?? "")) * 7 + this.hash(String(play.result ?? "")) * 11 + this.hash(String(play.officialPlayResult ?? "")) * 13
        const hitterName = hitter?.fullName ?? "The batter"
        const fielderName = fielderPlayer?.fullName ?? "the fielder"
        const fielderPosNoun = play.fielder ? this.getPositionDescriptionNoun(play.fielder) : "fielder"
        const fielderPos = play.fielder ? this.getPositionDescription(play.fielder) : "field"
        const contactTypeRaw = (play as any)?.contact?.type ?? play.contact
        const isGroundBall = contactTypeRaw === "GROUND_BALL" || contactTypeRaw === "GB" || contactTypeRaw === "GROUND" || contactTypeRaw === 0 || contactTypeRaw === Contact.GROUNDBALL
        const isPopup = contactTypeRaw === "POPUP" || contactTypeRaw === "PU" || contactTypeRaw === "POP_FLY"
        const isLineDrive = contactTypeRaw === "LINE_DRIVE" || contactTypeRaw === "LD" || contactTypeRaw === Contact.LINE_DRIVE
        const isFlyBall = contactTypeRaw === "FLY_BALL" || contactTypeRaw === "FB" || contactTypeRaw === "FLY" || contactTypeRaw === Contact.FLY_BALL
        const isOutfieldTarget = this.isToOF(play.fielder)
        const positionPrep = (position?: Position): string => position === Position.LEFT_FIELD || position === Position.CENTER_FIELD || position === Position.RIGHT_FIELD ? "in" : "at"
        const rawContactDesc = (): string => this.getContactDescription(play.contact, isOutfieldTarget, this.isHit(play.result))?.trim() ?? ""
        const hitModifier = (): string => {
            if (isPopup) return "blooper"
            if (isLineDrive) return "line-drive"
            if (isGroundBall) return "ground-ball"
            if (isFlyBall) return "fly-ball"
            return this.tidy(rawContactDesc().replace(/^(a|an)\s+/i, "").replace(/\s+ball$/i, ""))
        }
        const hitTarget = (): string => {
            if (isOutfieldTarget) return this.tidy(`to the ${this.getShallowDeepDescription(play.shallowDeep)} ${fielderPos}`)
            if (isGroundBall) return "through the infield"
            return "past the infield"
        }
        const runner1b = play.runner?.events?.find(event => event.movement?.start === BaseResult.FIRST)
        const runner2b = play.runner?.events?.find(event => event.movement?.start === BaseResult.SECOND)
        const runner3b = play.runner?.events?.find(event => event.movement?.start === BaseResult.THIRD)
        const leadOutRunner = runner3b?.movement?.isOut ? runner3b : runner2b?.movement?.isOut ? runner2b : runner1b?.movement?.isOut ? runner1b : undefined
        const outBase = leadOutRunner?.movement?.outBase
        const contactOutDesc = (): string => this.getContactDescriptionOut(play.contact, isOutfieldTarget) ?? "is retired"
        const strikeoutPhrases = [() => `${hitterName} strikes out.`, () => `${hitterName} goes down on strikes for the strikeout.`, () => `Strike three. ${hitterName} strikes out.`]
        const walkPhrases = [() => `${hitterName} draws a walk.`, () => `${hitterName} takes ball four for a walk.`, () => `Ball four. ${hitterName} reaches on a walk.`]
        const hbpPhrases = [() => `${hitterName} gets hit by a pitch.`, () => `Hit by pitch. ${hitterName} takes first.`, () => `${hitterName} is clipped and will head to first base.`]
        const outPhrases = [() => `${hitterName} ${contactOutDesc()} to ${fielderPosNoun} ${fielderName}.`, () => `${hitterName} ${contactOutDesc()} to ${fielderName} ${positionPrep(play.fielder)} ${fielderPos}.`, () => `${hitterName} ${contactOutDesc()} and ${fielderName} makes the play.`].map(fn => () => this.tidy(fn()))
        const singleGrounderPhrases = [() => `${hitterName} chops a ground ball through the infield for a single.`, () => `${hitterName} bounces a grounder through the right side for a single.`, () => `${hitterName} hits a grounder that finds a hole for a single.`]
        const singleOtherPhrases = [() => `${hitterName} hits a ${hitModifier()} single ${hitTarget()}.`, () => `${hitterName} lines a ${hitModifier()} single ${hitTarget()}.`, () => `${hitterName} drops a ${hitModifier()} single ${hitTarget()}.`].map(fn => () => this.tidy(fn()))
        const doublePhrases = [() => `${hitterName} hits a ${hitModifier()} double ${hitTarget()}.`, () => `${hitterName} drives a ${hitModifier()} double ${hitTarget()}.`, () => `${hitterName} rips a ${hitModifier()} double ${hitTarget()}.`].map(fn => () => this.tidy(fn()))
        const triplePhrases = [() => `${hitterName} hits a ${hitModifier()} triple ${hitTarget()}.`, () => `${hitterName} drives a ${hitModifier()} triple ${hitTarget()}.`, () => `${hitterName} legs out a ${hitModifier()} triple ${hitTarget()}.`].map(fn => () => this.tidy(fn()))
        const hrPhrases = [() => `${hitterName} hits a home run.`, () => `${hitterName} launches a home run.`, () => `Home run for ${hitterName}.`]
        const fcPhrases = [(base: string) => `${hitterName} puts it in play to ${fielderPosNoun} ${fielderName}. The lead runner is out at ${base}. Fielder's choice.`, (base: string) => `${hitterName} puts it on the ground to ${fielderPosNoun} ${fielderName}. The throw goes to ${base} for the out. Fielder's choice.`, (base: string) => `${hitterName} ${contactOutDesc()} to ${fielderPosNoun} ${fielderName}. They get the lead runner at ${base}. Fielder's choice.`].map(fn => (base: string) => this.tidy(fn(base)))
        const gidpPhrases = [(base: string) => `${hitterName} ${contactOutDesc()} to ${fielderPosNoun} ${fielderName}. Throw to ${base} for one, relay to first for the double play.`, (base: string) => `${hitterName} rolls it to ${fielderPosNoun} ${fielderName}. ${base} gets the lead runner, and the relay completes the double play.`, (base: string) => `${hitterName} ${contactOutDesc()} and it's turned. Out at ${base}, and the double play to first.`].map(fn => (base: string) => this.tidy(fn(base)))

        switch (play.result) {
            case PlayResult.STRIKEOUT:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(strikeoutPhrases, seed)() })
                break
            case PlayResult.BB:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(walkPhrases, seed)() })
                break
            case PlayResult.HIT_BY_PITCH:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(hbpPhrases, seed)() })
                break
            case PlayResult.OUT:
                if (play.officialPlayResult === OfficialPlayResult.FIELDERS_CHOICE && outBase) descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(fcPhrases, seed)(String(outBase)) })
                else if (play.officialPlayResult === OfficialPlayResult.GROUNDED_INTO_DP && outBase) descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(gidpPhrases, seed)(String(outBase)) })
                else descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(outPhrases, seed)() })
                break
            case PlayResult.SINGLE:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(isGroundBall ? singleGrounderPhrases : singleOtherPhrases, seed)() })
                break
            case PlayResult.DOUBLE:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(doublePhrases, seed)() })
                break
            case PlayResult.TRIPLE:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(triplePhrases, seed)() })
                break
            case PlayResult.HR:
                descriptions.push({ type: PlayDescriptionType.RESULT, text: this.pick(hrPhrases, seed)() })
                break
        }

        for (const description of descriptions) description.text = this.tidy(description.text)
        if (inPlayPitch && descriptions.length > 0) descriptions[0].meta = { pitch: inPlayPitch }

        return descriptions
    }

    private getMatchupDescription(play: Play, hitter: GamePlayer): string {
        const hitterName = hitter?.fullName ?? "The batter"
        const outs = play.count.start.outs
        const outsPhrase = outs === 0 ? "no outs" : outs === 1 ? "one out" : outs === 2 ? "two outs" : `${outs} outs`
        const outsSentence = outs === 1 ? `There's ${outsPhrase}` : `There are ${outsPhrase}`
        return `That will bring up ${hitterName}. ${outsSentence} and ${this.getRunnersPhrase(play.runner.result.start)}.`
    }

    private getPitchDescription(pitch: Pitch): string {
        const pitchTypeText = this.getPitchTypeFull(pitch.type).toLowerCase()
        const introPhrases = ["Here comes a", "Now a", "The pitch is a"]
        const strikeTakePhrases = ["Taken for a strike", "Called a strike", "Strike called"]
        const ballTakePhrases = ["Taken for a ball", "Ball", "Just misses"]
        const swingMissPhrases = ["The batter swings and misses", "The batter comes up empty", "The batter swings through it"]
        const chaseMissPhrases = ["The batter chases and misses", "The batter goes after it and misses", "The batter swings at a pitch out of the zone and misses"]
        const foulPhrases = ["The batter fouls it straight back", "The batter snaps it foul", "Fouled straight back"]
        const inPlayPhrases = ["The batter puts it in play", "The batter swings and puts it in play", "Contact made, ball in play"]
        const wildPitchPhrases = ["It skips past the catcher for a wild pitch", "That one gets away for a wild pitch"]
        const passedBallPhrases = ["It gets away from the catcher", "Passed ball"]
        const hbpPhrases = ["The batter is hit by the pitch", "Hit by pitch"]
        const countPhrases = [(count: Count) => `The count is ${count.balls}-${count.strikes}`, (count: Count) => `Now ${count.balls}-${count.strikes}`]
        const seed = (pitch.overallQuality ?? 0) + (Number(pitch.type) || 0) * 7 + (pitch.actualZone ? String(pitch.actualZone).length : 0) * 13 + (pitch.locQ ? Math.floor(pitch.locQ) : 0)
        const introText = this.pick(introPhrases, seed + 3)
        const zoneText = pitch.result === PitchCall.BALL ? this.describeZoneOffPlate(pitch.actualZone) : this.describeZoneNeutral(pitch.actualZone)
        const locationSentence = `${introText} ${pitchTypeText} ${zoneText}.`
        let outcomeSentence = ""

        if (pitch.isWP) outcomeSentence = this.pick(wildPitchPhrases, seed + 7)
        else if (pitch.isPB) outcomeSentence = this.pick(passedBallPhrases, seed + 7)
        else {
            switch (pitch.result) {
                case PitchCall.IN_PLAY: outcomeSentence = this.pick(inPlayPhrases, seed + 9); break
                case PitchCall.FOUL: outcomeSentence = this.pick(foulPhrases, seed + 9); break
                case PitchCall.HBP: outcomeSentence = this.pick(hbpPhrases, seed + 9); break
                case PitchCall.STRIKE: outcomeSentence = pitch.swing ? this.pick(swingMissPhrases, seed + 11) : this.pick(strikeTakePhrases, seed + 11); break
                case PitchCall.BALL: outcomeSentence = pitch.swing ? this.pick(chaseMissPhrases, seed + 13) : this.pick(ballTakePhrases, seed + 11); break
            }
        }

        const isFinalStrikeoutPitch = pitch.result === PitchCall.STRIKE && (pitch.count?.strikes ?? 0) >= 2
        const isFinalWalkPitch = pitch.result === PitchCall.BALL && (pitch.count?.balls ?? 0) >= 3
        const includeCount = !!pitch.count && !isFinalStrikeoutPitch && !isFinalWalkPitch && pitch.result !== PitchCall.IN_PLAY && pitch.result !== PitchCall.HBP
        const countSentence = includeCount && pitch.count ? this.pick(countPhrases, seed + 19)({ balls: Math.min(pitch.count.balls ?? 0, 3), strikes: Math.min(pitch.count.strikes ?? 0, 2), outs: pitch.count.outs }) + "." : ""
        return [locationSentence, outcomeSentence ? `${outcomeSentence}.` : "", countSentence].filter(Boolean).join(" ")
    }

    private getRunnerRecapDescription(game: Game, play: Play): PlayDescription[] {
        const descriptions: PlayDescription[] = []
        const events = play.runner?.events ?? []
        const pitchCount = play.pitchLog?.pitches?.length ?? 0

        for (const event of events) {
            if (this.isBatterRunnerPrimaryEvent(play, event)) continue
            if (typeof event.pitchIndex === "number" && event.pitchIndex >= 0 && event.pitchIndex < pitchCount) continue
            const text = this.getRunnerDescription(game, event)
            if (text) descriptions.push({ type: PlayDescriptionType.RECAP, text })
        }

        return descriptions
    }

    private getRunnerDescription(game: Game, runnerEvent: RunnerEvent): string {
        const gamePlayers = this.getGamePlayers(game)
        const runner = runnerEvent.runner?._id ? gamePlayers[runnerEvent.runner._id] : undefined
        const runnerName = runner?.fullName ?? "A runner"
        const thrower = runnerEvent.throw?.from?._id ? gamePlayers[runnerEvent.throw.from._id] : undefined
        const outBase = runnerEvent.movement?.outBase ?? runnerEvent.movement?.end
        const start = runnerEvent.movement?.start
        const end = runnerEvent.movement?.end

        if (runnerEvent.movement?.isOut) {
            if (thrower && runnerEvent.throw?.from?.position) {
                if (runnerEvent.isSBAttempt) return `${runnerName} is caught stealing at ${outBase} on the throw from the ${this.getPositionDescriptionNoun(runnerEvent.throw.from.position)} ${thrower.fullName}.`
                return `${runnerName} is out at ${outBase} on the throw from the ${this.getPositionDescriptionNoun(runnerEvent.throw.from.position)} ${thrower.fullName}.`
            }
            return `${runnerName} is out.`
        }

        if (end === BaseResult.HOME) return `${runnerName} scores from ${start}${runnerEvent.isError ? " [Error]" : ""}.`
        if (runnerEvent.isSBAttempt) {
            if (thrower && runnerEvent.throw?.from?.position) return `${runnerName} steals ${end} with a throw from the ${this.getPositionDescriptionNoun(runnerEvent.throw.from.position)} ${thrower.fullName}.`
            return `${runnerName} steals ${end}.`
        }
        if (runnerEvent.isPB) return `${runnerName} moves to ${end} on a passed ball.`
        if (runnerEvent.isWP) return `${runnerName} moves to ${end} on a wild pitch.`
        if (runnerEvent.eventType === OfficialRunnerResult.TAGGED_FIRST_TO_SECOND || runnerEvent.eventType === OfficialRunnerResult.TAGGED_SECOND_TO_THIRD || runnerEvent.eventType === OfficialRunnerResult.TAGGED_THIRD_TO_HOME) return `${runnerName} tags up and advances to ${end} from ${start}.`
        return `${runnerName} advances to ${end}${runnerEvent.isError ? " [Error]" : ""}.`
    }

    private getSubstitutionDescriptions(game: Game, play: Play): PlayDescription[] {
        const descriptions: PlayDescription[] = []
        const substitutions = (game.substitutions ?? []).filter(substitution => substitution.playIndex === play.index).sort((a, b) => a.isPitchingChange === b.isPitchingChange ? 0 : a.isPitchingChange ? 1 : -1)

        for (const substitution of substitutions) {
            const gamePlayers = this.getGamePlayers(game)
            const team = substitution.teamId === game.away._id ? game.away : game.home
            const teamName = this.getTeamName(team)
            const outPlayer = gamePlayers[substitution.outPlayerId]
            const inPlayer = gamePlayers[substitution.inPlayerId]
            if (!inPlayer) continue
            const seed = this.getSubstitutionDescriptionSeed(game, substitution)
            let text: string

            if (substitution.isPitchingChange) {
                text = outPlayer ? this.pickSubstitutionText([`Pitching change for ${teamName}. ${inPlayer.fullName} takes over for ${outPlayer.fullName}.`, `A call to the bullpen for ${teamName}. ${inPlayer.fullName} replaces ${outPlayer.fullName}.`, `That's all for ${outPlayer.fullName}. ${inPlayer.fullName} is the new pitcher for ${teamName}.`, `A new pitcher for ${teamName}. ${inPlayer.fullName} comes on in relief of ${outPlayer.fullName}.`, `${inPlayer.fullName} enters for ${teamName}, replacing ${outPlayer.fullName} on the mound.`], seed) : this.pickSubstitutionText([`Pitching change for ${teamName}. ${inPlayer.fullName} takes over on the mound.`, `A call to the bullpen for ${teamName}. ${inPlayer.fullName} is the new pitcher.`, `A new pitcher for ${teamName}. ${inPlayer.fullName} comes on in relief.`, `${inPlayer.fullName} enters to pitch for ${teamName}.`], seed)
            } else if (substitution.requiresPitcherChange) {
                text = outPlayer ? this.pickSubstitutionText([`Pinch hitter for ${teamName}. ${inPlayer.fullName} will bat for ${outPlayer.fullName}.`, `A move to the bench for ${teamName}. ${inPlayer.fullName} bats in place of ${outPlayer.fullName}.`, `${inPlayer.fullName} comes off the bench to hit for ${outPlayer.fullName}.`, `An offensive change for ${teamName}. ${inPlayer.fullName} will hit for ${outPlayer.fullName}.`, `${inPlayer.fullName} is announced as a pinch hitter for ${outPlayer.fullName}.`], seed) : this.pickSubstitutionText([`Pinch hitter for ${teamName}. ${inPlayer.fullName} steps in.`, `A move to the bench for ${teamName}. ${inPlayer.fullName} will hit.`, `${inPlayer.fullName} comes off the bench as a pinch hitter.`, `An offensive change for ${teamName}. ${inPlayer.fullName} will bat.`], seed)
            } else {
                const positionText = substitution.toPosition ? this.getPositionDescription(substitution.toPosition) : undefined
                text = outPlayer ? this.getLineupSubstitutionText(teamName, inPlayer.fullName, outPlayer.fullName, positionText, seed) : this.getLineupSubstitutionTextWithoutOutgoingPlayer(teamName, inPlayer.fullName, positionText, seed)
            }

            descriptions.push({ type: PlayDescriptionType.SUBSTITUTION, text })
        }

        return descriptions
    }

    private getLineupSubstitutionText(teamName: string, inPlayerName: string, outPlayerName: string, positionText: string | undefined, seed: number): string {
        if (!positionText) return this.pickSubstitutionText([`A substitution for ${teamName}. ${inPlayerName} replaces ${outPlayerName}.`, `${inPlayerName} enters the game for ${teamName}, replacing ${outPlayerName}.`, `A new player for ${teamName}. ${inPlayerName} replaces ${outPlayerName}.`], seed)
        return this.pickSubstitutionText([`Defensive change for ${teamName}. ${inPlayerName} takes over at ${positionText}.`, `A defensive substitution for ${teamName}. ${inPlayerName} replaces ${outPlayerName} at ${positionText}.`, `${inPlayerName} enters the game at ${positionText} for ${teamName}.`, `A defensive move for ${teamName}. ${inPlayerName} is now at ${positionText}.`, `${inPlayerName} comes in for ${outPlayerName} and takes over at ${positionText}.`], seed)
    }

    private getLineupSubstitutionTextWithoutOutgoingPlayer(teamName: string, inPlayerName: string, positionText: string | undefined, seed: number): string {
        if (!positionText) return this.pickSubstitutionText([`A substitution for ${teamName}. ${inPlayerName} enters the game.`, `${inPlayerName} enters the game for ${teamName}.`, `A new player enters for ${teamName}. ${inPlayerName} is into the game.`], seed)
        return this.pickSubstitutionText([`Defensive change for ${teamName}. ${inPlayerName} takes over at ${positionText}.`, `A defensive substitution for ${teamName}. ${inPlayerName} enters at ${positionText}.`, `${inPlayerName} enters the game at ${positionText} for ${teamName}.`, `A defensive move for ${teamName}. ${inPlayerName} is now at ${positionText}.`], seed)
    }

    private getSubstitutionDescriptionSeed(game: Game, substitution: any): number {
        return this.hash([game._id || "", substitution.teamId || "", substitution.outPlayerId || "", substitution.inPlayerId || "", substitution.playIndex ?? 0, substitution.lineupIndex ?? "", substitution.isPitchingChange ? "P" : "B"].join("|"))
    }

    private getRunnersPhrase(runners: { first: string, second: string, third: string }): string {
        const { first, second, third } = runners
        if (first && second && third) return "the bases loaded"
        if (first && second) return "runners on first and second"
        if (first && third) return "runners on first and third"
        if (second && third) return "runners on second and third"
        if (first) return "a runner on first"
        if (second) return "a runner on second"
        if (third) return "a runner on third"
        return "the bases empty"
    }

    private describeZoneNeutral(zone: PitchZone): string {
        const [vertical, horizontal] = String(zone).split("_")
        const verticalText = vertical === "LOW" ? "low" : vertical === "MID" ? "middle" : "high"
        const horizontalText = horizontal === "AWAY" ? "away" : horizontal === "MIDDLE" ? "over the plate" : "inside"
        return horizontalText === "over the plate" ? `${verticalText} ${horizontalText}` : `${verticalText} and ${horizontalText}`
    }

    private describeZoneOffPlate(zone: PitchZone): string {
        const [vertical, horizontal] = String(zone).split("_")
        const verticalText = vertical === "LOW" ? "low" : vertical === "MID" ? "just off the plate" : "high"
        const horizontalText = horizontal === "AWAY" ? "the outside corner" : horizontal === "INSIDE" ? "the inside corner" : "the plate"
        if (vertical === "MID" && horizontal === "MIDDLE") return "just off the plate"
        if (vertical === "MID") return `just off ${horizontalText}`
        if (horizontal === "MIDDLE") return `${verticalText}, just off the plate`
        return `${verticalText}, just off ${horizontalText}`
    }

    private getContactDescription(contact: Contact, isOutfieldTarget: boolean, isHit: boolean): string | undefined {
        switch (contact) {
            case Contact.FLY_BALL: return isOutfieldTarget ? "a fly ball" : "a popup"
            case Contact.GROUNDBALL: return isHit ? "a ground ball" : "a grounder"
            case Contact.LINE_DRIVE: return "a line drive"
        }
    }

    private getContactDescriptionOut(contact: Contact, isToOF: boolean): string | undefined {
        switch (contact) {
            case Contact.FLY_BALL: return isToOF ? "flies out" : "pops out"
            case Contact.GROUNDBALL: return "grounds out"
            case Contact.LINE_DRIVE: return "lines out"
        }
    }

    private getShallowDeepDescription(shallowDeep: ShallowDeep): string {
        if (shallowDeep === ShallowDeep.NORMAL || !shallowDeep) return ""
        return String(shallowDeep).toLowerCase()
    }

    private getPositionDescription(position: Position): string {
        switch (position) {
            case Position.PITCHER: return "pitcher"
            case Position.CATCHER: return "catcher"
            case Position.FIRST_BASE: return "first base"
            case Position.SECOND_BASE: return "second base"
            case Position.THIRD_BASE: return "third base"
            case Position.SHORTSTOP: return "shortstop"
            case Position.LEFT_FIELD: return "left field"
            case Position.CENTER_FIELD: return "center field"
            case Position.RIGHT_FIELD: return "right field"
            default: return String(position)
        }
    }

    private getPositionDescriptionNoun(position: Position): string {
        switch (position) {
            case Position.PITCHER: return "pitcher"
            case Position.CATCHER: return "catcher"
            case Position.FIRST_BASE: return "first baseman"
            case Position.SECOND_BASE: return "second baseman"
            case Position.THIRD_BASE: return "third baseman"
            case Position.SHORTSTOP: return "shortstop"
            case Position.LEFT_FIELD: return "left fielder"
            case Position.CENTER_FIELD: return "center fielder"
            case Position.RIGHT_FIELD: return "right fielder"
            default: return String(position)
        }
    }

    private getPitchTypeFull(pitchType: PitchType): string {
        switch (pitchType) {
            case PitchType.FF: return "Fastball"
            case PitchType.CU: return "Curveball"
            case PitchType.CH: return "Changeup"
            case PitchType.FC: return "Cutter"
            case PitchType.FO: return "Forkball"
            case PitchType.KN: return "Knuckleball"
            case PitchType.KC: return "Knuckle Curve"
            case PitchType.SC: return "Screwball"
            case PitchType.SI: return "Sinker"
            case PitchType.SL: return "Slider"
            case PitchType.SV: return "Slurve"
            case PitchType.FS: return "Splitter"
            case PitchType.ST: return "Slutter"
            default: return String(pitchType)
        }
    }

    private getGamePlayers(game: Game): Record<string, GamePlayer> {
        const players = [...(game.away.players ?? []), ...(game.home.players ?? [])]
        const result: Record<string, GamePlayer> = {}
        for (const player of players) result[player._id] = player
        return result
    }

    private getTeamName(team: { name?: string, abbrev?: string }): string {
        return team.name || team.abbrev || "Team"
    }

    private isBatterRunnerPrimaryEvent(play: Play, event: RunnerEvent): boolean {
        return event.runner?._id === play.hitterId && event.movement?.start === BaseResult.HOME
    }

    private isGameEndingPlay(game: Game, play: Play): boolean {
        return !!game.isFinished && play.index === game.playIndex
    }

    private isHit(playResult: PlayResult): boolean {
        return playResult === PlayResult.SINGLE || playResult === PlayResult.DOUBLE || playResult === PlayResult.TRIPLE || playResult === PlayResult.HR
    }

    private isToOF(fielder?: Position): boolean {
        return fielder === Position.LEFT_FIELD || fielder === Position.CENTER_FIELD || fielder === Position.RIGHT_FIELD
    }

    private getOutsPhrase(outs: number): string {
        if (outs === 1) return "is one out"
        return `are ${outs} outs`
    }

    private ordinal(value: number): string {
        const remainder = value % 100
        if (remainder >= 11 && remainder <= 13) return `${value}th`
        switch (value % 10) {
            case 1: return `${value}st`
            case 2: return `${value}nd`
            case 3: return `${value}rd`
            default: return `${value}th`
        }
    }

    private hash(value: string): number {
        let hash = 2166136261
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index)
            hash = Math.imul(hash, 16777619)
        }
        return hash >>> 0
    }

    private pick<T>(list: T[], seed: number): T {
        return list[Math.abs(seed) % list.length]
    }

    private pickSubstitutionText(list: string[], seed: number): string {
        return this.pick(list, seed)
    }

    private tidy(value: string): string {
        return value.replace(/\s+/g, " ").trim()
    }

}

interface PlayDescription {
    type: PlayDescriptionType
    text: string
    meta?: {
        pitch?: Pitch
    }
}


interface PlayByPlayEntry {
    descriptions: PlayDescription[]
    play: Play
}

enum PlayDescriptionType {
    RECAP = "RECAP",
    RESULT = "RESULT",
    SUBSTITUTION = "SUBSTITUTION"
}

export {
    PlayByPlayService, PlayDescription, PlayByPlayEntry, PlayDescriptionType
}

import {  HitResultCount, HitterStatLine, PitcherStatLine, PitchResultCount } from "./interfaces.js";

class StatService {

    constructor(
    ) {}

    public formatRatio(num) {

        // Special case for 0 to format as .000
        if (!num || num === 0) {
            return ".000";
        }

        // Format the number to always have 3 decimal places
        let numStr = num.toFixed(3)

        // Check if the number is less than 1 and greater than -1 but not 0
        if (num < 1 && num > -1 && num !== 0) {
            // Remove the leading 0
            numStr = numStr.replace(/^0/, '')
        }
        // Return the formatted string
        return numStr

    }

    getIP(outs) {

        if (!outs) return "0.0"

        const innings = Math.floor(outs / 3)
        const thirds = outs % 3

        if (thirds === 0) {
            return innings + ".0"
        } else if (thirds === 1) {
            return innings + ".1"
        } else {
            return innings + ".2"
        }

    }

    getERA(earnedRuns: number, outs: number) {

        if (outs == 0) {
            if (earnedRuns > 0) return Number.POSITIVE_INFINITY
            if (earnedRuns == 0) return 0
        }

        // Convert outs to innings pitched
        let inningsPitched = outs / 3

        // Calculate ERA
        return (earnedRuns / inningsPitched) * 9
    }

    getOBP(hits:number, bb:number, hbp:number, pa:number) {
        if (pa == 0) return 0
        return (hits + bb + hbp) / pa
    }

    getSLG(singles:number, doubles:number, triples:number, homeRuns:number, atBats:number) {
        if (atBats == 0) return 0
        return (singles + (doubles * 2) + (triples * 3) + (homeRuns * 4)) / atBats
    }

    getOPS(obp:number, slg:number) {
        return obp + slg
    }
    getAVG(hits:number, atBats:number) {
        if (atBats == 0) return 0
        return hits / atBats
    }

    getWinPercent(wins:number, losses:number) : number {

        let games = wins + losses

        if (games > 0) {
            return wins/games
        }

        return 0

    }

    displayPercent(num:number) {
        if (num == undefined || isNaN(num)) return ""
        return `${(num * 100).toFixed(1)}%`
    }


    hitResultToHitterStatLine(hitResult: HitResultCount): HitterStatLine {

        let obp = this.getOBP(hitResult.hits, hitResult.bb, hitResult.hbp, hitResult.pa)
        let slg = this.getSLG(hitResult.singles, hitResult.doubles, hitResult.triples, hitResult.homeRuns, hitResult.atBats)

        return {
            teamWins: hitResult.teamWins,
            teamLosses: hitResult.teamLosses,
            hbp: hitResult.hbp,
            games: hitResult.games,
            pa: hitResult.pa,
            atBats: hitResult.atBats,
            runs: hitResult.runs,
            hits: hitResult.hits,
            singles: hitResult.singles,
            doubles: hitResult.doubles,
            triples: hitResult.triples,
            homeRuns: hitResult.homeRuns,
            gidp: hitResult.gidp,
            e: hitResult.e,
            passedBalls: hitResult.passedBalls,
            assists: hitResult.assists,
            csDefense: hitResult.csDefense,
            doublePlays: hitResult.doublePlays,
            po: hitResult.po,
            rbi: hitResult.rbi,
            sb: hitResult.sb,
            sbAttempts: hitResult.sbAttempts,
            outfieldAssists: hitResult.outfieldAssists,
            cs: hitResult.cs,
            bb: hitResult.bb,
            so: hitResult.so,
            avg: this.getAVG(hitResult.hits, hitResult.atBats),
            obp: obp,
            slg: slg,
            ops: this.getOPS(obp, slg),
            wpa: hitResult.wpa,
            hbpPercent: this.getAVG(hitResult.hbp, hitResult.pa),

            bbPercent: this.getAVG(hitResult.bb, hitResult.pa),
            soPercent: this.getAVG(hitResult.so, hitResult.pa),

            strikePercent: this.getAVG(hitResult.pitches - hitResult.balls - hitResult.hbp, hitResult.pitches),

            calledStrikesPercent: this.getAVG(hitResult.calledStrikes, hitResult.pitches),
            swingingStrikesPercent: this.getAVG(hitResult.swingingStrikes, hitResult.pitches),

            ballPercent: this.getAVG(hitResult.balls, hitResult.pitches ),
            swingPercent: this.getAVG(hitResult.swings, hitResult.pitches),
            inZonePercent: this.getAVG(hitResult.inZone, hitResult.pitches),
            inPlayPercent: this.getAVG(hitResult.ballsInPlay, hitResult.pitches),
            swingAtBallsPercent: this.getAVG(hitResult.swingAtBalls, hitResult.pitches - hitResult.inZone),
            swingAtStrikesPercent: this.getAVG(hitResult.swingAtStrikes, hitResult.inZone),
            inZoneContactPercent: this.getAVG(hitResult.inZoneContact, hitResult.swingAtStrikes),
            outZoneContactPercent: this.getAVG(hitResult.outZoneContact, hitResult.swingAtBalls),


            babip: this.getAVG(hitResult.hits - hitResult.homeRuns, hitResult.atBats - hitResult.homeRuns - hitResult.so + hitResult.sacFlys),

            avgPitchQuality: this.getAVG(hitResult.totalPitchQuality, hitResult.pitches),
            avgPitchPowerQuality: this.getAVG(hitResult.totalPitchPowerQuality, hitResult.pitches),
            avgPitchLocationQuality: this.getAVG(hitResult.totalPitchLocationQuality, hitResult.pitches),
            avgPitchMovementQuality: this.getAVG(hitResult.totalPitchMovementQuality, hitResult.pitches),

            runsPerGame: hitResult.uniqueGames > 0 ? hitResult.runs / hitResult.uniqueGames : 0,
            sbPerGame: hitResult.uniqueGames > 0 ? hitResult.sb / hitResult.uniqueGames : 0,
            sbAttemptsPerGame: hitResult.uniqueGames > 0 ? hitResult.sbAttempts / hitResult.uniqueGames : 0,

            singlePercent: this.getAVG(hitResult.singles, hitResult.pa),
            doublePercent:this.getAVG(hitResult.doubles, hitResult.pa),
            triplePercent: this.getAVG(hitResult.triples, hitResult.pa),
            homeRunPercent: this.getAVG(hitResult.homeRuns, hitResult.pa),

            groundBallPercent: this.getAVG(hitResult.groundBalls, hitResult.ballsInPlay),
            flyBallPercent:this.getAVG(hitResult.flyBalls, hitResult.ballsInPlay),
            ldPercent:this.getAVG(hitResult.lineDrives, hitResult.ballsInPlay),

            pitchesPerPA: this.getAVG(hitResult.pitches, hitResult.pa),

        }
    }

    mergeHitResultsToStatLine(total:HitResultCount, currentGame:HitResultCount) : HitterStatLine {

        total = total ? JSON.parse(JSON.stringify(total)) : {}

        total.games = (total?.games || 0) + (currentGame?.games || 0)

        total.teamWins = (total?.teamWins || 0) + (currentGame?.teamWins || 0)
        total.teamLosses = (total?.teamLosses || 0) + (currentGame?.teamLosses || 0)
        total.pa = (total?.pa || 0) + (currentGame?.pa || 0)
        total.atBats = (total?.atBats || 0) + (currentGame?.atBats || 0)
        total.hits = (total?.hits || 0) + (currentGame?.hits || 0)
        total.singles = (total?.singles || 0) + (currentGame?.singles || 0)
        total.doubles = (total?.doubles || 0) + (currentGame?.doubles || 0)
        total.triples = (total?.triples || 0) + (currentGame?.triples || 0)
        total.homeRuns = (total?.homeRuns || 0) + (currentGame?.homeRuns || 0)
        total.runs = (total?.runs || 0) + (currentGame?.runs || 0)
        total.rbi = (total?.rbi || 0) + (currentGame?.rbi || 0)
        total.bb = (total?.bb || 0) + (currentGame?.bb || 0)
        total.sb = (total?.sb || 0) + (currentGame?.sb || 0)
        total.cs = (total?.cs || 0) + (currentGame?.cs || 0)
        total.hbp = (total?.hbp || 0) + (currentGame?.hbp || 0)
        total.so = (total?.so || 0) + (currentGame?.so || 0)
        total.lob = (total?.lob || 0) + (currentGame?.lob || 0)
        total.sacBunts = (total?.sacBunts || 0) + (currentGame?.sacBunts || 0)
        total.sacFlys = (total?.sacFlys || 0) + (currentGame?.sacFlys || 0)
        total.groundOuts = (total?.groundOuts || 0) + (currentGame?.groundOuts || 0)
        total.flyOuts = (total?.flyOuts || 0) + (currentGame?.flyOuts || 0)
        total.lineOuts = (total?.lineOuts || 0) + (currentGame?.lineOuts || 0)
        total.outs = (total?.outs || 0) + (currentGame?.outs || 0)
        total.groundBalls = (total?.groundBalls || 0) + (currentGame?.groundBalls || 0)
        total.lineDrives = (total?.lineDrives || 0) + (currentGame?.lineDrives || 0)
        total.flyBalls = (total?.flyBalls || 0) + (currentGame?.flyBalls || 0)
        total.gidp = (total?.gidp || 0) + (currentGame?.gidp || 0)
        total.po = (total?.po || 0) + (currentGame?.po || 0)
        total.assists = (total?.assists || 0) + (currentGame?.assists || 0)
        total.outfieldAssists = (total?.outfieldAssists || 0) + (currentGame?.outfieldAssists || 0)
        total.passedBalls = (total?.passedBalls || 0) + (currentGame?.passedBalls || 0)
        total.doublePlays = (total?.doublePlays || 0) + (currentGame?.doublePlays || 0)
        total.csDefense = (total?.csDefense || 0) + (currentGame?.csDefense || 0)
        total.sbAttempts = (total?.sbAttempts || 0) + (currentGame?.sbAttempts || 0)

        total.e = (total?.e || 0) + (currentGame?.e || 0)
        total.pitches = (total?.pitches || 0) + (currentGame?.pitches || 0)
        total.balls = (total?.balls || 0) + (currentGame?.balls || 0)
        total.strikes = (total?.strikes || 0) + (currentGame?.strikes || 0)
        total.fouls = (total?.fouls || 0) + (currentGame?.fouls || 0)
        total.inZone = (total?.inZone || 0) + (currentGame?.inZone || 0)
        total.swings = (total?.swings || 0) + (currentGame?.swings || 0)
        total.swingAtBalls = (total?.swingAtBalls || 0) + (currentGame?.swingAtBalls || 0)
        total.swingAtStrikes = (total?.swingAtStrikes || 0) + (currentGame?.swingAtStrikes || 0)
        total.ballsInPlay = (total?.ballsInPlay || 0) + (currentGame?.ballsInPlay || 0)
        total.inZoneContact = (total?.inZoneContact || 0) + (currentGame?.inZoneContact || 0)
        total.outZoneContact = (total?.outZoneContact || 0) + (currentGame?.outZoneContact || 0)

        total.totalPitchQuality = (total?.totalPitchQuality || 0) + (currentGame?.totalPitchQuality || 0)
        total.totalPitchPowerQuality = (total?.totalPitchPowerQuality || 0) + (currentGame?.totalPitchPowerQuality || 0)
        total.totalPitchLocationQuality = (total?.totalPitchLocationQuality || 0) + (currentGame?.totalPitchLocationQuality || 0)
        total.totalPitchMovementQuality = (total?.totalPitchMovementQuality || 0) + (currentGame?.totalPitchMovementQuality || 0)

        total.wpa = (total?.wpa || 0) + (currentGame?.wpa || 0)

        return this.hitResultToHitterStatLine(total)

    }

    mergePitchResultsToStatLine(total:PitchResultCount, currentGame:PitchResultCount) : PitcherStatLine {

        total = total ? JSON.parse(JSON.stringify(total)) : {}

        total.games = (total?.games || 0) + (currentGame?.games || 0)
        
        total.teamWins = (total?.teamWins || 0) + (currentGame?.teamWins || 0)
        total.teamLosses = (total?.teamLosses || 0) + (currentGame?.teamLosses || 0)
        total.starts = (total?.starts || 0) + (currentGame?.starts || 0)
        total.wins = (total?.wins || 0) + (currentGame?.wins || 0)
        total.losses = (total?.losses || 0) + (currentGame?.losses || 0)
        total.saves = (total?.saves || 0) + (currentGame?.saves || 0)
        total.bs = (total?.bs || 0) + (currentGame?.bs || 0)
        total.outs = (total?.outs || 0) + (currentGame?.outs || 0)
        total.er = (total?.er || 0) + (currentGame?.er || 0)
        total.so = (total?.so || 0) + (currentGame?.so || 0)
        total.hits = (total?.hits || 0) + (currentGame?.hits || 0)
        total.bb = (total?.bb || 0) + (currentGame?.bb || 0)
        total.sho = (total?.sho || 0) + (currentGame?.sho || 0)
        total.cg = (total?.cg || 0) + (currentGame?.cg || 0)
        total.hbp = (total?.hbp || 0) + (currentGame?.hbp || 0)
        total.singles = (total?.singles || 0) + (currentGame?.singles || 0)
        total.doubles = (total?.doubles || 0) + (currentGame?.doubles || 0)
        total.triples = (total?.triples || 0) + (currentGame?.triples || 0)
        total.battersFaced = (total?.battersFaced || 0) + (currentGame?.battersFaced || 0)
        total.atBats = (total?.atBats || 0) + (currentGame?.atBats || 0)
        total.runs = (total?.runs || 0) + (currentGame?.runs || 0)
        total.homeRuns = (total?.homeRuns || 0) + (currentGame?.homeRuns || 0)
        total.groundOuts = (total?.groundOuts || 0) + (currentGame?.groundOuts || 0)
        total.flyOuts = (total?.flyOuts || 0) + (currentGame?.flyOuts || 0)
        total.lineOuts = (total?.lineOuts || 0) + (currentGame?.lineOuts || 0)
        total.groundBalls = (total?.groundBalls || 0) + (currentGame?.groundBalls || 0)
        total.lineDrives = (total?.lineDrives || 0) + (currentGame?.lineDrives || 0)
        total.flyBalls = (total?.flyBalls || 0) + (currentGame?.flyBalls || 0)
        total.sacFlys = (total?.sacFlys || 0) + (currentGame?.sacFlys || 0)
        total.pitches = (total?.pitches || 0) + (currentGame?.pitches || 0)
        total.strikes = (total?.strikes || 0) + (currentGame?.strikes || 0)
        total.balls = (total?.balls || 0) + (currentGame?.balls || 0)
        total.fouls = (total?.fouls || 0) + (currentGame?.fouls || 0)
        total.inZone = (total?.inZone || 0) + (currentGame?.inZone || 0)
        total.wildPitches = (total?.wildPitches || 0) + (currentGame?.wildPitches || 0)

        total.inZoneContact = (total?.inZoneContact || 0) + (currentGame?.inZoneContact || 0)
        total.outZoneContact = (total?.outZoneContact || 0) + (currentGame?.outZoneContact || 0)

        total.swings = (total?.swings || 0) + (currentGame?.swings || 0)
        total.swingAtBalls = (total?.swingAtBalls || 0) + (currentGame?.swingAtBalls || 0)
        total.swingAtStrikes = (total?.swingAtStrikes || 0) + (currentGame?.swingAtStrikes || 0)
        total.ballsInPlay = (total?.ballsInPlay || 0) + (currentGame?.ballsInPlay || 0)
        total.totalPitchQuality = (total?.totalPitchQuality || 0) + (currentGame?.totalPitchQuality || 0)
        total.totalPitchPowerQuality = (total?.totalPitchPowerQuality || 0) + (currentGame?.totalPitchPowerQuality || 0)
        total.totalPitchLocationQuality = (total?.totalPitchLocationQuality || 0) + (currentGame?.totalPitchLocationQuality || 0)
        total.totalPitchMovementQuality = (total?.totalPitchMovementQuality || 0) + (currentGame?.totalPitchMovementQuality || 0)

        total.wpa = (total?.wpa || 0) + (currentGame?.wpa || 0)

        return this.pitchResultToPitcherStatLine(total)

    }

    pitchResultToPitcherStatLine(pitchResult: PitchResultCount): PitcherStatLine {

        return {
            saves: pitchResult.saves,
            games: pitchResult.games,
            starts: pitchResult.starts,
            cg: pitchResult.cg,
            sho: pitchResult.sho,
            so: pitchResult.so,
            wins: pitchResult.wins,
            losses: pitchResult.losses,
            outs: pitchResult.outs,
            hits: pitchResult.hits,
            runs: pitchResult.runs,
            er: pitchResult.er,
            homeRuns: pitchResult.homeRuns,
            bb: pitchResult.bb,
            hbp: pitchResult.hbp,
            atBats: pitchResult.atBats,
            battersFaced: pitchResult.battersFaced,
            winPercent: (pitchResult.wins + pitchResult.losses) > 0 ? pitchResult.wins / (pitchResult.wins + pitchResult.losses) : 0,
            ip: this.getIP(pitchResult.outs),
            era: this.getERA(pitchResult.er, pitchResult.outs),
            wpa: pitchResult.wpa,
            wildPitches: pitchResult.wildPitches,

            hbpPercent: this.getAVG(pitchResult.hbp, pitchResult.battersFaced),
            bbPercent: this.getAVG(pitchResult.bb, pitchResult.battersFaced),
            soPercent: this.getAVG(pitchResult.so, pitchResult.battersFaced),
            strikePercent: this.getAVG(pitchResult.pitches - pitchResult.balls - pitchResult.hbp, pitchResult.pitches),

            calledStrikesPercent: this.getAVG(pitchResult.calledStrikes, pitchResult.pitches),
            swingingStrikesPercent: this.getAVG(pitchResult.swingingStrikes, pitchResult.pitches),

            ballPercent: this.getAVG(pitchResult.balls, pitchResult.pitches ),
            swingPercent: this.getAVG(pitchResult.swings, pitchResult.pitches),
            inZonePercent: this.getAVG(pitchResult.inZone, pitchResult.pitches),
            inPlayPercent: this.getAVG(pitchResult.ballsInPlay, pitchResult.pitches),
            foulPercent: this.getAVG(pitchResult.fouls, pitchResult.pitches),
            foulContactPercent: pitchResult.fouls / (pitchResult.inZoneContact + pitchResult.outZoneContact),
            wildPitchPercent: this.getAVG(pitchResult.wildPitches, pitchResult.pitches),

            swingAtBallsPercent: this.getAVG(pitchResult.swingAtBalls, pitchResult.pitches - pitchResult.inZone),
            swingAtStrikesPercent: this.getAVG(pitchResult.swingAtStrikes, pitchResult.inZone),

            inZoneContactPercent: this.getAVG(pitchResult.inZoneContact, pitchResult.swingAtStrikes),
            outZoneContactPercent: this.getAVG(pitchResult.outZoneContact, pitchResult.swingAtBalls),

            babip: this.getAVG(pitchResult.hits - pitchResult.homeRuns, pitchResult.atBats - pitchResult.homeRuns - pitchResult.so + pitchResult.sacFlys),

            avgPitchQuality: this.getAVG(pitchResult.totalPitchQuality, pitchResult.pitches),
            avgPitchPowerQuality: this.getAVG(pitchResult.totalPitchPowerQuality, pitchResult.pitches),
            avgPitchLocationQuality: this.getAVG(pitchResult.totalPitchLocationQuality, pitchResult.pitches),
            avgPitchMovementQuality: this.getAVG(pitchResult.totalPitchMovementQuality, pitchResult.pitches),

            runsPerGame: pitchResult.uniqueGames > 0 ? pitchResult.runs / pitchResult.uniqueGames : 0,
            pitchesPerGame: pitchResult.uniqueGames > 0 ? pitchResult.pitches / pitchResult.uniqueGames : 0,

            singlePercent: this.getAVG(pitchResult.singles, pitchResult.battersFaced),
            doublePercent:this.getAVG(pitchResult.doubles, pitchResult.battersFaced),
            triplePercent: this.getAVG(pitchResult.triples, pitchResult.battersFaced),
            homeRunPercent: this.getAVG(pitchResult.homeRuns, pitchResult.battersFaced),

            groundBallPercent: this.getAVG(pitchResult.groundBalls, pitchResult.ballsInPlay),
            flyBallPercent:this.getAVG(pitchResult.flyBalls, pitchResult.ballsInPlay),
            ldPercent:this.getAVG(pitchResult.lineDrives, pitchResult.ballsInPlay),

            pitchesPerPA: this.getAVG(pitchResult.pitches, pitchResult.battersFaced),


        }

    }


}


export {
    StatService
}
// import assert from "assert"
// import {
//     StatService,
//     PlayerImporter
// } from "../src/index.js"
// import seedrandom from "seedrandom"
// import type {
//     PitchEnvironmentTarget,
//     PlayerImportBaseline
// } from "../src/index.js"

// import { DownloaderService } from "./service/downloader-service.js"


// let rng = new seedrandom(4)
// const statService = new StatService()
// const downloaderservice = new DownloaderService("test/data", 1000)
// let importBaseline:PlayerImportBaseline
// let pitchEnvironment:PitchEnvironmentTarget

// let season = 2025


// const players = await downloaderservice.buildSeasonPlayerImports(season, new Set([]))


// describe("PlayerImporter", async () => {


//     it("should calculate get pitch environment target for season", async () => {

//         pitchEnvironment = PlayerImporter.getPitchEnvironmentTargetForSeason(2025, players)



//         console.log(JSON.stringify(pitchEnvironment))

//     })



//         // it("should calculate player import baseline based on pitch environment", async () => {
    
//         //     pitchEnvironment = PlayerImporter.getPitchEnvironmentTargetForSeason(2025)
    
//         //     importBaseline = simService.getPlayerImportBaseline(pitchEnvironment, rng)
    
//         //     assert.ok(importBaseline)
    
//         //     console.log(importBaseline)
    
//         // })
    
//         // it("should download 2025 stats and build import data for listed players", async () => {
    
//         //     for (let playerId of playerIds) {
//         //         getPlayerImport(playerId)
//         //     }
    
//         // })
    
    
    
//         // it("should download 2025 stats and build import data for all players", async () => {
    
//         //     const players = await downloaderservice.buildSeasonPlayerImports(2025, undefined, true)
    
//         //     assert.ok(players.size > 0)
//         //     console.log(players.size)
//         // })

// })


// // const getPlayerImport = (playerId) => {

// //     const playerImportRaw = players.get(playerId)

// //     assert.ok(playerImportRaw)

// //     const playerBaseline = PlayerImporter.getImportBaselineForPlayer(pitchEnvironment, importBaseline, playerImportRaw)

// //     const command = PlayerImporter.createPlayerFromStatsCommand(pitchEnvironment, importBaseline, playerBaseline, playerImportRaw)

// //     let player = PlayerImporter.createPlayerFromStats(command)

// //     console.log(JSON.stringify(playerImportRaw, null, 2))
// //     // console.log(`${playerImportRaw.firstName} ${playerImportRaw.lastName}`)

// //     console.log(player)

// //     return {

// //         playerImportRaw: playerImportRaw,
// //         player: player,
// //         command: command, 
// //         playerBaseline: playerBaseline

// //     }

// // }

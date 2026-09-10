import path from "path"

import { SimVersionService } from "./service/sim-version-service.js"

import type { SimVersion } from "./service/sim-version-service.js"


const defaultBaseDataDir = process.env.DATA_DIR ?? "data"

const simVersionService = new SimVersionService(
    defaultBaseDataDir
)


export {
    simVersionService,
    SimVersionService
}

export type {
    SimVersion
}


if (process.argv[1] && path.basename(process.argv[1]) === "version.js") {
    const result = simVersionService.generate()

    console.log("")
    console.log("========================================")
    console.log("SIM VERSION GENERATED")
    console.log("========================================")
    console.log(JSON.stringify(result, null, 2))
    console.log("")
}
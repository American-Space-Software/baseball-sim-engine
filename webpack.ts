import path, { dirname } from "path"
import webpack from "webpack"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const packageConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")
)

const VERSION = JSON.stringify(packageConfig.version)

const baseConfig = {
  mode: "production",
  target: "node",
  experiments: {
    outputModule: true
  },
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".js", ".ts"]
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: "ts-loader"
      }
    ]
  },
  output: {
    filename: "index.js",
    library: {
      type: "module"
    },
    chunkFormat: "module"
  },
  plugins: [
    new webpack.DefinePlugin({
      VERSION
    })
  ]
}

export default [
  {
    ...baseConfig,
    entry: "./src/sim/index.ts",
    output: {
      ...baseConfig.output,
      filename: "index.js",
      path: path.resolve(__dirname, "dist"),
      clean: true
    }
  },
  {
    ...baseConfig,
    entry: "./src/importer/index.ts",
    output: {
      ...baseConfig.output,
      filename: "importer.js",
      path: path.resolve(__dirname, "dist"),
      clean: false
    }
  }
]
const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { StudyReleasePlugin } = require("./tools/StudyReleasePlugin.cjs");
const appDirectory = fs.realpathSync(process.cwd());

module.exports = (_env, argv = {}) => ({
  entry: path.resolve(appDirectory, "src/app.ts"), //path to the main .ts file
  output: {
    path: path.resolve(appDirectory, "dist"),
    filename: "js/[name].js",
    chunkFilename: "js/[id].js",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  optimization: {
    // Share modules across the scene and lazy Inspector/editor chunks.
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        // Small shader includes otherwise get inlined repeatedly into async shader chunks.
        shaderIncludes: {
          test: /[\\/]Shaders(?:WGSL)?[\\/]ShadersInclude[\\/]/,
          name: module => module.resource.includes("ShadersWGSL") ? "shader-includes-wgsl" : "shader-includes-glsl",
          minChunks: 2,
          minSize: 0,
          priority: 20,
          enforce: true,
        },
      },
    },
  },
  devServer: {
    host: "0.0.0.0",
    port: 8080, //port that we're using for local host (localhost:8080)
    disableHostCheck: true,
    contentBase: path.resolve(appDirectory, "public"), //tells webpack to serve from the public folder
    publicPath: "/",
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(appDirectory, "public/index.html"),
    }),
    new CleanWebpackPlugin(),
    ...(argv.mode === "production" ? [new StudyReleasePlugin()] : []),
  ],
  mode: argv.mode || "development",
});

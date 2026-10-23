// A controlled minifier-only capacity experiment. Does not modify the normal webpack config.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const webpack = require('webpack'), TerserPlugin = require('minimizer-webpack-plugin');
const { verifyRelease } = require('./verify-study-release.cjs');
const output = path.resolve(process.env.AUDIO_CAPACITY_DIST || path.join(os.tmpdir(), 'babylon-audio-capacity-probe'));
if (output === path.resolve('dist') || !output.includes('audio-capacity')) throw new Error('Capacity probe must have its own output');
const config = require('../webpack.config.js')({}, { mode: 'production' });
config.output.path = output;
config.optimization.minimizer = [new TerserPlugin({ terserOptions: { ecma: 2020, compress: { passes: 3 } } })];
const compiler = webpack(config);
compiler.run((error, stats) => compiler.close(() => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const checked = verifyRelease(output), manifest = JSON.parse(fs.readFileSync(path.join(output, 'release-manifest.json')));
  console.log(JSON.stringify({ output, minifier: 'Terser ecma2020, compress.passes=3; no unsafe transforms',
    totals: manifest.totals, checked, warnings: stats.toJson({ all: false, warnings: true }).warnings.map(w => w.message) }, null, 2));
}));

// Isolated production audition build. Nothing here enters the game's webpack entry.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createHash } = require('node:crypto');
const webpack = require('webpack'), HtmlWebpackPlugin = require('html-webpack-plugin');
const root = path.resolve(__dirname, '..'), hash = b => createHash('sha256').update(b).digest('hex');
const defaultOutput = path.join(os.tmpdir(), 'babylon-audio-stage-a-lab');

async function build(output = defaultOutput) {
  output = path.resolve(output);
  if (output === root || output === path.join(root, 'dist') || !output.includes('audio')) throw new Error('Use a separate audio-lab output directory');
  require('./audio-lab-resources.cjs').validateLabResources(root);
  const candidates = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio-lab/manifest.json')));
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'public/audio/study/source.json')));
  class Assets {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('AudioLabAssets', compilation => {
        compilation.hooks.processAssets.tap({ name: 'AudioLabAssets', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
          const copy = (from, to) => compilation.emitAsset(to, new webpack.sources.RawSource(fs.readFileSync(path.join(root, from))));
          for (const clip of candidates.clips) for (const f of clip.formats) copy('assets/audio-lab/' + f.file, 'candidates/' + f.file);
          for (const f of baseline.files) copy('public/' + f.file, f.file);
          copy('assets/audio-lab/manifest.json', 'candidates.json');
          copy('assets/audio-source/soundscape-lab/source.json', 'sources.json');
          copy('public/audio/study/source.json', 'baseline-source.json');
          copy('node_modules/@babylonjs/core/license.md', 'licenses/babylonjs-license.md');
          copy('node_modules/@babylonjs/core/NOTICE.md', 'licenses/babylonjs-notice.md');
        });
        compilation.hooks.processAssets.tap({ name: 'AudioLabAssets', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
          const modules = [...compilation.modules].filter(m => m.resource).map(m => ({ path: path.relative(root, m.resource).replaceAll('\\', '/'), bytes: m.size() }));
          const files = compilation.getAssets().map(a => { const b = a.source.buffer(); return { path: a.name, bytes: b.length, sha256: hash(b) }; }).sort((a, b) => a.path.localeCompare(b.path));
          const summary = { schemaVersion: 1, purpose: 'Phase A isolated production lab; not game dist', files,
            bytesExcludingManifest: files.reduce((n, f) => n + f.bytes, 0), jsBytes: files.filter(f => f.path.endsWith('.js')).reduce((n, f) => n + f.bytes, 0),
            modules, manifestAccounting: 'Verify adds this manifest actual file size; all async chunks included' };
          compilation.emitAsset('lab-manifest.json', new webpack.sources.RawSource(JSON.stringify(summary, null, 2) + '\n'));
        });
      });
    }
  }
  const compiler = webpack({ mode: 'production', context: root, entry: path.join(__dirname, 'audio-lab/lab.js'),
    output: { path: output, filename: 'js/main.js', chunkFilename: 'js/[id].js', clean: true },
    resolve: { extensions: ['.js', '.ts'] }, devtool: false,
    module: { rules: [{ test: /\.ts$/, use: { loader: 'ts-loader', options: { transpileOnly: true } }, exclude: /node_modules/ }] },
    plugins: [new HtmlWebpackPlugin({ template: path.join(__dirname, 'audio-lab/index.html') }), new Assets()],
    optimization: { splitChunks: { chunks: 'all' } }, performance: false });
  const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : resolve(stats)));
  await new Promise(resolve => compiler.close(resolve));
  if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
  return JSON.parse(fs.readFileSync(path.join(output, 'lab-manifest.json')));
}
function serve(directory = defaultOutput, port = 0) {
  directory = path.resolve(directory);
  const server = http.createServer((request, response) => {
    let name = new URL(request.url, 'http://localhost').pathname.replace(/^\/audio-lab\//, '/');
    if (name.endsWith('/')) name += 'index.html';
    const file = path.resolve(directory, '.' + decodeURIComponent(name));
    if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' }); response.end(data);
    });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}
module.exports = { build, serve, defaultOutput };
if (require.main === module) (async () => {
  const result = await build();
  console.log(JSON.stringify({ output: defaultOutput, jsBytes: result.jsBytes, files: result.files.length + 1 }));
  if (process.argv.includes('--serve')) {
    const server = await serve(defaultOutput, Number(process.env.AUDIO_LAB_PORT || 8109));
    console.log('Audio lab: http://127.0.0.1:' + server.address().port + '/');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const config = require('./study-release.config.cjs');
const { analyzeBundle } = require('./study-bundle-analysis.cjs');
const { validateAudioResources } = require('./study-audio-resources.cjs');

const hash = data => createHash('sha256').update(data).digest('hex');

class StudyReleasePlugin {
  apply(compiler) {
    const name = 'StudyReleasePlugin';
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap(name, compilation => {
      const kinds = new Map();
      compilation.hooks.processAssets.tap({ name, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
        validateAudioResources(path.join(compiler.context, 'public'));
        const copy = (source, file, kind) => {
          compilation.fileDependencies.add(source);
          if (compilation.getAsset(file)) throw new Error(`Release asset collision: ${file}`);
          compilation.emitAsset(file, new sources.RawSource(fs.readFileSync(source)));
          kinds.set(file, kind);
        };
        for (const kind of ['runtime', 'documentation']) {
          for (const file of config[kind]) copy(path.join(compiler.context, 'public', file), file, kind);
        }
        for (const notice of config.libraryNotices) {
          copy(path.join(compiler.context, notice.source), notice.file, 'documentation');
        }
      });
      // Record final bytes after HTML generation and JS minification, including license sidecars.
      compilation.hooks.processAssets.tap({ name, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        compilation.emitAsset('bundle-analysis.json', new sources.RawSource(JSON.stringify(analyzeBundle(compilation, compiler.context), null, 2) + '\n'));
        const files = compilation.getAssets().map(({ name: file, source }) => {
          const data = source.buffer();
          return { path: file, kind: kinds.get(file) || 'build', bytes: data.length, sha256: hash(data) };
        }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
        const manifest = {
          schemaVersion: 1,
          mode: compiler.options.mode,
          webpackVersion: compiler.webpack.version,
          // No timestamp or absolute paths: unchanged inputs produce an identical manifest.
          entryFiles: [...compilation.entrypoints.values()].flatMap(entry => entry.getFiles()),
          chunkFiles: [...new Set([...compilation.chunks].flatMap(chunk => [...chunk.files]))].sort(),
          budgets: config.budgets,
          totals: Object.fromEntries(['build', 'runtime', 'documentation'].map(kind =>
            [kind, files.filter(file => file.kind === kind).reduce((sum, file) => sum + file.bytes, 0)])),
          manifestAccounting: 'files and totals exclude release-manifest.json; verification adds its actual bytes to the full release budget',
          files,
        };
        const payload = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
        const releaseBytes = files.reduce((sum, file) => sum + file.bytes, 0) + payload.length;
        const modelBytes = files.filter(file => config.optimizedModels.includes(file.path)).reduce((sum, file) => sum + file.bytes, 0);
        if (modelBytes > config.budgets.models || manifest.totals.runtime > config.budgets.runtime || releaseBytes > config.budgets.release) {
          throw new Error(`Study release exceeds budget: models=${modelBytes}, runtime=${manifest.totals.runtime}, release=${releaseBytes}`);
        }
        compilation.emitAsset('release-manifest.json', new sources.RawSource(payload));
      });
    });
  }
}

module.exports = { StudyReleasePlugin, hash };

// Reuse frozen suites without overwriting their historical evidence or changing application code.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const suites = {
  browser: ['lighthouse-operation-phase3-2026-10-20/check-browser.cjs'],
  journey: ['lighthouse-operation-phase3-2026-10-20/check-journey.cjs'],
  matrix: ['lighthouse-operation-phase3-2026-10-20/check-matrix.cjs'],
  regression: ['lighthouse-finish-2026-10-19/check-regression.cjs', 'counts'],
  'master-mirror': ['day-night-phase2-2026-10-19/check-night-master-mirror.cjs'],
  'public-mirror': ['day-night-phase2-2026-10-19/check-night-public-mirror.cjs'],
  curtains: ['interactive-curtains-2026-10-20/check-browser.cjs'],
  ceiling: ['house-ceiling-lights-2026-10-20/check-browser.cjs'],
  scooter: ['clouds-stars-phase3-2026-10-19/check-scooter.cjs', 'output'],
  headlight: ['scooter-headlight-2026-10-20/check-browser.cjs', 'headlight-output'],
  lifecycle: ['clouds-stars-phase3-2026-10-19/check-lifecycle.cjs', 'output'],
  recreate: ['clouds-stars-phase3-2026-10-19/check-recreate.cjs', 'output'],
  platforms: ['clouds-stars-phase3-2026-10-19/check-platforms.cjs', 'platform-output'],
};
exports.suites = suites;
if (require.main === module) {
  const suite = suites[process.argv[2]]; assert.ok(suite, 'Known suite required');
  const source = path.resolve(__dirname, '..', suite[0]);
  const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname); fs.mkdirSync(output, {recursive: true});
  process.env.STUDY_CHECK_OUTPUT = output;
  let code = fs.readFileSync(source, 'utf8');
  const replace = (before, after) => {assert.equal(code.split(before).length, 2, before); code = code.replace(before, after);};
  if (suite[1] === 'counts') {
    replace('assert.equal(record.scene.actions.length,28);', 'assert.equal(record.scene.actions.length,41);');
    replace('record.scene.sceneOwnedVehicleMeshes.length,7', 'record.scene.sceneOwnedVehicleMeshes.length,8');
  }
  if (suite[1] === 'output' || suite[1] === 'platform-output') {
    assert.ok(code.includes('path.join(__dirname,'));
    code = 'const output=' + JSON.stringify(output) + ';\n' + code.replaceAll('path.join(__dirname,', 'path.join(output,');
  }
  if (suite[1] === 'headlight-output') replace('const out=__dirname,', 'const out=' + JSON.stringify(output) + ',');
  if (suite[1] === 'platform-output') {
    replace("checkedOn:'2026-10-19'", "checkedOn:'2026-10-20'");
    code = code.replaceAll('cloudsStarsTested', 'lighthouseTested');
    code = code.replaceAll('8198', '8228');
  }
  const copy = new Module(source, module); copy.filename = source; copy.paths = Module._nodeModulePaths(path.dirname(source));
  copy._compile(code, source);
}

// Preserve the original suite, adapting only the current count: four ceiling lights, six curtains, two devices.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const source = require.resolve('../lighthouse-finish-2026-10-19/check-regression.cjs');
const text = fs.readFileSync(source, 'utf8'), old = 'assert.equal(record.scene.actions.length,28);';
assert.equal(text.split(old).length, 2);
process.env.STUDY_URL ||= 'http://127.0.0.1:8215/';
process.env.STUDY_CHECK_OUTPUT ||= path.join(__dirname, 'regression');
const copy = new Module(source, module); copy.filename = source; copy.paths = Module._nodeModulePaths(path.dirname(source));
copy._compile(text.replace(old, 'assert.equal(record.scene.actions.length,40);').replace('record.scene.sceneOwnedVehicleMeshes.length,7', 'record.scene.sceneOwnedVehicleMeshes.length,8'), source);

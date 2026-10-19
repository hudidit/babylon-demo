// Reuse the original full house regression; only the expected action count gains four lamps.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const source=require.resolve('../lighthouse-finish-2026-10-19/check-regression.cjs');
const text=fs.readFileSync(source,'utf8'),old='assert.equal(record.scene.actions.length,28);';
assert.equal(text.split(old).length,2,'Original count assertion must remain identifiable');
process.env.STUDY_URL ||= 'http://127.0.0.1:8210/';
process.env.STUDY_CHECK_OUTPUT ||= '/private/tmp/babylon-ceiling-regression';
const moduleCopy=new Module(source,module);moduleCopy.filename=source;moduleCopy.paths=Module._nodeModulePaths(require('node:path').dirname(source));
moduleCopy._compile(text.replace(old,'assert.equal(record.scene.actions.length,32);'),source);

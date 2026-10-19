// Reuse the original full house regression; the expected action count includes four ceiling lamps and six curtains.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const source=require.resolve('../lighthouse-finish-2026-10-19/check-regression.cjs');
const text=fs.readFileSync(source,'utf8'),old='assert.equal(record.scene.actions.length,28);';
assert.equal(text.split(old).length,2,'Original count assertion must remain identifiable');
process.env.STUDY_URL ||= 'http://127.0.0.1:8211/';
process.env.STUDY_CHECK_OUTPUT ||= '/private/tmp/babylon-curtains-regression';
const moduleCopy=new Module(source,module);moduleCopy.filename=source;moduleCopy.paths=Module._nodeModulePaths(require('node:path').dirname(source));
moduleCopy._compile(text.replace(old,'assert.equal(record.scene.actions.length,38);'),source);

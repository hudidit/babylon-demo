// Preserve historical evidence. Only current resource counts and output destinations change.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const suites={
 recreate:['clouds-stars-phase3-2026-10-19/check-recreate.cjs'],
 browser:['lighthouse-operation-phase3-2026-10-20/check-browser.cjs'],
 journey:['lighthouse-operation-phase3-2026-10-20/check-journey.cjs'],
 regression:['lighthouse-finish-2026-10-19/check-regression.cjs'],
 curtains:['interactive-curtains-2026-10-20/check-browser.cjs'],
 ceiling:['house-ceiling-lights-2026-10-20/check-browser.cjs'],
 'master-mirror':['day-night-phase2-2026-10-19/check-night-master-mirror.cjs'],
 'public-mirror':['day-night-phase2-2026-10-19/check-night-public-mirror.cjs'],
 headlight:['scooter-headlight-2026-10-20/check-browser.cjs'],
};
exports.suites=suites;
if(require.main===module){
 const name=process.argv[2],entry=suites[name];assert.ok(entry,'Known suite required');
 const source=path.resolve(__dirname,'..',entry[0]),output=path.resolve(process.env.STUDY_CHECK_OUTPUT);fs.mkdirSync(output,{recursive:true});
 let code=fs.readFileSync(source,'utf8');const replace=(before,after)=>{assert.equal(code.split(before).length,2,before);code=code.replace(before,after);};
 if(name==='browser')replace('assert.equal(record.resources.textures, 152);','assert.equal(record.resources.textures, 153);');
 if(name==='journey'){
  // The historical screenshot loop consumed active time and could finish a wipe before its cancellation assertion.
  const hook=`replace("self.shotRender=()=>s.render();", "self.captureDelta=e.getDeltaTime;e.getDeltaTime=()=>0;self.shotRender=()=>s.render();");
replace("await page.evaluate(()=>e.stopRenderLoop(self.shotRender));", "await page.evaluate(()=>{e.stopRenderLoop(self.shotRender);e.getDeltaTime=self.captureDelta;});");\n`;
  replace('const copy = new Module(__filename, module);',hook+'const copy = new Module(__filename, module);');
 }
 if(name==='regression'){
  replace('assert.equal(record.scene.actions.length,28);','assert.equal(record.scene.actions.length,49);');
  replace('record.scene.sceneOwnedVehicleMeshes.length,7','record.scene.sceneOwnedVehicleMeshes.length,8');
 }
 if(name==='recreate'){
  code='const output='+JSON.stringify(output)+';\n'+code.replaceAll('path.join(__dirname,','path.join(output,');
  replace('const active={document:', "assert.equal(await page.locator('[data-power-command]').count(),5);assert.equal(await page.locator('[data-command]').count(),15,'exactly one live command set after recreation');const active={document:");
  replace('const disposed=await page.evaluate', "assert.equal(await page.locator('[data-power-command]').count(),0);assert.equal(await page.locator('[data-command]').count(),0,'owned command nodes removed on disposal');const disposed=await page.evaluate");
 }
 if(name==='headlight')replace('const out=__dirname,','const out='+JSON.stringify(output)+',');
 const copy=new Module(source,module);copy.filename=source;copy.paths=Module._nodeModulePaths(path.dirname(source));copy._compile(code,source);
}

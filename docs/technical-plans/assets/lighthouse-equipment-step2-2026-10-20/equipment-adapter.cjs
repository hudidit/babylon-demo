// Historical assertions remain intact except for documented new counts, commissioned readings and controls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=path.resolve(__dirname,'../lighthouse-equipment-step1-2026-10-20/check-equipment.cjs');
let code=fs.readFileSync(source,'utf8');
for(const [before,after]of [
 ['equipment.length,23','equipment.length,24'],['n+m.vertices,0),1560','n+m.vertices,0),1588'],['metadata.commissioned,false','metadata.commissioned,true'],
 ["await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lighthouse-panel-return');",
  "await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement===Array.from(document.querySelectorAll('#lighthouse-panel button,#lighthouse-panel select')).filter(n=>n.getClientRects().length&&!n.disabled).at(-1)),true);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lighthouse-panel-return');"]
]){assert.equal(code.split(before).length,2,before);code=code.replace(before,after);}
const copy=new Module(source,module);copy.filename=source;copy.paths=Module._nodeModulePaths(path.dirname(source));copy._compile(code,source);

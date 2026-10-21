const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name)));
const root=path.resolve(__dirname,'../../../..'),raw=fs.readFileSync(path.join(root,'dist/release-manifest.json'));
const previous=fs.readFileSync(path.join(__dirname,'../lighthouse-equipment-step5-2026-10-21/release-manifest.json'));
assert.deepEqual(raw,previous,'Pure logic must leave the entire delivered manifest unchanged');
const browser=read('browser.json'),models=read('models.json');assert.equal(browser.passed,true);assert.equal(models.passed,true);
assert.equal(browser.manifestSha256,sha(raw));assert.equal(browser.pages.length,2);assert.equal(browser.files.length,2);
for(const page of browser.pages){assert.equal(page.passed,true);assert.deepEqual(page.errors,[]);assert.deepEqual(page.warnings,[]);assert.ok(page.initialJsBytes<=3*1048576);assert.equal(page.requests.filter(r=>r.status>=400).length,0);}
for(const check of browser.files){assert.equal(check.passed,true);assert.equal(check.files,495);}
for(const seed of models.seeds){assert.equal(seed.passed,true);assert.equal(new Set(seed.steps.map(s=>s.sha256)).size,1);}
for(const [name,hash]of Object.entries(models.files))assert.equal(sha(fs.readFileSync(path.join(root,'src/examples',name))),hash);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 298[\s\S]*pass 298[\s\S]*fail 0/);
assert.match(fs.readFileSync(path.join(__dirname,'development-build.log'),'utf8'),/compiled successfully/);
assert.match(fs.readFileSync(path.join(__dirname,'production-build.log'),'utf8'),/compiled with 3 warnings/);
assert.ok(!fs.readFileSync(path.join(__dirname,'typecheck.log'),'utf8').includes('error TS'));
fs.writeFileSync(path.join(__dirname,'release-manifest.json'),raw);
fs.copyFileSync(path.join(root,'dist/bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));
const record={baseline:'1f9ef6c',passed:true,manifestSha256:sha(raw),productionFilesUnchanged:true,modelSeeds:models.seeds.length,
 replayStepCounts:models.seeds.map(s=>s.steps.length),tests:298,newTests:19,totals:browser.totals,browser:browser.browser,files:{}};
for(const name of ['LighthouseRandom.ts','LighthouseWeather.ts','LighthouseRisk.ts'])record.files['src/examples/'+name]=sha(fs.readFileSync(path.join(root,'src/examples',name)));
record.files['tests/lighthouse-weather-risk.test.cjs']=sha(fs.readFileSync(path.join(root,'tests/lighthouse-weather-risk.test.cjs')));
record.environment={node:process.version,typescript:require('typescript/package.json').version,webpack:require('webpack/package.json').version};
fs.writeFileSync(path.join(__dirname,'evidence-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));

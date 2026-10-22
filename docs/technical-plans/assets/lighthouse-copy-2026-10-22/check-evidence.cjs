const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['AGENTS.md','CHANGELOG.md','docs/technical-plans/README.md','docs/technical-plans/2026-10-22-game-copy-and-voice.md','docs/game-writing-guide.md','docs/technical-plans/2026-10-21-lighthouse-three-day-story.md','public/STUDY_ASSET_SOURCES.md','docs/technical-plans/assets/lighthouse-copy-2026-10-22/README.md'];
const record={files,links:0,anchors:0,sourceBindings:0,errors:[],node:process.version};
const slug=s=>s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu,'').trim().replace(/\s/g,'-');
function anchors(file){const set=new Set(),seen=new Map();for(const line of fs.readFileSync(file,'utf8').split('\n')){const h=line.match(/^#{1,6}\s+(.+)$/);if(!h)continue;const id=slug(h[1]),n=seen.get(id)||0;seen.set(id,n+1);set.add(id+(n?'-'+n:''));}return set;}
fs.writeFileSync(path.join(__dirname,'documentation-check.json'),'{}\n');
for(const file of files)for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
 const url=match[1].replace(/^<|>$/g,'');if(/^[a-z][a-z0-9+.-]*:/i.test(url))continue;
 const [name,fragment]=url.split('#'),target=path.resolve(root,file==='public/STUDY_ASSET_SOURCES.md'?'dist':path.dirname(file),decodeURIComponent(name||path.basename(file)));record.links++;
 if(!fs.existsSync(target))record.errors.push({file,url,error:'missing target'});
 else if(fragment&&target.endsWith('.md')){record.anchors++;if(!anchors(target).has(decodeURIComponent(fragment)))record.errors.push({file,url,error:'missing anchor'});}
}
const browser=JSON.parse(fs.readFileSync(path.join(__dirname,'chapters-browser.json'))),regression=JSON.parse(fs.readFileSync(path.join(__dirname,'regression.json')));
assert.equal(browser.passed,true);assert.equal(regression.passed,true);assert.equal(browser.manifestSha256,regression.manifestSha256);
assert.ok(Object.values(browser.cases).every(Boolean));assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.warnings,[]);
for(const result of [browser,regression])for(const [file,hash]of Object.entries(result.sources)){assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);record.sourceBindings++;}
const raw=fs.readFileSync(path.join(root,'dist/release-manifest.json')),manifest=JSON.parse(raw),release=require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(path.join(root,'dist'));
assert.equal(sha(raw),browser.manifestSha256);assert.deepEqual(fs.readFileSync(path.join(__dirname,'release-manifest.json')),raw);
assert.deepEqual(release,browser.release);assert.deepEqual(release,regression.release);
for(const c of [browser,...regression.cases]){
 assert.ok(c.firstScreenBytes<=3*1048576);assert.equal(c.firstScreenBytes,c.firstScreenJs.reduce((n,f)=>n+f.bytes,0));
 for(const js of c.firstScreenJs){const file=path.join(root,'dist',js.path.replace(/^\/home\//,'/').replace(/^\//,''));assert.equal(sha(fs.readFileSync(file)),js.sha256);}
}
assert.equal(browser.storyInteractionBytes,browser.storyInteractionJs.reduce((n,f)=>n+f.bytes,0));
assert.equal(browser.firstScreenJs.some(f=>f.sha256===browser.storyChunk.sha256),false);assert.ok(browser.storyInteractionJs.some(f=>f.sha256===browser.storyChunk.sha256));
assert.ok(manifest.files.some(f=>f.path===browser.storyChunk.path&&f.sha256===browser.storyChunk.sha256));
for(const prefix of regression.prefixes){assert.equal(prefix.passed,true);assert.equal(prefix.files,release.fileCount);}
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../lighthouse-story-step3-2026-10-22/release-manifest.json'))),runtime=m=>m.files.filter(f=>f.kind==='runtime');
assert.deepEqual(runtime(manifest),runtime(baseline));record.unchangedRuntimeAssets=runtime(manifest).length;
record.unchangedFiles=['src/examples/RoomTimeOfDay.ts','src/examples/RoomRuntime.ts','src/examples/LighthouseOperation.ts','src/examples/LighthousePower.ts','src/examples/LighthouseEquipment.ts','src/examples/LighthouseEquipmentLayout.ts','src/examples/LighthouseLayout.ts','src/examples/LighthouseGeometry.ts','src/examples/LighthouseExperience.ts','public/environment/coastal-cliff-source.json','package.json','package-lock.json','webpack.config.js','tools/verify-study-release.cjs'];
for(const file of record.unchangedFiles)assert.equal(sha(cp.execFileSync('git',['show','93974e4:'+file],{cwd:root})),sha(fs.readFileSync(path.join(root,file))),file);
// Copy edits cannot loosen serialized-message validation or change their canonical originals.
const oldStory=cp.execFileSync('git',['show','93974e4:src/examples/LighthouseStory.ts'],{cwd:root,encoding:'utf8'}),newStory=fs.readFileSync(path.join(root,'src/examples/LighthouseStory.ts'),'utf8');
const section=(s,a,b)=>{const start=s.indexOf(a),end=b?s.indexOf(b,start):s.length;assert.ok(start>=0&&end>start);return s.slice(start,end);};
for(const [a,b]of [['private messageContent(', 'private solarWasEarly('],['private validateCheckpoint(', null]]){
 assert.equal(section(newStory,a,b),section(oldStory,a,b),a);
}
record.canonicalMessagesAndValidationUnchanged=true;
const testLog=fs.readFileSync(path.join(__dirname,'tests.log'),'utf8');assert.match(testLog,/tests 383/);assert.match(testLog,/pass 383/);assert.match(testLog,/fail 0/);
for(const name of ['typecheck.log','development-build.log','production-build.log'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,name),'utf8'),/error TS\d+|compiled with .* errors/);
record.screens=Object.fromEntries(fs.readdirSync(__dirname).filter(p=>p.endsWith('.jpg')).map(p=>[p,sha(fs.readFileSync(path.join(__dirname,p)))]));
record.release=release;record.firstScreenBytes=browser.firstScreenBytes;record.storyInteractionBytes=browser.storyInteractionBytes;record.manifestSha256=sha(raw);record.passed=record.errors.length===0;
fs.writeFileSync(path.join(__dirname,'documentation-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));assert.equal(record.passed,true);

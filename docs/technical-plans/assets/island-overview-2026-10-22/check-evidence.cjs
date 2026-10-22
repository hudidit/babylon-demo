const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['CHANGELOG.md','docs/technical-plans/README.md','docs/technical-plans/2026-10-22-island-overview-and-beacon-timing.md',
 'docs/technical-plans/2026-10-20-lighthouse-operation-and-keeper-routine.md','docs/technical-plans/2026-10-20-lighthouse-project-01-core-loop.md',
 'docs/technical-plans/2026-10-20-lighthouse-focused-experience.md','docs/technical-plans/2026-10-22-lighthouse-visible-beam.md',
 'docs/technical-plans/2026-10-21-lighthouse-three-day-story.md','public/STUDY_ASSET_SOURCES.md','docs/technical-plans/assets/island-overview-2026-10-22/README.md'];
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
const browser=JSON.parse(fs.readFileSync(path.join(__dirname,'browser.json')));assert.equal(browser.passed,true);
for(const [file,hash]of Object.entries(browser.sources)){assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);record.sourceBindings++;}
const manifest=fs.readFileSync(path.join(root,'dist/release-manifest.json'));assert.equal(sha(manifest),browser.manifestSha256);assert.deepEqual(fs.readFileSync(path.join(__dirname,'release-manifest.json')),manifest);
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),op=load('LighthouseOperation').LIGHTHOUSE_OPERATION,inspection=load('LighthouseInspection').LIGHTHOUSE_INSPECTION;
const source=JSON.parse(fs.readFileSync(path.join(root,'public/environment/coastal-cliff-source.json'))).lighthouseOperation;
assert.equal(source.rotationSeconds,op.rotationSeconds);assert.equal(source.testActiveSeconds,op.testSeconds);assert.equal(source.observationActiveSeconds,inspection.observationSeconds);
record.manifestSha256=sha(manifest);record.passed=record.errors.length===0;fs.writeFileSync(path.join(__dirname,'documentation-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));assert.equal(record.passed,true);

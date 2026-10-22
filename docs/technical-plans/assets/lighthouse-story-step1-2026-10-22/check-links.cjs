const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..');
const files=['CHANGELOG.md','docs/technical-plans/README.md','docs/technical-plans/2026-10-22-lighthouse-story-state-machine.md',
 'docs/technical-plans/2026-10-21-lighthouse-three-day-story.md','docs/technical-plans/2026-10-20-lighthouse-focused-experience.md',
 'docs/technical-plans/2026-10-20-lighthouse-project-03-weather-and-uncertainty.md',
 'docs/technical-plans/2026-10-20-lighthouse-operation-and-keeper-routine.md','docs/technical-plans/assets/lighthouse-story-step1-2026-10-22/README.md'];
const slug=s=>s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu,'').trim().replace(/\s/g,'-');
function anchors(file){const seen=new Map(),set=new Set();for(const line of fs.readFileSync(file,'utf8').split('\n')){const h=line.match(/^#{1,6}\s+(.+)$/);if(!h)continue;
 const id=slug(h[1]),n=seen.get(id)||0;seen.set(id,n+1);set.add(id+(n?'-'+n:''));}return set;}
const record={files,links:0,anchors:0,errors:[]};
for(const file of files)for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
 const url=match[1].replace(/^<|>$/g,'');if(/^[a-z][a-z0-9+.-]*:/i.test(url))continue;
 const [name,fragment]=url.split('#'),target=path.resolve(root,path.dirname(file),decodeURIComponent(name||path.basename(file)));record.links++;
 if(!fs.existsSync(target))record.errors.push({file,url,error:'missing target'});
 else if(fragment&&target.endsWith('.md')){record.anchors++;if(!anchors(target).has(decodeURIComponent(fragment)))record.errors.push({file,url,error:'missing anchor'});}
}
record.passed=record.errors.length===0;fs.writeFileSync(path.join(__dirname,'documentation-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));assert.equal(record.passed,true);

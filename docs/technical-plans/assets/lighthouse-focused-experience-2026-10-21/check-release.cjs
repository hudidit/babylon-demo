const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyRelease}=require('../../../../tools/verify-study-release.cjs'),root=path.resolve(__dirname,'../../../../dist'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const totals=verifyRelease(root),raw=fs.readFileSync(path.join(root,'release-manifest.json')),manifest=JSON.parse(raw);
 const previous=require('../lighthouse-equipment-step3-2026-10-20/release-manifest.json'),runtime=m=>m.files.filter(f=>f.kind==='runtime').map(({path,bytes,sha256})=>({path,bytes,sha256}));assert.deepEqual(runtime(manifest),runtime(previous));
 const record={baseline:'ccbdc3f',releaseManifestSha256:sha(raw),totals,unchangedRuntimeFiles:runtime(manifest).length,prefixes:[]};
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of ['','home/']){const base=new URL(prefix,process.env.STUDY_URL||'http://127.0.0.1:8242/');
  for(let n=0;n<files.length;n+=2)await Promise.all(files.slice(n,n+2).map(async file=>{const r=await fetch(new URL(file.path,base));assert.equal(r.status,200,file.path);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);}));
  record.prefixes.push({path:base.pathname,files:files.length,passed:true});
 }
 fs.copyFileSync(path.join(root,'bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));fs.writeFileSync(path.join(__dirname,'release-manifest.json'),raw);record.passed=true;fs.writeFileSync(path.join(__dirname,'release.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
})().catch(e=>{console.error(e);process.exitCode=1;});

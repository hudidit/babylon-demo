const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{verifyRelease}=require('../../../../tools/verify-study-release.cjs');
const root=path.resolve(__dirname,'../../../../dist'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 const totals=verifyRelease(root),raw=fs.readFileSync(path.join(root,'release-manifest.json')),manifest=JSON.parse(raw);
 const previous=require('../clouds-stars-phase2-2026-10-19/release-manifest.json'),runtime=m=>m.files.filter(f=>f.kind==='runtime').map(({path,bytes,sha256})=>({path,bytes,sha256}));
 assert.deepEqual(runtime(manifest),runtime(previous));
 assert.deepEqual(manifest,previous,'Final release must be byte-for-byte identical to stage 2 when runtime code is unchanged');
 const analysis=JSON.parse(fs.readFileSync(path.join(root,'bundle-analysis.json')));
 const record={baseline:'47eb076',totals,unchangedRuntimeFiles:runtime(manifest).length,staticInitialJsBytes:analysis.initialJsBytes,
  staticJsDeltaFromPhase2:analysis.initialJsBytes-2684677,staticJsDeltaTotal:analysis.initialJsBytes-2678234,releaseDeltaFromPhase2:totals.releaseBytes-42316300,releaseDeltaTotal:totals.releaseBytes-42309856,prefixes:[]};
 assert.ok(record.staticJsDeltaTotal<=24*1024);assert.ok(record.releaseDeltaTotal<=64*1024);
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of['','home/']){const base=new URL(prefix,process.env.STUDY_URL||'http://127.0.0.1:8201/');
  for(const file of files){const r=await fetch(new URL(file.path,base));assert.equal(r.status,200,file.path);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,file.bytes,file.path);assert.equal(sha(b),file.sha256,file.path);}
  record.prefixes.push({path:base.pathname,files:files.length,passed:true});}
 record.passed=true;fs.writeFileSync(path.join(__dirname,'release-manifest.json'),raw);fs.copyFileSync(path.join(root,'bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));
 fs.writeFileSync(path.join(__dirname,'release-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});

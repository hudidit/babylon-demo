const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyRelease}=require('../../../../tools/verify-study-release.cjs');
const root=path.resolve(__dirname,'../../../../dist'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
  const totals=verifyRelease(root),data=fs.readFileSync(path.join(root,'release-manifest.json')),manifest=JSON.parse(data);
  const previous=require('../day-night-phase3-2026-10-19/release-manifest.json');
  const runtime=m=>m.files.filter(f=>f.kind==='runtime').map(({path,bytes,sha256})=>({path,bytes,sha256}));
  assert.deepEqual(runtime(manifest),runtime(previous),'all 36 runtime resources remain byte-identical');
  assert.deepEqual(manifest.files,previous.files,'all output file sizes and hashes match the phase3 release');
  assert.equal(sha(data),sha(fs.readFileSync(path.join(__dirname,'../day-night-phase3-2026-10-19/release-manifest.json'))),'the manifest itself also matches');
  const files=[...manifest.files,{path:'release-manifest.json',bytes:data.length,sha256:sha(data)}];
  const record={baseline:'69606ac',totals,unchangedRuntimeFiles:runtime(manifest).length,unchangedReleaseFiles:manifest.files.length+1,prefixes:[]};
  for(const prefix of ['','home/']){
    const base=new URL(prefix,process.env.STUDY_URL||'http://127.0.0.1:8196/');
    for(const file of files){const response=await fetch(new URL(file.path,base));assert.equal(response.status,200,file.path);
      const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);}
    record.prefixes.push({path:base.pathname,files:files.length,bytes:totals.releaseBytes,passed:true});
  }
  record.passed=true;fs.writeFileSync(path.join(__dirname,'release-check.json'),JSON.stringify(record,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'release-manifest.json'),data);
  console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});

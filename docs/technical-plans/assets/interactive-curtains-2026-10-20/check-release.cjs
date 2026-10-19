const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyRelease}=require('../../../../tools/verify-study-release.cjs');
const root=path.resolve(__dirname,'../../../../dist'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
  const totals=verifyRelease(root),raw=fs.readFileSync(path.join(root,'release-manifest.json')),manifest=JSON.parse(raw);
  const previous=require('../house-ceiling-lights-2026-10-20/release-manifest.json');
  const runtime=m=>m.files.filter(f=>f.kind==='runtime').map(({path,bytes,sha256})=>({path,bytes,sha256}));
  assert.deepEqual(runtime(manifest),runtime(previous),'Downloaded assets remain unchanged');
  const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
  const record={baseline:'603342d',totals,unchangedRuntimeFiles:runtime(manifest).length,prefixes:[]};
  for(const prefix of ['', 'home/']) {
    const base=new URL(prefix,process.env.STUDY_URL||'http://127.0.0.1:8211/');
    for(const file of files) {
      const response=await fetch(new URL(file.path,base));assert.equal(response.status,200,file.path);
      const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);
    }
    record.prefixes.push({path:base.pathname,files:files.length,passed:true});
  }
  fs.copyFileSync(path.join(root,'bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));
  fs.writeFileSync(path.join(__dirname,'release-manifest.json'),raw);
  record.passed=true;fs.writeFileSync(path.join(__dirname,'release.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});

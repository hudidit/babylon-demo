const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),{verifyRelease}=require(path.join(root,'tools/verify-study-release.cjs'));
const url=process.env.STUDY_URL||'http://127.0.0.1:8170/',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const dist=path.join(root,'dist'),metrics=verifyRelease(dist),raw=fs.readFileSync(path.join(dist,'release-manifest.json'));
 const manifest=JSON.parse(raw),files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:hash(raw)}];
 const record={baseline:'2169624 + lighthouse A',metrics,deployments:[],fpsOrLoadTimeSampling:false};
 const old=JSON.parse(fs.readFileSync(path.join(root,'docs/technical-plans/assets/coastal-cliff-d-2026-10-18/release-manifest.json')));
 const runtime=require(path.join(root,'tools/study-release.config.cjs')).runtime;
 record.runtime=runtime.map(file=>{const before=old.files.find(f=>f.path===file),after=manifest.files.find(f=>f.path===file);assert.equal(after.sha256,before.sha256,file);return{path:file,bytes:after.bytes,sha256:after.sha256};});
 for(const prefix of ['', 'home/']){
  let cursor=0,checked=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<files.length){const file=files[cursor++],response=await fetch(new URL(prefix+file.path,url));assert.equal(response.status,200,prefix+file.path);const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,file.bytes);assert.equal(hash(data),file.sha256);checked++;}}));
  const index=await fetch(new URL(prefix,url));assert.equal(index.status,200);assert.equal(hash(Buffer.from(await index.arrayBuffer())),manifest.files.find(f=>f.path==='index.html').sha256);
  for(const file of ['textures/study/forest-window/panorama.jpg','models/barrel.glb'])assert.equal((await fetch(new URL(prefix+file,url))).status,404);
  record.deployments.push({prefix:'/'+prefix,checked,allSha256Matched:true,noPublicFallback:true});
 }
 fs.writeFileSync(path.join(__dirname,'release-check.json'),JSON.stringify(record,null,2)+'\n');
 fs.copyFileSync(path.join(dist,'release-manifest.json'),path.join(__dirname,'release-manifest.json'));
 fs.copyFileSync(path.join(dist,'bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));
 console.log(JSON.stringify({metrics,deployments:record.deployments,runtimeUnchanged:record.runtime.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});

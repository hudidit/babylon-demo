const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p))),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before=read('before/browser.json'),after=read('after/browser.json'),movement=read('movement.json'),structure=read('structure-after.json');
assert.ok(before.passed&&after.passed&&movement.passed&&structure.passed);assert.deepEqual(before.views,after.views);assert.deepEqual(before.scene,after.scene);
assert.equal(after.manifestSha256,movement.manifestSha256);assert.equal(after.manifestSha256,sha(path.join(root,'dist/release-manifest.json')));
const oldManifest=read('before/release-manifest.json'),newManifest=read('after/release-manifest.json');
assert.deepEqual(oldManifest.chunkFiles,newManifest.chunkFiles);assert.deepEqual(oldManifest.files.filter(f=>f.kind==='runtime'),newManifest.files.filter(f=>f.kind==='runtime'));
for(const [p,hash]of Object.entries(structure.sources))assert.equal(sha(path.join(root,p)),hash,p);
const result={baseline:'bfe0c62',unchangedScene:after.scene,unchangedRuntimeAssets:oldManifest.files.filter(f=>f.kind==='runtime').length,identicalCameraPairs:after.views.length,
 firstScreen:{before:before.firstScreenBytes,after:after.firstScreenBytes,added:after.firstScreenBytes-before.firstScreenBytes,headroom:3*1048576-after.firstScreenBytes},
 release:{before:before.release.releaseBytes,after:after.release.releaseBytes,added:after.release.releaseBytes-before.release.releaseBytes,headroom:41*1048576-after.release.releaseBytes},
 unchangedRuntimeBytes:after.release.runtimeBytes,unchangedModelBytes:after.release.modelBytes,hosted:after.hosted,grounding:after.grounding,initialization:structure.initialization,
 checks:{maps:after.maps,settings:after.settings,inspector:after.inspector,orbit:after.orbit,subpathReady:after.subpathReady,errors:after.errors,textureFailures:Object.keys(after.textureFailures)},passed:true};
assert.ok(result.firstScreen.headroom>=0&&result.release.headroom>=0);assert.equal(result.hosted.filesPerPrefix,500);
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({firstScreen:result.firstScreen,release:result.release,runtimeBytes:result.unchangedRuntimeBytes,passed:true},null,2));

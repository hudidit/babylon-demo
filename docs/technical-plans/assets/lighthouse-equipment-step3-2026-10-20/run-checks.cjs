const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const jobs=[['power','power/power.json','check-power.cjs'],['power-subpath','power-subpath/power.json','check-power.cjs'],['drills','drills/drills.json','check-drills.cjs'],['drills-subpath','drills-subpath/drills.json','check-drills.cjs'],['equipment','equipment/equipment.json','equipment-adapter.cjs'],['subpath','subpath/equipment.json','equipment-adapter.cjs'],['browser','browser/browser.json'],['journey','journey/journey.json'],
 ['regression','regression/regression.json'],['curtains','curtains/browser.json'],['ceiling','ceiling/browser.json'],
 ['master-mirror','master-mirror/mirror-map.json'],['public-mirror','public-mirror/public-mirror.json'],['headlight','headlight/browser.json'],
 ['recreate','recreate/recreate.json'],['matrix','matrix/matrix.json','check-matrix.cjs'],['release','release.json','check-release.cjs']];
exports.jobs=jobs;
if(require.main===module)(async()=>{
 const manifestSha256=sha(fs.readFileSync(path.join(root,'dist/release-manifest.json'))),file=path.join(__dirname,'run-checks.json');
 const record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{baseline:'9e3823e',manifestSha256,fpsOrLoadTimeSampling:false,suites:{}};
 assert.equal(record.manifestSha256,manifestSha256,'A different production package needs separate evidence');
 const only=new Set(process.argv.slice(2));for(const key of only)assert.ok(jobs.some(j=>j[0]===key),key);
 for(const [name,result,direct]of jobs){
  if(only.size&&!only.has(name))continue;const output=path.join(__dirname,path.dirname(result));fs.mkdirSync(output,{recursive:true});
  const script=path.join(__dirname,direct||'suite-adapter.cjs'),source=direct?script:path.resolve(__dirname,'..',require('./suite-adapter.cjs').suites[name][0]);
  const log=path.join(__dirname,name+'.log'),fd=fs.openSync(log,'w');console.log('START '+name);
  let exitCode;try{exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script,...(direct?[]:[name])],{cwd:root,env:{...process.env,
   STUDY_CHECK_OUTPUT:output,STUDY_URL:name==='subpath'||name==='drills-subpath'||name==='power-subpath'?new URL('home/',process.env.STUDY_URL||'http://127.0.0.1:8241/').href:process.env.STUDY_URL||'http://127.0.0.1:8241/'},stdio:['ignore',fd,fd]});
   child.once('error',reject);child.once('exit',resolve);});}finally{fs.closeSync(fd);}
  const target=path.join(__dirname,result),item=fs.existsSync(target)?JSON.parse(fs.readFileSync(target)):null;
  if(item){item.sourceBaseline=item.baseline;item.baseline=record.baseline;item.releaseManifestSha256=manifestSha256;fs.writeFileSync(target,JSON.stringify(item,null,2)+'\n');}
  const passed=exitCode===0&&item?.passed===true;record.suites[name]={passed,exitCode,script:path.relative(root,source),scriptSha256:sha(fs.readFileSync(source)),adapterSha256:sha(fs.readFileSync(script)),
   result,...(item?{resultSha256:sha(fs.readFileSync(target))}:{}),log:path.basename(log)};
  record.passed=jobs.every(([name])=>record.suites[name]?.passed);fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({name,exitCode,passed}));
  assert.ok(passed,name+' failed: '+log);assert.equal(sha(fs.readFileSync(path.join(root,'dist/release-manifest.json'))),manifestSha256);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

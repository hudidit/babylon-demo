const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const jobs=[['work','check-work.cjs','work/work.json'],['weather','check-weather.cjs','browser/weather.json'],['matrix','check-matrix.cjs','matrix/matrix.json'],
 ['regression','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','regression/regression.json',['regression']],
 ['curtains','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','curtains/browser.json',['curtains']],
 ['ceiling','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','ceiling/browser.json',['ceiling']],
 ['master-mirror','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','master-mirror/night-master-mirror.json',['master-mirror']],
 ['public-mirror','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','public-mirror/night-public-mirror.json',['public-mirror']],
 ['headlight','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','headlight/browser.json',['headlight']],
 ['recreate','../lighthouse-equipment-step5-2026-10-21/suite-adapter.cjs','recreate/recreate.json',['recreate']],
 ['mirror-clouds','../clouds-stars-phase2-2026-10-19/check-mirrors.cjs','mirror-clouds/mirror-clouds.json'],['release','check-release.cjs','release.json']];
const manifestSha256=sha(fs.readFileSync(path.join(root,'dist/release-manifest.json'))),file=path.join(__dirname,'run-checks.json');
const record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{baseline:'3d1dd3c',manifestSha256,suites:{}};assert.equal(record.manifestSha256,manifestSha256);
(async()=>{const only=new Set(process.argv.slice(2));for(const [name,relative,result,args=[]]of jobs){if(only.size&&!only.has(name))continue;const script=path.resolve(__dirname,relative),out=path.join(__dirname,name==='weather'?'browser':name),fd=fs.openSync(path.join(__dirname,name+'.log'),'w');fs.mkdirSync(out,{recursive:true});console.log('START '+name);let exitCode;
try{exitCode=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[script,...args],{cwd:root,env:{...process.env,STUDY_URL:'http://127.0.0.1:8254/',STUDY_CHECK_OUTPUT:out},stdio:['ignore',fd,fd]});c.once('error',reject);c.once('exit',resolve);});}finally{fs.closeSync(fd);}
const target=path.join(__dirname,result);let actual=result;if(!fs.existsSync(target)&&exitCode===0){const possible=fs.readdirSync(out).filter(p=>p.endsWith('.json')).map(p=>({name:p,value:JSON.parse(fs.readFileSync(path.join(out,p)))})).filter(p=>p.value.passed===true);assert.equal(possible.length,1,name+' ambiguous result');actual=path.relative(__dirname,path.join(out,possible[0].name));}
const data=fs.existsSync(path.join(__dirname,actual))?JSON.parse(fs.readFileSync(path.join(__dirname,actual))):null;
record.suites[name]={passed:exitCode===0&&data?.passed===true,exitCode,script:path.relative(root,script),scriptSha256:sha(fs.readFileSync(script)),result:actual,...(data?{resultSha256:sha(fs.readFileSync(path.join(__dirname,actual)))}:{})};record.passed=jobs.every(([n])=>record.suites[n]?.passed);fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({name,...record.suites[name]}));assert.equal(sha(fs.readFileSync(path.join(root,'dist/release-manifest.json'))),manifestSha256);assert.ok(record.suites[name].passed,name+' failed');}
})().catch(e=>{console.error(e);process.exitCode=1;});

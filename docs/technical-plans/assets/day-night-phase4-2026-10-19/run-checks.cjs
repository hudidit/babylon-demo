// Runs browser suites in sequence against the same final dist; each suite writes this task's evidence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),assets=path.dirname(__dirname);
const jobs=[
  ['controls',path.join(__dirname,'check-controls.cjs'),'controls.json'],
  ['journey',path.join(__dirname,'check-night-journey.cjs'),'journey.json'],
  ['master-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-master-mirror.cjs'),'mirrors/master/mirror-map.json','mirrors/master'],
  ['public-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-public-mirror.cjs'),'mirrors/public/public-mirror.json','mirrors/public'],
  ['regression',path.join(assets,'lighthouse-finish-2026-10-19/check-regression.cjs'),'regression/regression.json','regression'],
  ['jump',path.join(__dirname,'check-jump.cjs'),'jump/jump.json','jump'],
  ['scooter',path.join(__dirname,'check-scooter.cjs'),'browser.json'],
  ['lifecycle',path.join(__dirname,'check-lifecycle.cjs'),'lifecycle.json'],
  ['recreate',path.join(__dirname,'check-recreate.cjs'),'recreate.json'],
  ['subpath',path.join(__dirname,'check-subpath.cjs'),'subpath.json'],
  ['release',path.join(__dirname,'check-release.cjs'),'release-check.json'],
];
(async()=>{
  const file=path.join(__dirname,'run-checks.json');
  const record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{baseline:'69606ac',fpsOrLoadTimeSampling:false,suites:{}};
  const only=new Set(process.argv.slice(2));
  for(const [name,script,result,output]of jobs){
    if(only.size&&!only.has(name))continue;
    console.log('START '+name);
    if(output)fs.mkdirSync(path.join(__dirname,output),{recursive:true});
    const log=path.join(__dirname,name+'.log'),fd=fs.openSync(log,'w');
    let exitCode;
    try{exitCode=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,...(output?{STUDY_CHECK_OUTPUT:path.join(__dirname,output)}:{})},stdio:['ignore',fd,fd]});
      child.once('error',reject);child.once('exit',resolve);
    });}finally{fs.closeSync(fd);}
    const state={script:path.relative(root,script),scriptSha256:crypto.createHash('sha256').update(fs.readFileSync(script)).digest('hex'),result,log:path.basename(log),exitCode};
    if(exitCode===0){assert.ok(fs.existsSync(path.join(__dirname,result)),name+' result exists');state.passed=JSON.parse(fs.readFileSync(path.join(__dirname,result))).passed===true;}
    else state.passed=false;
    record.suites[name]=state;record.passed=jobs.every(([name])=>record.suites[name]?.passed);
    fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
    console.log(JSON.stringify({suite:name,...state}));
    if(!state.passed)throw new Error(name+' failed; see '+log);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

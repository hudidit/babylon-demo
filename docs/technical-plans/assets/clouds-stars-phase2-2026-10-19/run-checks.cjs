// Reuse historical suites without modifying them; every run is pinned to the current production manifest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),assets=path.dirname(__dirname);
const jobs=[
 ['visuals',path.join(assets,'day-night-phase4-2026-10-19/check-visuals.cjs'),'visuals.json'],
 ['reflection',path.join(__dirname,'check-reflection.cjs'),'reflection.json'],
 ['stability',path.join(__dirname,'check-stability.cjs'),'stability.json'],
 ['mirror-clouds',path.join(__dirname,'check-mirrors.cjs'),'mirror-clouds.json'],
 ['master-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-master-mirror.cjs'),'mirrors/master/mirror-map.json','mirrors/master'],
 ['public-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-public-mirror.cjs'),'mirrors/public/public-mirror.json','mirrors/public'],
 ['transitions',path.join(__dirname,'check-transitions.cjs'),'transitions.json'],
 ['regression',path.join(assets,'lighthouse-finish-2026-10-19/check-regression.cjs'),'regression.json','/private/tmp/babylon-clouds-stars-phase2-regression'],
 ['release',path.join(__dirname,'check-release.cjs'),'release-check.json'],
 ['platforms',path.join(__dirname,'check-platforms.cjs'),'platform-availability.json'],
];
(async()=>{
 const only=new Set(process.argv.slice(2)),file=path.join(__dirname,'run-checks.json'),record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{baseline:'fefe1b3',fpsOrLoadTimeSampling:false,suites:{}};
 for(const[name,script,result,output]of jobs){if(only.size&&!only.has(name))continue;
  const dir=output?(path.isAbsolute(output)?output:path.join(__dirname,output)):__dirname;fs.mkdirSync(dir,{recursive:true});
  const fd=fs.openSync(path.join(__dirname,name+'.log'),'w');console.log('START '+name);
  let exitCode;try{exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,STUDY_URL:process.env.STUDY_URL||'http://127.0.0.1:8200/',STUDY_CHECK_OUTPUT:dir},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',resolve);});}finally{fs.closeSync(fd);}
  if(name==='regression'&&exitCode===0)fs.copyFileSync(path.join(dir,'regression.json'),path.join(__dirname,result));
  const state={script:path.relative(root,script),sha256:crypto.createHash('sha256').update(fs.readFileSync(script)).digest('hex'),exitCode,result,
   manifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/release-manifest.json'))).digest('hex')};
  if(exitCode===0){const value=JSON.parse(fs.readFileSync(path.join(__dirname,result)));state.passed=name==='platforms'||value.passed===true;}else state.passed=false;
  record.suites[name]=state;record.passed=jobs.every(([name])=>record.suites[name]?.passed);fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({name,...state}));
  if(!state.passed)throw new Error(name+' failed; inspect '+name+'.log');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

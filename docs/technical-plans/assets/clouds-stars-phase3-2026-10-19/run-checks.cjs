// Re-run final acceptance without overwriting earlier phases. Record the exact source script and release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),assets=path.dirname(__dirname),own=name=>path.join(__dirname,'check-'+name+'.cjs');
const jobs=[
 ['platforms',own('platforms'),'platform-availability.json'],
 ['controls',own('controls'),'controls.json'],
 ['automatic',own('automatic-clouds'),'automatic-clouds.json'],
 ['journey',own('night-journey'),'journey.json'],
 ['lifecycle',own('lifecycle'),'lifecycle.json'],
 ['recreate',own('recreate'),'recreate.json'],
 ['subpath',own('subpath'),'subpath.json'],
 ['scooter',own('scooter'),'browser.json'],
 ['jump',path.join(assets,'day-night-phase4-2026-10-19/check-jump.cjs'),'jump/jump.json','jump'],
 ['matrix',own('matrix'),'engines/matrix.json'],
 ['visuals',path.join(assets,'day-night-phase4-2026-10-19/check-visuals.cjs'),'visuals.json'],
 ['reflection',path.join(assets,'clouds-stars-phase2-2026-10-19/check-reflection.cjs'),'reflection.json'],
 ['stability',path.join(assets,'clouds-stars-phase2-2026-10-19/check-stability.cjs'),'stability.json'],
 ['mirror-clouds',path.join(assets,'clouds-stars-phase2-2026-10-19/check-mirrors.cjs'),'mirror-clouds.json'],
 ['master-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-master-mirror.cjs'),'mirrors/master/mirror-map.json','mirrors/master'],
 ['public-mirror',path.join(assets,'day-night-phase2-2026-10-19/check-night-public-mirror.cjs'),'mirrors/public/public-mirror.json','mirrors/public'],
 ['transitions',path.join(assets,'clouds-stars-phase2-2026-10-19/check-transitions.cjs'),'transitions/transitions.json','transitions'],
 ['regression',path.join(assets,'lighthouse-finish-2026-10-19/check-regression.cjs'),'regression.json','/private/tmp/babylon-clouds-stars-phase3-regression'],
 ['release',own('release'),'release-check.json'],
];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
 const only=new Set(process.argv.slice(2));for(const name of only)assert.ok(jobs.some(j=>j[0]===name),'Unknown suite '+name);
 const file=path.join(__dirname,'run-checks.json'),record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{baseline:'47eb076',fpsOrLoadTimeSampling:false,suites:{}};
 for(const[name,script,result,output]of jobs){if(only.size&&!only.has(name))continue;
  const dir=output?(path.isAbsolute(output)?output:path.join(__dirname,output)):__dirname;fs.mkdirSync(dir,{recursive:true});
  const manifestSha256=sha(path.join(root,'dist/release-manifest.json')),scriptSha256=sha(script),fd=fs.openSync(path.join(__dirname,name+'.log'),'w');console.log('START '+name);
  let exitCode;try{exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,STUDY_URL:process.env.STUDY_URL||'http://127.0.0.1:8201/',STUDY_CHECK_OUTPUT:dir},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',resolve);});}finally{fs.closeSync(fd);}
  assert.equal(sha(script),scriptSha256);assert.equal(sha(path.join(root,'dist/release-manifest.json')),manifestSha256);
  if(name==='regression'&&exitCode===0)fs.copyFileSync(path.join(dir,'regression.json'),path.join(__dirname,result));
  const state={script:path.relative(root,script),sha256:scriptSha256,exitCode,result,manifestSha256};
  if(exitCode===0){const value=JSON.parse(fs.readFileSync(path.join(__dirname,result)));state.passed=name==='platforms'||value.passed===true;}else state.passed=false;
  record.suites[name]=state;record.passed=jobs.every(([name])=>record.suites[name]?.passed);fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({name,...state}));
  if(!state.passed)throw new Error(name+' failed; inspect '+name+'.log');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

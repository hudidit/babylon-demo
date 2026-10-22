// Retained vehicle and three-cycle recreation suites, adapted to current labels/defaults; historical evidence stays unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto'),Module=require('node:module'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),dist=path.join(root,'dist'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const suites={headlight:'../scooter-headlight-2026-10-20/check-browser.cjs',recreate:'../clouds-stars-phase3-2026-10-19/check-recreate.cjs'};
if(process.argv[2]==='--suite'){
 const name=process.argv[3];assert.ok(suites[name]);const file=path.resolve(__dirname,suites[name]),out=path.join(__dirname,'originals',name);fs.mkdirSync(out,{recursive:true});let code=fs.readFileSync(file,'utf8').replaceAll('全屋八个房间已布置','住宅与灯塔已就绪');
 if(name==='headlight')code=code.replace('const out=__dirname,','const out='+JSON.stringify(out)+',').replace('new Promise(s.executeWhenReady.bind(s))','new Promise(resolve=>s.executeWhenReady(resolve))');
 if(name==='recreate'){
  code=code.replaceAll('path.join(__dirname,','path.join('+JSON.stringify(out)+',').replace('[data-view="balcony"]','[data-view="coast"]');
  code=code.replace('e.stopRenderLoop();e.getDeltaTime=()=>50;', 'e.stopRenderLoop();e.getDeltaTime=()=>50;room.setTimeOfDay(12);room.timeState.setAutomatic(false);room.timeState.advance(0);');
 }
 const child=new Module(file,module);child.filename=file;child.paths=Module._nodeModulePaths(path.dirname(file));child._compile(code,file);
}else{
 const record={baseline:'a7178ce',method:'Same final dist; original native vehicle/road-light pixel and 3-cycle application recreation suites. Explicit local poses, fixed clock/manual selections and reference steps are inherited; no travel or FPS claim. Adaptations: current ready label, current coast view button, explicit frozen-noon initial condition for the now-automatic clock, explicit executeWhenReady callback (do not pass Promise.reject as the checkRenderTargets flag), output directory only.',suites:{},errors:[]};
 const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';const file=path.resolve(dist,'.'+p);if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream','Content-Length':b.length}).end(b);});});
 (async()=>{try{
  const raw=fs.readFileSync(path.join(dist,'release-manifest.json'));record.manifestSha256=sha(raw);record.release=require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(dist);record.sources=Object.fromEntries(['src/examples/Room.ts','src/examples/CoastalScooter.ts','src/components/BasicExamples.ts','src/examples/RoomRuntime.ts','src/examples/RoomTimeOfDay.ts','src/examples/LighthouseSave.ts','src/examples/LighthouseStoryPanel.ts'].map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const base=`http://127.0.0.1:${server.address().port}/`;
  for(const name of Object.keys(suites)){
   const out=path.join(__dirname,'originals',name);fs.mkdirSync(out,{recursive:true});const fd=fs.openSync(path.join(out,'run.log'),'w');let code;try{code=await new Promise((r,j)=>{const child=spawn(process.execPath,[__filename,'--suite',name],{cwd:root,env:{...process.env,STUDY_URL:base,PLAYWRIGHT_PACKAGE:'/private/tmp/dsh-playwright/node_modules/playwright-core'},stdio:['ignore',fd,fd]});child.once('error',j);child.once('exit',r);});}finally{fs.closeSync(fd);}
   const result=path.join(out,name==='headlight'?'browser.json':'recreate.json'),value=fs.existsSync(result)?JSON.parse(fs.readFileSync(result)):{};record.suites[name]={passed:code===0&&value.passed===true,exitCode:code,source:suites[name],sourceSha256:sha(fs.readFileSync(path.resolve(__dirname,suites[name]))),result:path.relative(__dirname,result),resultSha256:fs.existsSync(result)?sha(fs.readFileSync(result)):null};assert.equal(record.suites[name].passed,true,name);console.log(name,'passed');
  }
  record.passed=true;
 }catch(e){record.failure=String(e.stack||e);throw e;}finally{await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'originals.json'),JSON.stringify(record,null,2)+'\n');}})().catch(e=>{console.error(e);process.exitCode=1;});
}

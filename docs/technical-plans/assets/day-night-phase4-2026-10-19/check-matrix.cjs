// Independent production page: menu/input and fixed reference steps, never a performance sample.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const {evaluateTimeOfDay:at}=require('../lighthouse-d-2026-10-18/source-loader.cjs')('RoomTimeOfDay');
const out=path.join(__dirname,'engines');fs.mkdirSync(out,{recursive:true});
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
(async()=>{
  const availability=JSON.parse(fs.readFileSync(path.join(__dirname,'platform-availability.json')));
  const kinds=['chromium','webkit',...(availability.firefox.available?['firefox']:[])];
  const record={baseline:'69606ac',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,availability,cases:[]};
  let current;
  try{for(const kind of kinds){
    const executablePath=kind==='chromium'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':kind==='webkit'?process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE;
    const browser=await pw[kind].launch({executablePath,headless:true});
    try{for(const dpr of [1,2]){
      const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,hasTouch:true,serviceWorkers:'block'});
      const page=await context.newPage(),errors=[],warnings=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url());});
      await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8196/');
      await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
      await require('./browser-harness.cjs').capture(page);
      const frames=n=>page.evaluate(n=>{for(let i=0;i<n;i++)s.render();},n);
      const shot=async name=>{
        await page.evaluate(()=>{e.getDeltaTime=()=>0;self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
        await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:84});
        await page.evaluate(()=>{e.stopRenderLoop(self.shotRender);e.getDeltaTime=()=>50;});
      };
      await page.locator('[data-view="balcony"]').click();
      for(const [width,height,name]of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
        current={kind,dpr,name};await page.setViewportSize({width,height});await frames(2);
        const prefix=`${kind}-${name}-dpr${dpr}`;
        const collapsed={time:await page.locator('#time-toggle').boundingBox(),views:await page.locator('.view-controls').boundingBox(),map:await page.locator('#floor-plan-toggle').boundingBox()};
        assert.ok(!overlaps(collapsed.time,collapsed.views)&&!overlaps(collapsed.time,collapsed.map));await shot(prefix+'-noon');
        if(name==='desktop')await page.keyboard.press('t');else await page.locator('#time-toggle').tap();
        const panel=await page.locator('#time-menu').boundingBox();
        assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height&&panel.height<=height*.6+1);
        assert.ok((await page.locator('[data-time-hour]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height))).every(h=>h>=44));
        const nodes=[];
        for(const hour of [0,3,6,9,12,15,18,21]){
          await page.locator(`[data-time-hour="${hour}"]`).tap();await frames(26);
          const state=await page.evaluate(()=>({hour:s.metadata.timeOfDay.state.hour,light:s.getLightByName('coastal-afternoon-sun').intensity,direction:s.getLightByName('coastal-afternoon-sun').direction.asArray(),
            sky:s.getMaterialByName('coastal-sky')._floats,sea:s.getMaterialByName('coastal-ocean')._floats,environment:s.getMaterialByName('coastal-ground').environmentIntensity,
            lamps:s.lights.filter(light=>!light.name.includes('daylight')&&!['coastal-afternoon-sun','room-bounce-light'].includes(light.name)).map(light=>({id:light.name,intensity:light.intensity})),
            skyReady:s.getMeshByName('coastal-sky').isReady(true),seaReady:s.getMeshByName('coastal-sea').isReady(true)}));
          const expected=at(hour);assert.equal(state.hour,hour);near(state.light,expected.primary.intensity);
          expected.primary.lightDirection.forEach((v,i)=>near(v,state.direction[i]));near(state.sky.sunStrength,state.sea.sunStrength);
          near(state.environment,expected.environment.exterior*3.8);assert.ok(state.skyReady&&state.seaReady);
          if(nodes.length)assert.deepEqual(state.lamps,nodes[0].lamps);nodes.push(state);
        }
        await page.locator('#time-close').scrollIntoViewIfNeeded();await shot(prefix+'-night-menu');
        await page.locator('#time-automatic').check();const paused=await page.evaluate(()=>s.metadata.timeOfDay.state.hour);await frames(10);near(await page.evaluate(()=>s.metadata.timeOfDay.state.hour),paused);
        await page.locator('#time-close').tap();await frames(12);assert.ok(await page.evaluate(()=>s.metadata.timeOfDay.state.hour>21));
        const automatic=[];
        for(const [start,count]of [[18,240],[21,1800],[0,3600]]){
          await page.locator('#time-toggle').tap();await page.locator(`[data-time-hour="${start}"]`).tap();await frames(26);
          await page.locator('#time-automatic').check();await page.locator('#time-close').tap();
          const state=await page.evaluate(count=>{
            e.getDeltaTime=()=>100;s.onBeforeRenderObservable.notifyObservers(s);
            const checkpoints=[];for(let i=0;i<count;i++){
              s.onBeforeRenderObservable.notifyObservers(s);const time=s.metadata.timeOfDay.state;
              if(i%60===59)checkpoints.push({hour:time.hour,body:time.primary?.kind||null,strength:time.primary?.strength||0,
                sky:s.getMaterialByName('coastal-sky')._floats.sunStrength,sea:s.getMaterialByName('coastal-ocean')._floats.sunStrength});
            }
            e.getDeltaTime=()=>50;const time=s.metadata.timeOfDay.state;
            return {hour:time.hour,visual:s.metadata.timeOfDay.visualHour,body:time.primary?.kind||null,checkpoints};
          },count);
          const difference=Math.abs(state.hour-(start+count/600)%24);assert.ok(Math.min(difference,24-difference)<1e-7);near(state.visual,state.hour);
          for(const point of state.checkpoints){near(point.strength,at(point.hour).primary?.strength||0);near(point.sky,point.sea);}
          if(start===18)assert.equal(state.body,null);automatic.push({start,steps:count,...state});
          await page.locator('#time-toggle').tap();await page.locator('#time-automatic').uncheck();await page.locator('#time-close').tap();
        }
        await shot(prefix+'-automatic-dawn');
        await page.locator('#time-toggle').tap();await page.locator('[data-time-hour="12"]').tap();await frames(26);await page.locator('#time-close').tap();
        const resources=await page.evaluate(()=>({textures:s.textures.length,materials:s.materials.length,lights:s.lights.length,cameras:s.cameras.length}));
        assert.deepEqual(resources,{textures:148,materials:95,lights:17,cameras:3});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
        record.cases.push({...current,version:browser.version(),collapsed,panel,nodes,automatic,resources,touch:true,errors:[...errors],warnings:[...warnings],passed:true});
      }
      await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length),0);await context.close();
    }}finally{await browser.close();}
  }record.availablePlatformsPassed=true;}catch(error){record.failure={...current,error:String(error)};throw error;}
  finally{fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(record,null,2)+'\n');}
  console.log(JSON.stringify({availablePlatformsPassed:record.availablePlatformsPassed,cases:record.cases.length,nodeChecks:record.cases.reduce((n,c)=>n+c.nodes.length,0),automaticSegments:record.cases.reduce((n,c)=>n+c.automatic.length,0)}));
})().catch(error=>{console.error(error);process.exitCode=1;});

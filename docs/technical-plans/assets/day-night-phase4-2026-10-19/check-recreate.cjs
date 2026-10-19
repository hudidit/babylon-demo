const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),cdp=await page.context().newCDPSession(page),errors=[];
  const record={baseline:'69606ac',fpsOrLoadTimeSampling:false,cycles:[]};
  page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const listeners=async expression=>{
    const {result}=await cdp.send('Runtime.evaluate',{expression});
    const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId:result.objectId});
    const counts={};for(const listener of listeners)counts[listener.type]=(counts[listener.type]||0)+1;
    await cdp.send('Runtime.releaseObject',{objectId:result.objectId});return counts;
  };
  const captureApp=async()=>{
    const scripts=[];cdp.on('Debugger.scriptParsed',script=>scripts.push(script));await cdp.send('Debugger.enable');
    let breakpoint;
    for(const script of scripts.filter(script=>script.url.startsWith('http'))){
      const {scriptSource:source}=await cdp.send('Debugger.getScriptSource',{scriptId:script.scriptId});
      const match=/bindSettings\([^)]*\)\s*\{/.exec(source);if(!match)continue;
      const lines=source.slice(0,match.index+match[0].length).split('\n');
      breakpoint=await cdp.send('Debugger.setBreakpointByUrl',{url:script.url,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});break;
    }
    if(!breakpoint)throw new Error('Original application settings method not found');
    const captured=new Promise((resolve,reject)=>cdp.once('Debugger.paused',async event=>{
      try{
        const result=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,
          expression:'self.DeliveryApp=this.constructor;typeof DeliveryApp==="function"',returnByValue:true});
        if(!result.result.value)throw new Error('Original application constructor capture failed');
        await cdp.send('Debugger.resume');resolve();
      }catch(error){await cdp.send('Debugger.resume');reject(error);}
    }));
    await page.reload();await captured;await cdp.send('Debugger.removeBreakpoint',{breakpointId:breakpoint.breakpointId});await cdp.send('Debugger.disable');
  };
  const captureRoom=async()=>{
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;});
  };
  try{
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8196/');
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await captureApp();await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await captureRoom();
    let baseline;
    for(let index=0;index<3;index++){
      if(index){
        await page.evaluate(()=>{document.querySelector('#gameCanvas').remove();document.querySelector('#scene-status').textContent='重建验证中';new DeliveryApp();});
        await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
        await captureRoom();
      }
      const active={document:await listeners('document'),window:await listeners('window'),toggle:await listeners('document.querySelector("#time-toggle")')};
      if(!baseline)baseline=active;else assert.deepEqual(active,baseline,'recreating must not accumulate DOM listeners');
      assert.equal(await page.evaluate(()=>room.timeOfDay.hour),12,'each new scene starts at noon');
      await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();
      await page.evaluate(()=>{for(let i=0;i<26;i++)s.render();});assert.equal(await page.evaluate(()=>room.timeOfDay.hour),0);
      await page.locator('#time-automatic').check();await page.locator('#time-close').click();
      await page.evaluate(()=>{for(let i=0;i<12;i++)s.render();});assert.ok(await page.evaluate(()=>room.timeOfDay.hour>0));
      const resources=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
      await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));});
      const disposed=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,observers:s.onBeforeRenderObservable.observers.length,engineScenes:e.scenes.length}));
      assert.deepEqual(disposed,{meshes:0,materials:0,textures:0,lights:0,cameras:0,observers:0,engineScenes:0});
      const after={document:await listeners('document'),window:await listeners('window'),toggle:await listeners('document.querySelector("#time-toggle")')};
      assert.equal(after.document.keydown||0,0);assert.equal(after.document.keyup||0,0);assert.equal(after.toggle.click||0,0);
      await page.keyboard.press('t');await page.locator('#time-toggle').click();assert.equal(await page.locator('#time-menu').evaluate(n=>n.hidden),true);
      record.cycles.push({index,active,resources,disposed,after,passed:true});
    }
    assert.deepEqual(errors,[]);record.passed=true;
  }finally{record.errors=errors;fs.writeFileSync(path.join(__dirname,'recreate.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
  console.log(JSON.stringify({passed:record.passed,cycles:record.cycles.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});

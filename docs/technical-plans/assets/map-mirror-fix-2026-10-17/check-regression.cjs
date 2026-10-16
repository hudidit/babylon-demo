// Functional and release verification. Fixed render delta is not an FPS/load-time sample.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8101/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  const page = await context.newPage(), errors=[], warnings=[], requests=[];
  let phase='initial';
  const record={baseline:'db500b3',browser:browser.version(),cacheDisabled:true,fpsOrLoadTimeSampling:false,drawers:[],lamps:[],doors:[],views:[]};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0),phase}));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const render=(n=4)=>page.evaluate(n=>{for(let i=0;i<n;i++)studyScene.render();},n);
  const shot=async name=>{await render();await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:90});};
  const pose=async(position,target)=>page.evaluate(({position,target})=>{
    const c=studyScene.activeCamera,V=c.position.constructor;
    c.cameraDirection?.setAll(0);c.cameraRotation?.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
    if(c.setPosition){c.lowerRadiusLimit=.5;c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;c.setTarget(new V(...target));c.setPosition(new V(...position));}
    else{c.position.set(...position);c.setTarget(new V(...target));}
    c.getViewMatrix(true);c.getProjectionMatrix(true);for(let i=0;i<3;i++)studyScene.render();
  },{position,target});
  const state=()=>page.evaluate(()=>{const c=studyScene.activeCamera;return{camera:c.name,position:c.position.asArray(),rotation:c.rotation.asArray(),target:c.getTarget().asArray(),attached:c.inputs.attachedToElement,locked:!!document.pointerLockElement};});
  const aim=async(id,side=1)=>{
    const view=await page.evaluate(({id,side})=>{
      const V=studyScene.activeCamera.position.constructor;
      const root=id.startsWith('cabinet-drawer')?studyScene.getMeshByName('GothicCommode_01_door'+({'cabinet-drawer-1':'03','cabinet-drawer-2':'02','cabinet-drawer-3':'01'})[id]):studyScene.getTransformNodeByName(id);
      let target,normal;
      if(id.includes('drawer')){root.computeWorldMatrix(true);target=root.getAbsolutePosition().clone();normal=V.TransformNormal(new V(0,0,1),root.parent.getWorldMatrix()).normalize();}
      else {
        const meshes=studyScene.meshes.filter(m=>m.metadata?.interactionId===id);meshes.forEach(m=>m.computeWorldMatrix(true));
        const mesh=meshes.find(m=>/lamp-shade|lampGlass|-glow/.test(m.material?.name))||meshes[0];
        target=mesh.getBoundingInfo().boundingBox.centerWorld.clone();
        normal=id.includes('door')?V.TransformNormal(new V(side,0,0),root.getWorldMatrix()).normalize():new V(0,0,1);
      }
      return{target:target.asArray(),position:target.add(normal.scale(id.includes('door')?1.75:id.includes('drawer')?4:5)).add(new V(0,id.includes('drawer')?.3:.8,0)).asArray()};
    },{id,side});
    await pose(view.position,view.target);return view;
  };
  const drawerPos=id=>page.evaluate(id=>{const r=id.startsWith('cabinet')?studyScene.getMeshByName('GothicCommode_01_door'+({'cabinet-drawer-1':'03','cabinet-drawer-2':'02','cabinet-drawer-3':'01'})[id]):studyScene.getTransformNodeByName(id);return r.position.asArray();},id);
  const sweep=async(start,end)=>page.evaluate(({start,end})=>{const V=studyScene.activeCamera.position.constructor,c=studyScene.collisionCoordinator.createCollider();c._radius=studyScene.getCameraByName('study-first-person').ellipsoid.clone();let p;studyScene.collisionCoordinator.getNewPosition(new V(...start),new V(...end).subtract(new V(...start)),c,3,null,(_,v)=>p=v.asArray(),0);return p;},{start,end});
  const world=(x,y)=>[(x-5.4)*5,-.9,(y-5.4)*5];
  const samePosition=(a,b)=>assert.ok(a.every((n,i)=>Math.abs(n-b[i])<1e-6));
  const click=async(n=18)=>{await page.mouse.click(640,400);await render(n);};
  try {
    await page.goto(url,{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('主卧套间已布置'),null,{timeout:120000});
    await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
    record.initialJsBytes=requests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((a,r)=>a+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
    await page.evaluate(()=>{
      webpackChunkbabylon_learning.push([[989997],{},r=>self.studyRequire=r]);
      for(const [id,f]of Object.entries(studyRequire.m))if(/get LastCreatedEngine|static get Instances/.test(f.toString()))for(const v of Object.values(studyRequire(id))){if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.studyEngine=v.LastCreatedEngine;self.studyScene=v.LastCreatedScene;}if(typeof v==='function'&&v.Instances?.some?.(i=>typeof i.createSoundBufferAsync==='function'))self.audioEngine=v.Instances[0];}
      self.audioEvents=[];for(const sound of audioEngine.sounds){const play=sound.play.bind(sound);sound.play=(...a)=>{audioEvents.push({name:sound.name,panning:sound.spatial.panningEnabled,position:sound.spatial.position.asArray()});return play(...a);};}
      studyEngine.stopRenderLoop();studyEngine.getDeltaTime=()=>50;
    });
    record.scene=await page.evaluate(()=>({unownedNodes:studyScene.transformNodes.filter(n=>!n.metadata?.ownerRooms?.length).map(n=>n.name),metadata:studyScene.metadata,meshes:studyScene.meshes.length,vertices:studyScene.getTotalVertices(),materials:studyScene.materials.length,textures:studyScene.textures.length,textureInventory:studyScene.textures.map(t=>({name:t.name,size:[t.getSize().width,t.getSize().height],renderTarget:t.isRenderTarget})),lights:studyScene.lights.length,cameras:studyScene.cameras.length,
      unowned:studyScene.meshes.filter(m=>m.getTotalVertices()&&!m.metadata?.ownerRooms?.length).map(m=>m.name),
      states:[...document.querySelectorAll('#floor-plan-drawing [data-room]')].map(n=>({id:n.dataset.room,state:n.dataset.state})),
      actions:[...new Set(studyScene.meshes.map(m=>m.metadata?.interactionId).filter(Boolean))].sort()}));
    assert.equal(record.scene.metadata.layoutVersion,'house-plan-v1');assert.deepEqual(record.scene.unowned,[]);assert.deepEqual(record.scene.unownedNodes,[]);
    assert.equal(record.scene.states.filter(r=>r.state==='shell').length,4);assert.deepEqual(record.scene.states.filter(r=>r.state==='ready').map(r=>r.id).sort(),['ensuite','living','master','study']);
    assert.equal(record.scene.actions.length,21); // Seven doors, eight drawers, five lamps and the letter.
    phase='views';
    for(const view of ['overview','study','living','master','ensuite','reading','desk','details','cabinet']){await page.locator(`[data-view="${view}"]`).click();await shot(view);if(['master','ensuite'].includes(view))assert.equal(await page.locator('#floor-plan-mini .is-current').getAttribute('data-room'),view);record.views.push(view);}
    phase='drawers';
    for(const id of ['writing-drawer-1','writing-drawer-2','console-drawer-1','console-drawer-2','console-drawer-3','cabinet-drawer-1','cabinet-drawer-2','cabinet-drawer-3']){
      await page.locator('[data-view="overview"]').click();const before=await drawerPos(id);await aim(id);
      if(id==='writing-drawer-1'){await page.mouse.click(640,400,{button:'right'});await render();assert.deepEqual(await drawerPos(id),before);}
      await click();const opened=await drawerPos(id);if(JSON.stringify(opened)===JSON.stringify(before))await shot('failure-'+id);
      assert.notDeepEqual(opened,before,id+' opens with pointer click');
      if(['writing-drawer-1','console-drawer-2','cabinet-drawer-2'].includes(id))await shot(id+'-open');
      await aim(id);await click();assert.deepEqual(await drawerPos(id),before,id+' closes');
      record.drawers.push({id,before,opened});
    }
    phase='lamps';
    for(const [id,light]of [['desk-lamp','banker-lamp-light'],['floor-lamp','reading-lamp-light'],['living-lamp','living-table-lamp-light'],['master-lamp','master-lamp-light'],['ensuite-lamp','ensuite-lamp-light']]){
      await page.locator('[data-view="overview"]').click();await aim(id);const before=await page.evaluate(light=>studyScene.getLightByName(light).intensity,light);
      await click(3);assert.equal(await page.evaluate(light=>studyScene.getLightByName(light).intensity,light),0,id);
      await click(3);assert.equal(await page.evaluate(light=>studyScene.getLightByName(light).intensity,light),before);record.lamps.push(id);
    }
    phase='doors';
    for(const id of ['master-door','ensuite-door','bathroom-door','bedroom-door','connecting-door','kitchen-door','entry-door']){
      await page.locator('[data-view="overview"]').click();await aim(id);await click();
      const angle=await page.evaluate(id=>studyScene.getTransformNodeByName(id).rotation.y,id);assert.ok(Math.abs(Math.abs(angle)-Math.PI/2)<1e-6,id+' open');
      await aim(id,-1);await click();assert.ok(Math.abs(await page.evaluate(id=>studyScene.getTransformNodeByName(id).rotation.y,id))<1e-6,id+' closes from other face');
      record.doors.push(id);
    }
    phase='physical-routes';
    const openings=[['master-door',5.4,4.05,'x'],['ensuite-door',1.2,4.8,'z'],['bathroom-door',5.4,6,'x'],['bedroom-door',5.4,9.15,'x'],['connecting-door',6.65,3.4,'z'],['kitchen-door',9.55,3.4,'z']];
    record.physicalDoors=[];
    for(const [id,x,y,axis]of openings){const a=world(x,y),b=world(x,y);a[axis==='x'?0:2]-=3.5;b[axis==='x'?0:2]+=3.5;const result=await sweep(a,b);assert.ok(result[axis==='x'?0:2]<(axis==='x'?world(x,y)[0]:world(x,y)[2])-1.2,id+' closed collision');}
    for(const [id]of openings){await aim(id);await click();}
    for(const [id,x,y,axis]of openings)for(const side of [-1,1]){const a=world(x,y),b=world(x,y);a[axis==='x'?0:2]+=side*3.5;b[axis==='x'?0:2]-=side*3.5;const actual=await sweep(a,b);samePosition(actual,b);record.physicalDoors.push({id,side,passed:true});}
    const route=[[9.4,5.35],[9.25,4.6],[9.55,3.8],[9.55,2.6],[9.55,3.8],[9.25,4.6],[9.4,5.55],[7,5.55],[7,6.6],[7,8.3],[7,10.3],[8,10.3],[8,11.6]];
    for(let i=1;i<route.length;i++)samePosition(await sweep(world(...route[i-1]),world(...route[i])),world(...route[i]));
    record.continuousLivingToBalconyRoute=route;
    for(const [id]of openings){await aim(id);await click();}
    phase='suite-routes';
    const suiteRoutes=[[[6.6,4.05],[4.3,4.05],[3.4,4.05],[1.2,4.05],[1.2,5.6],[1.45,5.9],[1.8,6.25],[1.8,6.8]],[[4.3,4.05],[4,3.3],[4,1.65],[3.3,1.65],[3.3,.7],[1.8,.7],[1.8,1]],[[3.4,4.05],[3.2,3.5],[1.3,3.5]]];
    for(const id of ['master-door','ensuite-door']){await aim(id);await click();}
    record.suiteRouteChecks=[];
    for(const route of suiteRoutes)for(let i=1;i<route.length;i++){const actual=await sweep(world(...route[i-1]),world(...route[i])),end=world(...route[i]);record.suiteRouteChecks.push({from:route[i-1],to:route[i],actual});assert.ok(actual.every((n,j)=>Math.abs(n-end[j])<.03),JSON.stringify(record.suiteRouteChecks.at(-1)));}
    record.suiteRoutes=suiteRoutes;
    record.suiteObstacles=[];
    for(const [from,to]of [[[.7,6],[.7,6.6]],[[3.4,2.3],[1.5,2.3]],[[4,1.6],[5.25,1.6]],[[2.8,6],[1.8,6]]]){const actual=await sweep(world(...from),world(...to));assert.notDeepEqual(actual,world(...to));record.suiteObstacles.push({from,to,actual});}
    for(const id of ['master-door','ensuite-door']){await aim(id);await click();}
    phase='suite-near-views';
    await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
    const eye=(x,y,h=1.6)=>[(x-5.4)*5,-5+h*5,(y-5.4)*5];
    for(const [name,from,to]of [['master-bed-close',[3.2,3.6],[1.2,2.25,.7]],['master-wardrobe-close',[3.4,1.3],[4.96,1.65,1.3]],['ensuite-vanity-close',[1.25,5.75],[2.08,5.35,1.25]],['ensuite-shower-close',[1.3,5.55],[1.94,6.82,1.6]]]){await pose(eye(...from),eye(...to));await shot(name);}
    await pose(eye(1.3,5.85),eye(1.85,5.35,2.18));await click(3);
    record.suiteSpatialAudio=await page.evaluate(()=>({event:audioEvents[audioEvents.length-1],light:studyScene.getLightByName('ensuite-lamp-light').intensity}));
    assert.ok(record.suiteSpatialAudio.event.name.startsWith('switch-'));assert.equal(record.suiteSpatialAudio.event.panning,true);assert.equal(record.suiteSpatialAudio.light,0);await shot('ensuite-light-off');await click(3);
    await page.evaluate(()=>document.exitPointerLock?.());await page.locator('[data-view="overview"]').click();
    phase='inspection';await page.locator('[data-view="details"]').click();
    const letter=await page.evaluate(()=>{const m=studyScene.meshes.find(m=>m.metadata?.interactionId==='desk-letter');return m.getBoundingInfo().boundingBox.centerWorld.asArray();});
    await pose([letter[0]+1,letter[1]+4,letter[2]+4],letter);const beforeLetter=await state();await click(3);
    assert.equal(await page.locator('#item-inspection').evaluate(n=>n.open),true);await shot('inspection-desktop');
    await page.evaluate(()=>document.querySelector('#floor-plan-toggle').click());assert.equal(await page.locator('#floor-plan-dialog').evaluate(n=>n.open),false);
    await page.setViewportSize({width:390,height:844});await shot('inspection-portrait');await page.setViewportSize({width:1280,height:800});
    await page.locator('#item-inspection-return').click();await render();samePosition((await state()).position,beforeLetter.position);
    phase='map';await page.locator('[data-view="living"]').click();const beforeMap=await state();await page.locator('#floor-plan-toggle').click();
    assert.equal(await page.locator('#floor-plan-dialog').evaluate(n=>n.open),true);
    for(const [w,h,name]of [[1280,800,'map-desktop'],[390,844,'map-portrait'],[844,390,'map-landscape']]){
      await page.setViewportSize({width:w,height:h});await shot(name);
      assert.ok(await page.locator('.map-body').evaluate(n=>n.scrollWidth<=n.clientWidth));
    }
    await page.setViewportSize({width:1280,height:800});
    await page.keyboard.down('w');await page.mouse.wheel(0,-250);await render(5);await page.keyboard.up('w');samePosition((await state()).position,beforeMap.position);
    for(let i=0;i<3;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#floor-plan-dialog').contains(document.activeElement)),true);}
    await page.keyboard.press('Escape');await render();samePosition((await state()).position,beforeMap.position);
    await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);await render();await shot('entry-first-person');
    phase='spatial-audio';await pose([8,3,11],[2.1,1.8,11]);await click(3);
    record.spatialAudio=await page.evaluate(()=>{const mesh=studyScene.meshes.find(m=>m.metadata?.interactionId==='living-lamp'&&m.material?.name==='brass');mesh.computeWorldMatrix(true);const p=mesh.getBoundingInfo().boundingBox.centerWorld,c=studyScene.activeCamera.globalPosition;return {event:audioEvents[audioEvents.length-1],expected:[p.x,p.y,-p.z],expectedListener:[c.x,c.y,-c.z],listener:audioEngine.listener.position.asArray(),context:audioEngine._audioContext.state,sounds:audioEngine.sounds.length};});
    assert.ok(record.spatialAudio.event.name.startsWith('switch-'));assert.equal(record.spatialAudio.event.panning,true);samePosition(record.spatialAudio.event.position,record.spatialAudio.expected);samePosition(record.spatialAudio.listener,record.spatialAudio.expectedListener);assert.equal(record.spatialAudio.context,'running');assert.equal(record.spatialAudio.sounds,24);await click(3);
    phase='map';record.mapLocations=[];
    for(const [id,x,y]of [['master',3.4,3.6],['study',7.45,2.2],['kitchen',9.6,1.7],['ensuite',1.2,6],['bathroom',3.9,6],['bedroom',2.7,9],['living',7,7],['balcony',8.1,11.55]]){
      const p=[(x-5.4)*5,3,(y-5.4)*5];await pose(p,[p[0]+1,3,p[2]-2]);await render();
      const location=await page.evaluate(()=>({current:document.querySelector('#floor-plan-mini .is-current')?.dataset.room,marker:document.querySelector('#floor-plan-mini .plan-position').getAttribute('transform'),visible:document.querySelector('#floor-plan-mini .plan-position').style.display!== 'none'}));
      assert.equal(location.current,id);assert.equal(location.visible,true);const xy=location.marker.match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number);assert.ok(Math.abs(xy[0]-64-(10.8-x)*36)<1e-6 && Math.abs(xy[1]-50-y*36)<1e-6);record.mapLocations.push({id,...location});
      if(['study','master','bathroom','balcony'].includes(id))await shot(id+'-first-person');
    }
    const fpBefore=await state();await page.keyboard.press('m');assert.equal(await page.locator('#floor-plan-dialog').evaluate(n=>n.open),true);assert.equal((await state()).locked,false);
    await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await render();samePosition((await state()).position,fpBefore.position);
    await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock?.());await page.locator('[data-view="overview"]').click();
    phase='regression';
    const alpha=await page.evaluate(()=>studyScene.activeCamera.alpha);await page.mouse.move(640,400);await page.mouse.down();await page.mouse.move(705,420,{steps:3});await page.mouse.up();await render();assert.notEqual(await page.evaluate(()=>studyScene.activeCamera.alpha),alpha);
    const radius=await page.evaluate(()=>studyScene.activeCamera.radius);await page.mouse.wheel(0,-250);await render();assert.notEqual(await page.evaluate(()=>studyScene.activeCamera.radius),radius);
    await page.locator('#settings-btn').click();await page.locator('#movement-speed').evaluate(n=>{n.value='2';n.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>studyScene.getCameraByName('study-first-person').speed),1.1);
    await page.locator('#settings-reset').click();await page.locator('#settings-close').click();
    await page.locator('#inspect-btn').click();await page.waitForFunction(()=>studyScene.debugLayer.isVisible(),null,{timeout:60000});await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!studyScene.debugLayer.isVisible());
    record.regression={inspection:true,mapModalIsolation:true,firstPersonPointerRestore:true,orbitDrag:true,wheelZoom:true,settings:true,inspector:true};
    phase='release';const root=path.resolve('dist'),files=[];const walk=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const p=path.join(d,e.name);e.isDirectory()?walk(p):files.push(p);});walk(root);
    for(const file of files){const r=await context.request.get(new URL(path.relative(root,file),url).href);assert.equal(r.status(),200);assert.equal(crypto.createHash('sha256').update(await r.body()).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));}
    record.release={filesVerified:files.length,bytes:files.reduce((a,p)=>a+fs.statSync(p).size,0),staticJsBytes:JSON.parse(fs.readFileSync(path.join(root,'bundle-analysis.json'))).initialJsBytes};assert.ok(record.release.bytes<=41*1048576);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));});
    record.disposed=await page.evaluate(()=>({disposed:studyScene.isDisposed,meshes:studyScene.meshes.length,materials:studyScene.materials.length,lights:studyScene.lights.length,engineScenes:studyEngine.scenes.length}));
    assert.deepEqual(record.disposed,{disposed:true,meshes:0,materials:0,lights:0,engineScenes:0});assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.status<400));record.passed=true;
    // A failed furniture download must leave the other room and the complete shell usable.
    phase='failure-path';const failure=await context.newPage();
    const expectedErrors=[];failure.on('pageerror',e=>expectedErrors.push(e.message));
    let releaseShelf;const shelfHeld=new Promise(resolve=>releaseShelf=resolve);
    await failure.route('**/wooden_bookshelf.glb',async r=>{await shelfHeld;await r.abort('failed');});
    await failure.goto(url,{waitUntil:'load'});
    await failure.waitForFunction(()=>document.querySelector('#floor-plan-drawing [data-room="living"]').dataset.state==='ready');
    await failure.locator('[data-view="first-person"]').click();await failure.waitForFunction(()=>!!document.pointerLockElement);
    await failure.keyboard.press('m');assert.equal(await failure.locator('#floor-plan-dialog').evaluate(n=>n.open),true);
    releaseShelf();await failure.waitForFunction(()=>document.querySelector('#floor-plan-drawing [data-room="study"]').dataset.state==='error');
    assert.equal(await failure.locator('#floor-plan-drawing .is-current').getAttribute('data-room'),'living');
    assert.equal(await failure.locator('#floor-plan-drawing .plan-position').evaluate(n=>n.style.display!=='none'),true);
    const suiteStates=await failure.locator('#floor-plan-drawing [data-room]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.room,n.dataset.state])));
    assert.equal(suiteStates.master,'ready');assert.equal(suiteStates.ensuite,'ready');assert.equal(Object.values(suiteStates).filter(s=>s==='shell').length,4);
    record.failurePath={states:suiteStates,study:'error',living:'ready',mapAndShellRemainUsable:true,mapPositionSurvivesAsyncStateRefresh:true,uncaughtErrors:expectedErrors};assert.deepEqual(expectedErrors,[]);await failure.close();
  } finally {
    Object.assign(record,{phase,errors,warnings,requests});fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();
  }
  console.log(JSON.stringify({passed:record.passed,scene:record.scene,initialJsBytes:record.initialJsBytes,release:record.release},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

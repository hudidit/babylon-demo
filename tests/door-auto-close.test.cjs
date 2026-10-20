const assert=require('node:assert/strict'),{test}=require('node:test'),b=require('@babylonjs/core/pure');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');load('RoomRuntime').registerRoomRuntime();
function fixture(t,autoCloseSeconds=10){const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 const root=new b.TransformNode('hinge',scene),mesh=b.CreateBox('door',{width:.2,height:10,depth:5},scene);mesh.parent=root;mesh.position.set(0,5,2.5);mesh.computeWorldMatrix(true);
 let walker;const events=[],interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{},()=>walker,e=>events.push(e));
 interactions.addDoor({id:'test-door',label:'test',root,meshes:[mesh],width:5,openAngle:Math.PI/2,autoCloseSeconds,walkerRadius:.8});
 const state=interactions.doors[0],toggle=()=>interactions.actions.get(mesh).toggle(),run=n=>{for(let i=0;i<n;i++)interactions.update(.05);},open=()=>{toggle();for(let i=0;i<30&&state.progress<1;i++)run(1);};
 return{state,events,root,interactions,toggle,run,open,setWalker:p=>walker=p};}
test('an entry waits ten active seconds after fully opening, then closes and latches once',t=>{
 const f=fixture(t);f.open();assert.equal(f.state.progress,1);assert.equal(f.state.openSeconds,0);f.run(199);assert.equal(f.state.progress,1);assert.equal(f.state.open,true);
 f.run(1);assert.equal(f.state.open,false);assert.ok(f.state.progress<1);f.run(20);assert.equal(f.state.progress,0);assert.equal(f.events.filter(e=>e.cue==='door-latch').length,1);
 f.run(400);assert.equal(f.events.filter(e=>e.cue==='door-latch').length,1);
});
test('automatic closing respects the real swept leaf, waits for a walker, and resumes without pushing them',t=>{
 const f=fixture(t);f.open();f.setWalker(new b.Vector3(Math.SQRT1_2*2.5,8,Math.SQRT1_2*2.5));f.run(230);assert.equal(f.state.blocked,true);assert.ok(f.state.progress>0);
 const blocked=f.state.progress;f.run(100);assert.equal(f.state.progress,blocked);f.setWalker(undefined);f.run(30);assert.equal(f.state.progress,0);
});
test('reopening a partly closed leaf restarts the full delay; invalid or absent ticks cannot advance it',t=>{
 const f=fixture(t);f.open();f.run(200);f.toggle();while(f.state.progress<1)f.run(1);assert.equal(f.state.openSeconds,0);
 for(const delta of [NaN,Infinity,-1,0])f.interactions.update(delta);assert.equal(f.state.openSeconds,0);for(let i=0;i<100;i++)f.interactions.update(.1,0);assert.equal(f.state.openSeconds,0);f.run(199);assert.equal(f.state.open,true);f.run(1);assert.equal(f.state.open,false);
});
test('ordinary interior doors retain manual operation',t=>{const f=fixture(t,null);f.open();f.run(500);assert.equal(f.state.open,true);assert.equal(f.state.progress,1);});

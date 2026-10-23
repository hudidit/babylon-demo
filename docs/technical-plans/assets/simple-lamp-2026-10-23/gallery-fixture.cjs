// Browser-only pose fixture. Does not create inspection evidence or advance the clock.
const {RoomScene} = require('../../../../src/examples/Room');
const {RoomTimeMenu} = require('../../../../src/components/RoomTimeMenu');
const {LIGHTHOUSE} = require('../../../../src/examples/LighthouseLayout');
const {COASTAL_SITE} = require('../../../../src/examples/CoastalSite');
const {houseVector} = require('../../../../src/examples/HouseWalking');
const {resetJumpState} = require('../../../../src/examples/HouseJump');
const canvas=document.createElement('canvas');canvas.id='gameCanvas';document.body.appendChild(canvas);
const room=new RoomScene(canvas);new RoomTimeMenu(room,()=>{});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>room.setView(button.dataset.view)));
const toolbar=document.createElement('div');toolbar.style.cssText='position:fixed;top:95px;right:20px;z-index:100000;display:flex;max-width:95vw;flex-wrap:wrap;gap:8px;background:#fff;padding:8px';
const title=document.createElement('span');title.textContent='QA 站位夹具';toolbar.appendChild(title);
function pose(x,y,target) {
  room.setView('first-person');const camera=room.firstPersonCamera,t=COASTAL_SITE.tower;
  camera.position.copyFrom(houseVector(t.x+x,t.y+y,LIGHTHOUSE.gallery+1.6));camera.setTarget(target());
  camera.cameraDirection.setAll(0);camera.movement.resetPanVelocity();resetJumpState(room.jump,LIGHTHOUSE.gallery);
  room.previousWalk.copyFrom(camera.position);room.stableWalk={position:camera.position.clone(),feet:LIGHTHOUSE.gallery};
  room.walkPose={...room.stableWalk,rotation:camera.rotation.clone()};camera.getViewMatrix(true);room.scene.updateTransformMatrix(true);
}
for(const [label,act]of [
  ['灯座站位',()=>pose(.25,-1.1,()=>{const mesh=room.exterior.lighthouseDetails.test.meshes[0];mesh.computeWorldMatrix(true);return mesh.getBoundingInfo().boundingBox.centerWorld;})],
  ['外廊玻璃前',()=>pose(2.5*Math.cos(Math.PI/8),2.5*Math.sin(Math.PI/8),()=>room.exterior.lighthouseDetails.beacon.root.position)],
  ['离开检查区',()=>pose(0,-3.5,()=>room.exterior.lighthouseDetails.beacon.root.position)],
  ['背对灯具',()=>pose(2.5*Math.cos(Math.PI/8),2.5*Math.sin(Math.PI/8),()=>room.firstPersonCamera.position.scale(2).subtract(room.exterior.lighthouseDetails.beacon.root.position))]
]) {const button=document.createElement('button');button.textContent=label;button.addEventListener('click',act);toolbar.appendChild(button);}
document.body.appendChild(toolbar);

const diagnostic=document.createElement('output');diagnostic.id='qa-check';diagnostic.style.cssText='position:fixed;bottom:95px;right:10px;max-width:95vw;background:#fff;color:#000;padding:8px;z-index:100000;font:13px monospace';document.body.append(diagnostic);
let started=0,finished=0,previous=false;
room.scene.onAfterRenderObservable.add(()=>{
 const i=room.lighthouseInspection,op=room.lighthouseOperation,checking=!!room.mainCheck;
 if(checking&&!previous){started=performance.now();finished=0;}if(!checking&&previous)finished=performance.now();previous=checking;
 diagnostic.textContent=JSON.stringify({checking,seconds:i.observationSeconds,turns:Number(i.observedTurns.toFixed(4)),complete:!!i.optic,
 result:i.optic?.result||'',mode:op.mode,running:op.running,remaining:Math.round(op.testSecondsRemaining),paused:room.pauseReasons,
 wallSeconds:started?Number(((finished||performance.now())-started).toFixed(0))/1000:0});
});

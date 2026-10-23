// Verification-only starting poses and read-only telemetry. Driving uses the production input handler and real render delta.
const {RoomScene}=require('../../../../src/examples/Room');
const {houseVector}=require('../../../../src/examples/HouseWalking');
const {scooterOffset,scooterSupport,SCOOTER_PARKING}=require('../../../../src/examples/CoastalScooter');
const {coastalRoute}=require('../../../../src/examples/CoastalSite');
const cases=require('../../../../tests/fixtures/scooter-ground-before.json').cases;
const canvas=document.createElement('canvas');canvas.id='gameCanvas';document.body.append(canvas);
const room=new RoomScene(canvas);
const toolbar=document.createElement('div');toolbar.style.cssText='position:fixed;top:100px;right:10px;z-index:100000;display:flex;gap:4px;flex-wrap:wrap;max-width:95vw;background:#fff;color:#000;padding:6px';
const output=document.createElement('output');output.id='qa-drive';output.style.cssText='position:fixed;bottom:105px;left:10px;z-index:100000;background:#fff;color:#000;padding:8px;max-width:95vw;font:13px monospace;white-space:pre-wrap';
const events=[];let poseLabel='initial',startingDistance=0;
function place(label,p){
 room.pauseScooter();room.scooterTransition=undefined;
 Object.assign(room.scooter,p,{riding:true,speed:0,distance:0,steer:0,exitRequested:false});
 room.setView('first-person');room.firstPersonCamera.rotation.set(.12,p.heading,0);
 room.placeRiderCamera();room.updateControls();
 poseLabel=label;startingDistance=room.scooter.distance;
}
for(const [label,p] of [
 ['住宅路肩去程',{...scooterOffset(cases[0],0,-2),heading:cases[0].heading}],
 ['住宅路肩返程',{...scooterOffset(cases[1],0,2),heading:cases[1].heading+Math.PI}],
 ['后半程路肩',{...scooterOffset(cases[3],0,-2),heading:cases[3].heading}],
 ['门外起点',SCOOTER_PARKING[0]],
 ['护栏检查',{x:14,y:0,heading:Math.PI/2}],
 ['塔基检查',{x:-125,y:84,heading:0}]
]){const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>place(label,p));toolbar.append(button);}
document.body.append(toolbar,output);
const route=coastalRoute().filter(p=>p.x<12.5&&p.y<82),native={};
document.addEventListener('keydown',e=>{if(['KeyW','KeyS','KeyA','KeyD','Space'].includes(e.code)){native[e.code]=true;events.push({type:'down',code:e.code,trusted:e.isTrusted,at:performance.now()});}});
document.addEventListener('keyup',e=>{delete native[e.code];});
room.scene.onAfterRenderObservable.add(()=>{
 const v=room.scooter,c=room.firstPersonCamera;let closest=0,distance=Infinity;
 route.forEach((p,i)=>{const d=Math.hypot(p.x-v.x,p.y-v.y);if(d<distance){distance=d;closest=i;}});
 const goal=route[Math.min(route.length-1,closest+10)],heading=Math.atan2(goal.x-v.x,goal.y-v.y),error=Math.atan2(Math.sin(heading-v.heading),Math.cos(heading-v.heading));
 output.textContent=JSON.stringify({pose:poseLabel,riding:v.riding,locked:room.pointerLocked,controls:room.controlsEnabled,
 x:Number(v.x.toFixed(4)),y:Number(v.y.toFixed(4)),heading:Number(v.heading.toFixed(4)),speed:Number((v.speed*3.6).toFixed(1)),travel:Number((v.distance-startingDistance).toFixed(3)),
 supported:!!scooterSupport(v),routeIndex:closest,crossTrack:Number(distance.toFixed(2)),turn:Number(error.toFixed(3)),keys:Object.keys(native),nativeEvents:events.filter(e=>e.trusted).length});
});

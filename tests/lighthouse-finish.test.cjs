const assert=require('node:assert/strict'),{test}=require('node:test');
const b=require('@babylonjs/core/pure'),load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {LIGHTHOUSE:a,LIGHTHOUSE_FLOORS:floors}=load('LighthouseLayout'),{COASTAL_SITE:{tower:tower}}=load('CoastalSite'),{planToWorld}=load('HouseLayout');
const point=(x,y,h)=>{const p=planToWorld({x:tower.x+x,y:tower.y+y},h);return new b.Vector3(p.x,p.y,p.z);};
function setup(t){const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;const exterior=new(load('RoomExterior').RoomExterior)(scene),camera=new b.UniversalCamera('finish-test',point(0,-1,a.floor+1.6),scene);scene.activeCamera=camera;t.after(()=>{scene.dispose();engine.dispose();});return{engine,scene,exterior,camera,details:exterior.lighthouseDetails};}

test('work light follows the current storey, is explicitly scoped, and switches off away from the tower',t=>{
 const {scene,exterior,camera,details:d}=setup(t),foreign=b.CreateBox('house-must-stay-dark',{},scene);
 assert.ok(d.light.includedOnlyMeshes.length>10);assert.ok(d.light.includedOnlyMeshes.every(m=>m.metadata.lighthouse));assert.ok(!d.light.includedOnlyMeshes.includes(foreign));
 assert.ok(!d.light.includedOnlyMeshes.some(m=>/shaft|plaza|path|glazing/.test(m.name)));
 for(const f of floors){camera.position.copyFrom(point(.2,-1,f.height+1.6));camera.getViewMatrix(true);d.update();assert.ok(d.light.isEnabled());assert.ok(Math.abs(d.light.position.y-point(.82,.85,f.height+1.69).y)<1e-7);}
 d.toggle();assert.equal(d.light.isEnabled(),false);d.toggle();assert.equal(d.light.isEnabled(),true);
 exterior.setVisible(false);assert.equal(d.light.isEnabled(),false);exterior.setVisible(true);assert.equal(d.light.isEnabled(),true);
 camera.position.setAll(0);camera.getViewMatrix(true);d.update();assert.equal(d.light.isEnabled(),false);
 assert.equal(d.light.getShadowGenerator(),null,'local illumination adds no shadow RTT');
});

test('panel switch and record are pickable at walking distance, are occluded by walls, and reuse sound cues',t=>{
 const {scene,details:d}=setup(t),events=[],interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{},()=>undefined,e=>events.push(e));
 interactions.addLamp(d.switch,()=>d.on,()=>d.toggle());let inspected;
 interactions.addInspectable(d.record,item=>inspected=item);
 const ray=(from,to)=>new b.Ray(from,to.subtract(from).normalize(),7.5);
 const sw=interactions.pick(ray(point(-.75,-.01,a.floor+1.39),point(-1.63,-.01,a.floor+1.39)));
 assert.match(sw.label(),/关闭/);sw.toggle();assert.equal(d.on,false);assert.equal(events.at(-1).cue,'switch');assert.equal(events.at(-1).entity,'lighthouse-work-light');assert.ok(events.at(-1).position().x<point(-1,-.01,a.floor).x);
 const log=interactions.pick(ray(point(.08,.8,a.floor+1.51),point(.08,1.998,a.floor+1.51)));assert.match(log.label(),/维护记录/);log.toggle();assert.equal(inspected,d.record);
 assert.ok(d.record.mesh.getVerticesData(b.VertexBuffer.NormalKind)[2]<-.99,'printed face must face the viewer in the left-handed scene');
 assert.equal(interactions.pick(ray(point(.08,3,a.floor+1.51),point(.08,1.998,a.floor+1.51))),undefined,'masonry prevents reading from outside');
 const inspection=new(load('RoomItemInspection').RoomItemInspection)(scene);assert.ok(inspection.open(d.record));assert.equal(scene.getMeshByName('inspection-'+d.record.id).geometry,d.record.mesh.geometry);inspection.close();inspection.dispose();assert.ok(scene.textures.includes(d.record.mesh.material.albedoTexture));
});

test('record atlas is deterministic, floor map matches real heights and identifies climbs without changing floors',()=>{
 const {lighthouseRecordPixels:p,LIGHTHOUSE_LOG}=load('LighthouseRecords'),one=p(),two=p();assert.deepEqual(one.pixels,two.pixels);assert.equal(one.pixels.length,2*1024*1024);assert.match(LIGHTHOUSE_LOG.join(' '),/FICTIONAL SCENE LOG/);
 const {lighthouseLevelsSvg:svg,lighthouseMapState:state}=load('LighthouseMap');assert.equal((svg().match(/data-lighthouse-floor=/g)||[]).length,5);
 for(const f of floors){assert.equal(state(f.height).floor,f.index);assert.match(svg(),new RegExp(f.height.toFixed(2)));}
 assert.equal(state(a.floor+1).visible,true);assert.equal(state(a.floor+1).floor,undefined);for(const h of [undefined,NaN,Infinity,0,99])assert.equal(state(h).visible,false);
});

test('details fit their separate geometry budget, leave all floor and ladder routes clear and release every owned resource',t=>{
 const {scene,exterior,camera,details:d}=setup(t),details=exterior.meshes.filter(m=>m.metadata.lighthouseDetail),walking=load('WalkingSurface');
 assert.ok(details.length<=16);assert.ok(details.reduce((n,m)=>n+m.getTotalVertices(),0)<=8000);assert.equal(exterior.surfaces.textures.filter(t=>t.name==='lighthouse-original-records-and-signs').length,1);
 for(const f of floors)for(const [x,y]of [[a.ladder.x,a.ladder.landingY],[0,-1.2],[.7,-.6]]){assert.ok(walking.walkingPointAllowed({x:tower.x+x,y:tower.y+y},.26,f.height));const p=point(x,y,f.height+.02),hit=scene.pickWithRay(new b.Ray(p,new b.Vector3(0,1,0),1.68*5),m=>!!m.metadata?.lighthouseDetail);assert.equal(hit.hit,false,'detail must not intrude into the walking body');}
 camera.dispose();exterior.dispose();exterior.dispose();d.toggle();assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.materials.length,0);assert.equal(scene.lights.length,0);assert.ok(scene.textures.every(t=>t.name.startsWith('data:EnvironmentBRDFTexture')));
});

const assert=require('node:assert/strict'),{test}=require('node:test'),b=require('@babylonjs/core/pure');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {evaluateTimeOfDay:at}=load('RoomTimeOfDay'),{LighthouseWeatherRisk}=load('LighthouseRisk');
const {coastalWeatherTime,coastalWeatherFog,applyCoastalSceneFog}=load('CoastalWeather');
const {RoomExterior}=load('RoomExterior'),{RoomLighting}=load('RoomLighting'),{CoastalRain}=load('CoastalRain');
const w=kind=>new LighthouseWeatherRisk({seed:1,fixedWeather:kind}).snapshot.weather;
const near=(a,z,e=1e-8)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
function setup(t){const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;t.after(()=>{scene.dispose();engine.dispose();});return scene;}
test('clear weather is the original time snapshot identity, with zero added fog and no changes to the clock',()=>{
 for(const h of [0,6,12,18,21]){const state=at(h);assert.equal(coastalWeatherTime(state,w('clear')),state);assert.equal(coastalWeatherFog(w('clear'),state).density,0);}
});
test('sky/sea cloud, atmosphere, PBR fog and natural light consume one weather snapshot while work lamps retain intensity',t=>{
 const scene=setup(t),exterior=new RoomExterior(scene),lighting=new RoomLighting(scene,true),lamp=scene.getLightByName('banker-lamp-light');
 const lampIntensity=lamp.intensity,resources=[scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length,scene.cameras.length];
 for(const hour of [12,21])for(const kind of ['clear','overcast','fog','storm','clear']){
  const weather=w(kind),state=coastalWeatherTime(at(hour),weather);applyCoastalSceneFog(scene,weather,state);exterior.applyTimeOfDay(state,weather);lighting.applyTimeOfDay(state);
  assert.equal(lamp.intensity,lampIntensity);near(exterior.sun.intensity,state.primary?.intensity||0);
  const sky=exterior.sky,ocean=exterior.ocean.material;near(sky._floats.weatherFogDensity,scene.fogDensity);near(ocean._floats.weatherFogDensity,scene.fogDensity);
  near(ocean._floats.weatherCloudCover,sky._floats.weatherCloudCover);assert.deepEqual(ocean._vectors3.weatherFogColor.asArray(),sky._vectors3.weatherFogColor.asArray());
  const linear=scene.fogColor.toLinearSpace();linear.asArray().forEach((v,i)=>near(v,sky._vectors3.weatherFogColor.asArray()[i],1e-6));
  assert.equal(scene.fogMode,kind==='clear'?0:2);assert.deepEqual([scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length,scene.cameras.length],resources);
 }
});
test('world rain is one noncolliding, unpickable mesh/material, shares fog and disables only decoration in reduced motion',t=>{
 const scene=setup(t),before=[scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length,scene.cameras.length],rain=new CoastalRain(scene),weather=w('storm'),time=coastalWeatherTime(at(12),weather);
 assert.equal(scene.meshes.length,before[0]+1);assert.equal(scene.materials.length,before[1]+1);assert.equal(scene.textures.length,before[2]);assert.equal(scene.lights.length,before[3]);assert.equal(scene.cameras.length,before[4]);
 assert.equal(rain.mesh.getTotalVertices(),576);assert.equal(rain.mesh.isPickable,false);assert.equal(rain.mesh.checkCollisions,false);
 rain.apply(weather,time,b.Vector3.Zero(),.1,true,false);assert.equal(rain.mesh.isVisible,true);const elapsed=rain.material._floats.rainTime;
 rain.apply(weather,time,b.Vector3.Zero(),0,true,false);assert.equal(rain.material._floats.rainTime,elapsed);
 rain.apply(weather,time,b.Vector3.Zero(),0,true,true);assert.equal(rain.mesh.isVisible,false);near(rain.material._floats.weatherFogDensity,coastalWeatherFog(weather,time).density);
 rain.dispose();assert.equal(scene.meshes.length,before[0]);assert.equal(scene.materials.length,before[1]);
});

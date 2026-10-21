import { Mesh, ShaderMaterial, Vector3, VertexData } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_ROOMS, planToWorld } from "./HouseLayout";
import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE_SERVICE_ROOM } from "./LighthouseEquipmentLayout";
import { setRoomOwners } from "./RoomOwnership";
import { applyCoastalWeather, coastalWeatherGLSL, weatherUniforms } from "./CoastalWeather";
import type { LighthouseWeatherSnapshot } from "./LighthouseWeather";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";

/** One small world-space rain patch. No particles, textures, lights or reflection cameras. */
export class CoastalRain {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private seconds=0;
  constructor(scene: Scene) {
    const scale=HOUSE_COORDINATES.unitsPerMeter, positions:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let n=0;n<144;n++) {
      const x=(n%12-5.5)*1.7, z=(Math.floor(n/12)-5.5)*1.7, phase=((n*73)%149)/149;
      for(let i=0;i<4;i++){positions.push(x*scale,phase*14*scale,z*scale);uvs.push(i%2,Math.floor(i/2));}
      const base=n*4;indices.push(base,base+1,base+2,base+2,base+1,base+3);
    }
    this.mesh=new Mesh("coastal-weather-rain",scene);const data=new VertexData();data.positions=positions;data.uvs=uvs;data.indices=indices;data.applyToMesh(this.mesh);
    this.mesh.isPickable=false;this.mesh.checkCollisions=false;this.mesh.alwaysSelectAsActiveMesh=true;
    this.mesh.metadata={exterior:true,exteriorLayer:"weather",castsShadows:false};setRoomOwners(this.mesh,HOUSE_ROOMS.map(r=>r.id));
    const a=planToWorld({x:Math.min(...HOUSE_ROOMS.map(r=>r.x))-.2,y:Math.min(...HOUSE_ROOMS.map(r=>r.y))-.2});
    const b=planToWorld({x:Math.max(...HOUSE_ROOMS.map(r=>r.x+r.width))+.2,y:Math.max(...HOUSE_ROOMS.map(r=>r.y+r.depth))+.2});
    const tower=planToWorld(COASTAL_SITE.tower), service=planToWorld({x:COASTAL_SITE.tower.x+LIGHTHOUSE_SERVICE_ROOM.x,y:COASTAL_SITE.tower.y+LIGHTHOUSE_SERVICE_ROOM.y});
    this.material=new ShaderMaterial("coastal-rain",scene,{
      vertexSource:`precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 viewProjection;
        uniform vec3 rainCenter;uniform float rainTime;varying vec2 vRainUv;varying vec3 vRainPosition;
        #include<clipPlaneVertexDeclaration>
        void main(){vec3 p=position+rainCenter;p.y=rainCenter.y+mod(position.y-rainTime*43.,70.)-24.;
          p.x+=(uv.x-.5)*.055+(uv.y-.5)*.55;p.y+=(uv.y-.5)*2.4;p.z+=(uv.x-.5)*.055;
          vRainUv=uv;vRainPosition=p;vec4 worldPos=vec4(p,1.);gl_Position=viewProjection*worldPos;
          #include<clipPlaneVertex>
        }`,
      fragmentSource:`precision highp float;varying vec2 vRainUv;varying vec3 vRainPosition;uniform vec3 cameraPosition;
        uniform float rainAmount,rainBrightness;${coastalWeatherGLSL}
        #include<clipPlaneFragmentDeclaration>
        void main(){
          #include<clipPlaneFragment>
          // Infinite shelter columns prevent rain penetrating a roof/interior at any camera height.
          vec3 p=vRainPosition;
          if(p.x>${a.x.toFixed(3)}&&p.x<${b.x.toFixed(3)}&&p.z>${a.z.toFixed(3)}&&p.z<${b.z.toFixed(3)})discard;
          if(distance(p.xz,vec2(${tower.x.toFixed(3)},${tower.z.toFixed(3)}))<${(COASTAL_SITE.tower.radius*scale).toFixed(3)})discard;
          if(abs(p.x-(${service.x.toFixed(3)}))<${(LIGHTHOUSE_SERVICE_ROOM.width*scale/2+.5).toFixed(3)}&&abs(p.z-(${service.z.toFixed(3)}))<${(LIGHTHOUSE_SERVICE_ROOM.depth*scale/2+.5).toFixed(3)})discard;
          float alpha=sin(vRainUv.x*3.14159265)*sin(vRainUv.y*3.14159265)*rainAmount*.32;
          gl_FragColor=vec4(coastalWeatherFog(vec3(.5,.6,.68)*rainBrightness,length(p-cameraPosition)),alpha);
        }`,
    },{attributes:["position","uv"],uniforms:["viewProjection","rainCenter","rainTime","rainAmount","rainBrightness","cameraPosition",...weatherUniforms],needAlphaBlending:true,useClipPlane:true});
    this.material.backFaceCulling=false;this.material.disableDepthWrite=true;this.mesh.material=this.material;this.mesh.isVisible=false;
    this.material.onBindObservable.add(()=>{const eye=scene._mirroredCameraPosition||scene.activeCamera?.globalPosition;if(eye)this.material.getEffect()?.setVector3("cameraPosition",eye);});
  }
  apply(weather:LighthouseWeatherSnapshot,time:TimeOfDaySnapshot,eye:Vector3,activeSeconds:number,visible:boolean,reduced:boolean) {
    this.seconds+=Math.max(0,Math.min(.1,activeSeconds));
    this.mesh.isVisible=visible&&!reduced&&weather.rain>.001;
    this.material.setVector3("rainCenter",new Vector3(Math.floor(eye.x/20)*20,eye.y,Math.floor(eye.z/20)*20));
    this.material.setFloat("rainTime",this.seconds);this.material.setFloat("rainAmount",weather.rain);
    this.material.setFloat("rainBrightness",Math.max(.12,time.environment.exterior));applyCoastalWeather(this.material,weather,time);
  }
  dispose(){this.mesh.dispose();this.material.dispose();}
}

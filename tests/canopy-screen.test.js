import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING, makeLayout } from '../src/layout.js';
import { CANOPY, toCanopyFrame, fromCanopyFrame, screenContact } from '../src/canopy-profile.js';
import { PARTITIONS, SCREEN_BANDS, bandForTier, bandFrame, bandVideoUV, bandSurfacePoint, partitionBlocksSegment, partitionPanels } from '../src/partition-layout.js';
import atlas from '../src/data/band-video.json' with { type:'json' };
import fit from '../src/data/partition-fit.json' with { type:'json' };
import { createScreenGeometry } from '../src/screen-geometry.js';
import { FanPartitions } from '../src/fan-partitions.js';
import { bandTargets, withinDefaultView } from '../src/partition-sightline.js';
import { createBandScreenMaterial } from '../src/band-screen.js';
import { compareWorlds } from '../src/comparison.js';
import { fitPartitionToViews } from '../src/partition-fit.js';
import { VIDEO_PRESETS } from '../src/video-library.js';

const layout=makeLayout('fan-v2');
const dispose=object=>object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('25-degree canopy retains the existing two seated zones and poses',()=>{
  assert.equal(layout.seats.length,3760);assert.equal(PARTITIONS.slopeDegrees,25);
  for(const seat of layout.seats) {
    assert.equal(seat.recliner,true);near(seat.backAngle*180/Math.PI,seat.tier<300?20:55);
    if(seat.tier>=300)near(seat.viewPitch*180/Math.PI,55);
    else assert.ok(withinDefaultView(seat,bandForTier(seat.tier).target));
  }
});

test('canopy loads fully extended and old folding/length commands cannot open a gap',()=>{
  const fans=new FanPartitions(),geometry=fans.membranes[0].mesh.geometry;
  for(const value of [0,.1,.5,1]) {
    fans.setAmount(value);fans.setDeployed(false,true);fans.update(.1);
    const state=fans.getState();assert.equal(state.amount,1);assert.equal(state.deployed,true);
    assert.equal(state.screenAttached,true);assert.equal(state.moving,false);
    assert.ok(fans.membranes.every(m=>m.mesh.visible));assert.equal(fans.membranes[0].mesh.geometry,geometry);
  }
  near(fans.getState().projectionMetres,53.31360154056196);dispose(fans);
});

test('contact arc exactly intersects the 25-degree plane and sphere and reaches both screen edges',()=>{
  const s=BUILDING.screen;
  for(const p of partitionPanels().flatMap(p=>p.contactEdge)) {
    near(toCanopyFrame(p).y,CANOPY.cut);near(p.x*p.x+(p.y-s.centerY)**2+(p.z-s.centerZ)**2,s.radius**2,1e-6);
  }
  near(screenContact(0).y,49.36054068218817);
  for(const p of [screenContact(-1),screenContact(1)]) {
    const a=s.tiltDegrees*Math.PI/180;
    near((p.y-s.centerY)*Math.cos(a)-(p.z-s.centerZ)*Math.sin(a),s.clipOffset);
  }
});

test('curved blades remain closed, consistently oriented, coplanar and joined without cracks',()=>{
  const fans=new FanPartitions(),panels=partitionPanels();
  for(let i=1;i<panels.length;i++) {
    assert.deepEqual(panels[i-1].ring[1],panels[i].ring[0]);assert.deepEqual(panels[i-1].ring[2],panels[i].ring.at(-1));
  }
  assert.equal(panels.filter(p=>p.bridge).length,10);
  for(const {mesh,panel,cassette} of fans.membranes) {
    for(const root of [panel.rootA,panel.rootB]) {near(root.y,24.5);near(root.z,CANOPY.rootZ);}
    near(cassette.position.y,24.5);for(const p of panel.ring)near(toCanopyFrame(p).y,CANOPY.cut);
    const p=mesh.geometry.attributes.position,indices=mesh.geometry.index.array,edges=new Map();let volume=0;
    for(let i=0;i<indices.length;i+=3) {
      const [a,b,c]=Array.from(indices.slice(i,i+3)),va=new THREE.Vector3().fromBufferAttribute(p,a),vb=new THREE.Vector3().fromBufferAttribute(p,b),vc=new THREE.Vector3().fromBufferAttribute(p,c);
      volume+=va.dot(vb.clone().cross(vc))/6;
      assert.ok(vb.clone().sub(va).cross(vc.clone().sub(va)).length()>1e-9);
      for(const [u,v] of [[a,b],[b,c],[c,a]]) {const key=u<v?`${u}/${v}`:`${v}/${u}`,entry=edges.get(key)??[0,0];entry[0]++;entry[1]+=u<v?1:-1;edges.set(key,entry);}
    }
    for(const edge of edges.values())assert.deepEqual(edge,[2,0]);assert.ok(volume>0);
  }
  dispose(fans);
});

function containsPoint(ring,point) {
  const points=ring.map(p=>toCanopyFrame(p)),q=toCanopyFrame(point);let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.z>q.z)!==(b.z>q.z) && q.x<(b.x-a.x)*(q.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}

test('the canopy covers actual faceted LED intersection points across the visible width',()=>{
  const {geometry,boundary}=createScreenGeometry(),screen=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));screen.updateMatrixWorld(true);
  const origin=fromCanopyFrame({x:0,y:CANOPY.cut,z:0}),panels=partitionPanels();let checked=0;
  for(let i=0;i<=160;i++) {
    const a=(-1+i/80)*CANOPY.halfAngle,end=fromCanopyFrame({x:Math.sin(a),y:CANOPY.cut,z:-Math.cos(a)});
    const ray=new THREE.Raycaster(new THREE.Vector3(origin.x,origin.y,origin.z),new THREE.Vector3(end.x-origin.x,end.y-origin.y,end.z-origin.z).normalize(),0,70);
    const hit=ray.intersectObject(screen)[0];if(!hit)continue;
    assert.ok(panels.some(p=>containsPoint(p.ring,hit.point)),`screen gap at ${(a*180/Math.PI).toFixed(2)} degrees`);checked++;
  }
  assert.ok(checked>150);geometry.dispose();boundary.dispose();screen.material.dispose();
});

test('split, screen samples and UVs agree in the tilted frame and converge at its pole',()=>{
  const s=BUILDING.screen;near(SCREEN_BANDS[0].top,SCREEN_BANDS[1].bottom);near(PARTITIONS.boundary,CANOPY.cut);
  for(const band of SCREEN_BANDS) {
    for(const p of bandTargets(band)) {
      const q=toCanopyFrame(p),a=s.tiltDegrees*Math.PI/180;
      assert.ok(q.y>=band.bottom-1e-8 && q.y<=band.top+1e-8);assert.ok(p.y>=-1e-8);
      assert.ok((p.y-s.centerY)*Math.cos(a)-(p.z-s.centerZ)*Math.sin(a)>=s.clipOffset-1e-6);
    }
    for(const [u,v] of [[.5,.5],[.25,.25],[.75,.25]]) {
      const uv=bandVideoUV(bandSurfacePoint(band,u,v,s),band,s);near(uv.u,u);near(uv.v,v);
    }
  }
  const {geometry,boundary}=createScreenGeometry(),p=geometry.attributes.position;
  for(let i=0;i<p.count;i+=3) {
    const point={x:p.getX(i),y:p.getY(i),z:p.getZ(i)},band=SCREEN_BANDS[toCanopyFrame(point).y<CANOPY.cut?0:1],uv=bandVideoUV(point,band,s);
    assert.ok(Number.isFinite(uv.u)&&Number.isFinite(uv.v));assert.ok(uv.u>=0&&uv.u<=1&&uv.v>=0&&uv.v<=1);
  }
  for(const u of [0,.25,.5,.75,1])near(bandVideoUV(bandSurfacePoint(SCREEN_BANDS[1],u,.99999,s),SCREEN_BANDS[1],s).u,.5,.003);
  geometry.dispose();boundary.dispose();
});

test('re-encoded media proportions and shader uniforms match the two physical zones',()=>{
  assert.equal(atlas.frameRotationDegrees,25);near(atlas.boundaryCoordinate,CANOPY.cut);
  assert.deepEqual(atlas.bands.map(b=>[b.width,b.height]),[[3072,1134],[3072,1012]]);assert.equal(atlas.height,2146);
  for(const band of SCREEN_BANDS) {
    const f=bandFrame(band,BUILDING.screen),b=atlas.bands[band.id-1];near(f.width,b.referenceWidthMetres);near(f.height,b.referenceHeightMetres);
    assert.ok(Math.abs(b.width/b.height-f.width/f.height)<.005);
  }
  const texture=new THREE.Texture(),material=createBandScreenMaterial(texture,true,BUILDING.screen);
  near(material.uniforms.uBoundary.value,CANOPY.cut);near(material.uniforms.uFrame.value.x,CANOPY.cos);
  assert.deepEqual(material.uniforms.uVideoSize.value.toArray(),[3072,2146]);for(const preset of VIDEO_PRESETS)assert.match(preset.bands.url,/-25deg\.mp4$/);
  material.dispose();texture.dispose();
});

test('fixed deployment analysis reports actual exposure and agrees with rendered blade intersections',()=>{
  const actual=fitPartitionToViews(layout);assert.deepEqual(actual,fit);assert.equal(actual.amount,1);assert.equal(actual.scope,'fixed-screen-attached-canopy');
  assert.equal(actual.groups[0].seats,1740);assert.equal(actual.groups[1].seats,2020);
  assert.equal(compareWorlds({worldId:'fan-v2',selection:{section:306,row:10}}).partition.amount,1);
  const fans=new FanPartitions();fans.updateMatrixWorld(true);
  const panel=partitionPanels().find(p=>p.section===304&&!p.bridge);
  const p={x:(panel.rootA.x+panel.rootB.x)/2,z:(panel.rootA.z+panel.ring[3].z)/2};p.y=CANOPY.rootY+(CANOPY.rootZ-p.z)*Math.tan(25*Math.PI/180);
  const origin=new THREE.Vector3(p.x,p.y+2,p.z),target=new THREE.Vector3(p.x,p.y-2,p.z);
  assert.equal(partitionBlocksSegment(origin,target,1),true);
  assert.ok(new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,4).intersectObjects(fans.membranes.map(m=>m.mesh)).length>0);dispose(fans);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING, makeLayout, resolveSeat } from '../src/layout.js';
import { PARTITIONS, SCREEN_BANDS, bandForTier, bandFrame, bandVideoUV, bandSurfacePoint, partitionBlocksSegment, requiredPartitionAmount, partitionPanels, partitionAmountForLength } from '../src/partition-layout.js';
import atlas from '../src/data/band-video.json' with { type: 'json' };
import { createScreenGeometry } from '../src/screen-geometry.js';
import { FanPartitions } from '../src/fan-partitions.js';
import { bandTargets, evaluatePartitions } from '../src/partition-sightline.js';
import { createBandScreenMaterial } from '../src/band-screen.js';
import { compareWorlds } from '../src/comparison.js';
import { seatEye } from '../src/seating-pose.js';
import { fitPartitionToViews } from '../src/partition-fit.js';
import { withinDefaultView } from '../src/partition-sightline.js';
import fit from '../src/data/partition-fit.json' with { type: 'json' };
import footprint from '../src/data/partition-footprint.json' with { type: 'json' };

const layout = makeLayout('fan-v2');

test('manual metre input is bounded and rejects invalid values', () => {
  assert.equal(partitionAmountForLength(1.25),1.25 / PARTITIONS.maximumProjection);
  assert.equal(partitionAmountForLength(-1),0);
  assert.equal(partitionAmountForLength(PARTITIONS.maximumProjection + 8),1);
  assert.equal(partitionAmountForLength(NaN),null);
  assert.equal(partitionAmountForLength(Infinity),null);
  assert.equal(partitionAmountForLength('1.25'),null);
});

test('two recliner zones retain their poses and screen boundary', () => {
  assert.equal(layout.seats.length,3760);
  assert.equal(SCREEN_BANDS.length,2);
  assert.equal(PARTITIONS.boundary,36);
  for (const seat of layout.seats) {
    const band = bandForTier(seat.tier), eye = seatEye(seat).y;
    const lower = band.id === 1 ? -Infinity : 24.4;
    const upper = band.id === 2 ? Infinity : 24.4;
    assert.equal(seat.recliner,true);
    assert.ok(Math.abs(seat.backAngle*180/Math.PI-(seat.tier<300?20:55))<1e-8);
    if(seat.tier>=300)assert.ok(seat.viewPitch*180/Math.PI>23);
    if(seat.tier<300)assert.ok(withinDefaultView(seat,band.target));
    else assert.ok(Math.abs(seat.viewPitch*180/Math.PI-55)<1e-8);
    assert.ok(eye - .2 > lower + PARTITIONS.thickness, seat.id);
    assert.ok(eye + .2 < upper - PARTITIONS.thickness, seat.id);
  }
});

test('wide band movies cover the complete curved LED without side or height letterboxing', () => {
  const centers = [];
  for (const band of SCREEN_BANDS) {
    const f = bandFrame(band, BUILDING.screen);
    assert.equal(f.bottom,band.bottom); assert.equal(f.top,band.top);
    assert.ok(f.width / f.height > 3);
    const source = atlas.bands[band.id-1];
    // Preserve the encoded strips and remap each full frame into the newly
    // allocated physical band instead of cropping or bleeding across them.
    assert.ok(source.width>0 && source.height>0);
    const centerUV = bandVideoUV(bandSurfacePoint(band,.5,.5,BUILDING.screen),band,BUILDING.screen);
    assert.ok(Math.abs(centerUV.u-.5)<1e-10 && Math.abs(centerUV.v-.5)<1e-10);
    const uv = bandVideoUV(bandSurfacePoint(band,.25,.25,BUILDING.screen),band,BUILDING.screen);
    assert.ok(Math.abs(uv.u-.25)<1e-10 && Math.abs(uv.v-.25)<1e-10);
    for (const p of bandTargets(band)) assert.ok([p.x,p.y,p.z].every(Number.isFinite));
    centers.push(f.center);
  }
  assert.equal(SCREEN_BANDS[0].top,SCREEN_BANDS[1].bottom);
  assert.equal(SCREEN_BANDS[1].top,BUILDING.screenApex);
  assert.equal(atlas.bands.length,2);
  assert.equal(atlas.bands.reduce((n,b)=>n+b.height,0),atlas.height);
  const {geometry,boundary} = createScreenGeometry(), positions = geometry.attributes.position;
  for (let i=0;i<positions.count;i++) {
    const point = {x:positions.getX(i),y:positions.getY(i),z:positions.getZ(i)};
    const band = SCREEN_BANDS.find(b=>point.y<=b.top+.0001)??SCREEN_BANDS.at(-1);
    const uv = bandVideoUV(point,band,BUILDING.screen);
    assert.ok(Number.isFinite(uv.u)&&Number.isFinite(uv.v));
    assert.ok(uv.u>=0&&uv.u<=1&&uv.v>=0&&uv.v<=1);
  }
  geometry.dispose();boundary.dispose();
  assert.ok(centers[0] < centers[1]);
  const texture = new THREE.Texture(), material = createBandScreenMaterial(texture,true,BUILDING.screen);
  assert.equal(material.uniforms.uMovie.value, texture);
  assert.equal(material.uniforms.uBands.value.length,2);
  assert.equal(material.uniforms.uAtlas.value.length,2);
  assert.equal(material.uniforms.uBoundary.value,36);
  assert.equal(material.uniforms.uReady.value,1);
  material.dispose(); texture.dispose();
  const cap = SCREEN_BANDS[1];
  const pole = bandVideoUV({x:0,y:cap.top,z:0},cap,BUILDING.screen);
  assert.ok(Math.abs(pole.u-.5)<1e-8);
  for(const u of [0,.25,.5,.75,1]) {
    const near = bandVideoUV(bandSurfacePoint(cap,u,.99999,BUILDING.screen),cap,BUILDING.screen);
    assert.ok(Math.abs(near.u-pole.u)<.003,'canopy UV converges continuously at the pole');
  }
});

test('seat-edge blades are closed solids, retract into the gallery and reuse their geometry', () => {
  const fans = new FanPartitions(), geometry = fans.membranes[0].mesh.geometry;
  assert.equal(fans.membranes.length,footprint.segments.length);
  assert.equal(fans.getState().amount,0);
  assert.ok(fans.membranes.every(({mesh,ribs})=>!mesh.visible&&!ribs.visible));
  for (const amount of [.3,1]) {
    fans.setAmount(amount);
    for (const {mesh} of fans.membranes) {
      const p = mesh.geometry.attributes.position, idx = mesh.geometry.index.array, edges = new Map();
      let volume = 0;
      for (let i=0;i<p.count;i++) assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
      for(let i=0;i<idx.length;i+=3){
        const [a,b,c] = [...idx.slice(i,i+3)];
        const x=new THREE.Vector3().fromBufferAttribute(p,a), y=new THREE.Vector3().fromBufferAttribute(p,b), z=new THREE.Vector3().fromBufferAttribute(p,c);
        volume += x.dot(y.clone().cross(z))/6;
        assert.ok(y.sub(x).cross(z.sub(x)).length()>1e-8);
        for(const [u,v] of [[a,b],[b,c],[c,a]]){const key=u<v?`${u}/${v}`:`${v}/${u}`, value=edges.get(key)??[0,0];value[0]++;value[1]+=u<v?1:-1;edges.set(key,value);}
      }
      for(const edge of edges.values()) assert.deepEqual(edge,[2,0]);
      assert.ok(volume>0,'outward-facing watertight blade');
    }
  }
  assert.equal(fans.membranes[0].mesh.geometry,geometry);
  fans.setDeployed(false);
  for(let i=0;i<40;i++)fans.update(.05);
  assert.equal(fans.getState().amount,0);
  fans.setDeployed(true);
  for(let i=0;i<40;i++)fans.update(.05);
  assert.equal(fans.getState().projectionMetres,100);
  assert.equal(fans.getState().slopeDegrees,15);
  fans.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('blades stay rooted at gallery banks and allow the requested 100m manual reach', async () => {
  const {rowPath,rowGeometry} = await import('../src/layout.js');
  const {bankBounds} = await import('../src/bowl-geometry.js');
  const panels=partitionPanels(1);
  for(const section of layout.sections.filter(s=>s.tier.id===300)) {
    const front=section.range.first-section.tier.rowStep/2, bounds=bankBounds(section,front);
    const path=rowPath(section.tier,front,bounds.start,bounds.end), own=panels.filter(p=>p.section===section.id&&!p.bridge);
    assert.equal(own.length,path.length-1);
    for(const [i,p] of own.entries()) {
      assert.deepEqual({x:p.a.x,z:p.a.z},{x:path[i].x,z:path[i].z});
      assert.deepEqual({x:p.b.x,z:p.b.z},{x:path[i+1].x,z:path[i+1].z});
      assert.equal(p.y,rowGeometry(section.tier,section.range.first).floorY-.08);
      for(const [root,tip] of [[p.a,p.ring[3]],[p.b,p.ring[2]]]) assert.ok(Math.abs(Math.hypot(tip.x-root.x,tip.z-root.z)-100)<1e-9);
      assert.ok(Math.abs(p.ring[3].y-p.a.y-100*Math.tan(Math.PI/12))<1e-9);
    }
  }
  assert.ok(panels.some(p=>p.ring.some(tip=>Math.hypot(tip.x,tip.z, p.y-BUILDING.centerY)>BUILDING.diameter/2)),'manual reach is not clipped at the building');
});

test('analytic interception agrees with physical blades, including the zero-length state', () => {
  const fans=new FanPartitions(), panel=partitionPanels(1).find(p=>p.section===304&&!p.bridge);
  const px=(panel.a.x+panel.b.x)/2+(panel.normalA.x+panel.normalB.x)/2, pz=(panel.a.z+panel.b.z)/2+(panel.normalA.z+panel.normalB.z)/2;
  const origin=new THREE.Vector3(px,panel.y+1,pz), target=new THREE.Vector3(px,panel.y-1,pz);
  const fraction=1/PARTITIONS.maximumProjection;
  assert.ok(Math.abs(requiredPartitionAmount(origin,target)-fraction)<1e-8);
  for(const amount of [0,fraction*.8,fraction*1.2,1]) {
    fans.setAmount(amount); fans.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),.001,1.999);
    const meshes=fans.membranes.map(m=>m.mesh).filter(m=>m.visible);
    const blocked=ray.intersectObjects(meshes).length>0;
    assert.equal(blocked,amount>fraction);
    assert.equal(partitionBlocksSegment(origin,target,amount),blocked);
  }
  assert.equal(requiredPartitionAmount({x:0,y:80,z:-1000},{x:0,y:0,z:-1000}),Infinity);
  fans.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('every internal joint shares the complete edge and gallery gaps have opaque connecting panels', () => {
  const fans=new FanPartitions();
  for(const amount of [.01,.25,1]) {
    const panels=partitionPanels(amount);
    fans.setAmount(amount); fans.updateMatrixWorld(true);
    for(let i=1;i<panels.length;i++) {
      assert.deepEqual(panels[i-1].ring[1],panels[i].ring[0]);
      assert.deepEqual(panels[i-1].ring[2],panels[i].ring[3]);
      const a=fans.membranes[i-1].mesh.geometry.attributes.position, b=fans.membranes[i].mesh.geometry.attributes.position;
      for(const [left,right] of [[2,0],[3,1],[4,6],[5,7]]) {
        assert.deepEqual([a.getX(left),a.getY(left),a.getZ(left)],[b.getX(right),b.getY(right),b.getZ(right)]);
      }
    }
    const bridges=panels.filter(p=>p.bridge);
    assert.equal(bridges.length,10);
    for(const panel of bridges) {
      const x=panel.ring.reduce((s,p)=>s+p.x,0)/4, z=panel.ring.reduce((s,p)=>s+p.z,0)/4;
      const hi=Math.max(...panel.ring.map(p=>p.y)), lo=Math.min(...panel.ring.map(p=>p.y));
      const origin=new THREE.Vector3(x,hi+2,z), target=new THREE.Vector3(x,lo-2,z);
      const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),.001,hi-lo+3.999);
      assert.ok(ray.intersectObjects(fans.membranes.map(m=>m.mesh)).length>0,'former bank gap is opaque');
      assert.equal(partitionBlocksSegment(origin,target,amount,panels),true);
    }
  }
  fans.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('raised split reports upper exposure without claiming automatic complete separation', () => {
  const actual=fitPartitionToViews(layout);
  assert.deepEqual(actual,fit);
  assert.equal(actual.scope,'upper-seated-view-only');
  assert.ok(actual.unshieldable>0);
  assert.ok(actual.crossingSamples>0);
  assert.equal(actual.amount,null);
  assert.equal(actual.projectionMetres,null);
  assert.equal(actual.groups[0].seats,1740);assert.equal(actual.groups[1].seats,2020);
  assert.ok(actual.groups[0].crossingSamples>0);
  assert.equal(actual.groups[0].protectionRequired,false);
  assert.equal(actual.groups[1].protectionRequired,true);
  const lower=resolveSeat(layout,{section:206,row:10});
  assert.ok(evaluatePartitions(lower,0).leakage>0,'do not hide upper video in software');
  const upper=compareWorlds({worldId:'fan-v2',selection:{section:306,row:10},partitionAmount:0});
  assert.equal(upper.partition.leakage,0);
});

test('short rising canopy preserves the original lower screen area', () => {
  const amount=2/PARTITIONS.maximumProjection, targets=bandTargets(SCREEN_BANDS[0]).filter(p=>p.y<=24.4), panels=partitionPanels(amount);
  for(const seat of layout.seats.filter(s=>s.tier<300)) {
    const eye=seatEye(seat);
    for(const target of targets) {
      if(withinDefaultView(seat,target,eye)) assert.equal(partitionBlocksSegment(eye,target,amount,panels),false,seat.id);
    }
  }
});

test('upward slope opens more of the raised lower band to second-floor viewers', () => {
  const amount=40/PARTITIONS.maximumProjection;
  const flat=partitionPanels(amount,0), rising=partitionPanels(amount);
  const targets=bandTargets(SCREEN_BANDS[0]).filter(p=>p.y>24.4);
  let flatBlocked=0, risingBlocked=0;
  for(const seat of layout.seats.filter(s=>s.tier===200)) {
    const eye=seatEye(seat);
    for(const target of targets) if(withinDefaultView(seat,target,eye)) {
      if(partitionBlocksSegment(eye,target,amount,flat))flatBlocked++;
      if(partitionBlocksSegment(eye,target,amount,rising))risingBlocked++;
    }
  }
  assert.ok(flatBlocked>0);
  assert.ok(risingBlocked<flatBlocked/2,'15-degree slope should substantially reduce upper-area obstruction at 40m');
});

test('independent dense screen sampling measures the raised boundary without hiding leakage', () => {
  const targets=Array.from({length:41*33},(_,i)=>bandSurfacePoint(SCREEN_BANDS[0],.001+(i%41)/40*.998,.001+Math.floor(i/41)/32*.998,BUILDING.screen));
  let checked=0, exposed=0;
  for(const seat of layout.seats.filter(s=>s.tier>=300)) {
    const eye=seatEye(seat); checked++;
    for(const p of targets) if(withinDefaultView(seat,p,eye)) exposed++;
  }
  assert.equal(checked,2020);
  assert.ok(exposed>0);
});

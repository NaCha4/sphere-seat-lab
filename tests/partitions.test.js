import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING, makeLayout, resolveSeat } from '../src/layout.js';
import { PARTITIONS, SCREEN_BANDS, bandForTier, bandFrame, bandVideoUV, partitionBlocksSegment } from '../src/partition-layout.js';
import { FanPartitions } from '../src/fan-partitions.js';
import { bandTargets, evaluatePartitions } from '../src/partition-sightline.js';
import { createBandScreenMaterial } from '../src/band-screen.js';
import { compareWorlds } from '../src/comparison.js';

const layout = makeLayout('fan-v2');

test('the third world retains baseline seating and separates all seated eye envelopes with real physical levels', () => {
  assert.deepEqual(layout.seats, makeLayout().seats);
  for (const seat of layout.seats) {
    const band = bandForTier(seat.tier), eye = seat.y + BUILDING.eyeHeight;
    const lower = band.id === 1 ? -Infinity : PARTITIONS.levels[band.id - 2];
    const upper = band.id === 3 ? Infinity : PARTITIONS.levels[band.id - 1];
    assert.ok(eye - .2 > lower + PARTITIONS.thickness, seat.id);
    assert.ok(eye + .2 < upper - PARTITIONS.thickness, seat.id);
    assert.ok(Math.abs(seat.x) < PARTITIONS.halfWidth && seat.z < PARTITIONS.rearZ && seat.z > PARTITIONS.frontZ);
  }
});

test('three non-overlapping screen frames preserve source proportions and sample the same movie coordinates', () => {
  const centers = [];
  for (const band of SCREEN_BANDS) {
    const f = bandFrame(band, BUILDING.screen);
    assert.ok(f.bottom > band.bottom && f.top < band.top);
    assert.equal(f.width / f.height, 2);
    const centerUV = bandVideoUV({ x: 0, y: f.center },band,BUILDING.screen);
    assert.ok(Math.abs(centerUV.u-.5)<1e-10 && Math.abs(centerUV.v-.5)<1e-10);
    const uv = bandVideoUV({ x:-f.width*.25, y:f.center+f.height*.25 },band,BUILDING.screen);
    assert.ok(Math.abs(uv.u-.25)<1e-10 && Math.abs(uv.v-.75)<1e-10);
    for (const p of bandTargets(band)) assert.ok([p.x,p.y,p.z].every(Number.isFinite));
    centers.push(f.center);
  }
  assert.ok(centers[0] < centers[1] && centers[1] < centers[2]);
  const texture = new THREE.Texture(), material = createBandScreenMaterial(texture,true,BUILDING.screen);
  assert.equal(material.uniforms.uMovie.value, texture);
  assert.equal(material.uniforms.uFrames.value.length,3);
  assert.equal(material.uniforms.uReady.value,1);
  material.dispose(); texture.dispose();
});

test('folded, partial and deployed fan membranes remain closed solids with reusable geometry', () => {
  const fans = new FanPartitions(), geometry = fans.membranes[0].mesh.geometry;
  assert.equal(fans.getState().amount,0);
  for (const amount of [0,.3,1]) {
    fans.setAmount(amount);
    for (const {mesh} of fans.membranes) {
      const p = mesh.geometry.attributes.position, idx = mesh.geometry.index.array, edges = new Map();
      let volume = 0;
      for(let i=0;i<idx.length;i+=3){
        const [a,b,c] = [...idx.slice(i,i+3)];
        const x=new THREE.Vector3().fromBufferAttribute(p,a), y=new THREE.Vector3().fromBufferAttribute(p,b), z=new THREE.Vector3().fromBufferAttribute(p,c);
        volume += x.dot(y.clone().cross(z))/6;
        assert.ok(y.sub(x).cross(z.sub(x)).length()>1e-8);
        for(const [u,v] of [[a,b],[b,c],[c,a]]){const key=u<v?`${u}/${v}`:`${v}/${u}`, value=edges.get(key)??[0,0];value[0]++;value[1]+=u<v?1:-1;edges.set(key,value);}
      }
      for(const edge of edges.values()) assert.deepEqual(edge,[2,0]);
      assert.ok(volume>0);
    }
  }
  assert.equal(fans.membranes[0].mesh.geometry,geometry,'animation reuses the GPU geometry');
  fans.setDeployed(false);
  for(let i=0;i<40;i++)fans.update(.05);
  assert.equal(fans.getState().amount,0);assert.equal(fans.getState().moving,false);
  fans.setDeployed(true);
  for(let i=0;i<40;i++)fans.update(.05);
  assert.equal(fans.getState().amount,1);assert.equal(fans.getState().moving,false);
  fans.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('deployed physical meshes block other bands from every section while own-band rays stay clear', () => {
  const fans = new FanPartitions(); fans.setDeployed(true,true); fans.updateMatrixWorld(true);
  const meshes = fans.membranes.map(p=>p.mesh), ray = new THREE.Raycaster();
  for (const section of layout.sections) {
    const rows=[section.range.first,Math.round((section.range.first+section.range.last)/2),section.range.last];
    for(const row of rows){
      const s=resolveSeat(layout,{section:section.id,row}), own=bandForTier(s.tier);
      const origin=new THREE.Vector3(s.x,s.y+BUILDING.eyeHeight,s.z);
      for(const band of SCREEN_BANDS){
        const targets=bandTargets(band);
        for(const target of [targets[0],targets[76],targets.at(-1)]){
          const end=new THREE.Vector3(target.x,target.y,target.z), direction=end.clone().sub(origin);
          ray.set(origin,direction.clone().normalize());ray.near=.001;ray.far=direction.length()-.001;
          const blocked=ray.intersectObjects(meshes).length>0;
          assert.equal(blocked,band.id!==own.id,`${s.id} -> band ${band.id}`);
          assert.equal(blocked,partitionBlocksSegment(origin,end,1));
        }
      }
    }
  }
  for(const tier of [106,206,306,406]){
    const seat=resolveSeat(layout,{section:tier,row:10});
    assert.equal(evaluatePartitions(seat,0).leakage,306);
    const open=evaluatePartitions(seat,1);assert.equal(open.leakage,0);assert.equal(open.ownBlocked,0);
  }
  const result=compareWorlds({worldId:'fan-v2',selection:{section:206,row:10},partitionAmount:1});
  assert.equal(result.partition.leakage,0);
  fans.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

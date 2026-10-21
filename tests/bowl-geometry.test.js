import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING, makeLayout, rowGeometry, rowPoint } from '../src/layout.js';
import { bankBounds, bankBottom, bankPoint, createBankGeometry, createAisleGeometry } from '../src/bowl-geometry.js';

import { WORLDS } from '../src/worlds.js';
import { seatEye } from '../src/seating-pose.js';

for (const world of WORLDS) {
const layout = makeLayout(world.id);
const banks = layout.sections.map(section => ({ section, geometry: createBankGeometry(section) }));
const aisles = [];
for (let i = 1; i < layout.sections.length; i++) {
  const left = layout.sections[i-1], right = layout.sections[i];
  if (left.tier === right.tier) aisles.push({ left, right, geometry: createAisleGeometry(left, right) });
}

test(`${world.id}: every seating bank and stair flight is a consistently oriented, closed solid`, () => {
  assert.equal(banks.length, 39); assert.equal(aisles.length, 35);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const shell of [...banks, ...aisles]) {
    const label = shell.section?.id ?? `${shell.left.id}/${shell.right.id}`;
    const { geometry } = shell, p = geometry.attributes.position, idx = geometry.index.array;
    const edges = new Map(); let volume = 0;
    for (let i = 0; i < p.count; i++) assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite), `${label}: finite vertices`);
    for (let i = 0; i < idx.length; i += 3) {
      const [u,v,w] = idx.slice(i,i+3);
      a.fromBufferAttribute(p,u); b.fromBufferAttribute(p,v); c.fromBufferAttribute(p,w);
      volume += a.dot(b.clone().cross(c)) / 6;
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length() > 1e-8, `${label}: no collapsed faces`);
      for (const [x,y] of [[u,v],[v,w],[w,u]]) {
        const key = x < y ? `${x}/${y}` : `${y}/${x}`, edge = edges.get(key) ?? [0,0];
        edge[0]++; edge[1] += x < y ? 1 : -1; edges.set(key,edge);
      }
    }
    for (const [edge, [uses,direction]] of edges) {
      assert.equal(uses,2,`${label}: open/non-manifold edge ${edge}`);
      assert.equal(direction,0,`${label}: reversed face at ${edge}`);
    }
    assert.ok(volume > 0, `${label}: faces point outwards`);
  }
});

test(`${world.id}: row ends, row centres, side walls and back walls all meet the seating bank`, () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
  for (const { section: s, geometry } of banks) {
    const mesh = new THREE.Mesh(geometry,material); mesh.updateMatrixWorld(true);
    for (const seats of s.rows.values()) {
      for (const seat of [seats[0],seats[Math.floor(seats.length/2)],seats.at(-1)]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(seat.x,seat.y+.1,seat.z),new THREE.Vector3(0,-1,0),0,.2);
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit && Math.abs(hit.distance-.1)<.002, `unsupported chair ${seat.id}`);
      }
    }
    for (const row of [s.range.first+.25,(s.range.first+s.range.last)/2+.13,s.range.last-.25]) {
      const bounds = bankBounds(s,row), left = rowPoint(s.tier,row,bounds.start), right = rowPoint(s.tier,row,bounds.end);
      const y = (rowGeometry(s.tier,Math.round(row)).floorY + bankBottom(s,row)) / 2;
      for (const [p,q] of [[left,right],[right,left]]) {
        const outward = new THREE.Vector3(p.x-q.x,0,p.z-q.z).normalize();
        const origin = new THREE.Vector3(p.x,y,p.z).addScaledVector(outward,2);
        const hit = new THREE.Raycaster(origin,outward.negate(),0,2.3).intersectObject(mesh)[0];
        assert.ok(hit, `${s.id}: open side at row ${row}`);
      }
    }
    const row = s.range.last+.5, b = bankBounds(s,row);
    const p = rowPoint(s.tier,row,(b.start+b.end)/2), q = rowPoint(s.tier,row-1,(b.start+b.end)/2);
    const outward = new THREE.Vector3(p.x-q.x,0,p.z-q.z).normalize();
    const y = (rowGeometry(s.tier,s.range.last).floorY + bankBottom(s,row))/2;
    const origin = new THREE.Vector3(p.x,y,p.z).addScaledVector(outward,2);
    assert.ok(new THREE.Raycaster(origin,outward.negate(),0,2.3).intersectObject(mesh).length,`${s.id}: open back wall`);
  }
  material.dispose();
});

test(`${world.id}: all inter-section stair flights have walkable top faces`, () => {
  const material = new THREE.MeshBasicMaterial();
  for (const { left, right, geometry } of aisles) {
    const mesh = new THREE.Mesh(geometry,material); mesh.updateMatrixWorld(true);
    const rings = geometry.userData.rings, stepCount = (rings.length-1)/3;
    for (const i of [0,Math.floor(stepCount/2),stepCount-1]) {
      const row = (rings[2*i].row+rings[2*i+1].row)/2;
      const a = bankBounds(left,row).end, b = bankBounds(right,row).start;
      const pa = bankPoint(left,row,1), pb = bankPoint(right,row,0);
      const p = { x:(pa.x+pb.x)/2, z:(pa.z+pb.z)/2 }, y = rings[2*i].y;
      assert.ok(b>a,`${left.id}/${right.id}: stair width`);
      const hit = new THREE.Raycaster(new THREE.Vector3(p.x,y+.1,p.z),new THREE.Vector3(0,-1,0),0,.2).intersectObject(mesh)[0];
      assert.ok(hit && Math.abs(hit.distance-.1)<.01,`${left.id}/${right.id}: missing stair tread ${i}`);
    }
  }
  material.dispose();
});

test(`${world.id}: no selectable seat places the eyes or top of the head inside another seating bank`, () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = banks.map(bank => {
    bank.geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(bank.geometry,material); mesh.updateMatrixWorld(true);
    return { ...bank, mesh };
  });
  const point = new THREE.Vector3(), ray = new THREE.Raycaster();
  ray.ray.direction.set(0,1,0);
  for (const seat of layout.seats) for (const height of [BUILDING.eyeHeight,BUILDING.eyeHeight+.2]) {
    const eye=seatEye(seat,height);point.set(eye.x,eye.y,eye.z);
    for (const bank of meshes) {
      if (bank.section.id === seat.section || !bank.geometry.boundingBox.containsPoint(point)) continue;
      ray.ray.origin.copy(point);
      const hit = ray.intersectObject(bank.mesh)[0];
      assert.ok(!hit || hit.face.normal.y < 0,`${seat.id}: viewer inside ${bank.section.id}`);
    }
  }
  material.dispose();
});

}

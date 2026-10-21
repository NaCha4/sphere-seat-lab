import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeLayout, resolveSeat } from '../src/layout.js';
import { WORLDS } from '../src/worlds.js';
import { SeatMapNavigator, XrSeatMap } from '../src/xr-seat-map.js';
import { pickTarget, seatedVrTransform } from '../src/interaction.js';
import { seatEye } from '../src/seating-pose.js';

const uvAt=r=>new THREE.Vector2((r.bounds.x+r.bounds.width/2)/1536,1-(r.bounds.y+r.bounds.height/2)/1200);
const createCanvas=()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});

test('VR section overview reaches every section and paginated map reaches every real seat in all worlds',()=>{
  for(const world of WORLDS) {
    const layout=makeLayout(world.id),nav=new SeatMapNavigator(layout,resolveSeat(layout,{}));
    const sections=nav.regions().filter(r=>r.kind==='section');
    assert.equal(sections.length,layout.sections.length);
    for(const r of sections) assert.equal(nav.hitUV(new THREE.Vector2(r.center.x/1536,1-r.center.y/1200)).id,r.id);
    const visited=new Set();
    for(const section of layout.sections) {
      nav.openSection(section.id,false);
      const pages=nav.pages;
      for(let row=0;row<pages.rows;row++) for(let col=0;col<pages.seats;col++) {
        nav.rowPage=row; nav.seatPage=col;
        for(const r of nav.regions().filter(r=>r.kind==='seat')) {
          assert.equal(nav.hitUV(uvAt(r)).seat,r.seat);
          assert.ok(layout.byId.has(r.seat.id));
          assert.ok(!visited.has(r.seat.id),'every seat appears on exactly one page');
          visited.add(r.seat.id);
        }
      }
    }
    assert.equal(visited.size,layout.seats.length);
  }
});

test('VR map focuses the current seat, bounds page navigation and discards old world seats',()=>{
  const original=makeLayout('original'),current=original.seats.at(-1),nav=new SeatMapNavigator(original,current);
  nav.openSection(current.section);
  assert.ok(nav.regions().some(r=>r.seat===current && r.selected));
  nav.activate(nav.regions().find(r=>r.id==='rows-next'));
  assert.ok(nav.rowPage<nav.pages.rows);
  assert.equal(nav.hitUV({x:-.1,y:.5}),null);
  const next=makeLayout('fan-v2'),seat=resolveSeat(next,{section:306});
  nav.update(next,seat);
  assert.equal(nav.mode,'overview');assert.equal(nav.sectionId,306);
  nav.openSection(306);
  assert.ok(nav.regions().filter(r=>r.seat).every(r=>next.byId.get(r.seat.id)===r.seat));
});

test('VR map ray picks a section then a real seat; blank map space blocks chairs and hover does not upload textures',()=>{
  const layout=makeLayout('fan-v2'),current=resolveSeat(layout,{});let selected=null,closed=false;
  const map=new XrSeatMap({layout,seat:current,onSelectSeat:seat=>{selected=seat;map.update(layout,seat);},onClose:()=>{closed=true;map.visible=false;},createCanvas});
  const chair=new THREE.InstancedMesh(new THREE.BoxGeometry(5,5,1),new THREE.MeshBasicMaterial(),1);
  chair.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,-2));chair.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const aim=uv=>{
    ray.set(new THREE.Vector3((uv.x-.5)*1.36,(uv.y-.5)*1.0625-.42,1),new THREE.Vector3(0,0,-1));
    map.updateMatrixWorld(true);
    return pickTarget(ray,map.pickables,[chair],[current]);
  };
  map.open();
  const section=map.navigator.regions().find(r=>r.id==='section-210');
  const target=aim({x:section.center.x/1536,y:1-section.center.y/1200});
  assert.equal(target.type,'map');assert.equal(selected,null);
  target.action();assert.equal(map.navigator.sectionId,210);
  const seatRegion=map.navigator.regions().find(r=>r.kind==='seat'),version=map.texture.version;
  map.setHover(seatRegion);map.setHover(null);assert.equal(map.texture.version,version);
  const seatTarget=aim(uvAt(seatRegion));assert.equal(seatTarget.seat,seatRegion.seat);assert.equal(selected,null);
  seatTarget.action();assert.equal(selected,seatRegion.seat);
  assert.equal(aim({x:.02,y:.8}).type,'panel','blank panel must consume the ray');
  aim(uvAt(map.navigator.regions().find(r=>r.id==='close'))).action();assert.equal(closed,true);
  assert.equal(aim({x:.5,y:.5}).type,'seat','hidden map must release the ray');
  map.dispose();chair.geometry.dispose();chair.material.dispose();chair.dispose();
});

test('view reset restores the selected chair eye and forward direction from translated and rotated tracking poses',()=>{
  const layout=makeLayout('fan-v2');
  for(const section of [106,210,306,406]) {
    const seat=resolveSeat(layout,{section}),before=JSON.stringify(seat),eye=seatEye(seat);
    for(const headYaw of [-2.3,0,1.6]) {
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.35,headYaw,.1,'YXZ'));
      const pose={transform:{position:{x:.8,y:1.55,z:-.6},orientation:q}};
      const reset=seatedVrTransform(seat,pose),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),reset.yaw);
      const head=new THREE.Vector3(.8,1.55,-.6).applyQuaternion(rotation).add(reset.position);
      assert.ok(head.distanceTo(new THREE.Vector3(eye.x,eye.y,eye.z))<1e-10);
      const direction=new THREE.Vector3(0,0,-1).applyQuaternion(q).applyQuaternion(rotation);direction.y=0;direction.normalize();
      const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),seat.yaw);
      assert.ok(direction.distanceTo(forward)<1e-10);
      assert.equal(JSON.stringify(seat),before,'reset never changes the chair transform');
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING, makeLayout, resolveSeat, rowPoint } from '../src/layout.js';
import { WORLDS, getWorld, warpPlan } from '../src/worlds.js';
import { HEAD, audienceHead } from '../src/audience-shape.js';
import { evaluateSeat, headBlocksSegment, SCREEN_SAMPLES } from '../src/sightline.js';
import { compareWorlds } from '../src/comparison.js';
import { RECLINER, seatEye } from '../src/seating-pose.js';

test('recliner world reduces seating and provides wide chairs on deep continuous curved terraces', () => {
  const original = makeLayout(), variant = makeLayout('curvature-v1');
  assert.equal(getWorld('unknown').id, 'original');
  assert.equal(new Set(WORLDS.map(w => w.id)).size, WORLDS.length);
  assert.ok(variant.seats.length < original.seats.length*.5);
  assert.ok(variant.seats.length > 4000, 'recover capacity without shrinking the recliners');
  assert.equal(variant.sections.length,original.sections.length);
  assert.deepEqual(makeLayout().seats, original.seats, 'variant generation must not mutate baseline');
  for (const section of original.sections) {
    const changed = variant.bySection.get(section.id);
    for (const row of [changed.range.first, changed.range.last]) {
      for (const parameter of [section.start, section.center, section.end]) {
        assert.deepEqual(rowPoint(changed.tier, row, parameter), warpPlan(rowPoint(section.tier, row, parameter), variant.world.geometry));
      }
    }
  }
  for (const s of variant.seats) {
    const baseline = original.bySection.get(s.section).rows.get(s.row)[0];
    assert.equal(s.y, baseline.y, 'retain the reference riser heights');
    assert.ok(Math.hypot(s.x, s.y - BUILDING.centerY, s.z) < BUILDING.diameter / 2, s.id);
    assert.ok(Math.abs(s.x) < 65.8 && s.z < 64.8, 'chairs stay inside fixed enclosure');
    assert.equal(s.recliner,true);assert.equal(s.width,RECLINER.width);
    assert.ok(s.pitch>=RECLINER.pitch-1e-9);
    assert.ok(Math.abs(evaluateSeat(variant,s,{audience:false,targets:[]}).turnDegrees)<.01);
    const eye=seatEye(s);assert.ok(eye.y<s.y+BUILDING.eyeHeight,'reclined viewpoint is lower');
  }
  for (const section of variant.sections) for (const seats of section.rows.values()) {
    for (let i = 1; i < seats.length; i++) assert.ok(Math.hypot(seats[i].x-seats[i-1].x,seats[i].z-seats[i-1].z) > 1, seats[i].id);
  }
  for(const section of variant.sections){
    const rows=[...section.rows.keys()];
    for(let i=1;i<rows.length;i++)assert.ok(rows[i]-rows[i-1]>=2);
  }
});

for (const worldId of ['curvature-v1','fan-v2']) test(`${worldId}: recliners retain clearance around fully extended chairs`, () => {
  const seats = makeLayout(worldId).seats;
  // A conservative 0.90 x 1.56 m footprint encloses the rendered armrests,
  // reclined back/headrest and fully extended footrest.
  const corner = (s,x,z) => ({ x:s.x+x*Math.cos(s.yaw)+z*Math.sin(s.yaw), z:s.z-x*Math.sin(s.yaw)+z*Math.cos(s.yaw) });
  const outlines = seats.map(s => {
    const rear = s.backAngle>Math.PI/4 ? .93 : .63;
    return [corner(s,-.45,-.93),corner(s,.45,-.93),corner(s,.45,rear),corner(s,-.45,rear)];
  });
  const overlaps = (a,b) => {
    for (const p of [a,b]) for (let edge=0;edge<2;edge++) {
      const q=p[edge+1],r=p[edge],ax=-(q.z-r.z),az=q.x-r.x;
      const first=a.map(v=>v.x*ax+v.z*az),second=b.map(v=>v.x*ax+v.z*az);
      if(Math.max(...first)<=Math.min(...second)+.001||Math.max(...second)<=Math.min(...first)+.001)return false;
    }
    return true;
  };
  for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++) {
    const a=seats[i],b=seats[j];
    if(Math.abs(a.y-b.y)>.01||Math.hypot(a.x-b.x,a.z-b.z)>2.2)continue;
    assert.equal(overlaps(outlines[i],outlines[j]),false,`${a.id} overlaps ${b.id}`);
  }
});

test('head-only comparison excludes self, respects empty seats and clips intersections to the sightline segment', () => {
  const viewer = { id:'viewer', section:206, row:10, number:1, x:0,y:0,z:0,yaw:0 };
  const person = { ...viewer, id:'other', number:2, z:-1 };
  const target = { x:0,y:BUILDING.eyeHeight,z:-3 }, head = audienceHead(person);
  assert.equal(head.rx, HEAD.x);
  assert.equal(headBlocksSegment({x:0,y:BUILDING.eyeHeight,z:0},target,head), true);
  assert.equal(headBlocksSegment({x:0,y:BUILDING.eyeHeight,z:0},{...target,z:-.2},head), false);
  const layout = { world:{id:'test'}, seats:[viewer,person] };
  assert.equal(evaluateSeat(layout,viewer,{targets:[target]}).blocked,1);
  assert.equal(evaluateSeat(layout,viewer,{targets:[target],audience:false}).blocked,0);
  assert.equal(evaluateSeat({...layout,seats:[viewer]},viewer,{targets:[target]}).blocked,0);
  for (const p of SCREEN_SAMPLES) assert.ok(p.y > 0 && p.z < 0);
});

test('209/210 comparison uses corresponding positions when the recliner layout has fewer seats', () => {
  for (const section of [209,210]) {
    const selection = {section,row:10}, result = compareWorlds({worldId:'curvature-v1',selection,audience:true});
    assert.equal(result.original.section,result.variant.section);
    assert.ok(result.variant.seatCount<result.original.seatCount);
    assert.equal(result.original.samples,result.variant.samples);
    assert.ok(result.variant.turnDegrees < result.original.turnDegrees - 10);
    assert.ok(result.original.blocked>=0 && result.variant.blocked>=0);
    const empty = compareWorlds({worldId:'curvature-v1',selection,audience:false});
    assert.equal(empty.original.blocked,0); assert.equal(empty.variant.blocked,0);
  }
  const layout = makeLayout('curvature-v1'), seat = resolveSeat(layout,{section:210,row:10});
  assert.equal(evaluateSeat(layout,seat).seatId, seat.id);
});

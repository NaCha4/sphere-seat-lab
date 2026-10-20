import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING, makeLayout, resolveSeat, rowPoint } from '../src/layout.js';
import { WORLDS, getWorld, warpPlan } from '../src/worlds.js';
import { HEAD, audienceHead } from '../src/audience-shape.js';
import { evaluateSeat, headBlocksSegment, SCREEN_SAMPLES } from '../src/sightline.js';
import { compareWorlds } from '../src/comparison.js';

test('world registry preserves every seat identity and baseline while all four floors share the variant transform', () => {
  const original = makeLayout(), variant = makeLayout('curvature-v1');
  assert.equal(getWorld('unknown').id, 'original');
  assert.equal(new Set(WORLDS.map(w => w.id)).size, WORLDS.length);
  assert.deepEqual(variant.seats.map(s => s.id), original.seats.map(s => s.id));
  assert.deepEqual(makeLayout().seats, original.seats, 'variant generation must not mutate baseline');
  for (const section of original.sections) {
    const changed = variant.bySection.get(section.id);
    for (const row of [section.range.first, section.range.last]) {
      for (const parameter of [section.start, section.center, section.end]) {
        assert.deepEqual(rowPoint(changed.tier, row, parameter), warpPlan(rowPoint(section.tier, row, parameter), variant.world.geometry));
      }
    }
  }
  for (const s of variant.seats) {
    const baseline = original.byId.get(s.id);
    assert.equal(s.y, baseline.y, 'same eye and riser heights');
    assert.ok(Math.hypot(s.x, s.y - BUILDING.centerY, s.z) < BUILDING.diameter / 2, s.id);
    assert.ok(Math.abs(s.x) < 65.8 && s.z < 64.8, 'chairs stay inside fixed enclosure');
  }
  for (const section of variant.sections) for (const seats of section.rows.values()) {
    for (let i = 1; i < seats.length; i++) assert.ok(Math.hypot(seats[i].x-seats[i-1].x,seats[i].z-seats[i-1].z) > .5, seats[i].id);
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

test('209/210 comparison retains the same seat and reports head interference independently from orientation', () => {
  for (const section of [209,210]) {
    const selection = {section,row:10}, result = compareWorlds({worldId:'curvature-v1',selection,audience:true});
    assert.equal(result.original.seatId,result.variant.seatId);
    assert.equal(result.original.samples,result.variant.samples);
    assert.ok(result.variant.turnDegrees < result.original.turnDegrees - 10);
    assert.ok(result.original.blocked > 0 && result.variant.blocked > 0);
    const empty = compareWorlds({worldId:'curvature-v1',selection,audience:false});
    assert.equal(empty.original.blocked,0); assert.equal(empty.variant.blocked,0);
  }
  const layout = makeLayout('curvature-v1'), seat = resolveSeat(layout,{section:210,row:10});
  assert.equal(evaluateSeat(layout,seat).seatId, '210-10-10');
});

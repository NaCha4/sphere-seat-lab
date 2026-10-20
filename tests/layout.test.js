import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING, TIERS, PRESETS, INVENTORY_TOTAL, SEAT_INVENTORY, makeLayout, resolveSeat, seatMetrics } from '../src/layout.js';

const layout = makeLayout();

test('the baseline has the documented 39 sections, including seven upper sections', () => {
  assert.equal(layout.sections.length, 39);
  assert.deepEqual(layout.sections.filter(s => s.tier.id === 400).map(s => s.id), [403, 404, 405, 406, 407, 408, 409]);
  assert.equal(layout.bySection.has(401), false);
  assert.equal(layout.bySection.has(111), false);
});

test('every selectable chair has a unique finite location and stays within the exterior envelope', () => {
  assert.equal(layout.byId.size, layout.seats.length);
  assert.ok(layout.seats.length > 10000 && layout.seats.length < 30000);
  const radius = BUILDING.diameter / 2;
  for (const seat of layout.seats) {
    assert.ok([seat.x, seat.y, seat.z, seat.yaw].every(Number.isFinite), seat.id);
    assert.ok(Math.hypot(seat.x, seat.y - BUILDING.centerY, seat.z) < radius, `chair outside exterior: ${seat.id}`);
    assert.equal(layout.bySection.get(seat.section).rows.get(seat.row)[seat.number - 1], seat);
  }
});

test('all quick viewpoints resolve to their requested section and row', () => {
  for (const preset of PRESETS) {
    const seat = resolveSeat(layout, preset);
    assert.equal(seat.section, preset.section);
    assert.equal(seat.row, preset.row);
    const metrics = seatMetrics(seat);
    assert.ok(metrics.distance > 0 && metrics.elevation > 0);
  }
});

test('invalid shared-link coordinates clamp safely to a real chair', () => {
  for (const input of [{ section: 'garbage', row: -12, number: -500 }, { section: 406, row: 999, number: Infinity }, { section: 301, row: 20, number: 999 }]) {
    const seat = resolveSeat(layout, input);
    assert.ok(layout.byId.has(seat.id));
  }
});

test('published numeric row inventories replace uniform tier ranges', () => {
  assert.equal(layout.seats.length, 13830);
  assert.equal(INVENTORY_TOTAL, 13830);
  assert.deepEqual([...layout.bySection.get(206).rows.keys()], [7,8,9,10,11,12,13,14,15,16]);
  assert.equal(layout.bySection.get(206).rows.get(7).length, 14);
  assert.equal(layout.bySection.get(206).rows.get(16).length, 16);
  assert.equal(layout.bySection.get(406).rows.has(1), false);
  assert.equal(layout.bySection.get(406).rows.get(23).length, 30);
  assert.equal(layout.bySection.get(301).rows.get(10).length, 2);
  assert.equal(layout.bySection.get(106).rows.has(1), false);
  assert.equal(layout.accessibleInventory.reduce((sum, r) => sum + r.count, 0), 178);
  for (const group of layout.sections) {
    for (const [row, seats] of group.rows) assert.equal(seats.length, SEAT_INVENTORY[group.id][row]);
  }
});

test('estimated rows have usable chair spacing and tier-specific centres', () => {
  assert.equal(new Set(TIERS.map(t => t.centerZ)).size, 4);
  for (const group of layout.sections) for (const list of group.rows.values()) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i-1], b = list[i];
      assert.ok(Math.hypot(a.x-b.x, a.z-b.z) > .50, `overlapping chairs ${a.id}`);
    }
  }
});

test('rows ascend, upper side sections taper, and center chair has the smallest yaw mismatch', () => {
  for (const section of layout.sections) {
    let previousY = -Infinity;
    for (const seats of section.rows.values()) { assert.ok(seats[0].y > previousY); previousY = seats[0].y; }
  }
  assert.ok(layout.bySection.get(403).rows.size < layout.bySection.get(406).rows.size);
  assert.ok(layout.bySection.get(301).rows.size < layout.bySection.get(306).rows.size);
  assert.ok(Math.abs(seatMetrics(resolveSeat(layout, { section: 206 })).yawDifference) < Math.abs(seatMetrics(resolveSeat(layout, { section: 210 })).yawDifference));
  assert.ok(Math.abs(BUILDING.screen.centerY + BUILDING.screen.radius - BUILDING.screenApex) < .0001);
  assert.equal(TIERS.length, 4);
});

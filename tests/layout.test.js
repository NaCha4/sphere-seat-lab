import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING, TIERS, PRESETS, makeLayout, resolveSeat, seatMetrics } from '../src/layout.js';

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
    assert.ok(Math.hypot(seat.x, seat.y - BUILDING.centerY, seat.z + 13) < radius, `chair outside exterior: ${seat.id}`);
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

test('adding retractable front rows preserves fixed-chair identity and coordinates', () => {
  const cinema = makeLayout({ cinema: true });
  assert.ok(cinema.seats.length > layout.seats.length);
  assert.ok(cinema.bySection.get(106).rows.has(1));
  assert.equal(layout.bySection.get(106).rows.has(1), false);
  for (const seat of layout.seats) {
    const same = cinema.byId.get(seat.id);
    assert.equal(seat.x, same.x); assert.equal(seat.y, same.y); assert.equal(seat.z, same.z);
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
  assert.equal(BUILDING.screen.centerY + BUILDING.screen.y, BUILDING.screenApex);
  assert.equal(TIERS.length, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_PLAN, LOWER_CONTOUR, LOWER_TREAD, pixelToPlan } from '../src/production-plan.js';
import { BUILDING, TIERS, makeLayout, rowPoint } from '../src/layout.js';

test('the 2023 production plan uses a uniform metric scale and traced faceted lower contour', () => {
  const [a, b] = PRODUCTION_PLAN.stageWidthAnchorsPx.map(pixelToPlan);
  assert.ok(Math.abs(b.x - a.x - 14.127) < 1e-8, 'the drawn stage width is 14,127 mm');
  assert.ok(Math.abs(LOWER_TREAD - .87330545) < 1e-7, '18 visible tread intervals calibrate to about 873 mm');
  assert.equal(LOWER_CONTOUR.length, 17);
  for (let i = 0; i < LOWER_CONTOUR.length; i++) {
    const p = LOWER_CONTOUR[i], q = LOWER_CONTOUR.at(-1-i);
    assert.ok(Math.abs(p.x + q.x) < 1e-10 && Math.abs(p.z - q.z) < 1e-10);
  }
  const tier = TIERS[0], edge = rowPoint(tier, 11.5, .5), rear = rowPoint(tier, 37, .5);
  assert.ok(edge.z > -27 && edge.z < -26, 'front edge matches the calibrated plan datum');
  assert.ok(rear.z > -5 && rear.z < -3, 'hidden rear rows are extended behind the traced front');
  assert.equal(BUILDING.stage.width, 14.127);
});

test('lower chairs remain separated across inferred section boundaries as inventories grow', () => {
  const layout = makeLayout();
  for (let row = 12; row <= 37; row++) {
    const seats = layout.seats.filter(s => s.tier === 100 && s.row === row);
    for (let i = 1; i < seats.length; i++) {
      const a = seats[i-1], b = seats[i];
      assert.ok(Math.hypot(a.x-b.x,a.z-b.z) > .50, `${a.id} / ${b.id}`);
    }
  }
});

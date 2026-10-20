import { BUILDING, radians, seatMetrics } from './layout.js';
import { audienceHead } from './audience-shape.js';

// Identical world-space targets for every variant. These are samples on the
// front LED, not pixels and not an area/visibility percentage of the full dome.
export const SCREEN_SAMPLES = Object.freeze(Array.from({ length: 51 * 29 }, (_, i) => {
  const az = radians(-75 + (i % 51) * 3), el = radians(-12 + Math.floor(i / 51) * 3);
  const c = BUILDING.screen;
  return Object.freeze({ x: c.radius * Math.cos(el) * Math.sin(az), y: c.centerY + c.radius * Math.sin(el), z: c.centerZ - c.radius * Math.cos(el) * Math.cos(az) });
}).filter(p => p.y > 0 && Math.cos(radians(BUILDING.screen.tiltDegrees)) * (p.y - BUILDING.screen.centerY) - Math.sin(radians(BUILDING.screen.tiltDegrees)) * (p.z - BUILDING.screen.centerZ) > BUILDING.screen.clipOffset + .4));

// Open segment/ellipsoid intersection in head-local coordinates. An ellipsoid
// approximates the rendered low-poly head conservatively; bodies/rails/slabs
// are deliberately excluded from this head-only metric.
export function headBlocksSegment(origin, target, head) {
  const ox = origin.x - head.x, oy = origin.y - head.y, oz = origin.z - head.z;
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const x = (head.cos * ox - head.sin * oz) / head.rx, y = oy / head.ry, z = (head.sin * ox + head.cos * oz) / head.rz;
  const u = (head.cos * dx - head.sin * dz) / head.rx, v = dy / head.ry, w = (head.sin * dx + head.cos * dz) / head.rz;
  const a = u * u + v * v + w * w, b = x * u + y * v + z * w, c = x * x + y * y + z * z - 1;
  const disc = b * b - a * c;
  if (disc < 0 || a === 0) return false;
  const root = Math.sqrt(disc), entry = (-b - root) / a, exit = (-b + root) / a;
  return exit > 1e-6 && entry < 1 - 1e-6;
}

export function evaluateSeat(layout, seat, { audience = true, targets = SCREEN_SAMPLES } = {}) {
  const eye = { x: seat.x, y: seat.y + BUILDING.eyeHeight, z: seat.z };
  const people = audience ? layout.seats.filter(s => s.id !== seat.id).map(audienceHead) : [];
  let blocked = 0;
  for (const target of targets) {
    const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    for (const head of people) {
      const hx = head.x - eye.x, hy = head.y - eye.y, hz = head.z - eye.z;
      const t = (hx * dx + hy * dy + hz * dz) / distanceSquared;
      if (t < 0 || t > 1) continue;
      // Broad phase avoids almost all square roots/ellipsoid transforms.
      if ((hx - t * dx) ** 2 + (hy - t * dy) ** 2 + (hz - t * dz) ** 2 > .16 ** 2) continue;
      if (headBlocksSegment(eye, target, head)) { blocked++; break; }
    }
  }
  return {
    seatId: seat.id, world: layout.world.id,
    turnDegrees: Math.abs(seatMetrics(seat).yawDifference * 180 / Math.PI),
    blocked, samples: targets.length, blockedPercent: targets.length ? blocked / targets.length * 100 : 0,
  };
}

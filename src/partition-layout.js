// Concept dimensions, not structural/mechanism specifications. The two
// boundaries sit between the seated-eye envelopes of the baseline groups.
export const PARTITIONS = Object.freeze({
  levels: Object.freeze([11, 24.4]), thickness: .05,
  halfWidth: 65.7, rearZ: 64.7, frontZ: -61,
  duration: 1.8, blades: 40,
});

export const SCREEN_BANDS = Object.freeze([
  Object.freeze({ id: 1, label: '1층 · 100번대', tiers: [100], bottom: 0, top: 11, color: '#9dcce5' }),
  Object.freeze({ id: 2, label: '2층 · 200번대', tiers: [200], bottom: 11, top: 24.4, color: '#b9d8a1' }),
  Object.freeze({ id: 3, label: '3층 그룹 · 300·400번대', tiers: [300, 400], bottom: 24.4, top: 73.152, color: '#d5b5e2' }),
]);

export const bandForTier = tier => SCREEN_BANDS.find(b => b.tiers.includes(tier));

const corner = Math.atan(PARTITIONS.halfWidth / (PARTITIONS.rearZ - PARTITIONS.frontZ));
const angles = [...Array.from({ length: PARTITIONS.blades + 1 }, (_, i) => -Math.PI / 2 + Math.PI * i / PARTITIONS.blades), -corner, corner].sort((a, b) => a - b);

// Shared by rendered geometry and ray auditing. Folded leaves retract into a
// rear cassette. Extension and rotation are a schematic deployment animation;
// they do not assert that a real 100m-scale fan mechanism is feasible.
export function fanRing(amount, level = PARTITIONS.levels[0]) {
  const open = Math.max(0, Math.min(1, amount));
  return angles.map(fullAngle => {
    const outerRadius = Math.sqrt((BUILDING.diameter / 2 - .1) ** 2 - (level - BUILDING.centerY) ** 2);
    const circleRadius = PARTITIONS.rearZ * Math.cos(fullAngle)
      + Math.sqrt(outerRadius ** 2 - (PARTITIONS.rearZ * Math.sin(fullAngle)) ** 2);
    const fullRadius = Math.min(
      Math.abs(Math.sin(fullAngle)) < 1e-9 ? Infinity : PARTITIONS.halfWidth / Math.abs(Math.sin(fullAngle)),
      Math.cos(fullAngle) < 1e-9 ? Infinity : (PARTITIONS.rearZ - PARTITIONS.frontZ) / Math.cos(fullAngle),
      circleRadius,
    );
    const angle = Math.PI / 2 + (fullAngle - Math.PI / 2) * (.008 + .992 * open);
    const radius = 1.4 * (1 - open) + fullRadius * open;
    return { x: Math.sin(angle) * radius, z: PARTITIONS.rearZ - Math.cos(angle) * radius };
  });
}

export const fanRings = amount => PARTITIONS.levels.map(level => fanRing(amount, level));

function inTriangleXZ(p, a, b, c) {
  const sign = (u, v, w) => (u.x - w.x) * (v.z - w.z) - (v.x - w.x) * (u.z - w.z);
  const x = sign(p, a, b), y = sign(p, b, c), z = sign(p, c, a);
  return !((x < -1e-7 || y < -1e-7 || z < -1e-7) && (x > 1e-7 || y > 1e-7 || z > 1e-7));
}

export function partitionBlocksSegment(origin, target, amount = 1, rings = fanRings(amount)) {
  const dy = target.y - origin.y;
  if (Math.abs(dy) < 1e-9) return false;
  for (const [index, y] of PARTITIONS.levels.entries()) {
    const ring = rings[index];
    const t = (y - origin.y) / dy;
    if (t <= 0 || t >= 1) continue;
    const p = { x: origin.x + (target.x - origin.x) * t, z: origin.z + (target.z - origin.z) * t };
    for (let i = 1; i < ring.length; i++) {
      if (inTriangleXZ(p, { x: 0, z: PARTITIONS.rearZ }, ring[i - 1], ring[i])) return true;
    }
  }
  return false;
}

// The screen's clipped spherical surface has a different horizontal extent at
// each height. Unwrap each horizontal arc fully, including the side returns.
export function bandHalfAngle(y, screen) {
  const dy = y - screen.centerY;
  const radius = Math.sqrt(Math.max(1e-8, screen.radius ** 2 - dy ** 2));
  const tilt = screen.tiltDegrees * Math.PI / 180;
  const limit = (screen.clipOffset - Math.cos(tilt) * dy) / (Math.sin(tilt) * radius);
  return Math.acos(Math.max(-1, Math.min(1, limit)));
}

// Aspect is measured along the horizontal arc at the band's middle height.
// It is a video-production reference, not a flat projection onto the dome.
export function bandFrame(band, screen) {
  const center = (band.bottom + band.top) / 2;
  const radius = Math.sqrt(Math.max(0, screen.radius ** 2 - (center - screen.centerY) ** 2));
  return { center, height: band.top - band.bottom, width: 2 * radius * bandHalfAngle(center, screen), bottom: band.bottom, top: band.top };
}

export function bandVideoUV(point, band, screen) {
  const angle = Math.atan2(point.x, -(point.z - screen.centerZ));
  const halfAngle = Math.max(1e-5, bandHalfAngle(point.y, screen));
  return {
    u: Math.max(0, Math.min(1, .5 + angle / (2 * halfAngle))),
    v: Math.max(0, Math.min(1, (point.y - band.bottom) / (band.top - band.bottom))),
  };
}

export function bandSurfacePoint(band, u, v, screen) {
  const y = band.bottom + v * (band.top - band.bottom);
  const radius = Math.sqrt(Math.max(0, screen.radius ** 2 - (y - screen.centerY) ** 2));
  const angle = (2 * u - 1) * bandHalfAngle(y, screen);
  return { x: radius * Math.sin(angle), y, z: screen.centerZ - radius * Math.cos(angle) };
}
import { BUILDING } from './layout.js';


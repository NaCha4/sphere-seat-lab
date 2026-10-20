// Concept dimensions, not structural/mechanism specifications. The two
// boundaries sit between the seated-eye envelopes of the baseline groups.
export const PARTITIONS = Object.freeze({
  levels: Object.freeze([11, 24.4]), thickness: .05,
  halfWidth: 65.7, rearZ: 64.7, frontZ: -61,
  duration: 1.8, blades: 40,
});

export const SCREEN_BANDS = Object.freeze([
  Object.freeze({ id: 1, label: '1층 · 100번대', tiers: [100], bottom: 0, top: 10.8, color: '#9dcce5' }),
  Object.freeze({ id: 2, label: '2층 · 200번대', tiers: [200], bottom: 11.2, top: 24.2, color: '#b9d8a1' }),
  Object.freeze({ id: 3, label: '3층 그룹 · 300·400번대', tiers: [300, 400], bottom: 24.6, top: 73.152, color: '#d5b5e2' }),
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

// Fit the whole 2:1 movie inside a front projection rectangle on each band.
// Black margins preserve proportions; stretching to fill each unequal band
// would disguise one of this proposal's central trade-offs.
export function bandFrame(band, screen) {
  const center = (band.bottom + band.top) / 2;
  let lo = 0, hi = (band.top - band.bottom) * .94;
  for (let i = 0; i < 40; i++) {
    const height = (lo + hi) / 2;
    const dy = Math.max(Math.abs(center - height / 2 - screen.centerY), Math.abs(center + height / 2 - screen.centerY));
    if (height * height + dy * dy <= screen.radius ** 2 * .98) lo = height; else hi = height;
  }
  return { center, height: lo, width: lo * 2, bottom: center - lo / 2, top: center + lo / 2 };
}

export function bandVideoUV(point, band, screen) {
  const frame = bandFrame(band, screen);
  return { u: point.x / frame.width + .5, v: (point.y - frame.bottom) / frame.height };
}
import { BUILDING } from './layout.js';


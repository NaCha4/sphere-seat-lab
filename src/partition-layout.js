import { PARTITION_HEIGHT, VIEW_ZONES } from './view-zones.js';
import footprint from './data/partition-footprint.json' with { type: 'json' };

// Concept dimensions, not structural/mechanism specifications.
export const PARTITIONS = Object.freeze({
  levels: Object.freeze([PARTITION_HEIGHT]), thickness: .05,
  halfWidth: 65.7, rearZ: 64.7, frontZ: -61,
  hubX: footprint.hub.x, hubZ: footprint.hub.z,
  duration: 1.8, blades: 40,
});

export const SCREEN_BANDS = VIEW_ZONES;

export const bandForTier = tier => SCREEN_BANDS.find(b => b.tiers.includes(tier));

// The convex envelope of crossing sightlines, with a 1m edge allowance.
// Radial retraction into the local hub is only a schematic mechanism.
export function fanRing(amount) {
  const open = Math.max(0, Math.min(1, amount));
  const scale = .012 + .988 * open;
  return footprint.vertices.map(p => ({
    x: PARTITIONS.hubX + (p.x - PARTITIONS.hubX) * scale,
    z: PARTITIONS.hubZ + (p.z - PARTITIONS.hubZ) * scale,
  }));
}

export const fanRings = amount => PARTITIONS.levels.map(level => fanRing(amount, level));

// Smallest radial deployment that covers this ray at the separator plane.
// Infinity means the ray cannot be intercepted by this panel's footprint.
export function requiredPartitionAmount(origin, target, ring = fanRing(1)) {
  const dy = target.y - origin.y;
  if (Math.abs(dy) < 1e-9) return 0;
  const t = (PARTITION_HEIGHT - origin.y) / dy;
  if (t <= 0 || t >= 1) return 0;
  const px = origin.x + (target.x - origin.x) * t - PARTITIONS.hubX;
  const pz = origin.z + (target.z - origin.z) * t - PARTITIONS.hubZ;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i+1)%ring.length];
    const ax = a.x - PARTITIONS.hubX, bx = b.x - PARTITIONS.hubX;
    const az = a.z - PARTITIONS.hubZ, bz = b.z - PARTITIONS.hubZ;
    const det = ax * bz - az * bx;
    if (Math.abs(det) < 1e-9) continue;
    const u = (px * bz - pz * bx) / det;
    const v = (ax * pz - az * px) / det;
    if (u >= -1e-8 && v >= -1e-8) return Math.max(0, (u + v - .012) / .988);
  }
  return Infinity;
}

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
    for (let i = 0; i < ring.length; i++) {
      if (inTriangleXZ(p, { x: PARTITIONS.hubX, z: PARTITIONS.hubZ }, ring[i], ring[(i+1)%ring.length])) return true;
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
  const v = Math.max(0, Math.min(1, (point.y - band.bottom) / (band.top - band.bottom)));
  const uArc = .5 + angle / (2 * halfAngle);
  // A full horizontal panorama cannot meet at a single pole. Fade into a
  // continuous front projection before the canopy closes behind the viewer.
  const t = band.id === 2 ? Math.max(0, Math.min(1, (v - .45) / .30)) : 0;
  const blend = t * t * (3 - 2 * t);
  const uCap = .5 + point.x / (2 * screen.radius);
  return {
    u: Math.max(0, Math.min(1, uArc * (1 - blend) + uCap * blend)), v,
  };
}

export function bandSurfacePoint(band, u, v, screen) {
  const y = band.bottom + v * (band.top - band.bottom);
  const radius = Math.sqrt(Math.max(0, screen.radius ** 2 - (y - screen.centerY) ** 2));
  const angle = (2 * u - 1) * bandHalfAngle(y, screen);
  return { x: radius * Math.sin(angle), y, z: screen.centerZ - radius * Math.cos(angle) };
}
import { BUILDING } from './layout.js';


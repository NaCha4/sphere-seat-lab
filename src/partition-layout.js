import { PARTITION_HEIGHT, VIEW_ZONES } from './view-zones.js';
import footprint from './data/partition-footprint.json' with { type: 'json' };

// Concept dimensions, not structural/mechanism specifications.
export const PARTITIONS = Object.freeze({
  // Screen division and mounting heights are independent.
  levels: Object.freeze([...new Set(footprint.segments.map(s => s.y))]),
  boundary: PARTITION_HEIGHT, thickness: .05, duration: 1.2,
  maximumProjection: footprint.maximumProjectionMetres,
});

export const SCREEN_BANDS = VIEW_ZONES;

export const bandForTier = tier => SCREEN_BANDS.find(b => b.tiers.includes(tier));

export function partitionPanels(amount = 1) {
  const length = Math.max(0, Math.min(1, amount)) * PARTITIONS.maximumProjection;
  return footprint.segments.map(segment => ({ ...segment, length, ring: [
    segment.a, segment.b,
    { x: segment.b.x + segment.normal.x * length, z: segment.b.z + segment.normal.z * length },
    { x: segment.a.x + segment.normal.x * length, z: segment.a.z + segment.normal.z * length },
  ] }));
}

// Solve a ray against the rooted rectangular blades. A ray outside their
// sweep is unshieldable; it must not silently become a zero-length success.
export function requiredPartitionAmount(origin, target) {
  const dy = target.y - origin.y;
  if (Math.abs(dy) < 1e-9) return Infinity;
  let required = Infinity;
  for (const s of footprint.segments) {
    const t = (s.y - origin.y) / dy;
    if (t <= 0 || t >= 1) continue;
    const px = origin.x + (target.x - origin.x) * t - s.a.x;
    const pz = origin.z + (target.z - origin.z) * t - s.a.z;
    const along = (px * (s.b.x - s.a.x) + pz * (s.b.z - s.a.z)) / s.width;
    const forward = px * s.normal.x + pz * s.normal.z;
    if (along >= -1e-8 && along <= s.width + 1e-8 && forward >= -1e-8 && forward <= PARTITIONS.maximumProjection + 1e-8) {
      required = Math.min(required, Math.max(0, forward) / PARTITIONS.maximumProjection);
    }
  }
  return required;
}

function inTriangleXZ(p, a, b, c) {
  const sign = (u, v, w) => (u.x - w.x) * (v.z - w.z) - (v.x - w.x) * (u.z - w.z);
  const x = sign(p, a, b), y = sign(p, b, c), z = sign(p, c, a);
  return !((x < -1e-7 || y < -1e-7 || z < -1e-7) && (x > 1e-7 || y > 1e-7 || z > 1e-7));
}

export function partitionBlocksSegment(origin, target, amount = 1, panels = partitionPanels(amount)) {
  if (amount <= 0) return false;
  const dy = target.y - origin.y;
  if (Math.abs(dy) < 1e-9) return false;
  for (const { y, ring } of panels) {
    const t = (y - origin.y) / dy;
    if (t <= 0 || t >= 1) continue;
    const p = { x: origin.x + (target.x - origin.x) * t, z: origin.z + (target.z - origin.z) * t };
    if (inTriangleXZ(p, ring[0], ring[1], ring[2]) || inTriangleXZ(p, ring[0], ring[2], ring[3])) return true;
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


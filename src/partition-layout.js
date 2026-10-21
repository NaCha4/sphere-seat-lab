import { PARTITION_HEIGHT, CANOPY_SLOPE_DEGREES, VIEW_ZONES, VIEW_FIELD } from './view-zones.js';
import footprint from './data/partition-footprint.json' with { type: 'json' };

// Concept dimensions, not structural/mechanism specifications.
export const PARTITIONS = Object.freeze({
  // Screen division and mounting heights are independent.
  levels: Object.freeze([footprint.lowerLineY]),
  boundary: PARTITION_HEIGHT, thickness: .05, duration: 1.2, slopeDegrees: CANOPY_SLOPE_DEGREES,
  maximumProjection: footprint.maximumProjectionMetres,
});

export const SCREEN_BANDS = VIEW_ZONES;

export const bandForTier = tier => SCREEN_BANDS.find(b => b.tiers.includes(tier));

export function partitionAmountForLength(metres) {
  if (!Number.isFinite(metres)) return null;
  return Math.max(0, Math.min(PARTITIONS.maximumProjection, metres)) / PARTITIONS.maximumProjection;
}

export function partitionPanels(amount = 1, slopeDegrees = PARTITIONS.slopeDegrees) {
  const length = Math.max(0, Math.min(1, amount)) * PARTITIONS.maximumProjection;
  const halfWidth=Math.max(...footprint.segments.flatMap(s=>[Math.abs(s.a.x),Math.abs(s.b.x)]));
  const arcRadius=halfWidth/Math.sin(VIEW_FIELD.horizontalDegrees*Math.PI/360);
  const point=(source,z=source.z)=>({...source,z,y:footprint.lowerLineY+(footprint.rearBaselineZ-z)*Math.tan(slopeDegrees*Math.PI/180)});
  const tip=source=>point(source,footprint.frontBaselineZ-length*Math.sqrt(Math.max(0,1-(source.x/arcRadius)**2)));
  return footprint.segments.map(segment => {
    const a=point(segment.a),b=point(segment.b);
    // Begin at the innermost edge of the entire straightened area, not at
    // each bank's curved front. The former infill is part of the same blade.
    const rootA=point(a,footprint.rearBaselineZ),rootB=point(b,footprint.rearBaselineZ);
    return {...segment,a,b,rootA,rootB,length,y:footprint.lowerLineY,
      mountRing:[a,b,{...b,y:b.mountY},{...a,y:a.mountY}],
      ring:[rootA,rootB,tip(b),tip(a)],
    };
  });
}

// Used only by the seated-view check, never to cap manual extension.
export function requiredPartitionAmount(origin, target) {
  if (!partitionBlocksSegment(origin,target,1)) return Infinity;
  let low=0, high=1;
  for (let i=0;i<32;i++) {
    const mid=(low+high)/2;
    if (partitionBlocksSegment(origin,target,mid)) high=mid;
    else low=mid;
  }
  return high;
}

function intersectsTriangle(origin, target, a, b, c) {
  const dx=target.x-origin.x, dy=target.y-origin.y, dz=target.z-origin.z;
  const ux=b.x-a.x, uy=b.y-a.y, uz=b.z-a.z, vx=c.x-a.x, vy=c.y-a.y, vz=c.z-a.z;
  const px=dy*vz-dz*vy, py=dz*vx-dx*vz, pz=dx*vy-dy*vx;
  const det=ux*px+uy*py+uz*pz;
  if (Math.abs(det)<1e-10) return false;
  const tx=origin.x-a.x, ty=origin.y-a.y, tz=origin.z-a.z;
  const u=(tx*px+ty*py+tz*pz)/det;
  if (u < -1e-8 || u > 1+1e-8) return false;
  const qx=ty*uz-tz*uy, qy=tz*ux-tx*uz, qz=tx*uy-ty*ux;
  const v=(dx*qx+dy*qy+dz*qz)/det;
  if (v < -1e-8 || u+v > 1+1e-8) return false;
  const t=(vx*qx+vy*qy+vz*qz)/det;
  return t>1e-8 && t<1-1e-8;
}

export function partitionBlocksSegment(origin, target, amount = 1, panels = partitionPanels(amount)) {
  if (amount <= 0) return false;
  for (const panel of panels) {
    for (const ring of [panel.ring,panel.mountRing]) {
      const lo=Math.min(ring[0].y,ring[1].y,ring[2].y,ring[3].y), hi=Math.max(ring[0].y,ring[1].y,ring[2].y,ring[3].y);
      if (Math.min(origin.y,target.y)>hi || Math.max(origin.y,target.y)<lo) continue;
      if (intersectsTriangle(origin,target,ring[0],ring[1],ring[2]) || intersectsTriangle(origin,target,ring[0],ring[2],ring[3])) return true;
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


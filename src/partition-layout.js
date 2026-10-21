import { PARTITION_HEIGHT, CANOPY_SLOPE_DEGREES, VIEW_ZONES } from './view-zones.js';
import footprint from './data/partition-footprint.json' with { type: 'json' };
import { CANOPY, toCanopyFrame, fromCanopyFrame, screenHalfAngle, screenContact } from './canopy-profile.js';

// Concept dimensions, not structural/mechanism specifications.
export const PARTITIONS = Object.freeze({
  // Screen division and mounting heights are independent.
  levels: Object.freeze([footprint.lowerLineY]),
  boundary: PARTITION_HEIGHT, thickness: .05, duration: 1.2, slopeDegrees: CANOPY_SLOPE_DEGREES,
  maximumProjection: CANOPY.centerProjection,
});

export const SCREEN_BANDS = VIEW_ZONES;

export const bandForTier = tier => SCREEN_BANDS.find(b => b.tiers.includes(tier));

export function partitionPanels(amount = 1) {
  const fraction=Math.max(0,Math.min(1,amount)),length=fraction*PARTITIONS.maximumProjection;
  const minX=footprint.segments[0].a.x,maxX=footprint.segments.at(-1).b.x;
  const point=(source,z=source.z)=>({...source,z,y:CANOPY.rootY+(CANOPY.rootZ-z)*Math.tan(CANOPY.slopeDegrees*Math.PI/180)});
  const edge=(x,overlap=0)=>screenContact((x-minX)/(maxX-minX)*2-1,overlap);
  return footprint.segments.map(segment => {
    const a=point(segment.a),b=point(segment.b);
    // Begin at the innermost edge of the entire straightened area, not at
    // each bank's curved front. The former infill is part of the same blade.
    const rootA=point(a,footprint.rearBaselineZ),rootB=point(b,footprint.rearBaselineZ);
    const contactEdge=[],tipEdge=[];
    // Dense arc sampling and a small overlap seal the faceted LED mesh.
    const steps=Math.max(2,Math.ceil((b.x-a.x)/.5));
    for(let i=0;i<=steps;i++) {
      const x=i===0?b.x:i===steps?a.x:b.x+(a.x-b.x)*i/steps;
      const contact=edge(x),tip=edge(x,CANOPY.overlap);
      contactEdge.push(contact);
      tipEdge.push({x:x+(tip.x-x)*fraction,y:CANOPY.rootY+(tip.y-CANOPY.rootY)*fraction,z:CANOPY.rootZ+(tip.z-CANOPY.rootZ)*fraction});
    }
    return {...segment,a,b,rootA,rootB,length,y:footprint.lowerLineY,contactEdge,
      mountRing:[a,b,{...b,y:b.mountY},{...a,y:a.mountY}],
      ring:[rootA,rootB,...tipEdge],
    };
  });
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
      const lo=Math.min(...ring.map(p=>p.y)), hi=Math.max(...ring.map(p=>p.y));
      if (Math.min(origin.y,target.y)>hi || Math.max(origin.y,target.y)<lo) continue;
      for(let i=1;i<ring.length-1;i++) if(intersectsTriangle(origin,target,ring[0],ring[i],ring[i+1])) return true;
    }
  }
  return false;
}

// The screen's clipped spherical surface has a different horizontal extent at
// each height. Unwrap each horizontal arc fully, including the side returns.
export function bandHalfAngle(y, screen) {
  return screenHalfAngle(y,screen);
}

// Aspect is measured along the horizontal arc at the band's middle height.
// It is a video-production reference, not a flat projection onto the dome.
export function bandFrame(band, screen) {
  const center = (band.bottom + band.top) / 2;
  const radius = Math.sqrt(Math.max(0, screen.radius ** 2 - center ** 2));
  return { center, height: band.top - band.bottom, width: 2 * radius * bandHalfAngle(center, screen), bottom: band.bottom, top: band.top };
}

export function bandVideoUV(point, band, screen) {
  const local=toCanopyFrame(point,screen);
  const angle = Math.atan2(local.x, -local.z);
  const halfAngle = Math.max(1e-5, bandHalfAngle(local.y, screen));
  const v = Math.max(0, Math.min(1, (local.y - band.bottom) / (band.top - band.bottom)));
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
  const radius = Math.sqrt(Math.max(0, screen.radius ** 2 - y ** 2));
  const angle = (2 * u - 1) * bandHalfAngle(y, screen);
  return fromCanopyFrame({ x: radius * Math.sin(angle), y, z:-radius * Math.cos(angle) },screen);
}


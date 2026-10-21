import { writeFileSync } from 'node:fs';
import { makeLayout, rowPath, rowGeometry } from '../src/layout.js';
import { bankBounds } from '../src/bowl-geometry.js';
import { CANOPY_SLOPE_DEGREES } from '../src/view-zones.js';

// One continuous root line follows the real gallery front, including the
// connections between banks. Every joint shares one extrusion direction.
// Manual exploration range; deliberately not clipped to screen/building size.
const stations = [], maximumProjectionMetres = 100;
for (const section of makeLayout('fan-v2').sections.filter(s => s.tier.id === 300)) {
  const frontRow = section.range.first - section.tier.rowStep / 2;
  const bounds = bankBounds(section, frontRow);
  const path = rowPath(section.tier, frontRow, bounds.start, bounds.end);
  const y = rowGeometry(section.tier, section.range.first).floorY - .08;
  for (const point of path) stations.push({ x: point.x, y, mountY:y, z: point.z, section: section.id });
}
// Keep the whole lower edge level: the middle banks start three metres higher,
// but their raised attachment must not create a notch in the shading surface.
const lowerLineY=Math.min(...stations.map(p=>p.mountY));
const rearBaselineZ=Math.max(...stations.map(p=>p.z));
for (const p of stations) p.y=lowerLineY+(rearBaselineZ-p.z)*Math.tan(CANOPY_SLOPE_DEGREES*Math.PI/180);
const frontBaselineZ=Math.min(...stations.map(p=>p.z));
const normals = stations.map(() => ({x:0,z:-1}));
const segments = stations.slice(1).map((b,i) => {
  const a=stations[i], normalA=normals[i], normalB=normals[i+1];
  return {section:a.section, bridge:a.section!==b.section, a,b, normalA,normalB,
    y:(a.y+b.y)/2, width:Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)};
});
const result = {
  model: 'continuous-seat-edge-visor', mountingTier: 300, protectedTiers: [300, 400], lowerLineY, rearBaselineZ, frontBaselineZ,
  maximumProjectionMetres, previousPanelArea: 4906.435263990791,
  area: segments.reduce((n, s) => n + s.width * maximumProjectionMetres, 0),
  segments,
};
writeFileSync(new URL('../src/data/partition-footprint.json',import.meta.url),`${JSON.stringify(result,null,2)}\n`);
console.log({ segments: segments.length, maximumProjectionMetres, maximumArea: result.area });

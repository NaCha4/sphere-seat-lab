import { writeFileSync } from 'node:fs';
import { makeLayout } from '../src/layout.js';
import { seatEye } from '../src/seating-pose.js';
import { SCREEN_BANDS, PARTITIONS } from '../src/partition-layout.js';
import { bandTargets, withinDefaultView } from '../src/partition-sightline.js';

const points = [];
for (const seat of makeLayout('fan-v2').seats) {
  const eye = seatEye(seat);
  for (const band of SCREEN_BANDS.filter(b => b.id !== seat.viewZone)) for (const p of bandTargets(band)) {
    if (!withinDefaultView(seat, p, eye)) continue;
    const t = (PARTITIONS.levels[0] - eye.y) / (p.y - eye.y);
    if (t > 0 && t < 1) points.push({ x: eye.x + (p.x - eye.x) * t, z: eye.z + (p.z - eye.z) * t });
  }
}
const cross = (a,b,c) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
points.sort((a,b) => a.x-b.x || a.z-b.z);
const lower = [], upper = [];
for (const p of points) {
  while (lower.length >= 2 && cross(lower.at(-2),lower.at(-1),p) <= 0) lower.pop();
  lower.push(p);
}
for (const p of [...points].reverse()) {
  while (upper.length >= 2 && cross(upper.at(-2),upper.at(-1),p) <= 0) upper.pop();
  upper.push(p);
}
const hull = lower.slice(0,-1).concat(upper.slice(0,-1)), margin = 1;
// Offset the convex envelope by one metre. This preserves clearance around
// the sampled rays without filling the entire rear half of the auditorium.
const vertices = hull.map((p,i) => {
  const a = hull[(i+hull.length-1)%hull.length], b = hull[(i+1)%hull.length];
  const al = Math.hypot(p.x-a.x,p.z-a.z), bl = Math.hypot(b.x-p.x,b.z-p.z);
  const n1 = { x:(p.z-a.z)/al, z:-(p.x-a.x)/al };
  const n2 = { x:(b.z-p.z)/bl, z:-(b.x-p.x)/bl };
  const factor = margin/(1+n1.x*n2.x+n1.z*n2.z);
  return { x:p.x+(n1.x+n2.x)*factor, z:p.z+(n1.z+n2.z)*factor };
});
const area = polygon => Math.abs(polygon.reduce((sum,a,i) => {
  const b=polygon[(i+1)%polygon.length]; return sum+a.x*b.z-b.x*a.z;
},0)/2);
const hub = vertices.reduce((p,v) => ({x:p.x+v.x/vertices.length,z:p.z+v.z/vertices.length}),{x:0,z:0});
const result = { marginMetres:margin, sampledRays:points.length, sampleEnvelopeArea:area(hull), area:area(vertices), hub, vertices };
writeFileSync(new URL('../src/data/partition-footprint.json',import.meta.url),`${JSON.stringify(result,null,2)}\n`);
console.log({margin, rays:points.length, sampleArea:result.sampleEnvelopeArea, panelArea:result.area, hub});

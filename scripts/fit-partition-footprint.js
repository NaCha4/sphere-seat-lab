import { writeFileSync } from 'node:fs';
import { makeLayout, rowPath, rowGeometry } from '../src/layout.js';
import { bankBounds } from '../src/bowl-geometry.js';

// Root short blades at the real bank front, leaving access aisles open.
const segments = [], maximumProjectionMetres = 2;
for (const section of makeLayout('fan-v2').sections.filter(s => s.tier.id === 300)) {
  const frontRow = section.range.first - section.tier.rowStep / 2;
  const bounds = bankBounds(section, frontRow);
  const path = rowPath(section.tier, frontRow, bounds.start, bounds.end);
  const y = rowGeometry(section.tier, section.range.first).floorY - .08;
  for (let i = 1; i < path.length; i++) {
    const a = { x: path[i - 1].x, z: path[i - 1].z }, b = { x: path[i].x, z: path[i].z };
    const width = Math.hypot(b.x - a.x, b.z - a.z);
    let normal = { x: (b.z - a.z) / width, z: -(b.x - a.x) / width };
    if (normal.x * -(a.x + b.x) / 2 + normal.z * (-58.1 - (a.z + b.z) / 2) < 0) {
      normal = { x: -normal.x, z: -normal.z };
    }
    segments.push({ section: section.id, y, a, b, normal, width });
  }
}
const result = {
  model: 'seat-edge-visor', mountingTier: 300, protectedTiers: [300, 400],
  maximumProjectionMetres, previousPanelArea: 4906.435263990791,
  area: segments.reduce((n, s) => n + s.width * maximumProjectionMetres, 0),
  segments,
};
writeFileSync(new URL('../src/data/partition-footprint.json',import.meta.url),`${JSON.stringify(result,null,2)}\n`);
console.log({ segments: segments.length, maximumProjectionMetres, maximumArea: result.area });

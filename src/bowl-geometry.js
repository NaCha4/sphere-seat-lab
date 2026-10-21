import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING, rowGeometry, rowPath, rowPoint, sectionAngles } from './layout.js';

export function bankBounds(section, row) {
  const bounds = sectionAngles(section.tier, section.id, row);
  if (section.tier.id === 100) return bounds;
  const inset = BUILDING.aisleWidth / (2 * rowGeometry(section.tier, row).radius);
  return { start: bounds.start + inset, end: bounds.end - inset };
}

export function bankBottom(section, row) {
  if (section.tier.id === 100) return -.27;
  const first = rowGeometry(section.tier, section.range.first).floorY;
  if (section.tier.id === 200) return first - 1.25;
  const last = rowGeometry(section.tier, section.range.last).floorY;
  const f = (row - section.range.first + .5) / (section.range.last - section.range.first + 1);
  return first - 1.3 + (last - first) * f;
}

export function bankPoint(section, row, fraction) {
  // A tread is a straight loft between its two edges. The narrower stair
  // subdivisions must use that same edge, rather than resampling the curve and
  // opening a hairline gap next to a tapered lower-bowl section.
  const step = section.tier.rowStep ?? 1;
  const start = section.range.first-step/2;
  const front = start + Math.floor((row-start)/step+1e-9)*step, blend = (row-front)/step;
  const at = r => {
    const { start, end } = bankBounds(section, r);
    return rowPoint(section.tier, r, start + (end - start) * fraction);
  };
  const a = at(front), b = at(front + step);
  return { x: a.x + (b.x - a.x) * blend, z: a.z + (b.z - a.z) * blend };
}

// Loft a closed stepped profile across a curved, potentially tapered footprint.
// Every surface shares the same vertices at seams, including both side caps.
function steppedSolid({ tier, first, last, rowSpan = 1, stepsPerRow = 1, narrow = false, boundsAt, pointAt, bottomAt, elevationAt }) {
  const front = first - rowSpan/2, rings = [];
  const count = Math.round((last - first + rowSpan) * stepsPerRow);
  for (let i = 0; i < count; i++) {
    const a = front + i / stepsPerRow, b = front + (i + 1) / stepsPerRow;
    const y = elevationAt(a + .5 / stepsPerRow);
    rings.push({ row: a, y }, { row: b, y });
  }
  for (let i = count; i >= 0; i--) {
    const row = front + i / stepsPerRow;
    rings.push({ row, y: bottomAt(row) });
  }

  const fractions = new Set([0, 1]);
  if (!narrow) for (let i = 1; i < 9; i++) fractions.add(i / 9);
  for (const { row } of narrow ? [] : rings) {
    const { start, end } = boundsAt(row);
    for (const p of rowPath(tier, row, start, end)) {
      fractions.add(Math.round((p.u - start) / (end - start) * 1e7) / 1e7);
    }
  }
  const columns = [0];
  for (const value of [...fractions].sort((a, b) => a - b)) {
    if (value > columns.at(-1) + 1e-4 && value < 1 - 1e-4) columns.push(value);
  }
  columns.push(1);
  const vertices = [], faces = [[], [], []], width = columns.length;
  for (const ring of rings) {
    for (const fraction of columns) {
      const p = pointAt(ring.row, fraction);
      vertices.push(p.x, ring.y, p.z);
    }
  }
  const push = (material, a, b, c) => faces[material].push(a, b, c);
  for (let i = 0; i < rings.length; i++) {
    const next = (i + 1) % rings.length;
    const material = i < 2 * count - 1 ? 0 : i >= 2 * count && i < rings.length - 1 ? 1 : 2;
    for (let j = 0; j < width - 1; j++) {
      const a = i * width + j, b = a + 1, c = next * width + j, d = c + 1;
      push(material, a, c, b); push(material, b, c, d);
    }
  }
  // A structured cap keeps every stair corner and avoids zero-area earcut
  // triangles along the long collinear underside of a flight.
  const caps = [];
  for (let i = 0; i < count; i++) {
    const topA = 2 * i, topB = topA + 1;
    const bottomA = 3 * count - i, bottomB = bottomA - 1;
    caps.push([topB, bottomB, bottomA]);
    if (i === 0) caps.push([topB, bottomA, topA]);
    else caps.push([topB, bottomA, topA - 1], [topB, topA - 1, topA]);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const across = new THREE.Vector3().fromArray(vertices, (width - 1) * 3).sub(new THREE.Vector3().fromArray(vertices));
  for (const side of [0, width - 1]) {
    for (const face of caps) {
      let [i, j, k] = face.map(r => r * width + side);
      a.fromArray(vertices, i * 3); b.fromArray(vertices, j * 3); c.fromArray(vertices, k * 3);
      const towardRight = b.sub(a).cross(c.sub(a)).dot(across) > 0;
      if (towardRight !== (side !== 0)) [j, k] = [k, j];
      push(2, i, j, k);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(faces.flat());
  let offset = 0;
  faces.forEach((indices, material) => { geometry.addGroup(offset, indices.length, material); offset += indices.length; });
  geometry.computeVertexNormals();
  geometry.userData.rings = rings;
  geometry.userData.columns = width;
  return geometry;
}

export function createBankGeometry(section) {
  const step = section.tier.rowStep ?? 1;
  return steppedSolid({
    tier: section.tier, first: section.range.first, last: section.range.last,
    rowSpan: step, stepsPerRow: 1/step,
    boundsAt: row => bankBounds(section, row), bottomAt: row => bankBottom(section, row),
    pointAt: (row, fraction) => bankPoint(section, row, fraction),
    elevationAt: row => rowGeometry(section.tier, section.range.first+Math.round((row-section.range.first)/step)*step).floorY,
  });
}

export function createAisleGeometry(left, right) {
  const tier = left.tier;
  const first = Math.min(left.range.first, right.range.first), last = Math.max(left.range.last, right.range.last);
  const major = tier.id !== 100 || [103, 107].includes(left.id);
  const steps = major ? Math.max(2, Math.ceil(tier.rise / .18)) : 1;
  const bottomAt = row => Math.min(bankBottom(left, row), bankBottom(right, row));
  return steppedSolid({
    tier, first, last, rowSpan: tier.rowStep ?? 1, stepsPerRow: steps, narrow: true,
    boundsAt: row => ({ start: bankBounds(left, row).end, end: bankBounds(right, row).start }),
    pointAt: (row, fraction) => {
      const a = bankPoint(left, row, 1), b = bankPoint(right, row, 0);
      return { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction };
    },
    bottomAt,
    elevationAt: row => major ? rowGeometry(tier, row).floorY : rowGeometry(tier, Math.round(row)).floorY,
  });
}

// Render all sections in three batches, instead of adding a draw call per wall.
export function mergeBowlSurfaces(geometries) {
  return [0, 1, 2].map(material => {
    const parts = geometries.map(source => {
      const part = new THREE.BufferGeometry();
      part.setAttribute('position', source.attributes.position);
      part.setAttribute('normal', source.attributes.normal);
      const group = source.groups[material];
      part.setIndex(Array.from(source.index.array.slice(group.start, group.start + group.count)));
      return part;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return merged;
  });
}

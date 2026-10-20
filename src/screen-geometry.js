import * as THREE from 'three';
import { BUILDING, radians } from './layout.js';

// Spherical fit constrained by the published apex/area and a traced profile.
// Page 8 of the 2023 production drawing shows a stepped panel edge. Its exact
// panel schedule is unavailable; the step pitch below is a visual reconstruction.
export function createScreenGeometry() {
  const c = BUILDING.screen, p = [], uv = [], edge = [];
  const normal = new THREE.Vector3(0, Math.cos(radians(c.tiltDegrees)), -Math.sin(radians(c.tiltDegrees)));
  let panelOffset = c.clipOffset;
  const signed = v => normal.dot(v.p.clone().sub(new THREE.Vector3(0, c.centerY, c.centerZ))) - panelOffset;
  const clip = (polygon, distance) => {
    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const da = distance(a), db = distance(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push({ p: a.p.clone().lerp(b.p, t), uv: a.uv.clone().lerp(b.uv, t) });
      }
    }
    return out;
  };
  const width = 240, height = 100, polarMax = Math.acos(-c.centerY / c.radius);
  const at = (i, j) => {
    const az = i / width * 2 * Math.PI - Math.PI, polar = j / height * polarMax;
    return { p: new THREE.Vector3(c.radius * Math.sin(polar) * Math.sin(az), c.centerY + c.radius * Math.cos(polar), c.centerZ - c.radius * Math.sin(polar) * Math.cos(az)), uv: new THREE.Vector2(i / width, 1 - j / height) };
  };
  const emit = triangle => {
    const polygon = clip(clip(triangle, v => v.p.y), signed);
    for (let k = 1; k < polygon.length - 1; k++) {
      const a = polygon[0], b = polygon[k], d = polygon[k + 1];
      if (b.p.clone().sub(a.p).cross(d.p.clone().sub(a.p)).lengthSq() < 1e-12) continue;
      for (const v of [a, b, d]) { p.push(...v.p); uv.push(...v.uv); }
    }
    for (let k = 0; k < polygon.length; k++) {
      const a = polygon[k], b = polygon[(k + 1) % polygon.length];
      if ((Math.abs(signed(a)) < 1e-6 && Math.abs(signed(b)) < 1e-6) || (Math.abs(a.p.y) < 1e-6 && Math.abs(b.p.y) < 1e-6)) edge.push(...a.p, ...b.p);
    }
  };
  for (let i = 0; i < width; i++) {
    const az = (i + .5) / width * 2 * Math.PI - Math.PI;
    // Constant per azimuth strip: clipping stays planar within each triangle,
    // while adjacent strips end at visibly different panel heights.
    let lo = 0, hi = polarMax;
    panelOffset = c.clipOffset;
    for (let n = 0; n < 30; n++) {
      const mid = (lo + hi) / 2;
      const value = normal.y * c.radius * Math.cos(mid) - normal.z * c.radius * Math.sin(mid) * Math.cos(az) - c.clipOffset;
      if (value > 0) lo = mid; else hi = mid;
    }
    const edgeY = c.centerY + c.radius * Math.cos((lo + hi) / 2);
    panelOffset += normal.y * (Math.round(edgeY / .35) * .35 - edgeY);
    for (let j = 0; j < height; j++) {
      const a = at(i, j), b = at(i + 1, j), d = at(i, j + 1), e = at(i + 1, j + 1);
      emit([a, b, d]); emit([b, e, d]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const boundary = new THREE.BufferGeometry(); boundary.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
  return { geometry, boundary };
}

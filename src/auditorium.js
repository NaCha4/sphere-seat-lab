import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING, TIERS, radians } from './layout.js';

function sector(inner, outer, start, end, top, bottom = top - .2, segments = 10) {
  const p = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (end - start) * i / segments;
    for (const [r, y] of [[inner, top], [outer, top], [inner, bottom], [outer, bottom]])
      p.push(Math.sin(a) * r, y, BUILDING.bowlCenterZ + Math.cos(a) * r);
  }
  for (let i = 0; i < segments; i++) {
    const k = i * 4;
    indices.push(k, k + 4, k + 1, k + 1, k + 4, k + 5);
    indices.push(k + 2, k + 3, k + 6, k + 3, k + 7, k + 6);
    indices.push(k, k + 2, k + 4, k + 2, k + 6, k + 4);
    indices.push(k + 1, k + 5, k + 3, k + 3, k + 5, k + 7);
  }
  indices.push(0, 1, 2, 1, 3, 2);
  const k = segments * 4;
  indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

function screenGeometry() {
  const c = BUILDING.screen, p = [], uv = [], indices = [];
  const width = 180, height = 72;
  const capHeight = BUILDING.publishedScreenArea / (2 * Math.PI * c.radius);
  const polarMax = Math.acos(1 - capHeight / c.radius);
  const point = new THREE.Vector3(), tiltAxis = new THREE.Vector3(1, 0, 0);
  for (let x = 0; x <= width; x++) {
    const az = -Math.PI + 2 * Math.PI * x / width;
    // Weld the periodic seam exactly, including ray tests on the centre plane.
    const sinAz = Math.abs(Math.sin(az)) < 1e-12 ? 0 : Math.sin(az);
    const cosAz = Math.abs(Math.cos(az)) < 1e-12 ? 0 : Math.cos(az);
    for (let y = 0; y <= height; y++) {
      const polar = polarMax * y / height;
      point.set(c.radius * Math.sin(polar) * sinAz, c.radius * Math.cos(polar), -c.radius * Math.sin(polar) * cosAz);
      point.applyAxisAngle(tiltAxis, -radians(c.tiltDegrees));
      p.push(point.x, point.y + c.centerY, point.z + c.centerZ);
      uv.push(x / width, 1 - y / height);
    }
  }
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    const k = x * (height + 1) + y;
    indices.push(k, k + 1, k + height + 1, k + 1, k + height + 2, k + height + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

const fract = n => n - Math.floor(n);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}
function fbm(x, y) {
  return noise(x, y) * .53 + noise(x * 2.07, y * 2.07) * .27 + noise(x * 4.17, y * 4.17) * .13 + noise(x * 8.31, y * 8.31) * .07;
}

export function screenTexture(mode = 'earth') {
  if (mode === 'chiikawa') {
    const texture = new THREE.TextureLoader().load(new URL('./assets/chiikawa-screen.webp', import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return texture;
  }
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (mode === 'earth') {
    const im = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 2048; x++) {
      const nx = (x - 1024) / 920, ny = (y - 1130) / 930;
      const rr = nx * nx + ny * ny;
      let r, g, b;
      if (rr < 1) {
        const light = .55 + Math.sqrt(1 - rr) * .45;
        const n = fbm(nx * 5 + 19, ny * 5 - 8);
        const clouds = Math.max(0, (fbm(nx * 12 - 26, ny * 9 + 7) - .54) * 5);
        if (n > .48) { r = 55 + n * 65; g = 76 + n * 83; b = 37 + n * 34; }
        else { r = 8; g = 64 + n * 42; b = 125 + n * 54; }
        r = (r * (1 - clouds) + 227 * clouds) * light;
        g = (g * (1 - clouds) + 239 * clouds) * light;
        b = (b * (1 - clouds) + 241 * clouds) * light;
      } else {
        const glow = Math.exp(-Math.abs(Math.sqrt(rr) - 1) * 16);
        r = 3 + glow * 31; g = 10 + glow * 111; b = 24 + glow * 176;
        if (fract(Math.sin(x * 91.317 + y * 87.41) * 4358.5) > .9993) r = g = b = 185;
      }
      const k = (y * 2048 + x) * 4;
      im.data[k] = r; im.data[k + 1] = g; im.data[k + 2] = b; im.data[k + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  } else if (mode === 'grid') {
    ctx.fillStyle = '#16272d'; ctx.fillRect(0, 0, 2048, 1024);
    ctx.textAlign = 'center'; ctx.font = '22px system-ui';
    for (let x = 0; x <= 2048; x += 128) {
      ctx.strokeStyle = x === 1024 ? '#f4d5a0' : '#54757c'; ctx.lineWidth = x === 1024 ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
      ctx.fillStyle = '#a9c8ce'; if (x > 0 && x < 2048) ctx.fillText(`${Math.round((x / 2048 - .5) * 360)}°`, x, 790);
    }
    for (let y = 0; y <= 1024; y += 128) {
      ctx.strokeStyle = '#54757c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
    }
    ctx.fillStyle = '#f4d5a0'; ctx.font = '600 36px system-ui'; ctx.fillText('SPHERE / VISUAL FIELD', 1024, 590);
    ctx.font = '20px system-ui'; ctx.fillStyle = '#afc7ca'; ctx.fillText('SCREEN UV GRID · NOT EQUAL-ANGLE CALIBRATION', 1024, 630);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#02060c'); gradient.addColorStop(.5, '#0b1726'); gradient.addColorStop(1, '#1f3440');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 1024);
    let seed = 17;
    for (let i = 0; i < 2500; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed / 2 ** 32 * 2048;
      seed = (seed * 1664525 + 1013904223) >>> 0; const y = seed / 2 ** 32 * 1024;
      ctx.fillStyle = `rgba(225,236,255,${.25 + (i % 7) / 10})`; ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

export class Auditorium {
  constructor(scene, layout, { screenMode = 'earth' } = {}) {
    this.scene = scene; this.layout = layout; this.group = new THREE.Group();
    this.group.name = 'Original Sphere reconstruction'; scene.add(this.group);
    this.pickables = []; this.chairMeshes = []; this.labels = new THREE.Group(); this.group.add(this.labels);
    this.createArchitecture(); this.createSeats(); this.createScreen(screenMode); this.createExterior();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .49, 32), new THREE.MeshBasicMaterial({ color: '#eac78d', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; this.marker = ring; this.group.add(ring);
    this.hovered = [];
    const hoverMaterial = new THREE.MeshBasicMaterial({ color: '#77ffe0', transparent: true, opacity: .92, depthWrite: false, toneMapped: false });
    this.hoverSlots = Array.from({ length: 2 }, () => {
      const group = new THREE.Group(); group.visible = false;
      for (const source of this.chairMeshes) {
        const glow = new THREE.Mesh(source.geometry, hoverMaterial);
        glow.matrixAutoUpdate = false; glow.renderOrder = 2;
        group.add(glow);
      }
      this.group.add(group); return group;
    });
  }

  createArchitecture() {
    const concrete = new THREE.MeshStandardMaterial({ color: '#18242c', roughness: .94, side: THREE.DoubleSide });
    const fascia = new THREE.MeshStandardMaterial({ color: '#111b23', roughness: .8, metalness: .2, side: THREE.DoubleSide });
    const beamMatrices = [], lightMatrices = [];
    const beam = (from, to, width, target = beamMatrices) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
      const o = new THREE.Object3D(); o.position.copy(a).lerp(b, .5);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      o.scale.set(width, a.distanceTo(b), width); o.updateMatrix(); target.push(o.matrix.clone());
    };
    const tiers = new Map(TIERS.map(t => [t.id, []]));
    for (const s of this.layout.sections) {
      for (const [row, list] of s.rows) {
        const seat = list[0], t = s.tier;
        tiers.get(t.id).push(sector(seat.radius - t.tread / 2, seat.radius + t.tread / 2, s.start - radians(.9), s.end + radians(.9), seat.floorY, seat.floorY - t.rise - .15));
      }
      const t = s.tier, first = s.rows.get(s.range.first)[0], last = s.rows.get(s.range.last)[0];
      const label = this.makeLabel(String(s.id), t.color);
      label.position.set(Math.sin(s.center) * (first.radius + 1.5), first.floorY + 2, BUILDING.bowlCenterZ + Math.cos(s.center) * (first.radius + 1.5));
      label.scale.set(2.4, 1.2, 1); this.labels.add(label);
      for (const angle of [s.start - radians(.7), s.end + radians(.7)]) {
        const x0 = Math.sin(angle) * first.radius, z0 = BUILDING.bowlCenterZ + Math.cos(angle) * first.radius;
        const x1 = Math.sin(angle) * last.radius, z1 = BUILDING.bowlCenterZ + Math.cos(angle) * last.radius;
        beam([x0, first.floorY + .95, z0], [x1, last.floorY + .95, z1], .035);
        for (let j = 0; j <= 5; j++) {
          const f = j / 5, x = THREE.MathUtils.lerp(x0, x1, f), z = THREE.MathUtils.lerp(z0, z1, f), y = THREE.MathUtils.lerp(first.floorY, last.floorY, f);
          beam([x, y, z], [x, y + .95, z], .035);
        }
        beam([x0, first.floorY + .035, z0], [x1, last.floorY + .035, z1], .026, lightMatrices);
      }
      // The pronounced first balcony overhang is part of the baseline, not an improvement.
      if (t.id === 200 || t.id === 300) {
        const bottom = t.id === 200 ? t.elevation - 1.8 : t.elevation - 1.6;
        const under = new THREE.Mesh(sector(first.radius - 1.8, last.radius + 2.2, s.start - radians(.9), s.end + radians(.9), t.elevation - .18, bottom, 18), fascia);
        this.group.add(under);
        const railRadius = first.radius - 1.7;
        for (let j = 0; j < 18; j++) {
          const a0 = s.start + (s.end - s.start) * j / 18, a1 = s.start + (s.end - s.start) * (j + 1) / 18;
          const p = a => [Math.sin(a) * railRadius, t.elevation + 1.02, BUILDING.bowlCenterZ + Math.cos(a) * railRadius];
          beam(p(a0), p(a1), .045);
          if (j % 3 === 0) beam([p(a0)[0], t.elevation, p(a0)[2]], p(a0), .035);
        }
      }
    }
    for (const [, geometries] of tiers) {
      const merged = mergeGeometries(geometries, false);
      this.group.add(new THREE.Mesh(merged, concrete)); geometries.forEach(g => g.dispose());
    }
    const addInstances = (matrices, material) => {
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.computeBoundingSphere(); this.group.add(mesh);
    };
    addInstances(beamMatrices, new THREE.MeshStandardMaterial({ color: '#89949a', roughness: .44, metalness: .7 }));
    addInstances(lightMatrices, new THREE.MeshBasicMaterial({ color: '#477da1' }));
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(73, 73, .4, 96), new THREE.MeshStandardMaterial({ color: '#0b141c', roughness: .97 }));
    floor.position.set(0, -.27, -12); this.group.add(floor);
    const event = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, .08, 64), new THREE.MeshStandardMaterial({ color: '#18232a', roughness: 1 }));
    event.position.set(0, -.02, -19); this.group.add(event);
    const st = BUILDING.stage;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(st.width, st.y, st.depth), new THREE.MeshStandardMaterial({ color: '#070d12', roughness: .77 }));
    stage.position.set(st.x, st.y / 2, st.z); this.group.add(stage);
    const stageLine = new THREE.Mesh(new THREE.BoxGeometry(st.width, .022, .035), new THREE.MeshBasicMaterial({ color: '#7c8a8d' }));
    stageLine.position.set(0, st.y + .012, st.z + st.depth / 2); this.group.add(stageLine);
    const stageLabel = this.makeLabel('STAGE', '#9cb4ba'); stageLabel.position.set(0, 1.4, st.z); stageLabel.scale.set(4, 2, 1); this.labels.add(stageLabel);
    // Side and rear walls, including two distinct hospitality bands.
    const wall = new THREE.Mesh(sector(73, 74, -radians(115), radians(115), 56, 0, 100), new THREE.MeshStandardMaterial({ color: '#0a131b', roughness: 1, side: THREE.DoubleSide }));
    this.group.add(wall);
    for (const y of [12.3, 25.8]) {
      const band = new THREE.Mesh(sector(y < 20 ? 48 : 55, 71, -radians(108), radians(108), y, y - 1.0, 90), fascia);
      this.group.add(band);
    }
  }

  makeLabel(text, color) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(6,13,20,.85)'; ctx.roundRect(8, 14, 240, 100, 20); ctx.fill();
    ctx.font = '600 58px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 128, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: true, transparent: true }));
  }

  createSeats() {
    const count = this.layout.seats.length;
    const parts = [
      { geometry: new THREE.BoxGeometry(.47, .14, .45), position: [0, .47, -.015] },
      { geometry: new THREE.BoxGeometry(.48, .61, .13), position: [0, .8, .205], tilt: -.09 },
      { geometry: new THREE.BoxGeometry(.055, .075, .48), position: [-.278, .64, .015] },
      { geometry: new THREE.BoxGeometry(.055, .075, .48), position: [.278, .64, .015] },
      { geometry: new THREE.BoxGeometry(.055, .42, .055), position: [0, .23, .11] },
    ];
    const mat = new THREE.MeshStandardMaterial({ color: '#d0d8df', roughness: .78, metalness: .04 });
    const o = new THREE.Object3D(), part = new THREE.Object3D();
    const baseColors = new Map(TIERS.map(t => [t.id, new THREE.Color(t.id === 100 ? '#253747' : t.id === 200 ? '#263b4e' : t.id === 300 ? '#2d3d57' : '#35405a')]));
    parts.forEach((def, partIndex) => {
      const mesh = new THREE.InstancedMesh(def.geometry, mat, count);
      mesh.name = partIndex === 0 ? 'selectable-seats' : 'chair-detail';
      for (const s of this.layout.seats) {
        o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.yaw, 0); o.updateMatrix();
        part.position.fromArray(def.position); part.rotation.set(def.tilt || 0, 0, 0); part.updateMatrix();
        mesh.setMatrixAt(s.index, o.matrix.clone().multiply(part.matrix)); mesh.setColorAt(s.index, baseColors.get(s.tier));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
      this.group.add(mesh); this.chairMeshes.push(mesh);
      if (partIndex < 2) this.pickables.push(mesh);
    });
    this.baseColors = baseColors;
  }

  createScreen(mode) {
    this.texture = screenTexture(mode);
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true, toneMapped: false });
    this.screen = new THREE.Mesh(screenGeometry(), this.screenMaterial); this.screen.name = 'interior-LED';
    this.group.add(this.screen);
  }

  createExterior() {
    const radius = BUILDING.diameter / 2;
    const exterior = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.acos(-BUILDING.centerY / radius));
    this.exterior = new THREE.LineSegments(new THREE.WireframeGeometry(exterior), new THREE.LineBasicMaterial({ color: '#617d84', transparent: true, opacity: .075, depthWrite: false }));
    this.exterior.position.set(0, BUILDING.centerY, -13); this.group.add(this.exterior); this.exterior.visible = false;
    exterior.dispose();
  }

  select(seat) {
    for (const mesh of this.chairMeshes) {
      if (this.selected) mesh.setColorAt(this.selected.index, this.baseColors.get(this.selected.tier));
      mesh.setColorAt(seat.index, new THREE.Color('#edd096')); mesh.instanceColor.needsUpdate = true;
    }
    this.selected = seat; this.marker.position.set(seat.x, seat.y + .015, seat.z);
    this.setHoverSeats(this.hovered, true);
  }
  setHoverSeats(seats, force = false) {
    const next = [...new Map(seats.filter(Boolean).map(s => [s.id, s])).values()].slice(0, 2);
    if (!force && next.length === this.hovered.length && next.every((s, i) => s.id === this.hovered[i].id)) return;
    const affected = new Map([...this.hovered, ...next].map(s => [s.id, s]));
    const ids = new Set(next.map(s => s.id));
    for (const mesh of this.chairMeshes) {
      for (const seat of affected.values()) {
        const color = ids.has(seat.id) ? new THREE.Color('#77ffe0') : this.selected?.id === seat.id ? new THREE.Color('#edd096') : this.baseColors.get(seat.tier);
        mesh.setColorAt(seat.index, color);
      }
      if (affected.size) mesh.instanceColor.needsUpdate = true;
    }
    const grow = new THREE.Matrix4().makeScale(1.045, 1.045, 1.045);
    this.hoverSlots.forEach((slot, i) => {
      slot.visible = Boolean(next[i]);
      if (!next[i]) return;
      slot.children.forEach((glow, part) => {
        this.chairMeshes[part].getMatrixAt(next[i].index, glow.matrix);
        glow.matrix.multiply(grow); glow.matrixWorldNeedsUpdate = true;
      });
    });
    this.hovered = next;
  }
  setScreen(mode) {
    this.texture?.dispose(); this.texture = screenTexture(mode); this.screenMaterial.map = this.texture; this.screenMaterial.needsUpdate = true;
  }
  setOverview(on, labels = true) {
    this.screenMaterial.opacity = on ? .16 : 1; this.screenMaterial.depthWrite = !on;
    this.exterior.visible = on; this.labels.visible = on || labels;
  }
  dispose() {
    this.scene.remove(this.group);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.group.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.isInstancedMesh) o.dispose();
      for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) { materials.add(m); if (m.map) textures.add(m.map); }
    });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
  }
}

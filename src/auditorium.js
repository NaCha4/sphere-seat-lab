import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING, TIERS, radians } from './layout.js';
import { createAuroraMaterial } from './screen-content.js';
import { Audience } from './audience.js';
import { createScreenGeometry } from './screen-geometry.js';

function roundedPanel(width, height, depth, radius) {
  const x = -width / 2, y = -height / 2, r = radius, shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r); shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, curveSegments: 2, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2); return geometry;
}

function sector(inner, outer, start, end, top, bottom = top - .2, segments = 10, centerZ = 0) {
  const p = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (end - start) * i / segments;
    for (const [r, y] of [[inner, Array.isArray(top) ? top[0] : top], [outer, Array.isArray(top) ? top[1] : top], [inner, Array.isArray(bottom) ? bottom[0] : bottom], [outer, Array.isArray(bottom) ? bottom[1] : bottom]])
      p.push(Math.sin(a) * r, y, centerZ + Math.cos(a) * r);
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
  constructor(scene, layout, { screenMode = 'aurora' } = {}) {
    this.scene = scene; this.layout = layout; this.group = new THREE.Group();
    this.group.name = 'Original Sphere reconstruction'; scene.add(this.group);
    this.pickables = []; this.chairMeshes = []; this.labels = new THREE.Group(); this.group.add(this.labels);
    this.createArchitecture(); this.createSeats(); this.createScreen(screenMode); this.createEnclosure(); this.createExterior();
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
    const concrete = new THREE.MeshStandardMaterial({ color: '#45545e', roughness: .94, side: THREE.DoubleSide });
    const fascia = new THREE.MeshStandardMaterial({ color: '#3b505e', roughness: .8, metalness: .2, side: THREE.DoubleSide });
    // A subtle fill keeps the downward-facing structure readable from the
    // lower seats; these colours are navigation aids, not as-built finishes.
    const soffit = new THREE.MeshStandardMaterial({ color: '#8f7d67', emissive: '#6d5a45', emissiveIntensity: .18, roughness: .94, side: THREE.DoubleSide });
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
        tiers.get(t.id).push(sector(seat.radius - t.tread / 2, seat.radius + t.tread / 2, s.start - radians(.9), s.end + radians(.9), seat.floorY, seat.floorY - t.rise - .15, 10, t.centerZ));
      }
      const t = s.tier, first = s.rows.get(s.range.first)[0], last = s.rows.get(s.range.last)[0];
      const label = this.makeLabel(String(s.id), t.color);
      label.position.set(Math.sin(s.center) * (first.radius + 1.5), first.floorY + 2, t.centerZ + Math.cos(s.center) * (first.radius + 1.5));
      label.scale.set(2.4, 1.2, 1); this.labels.add(label);
      for (const angle of [s.start - radians(.7), s.end + radians(.7)]) {
        const x0 = Math.sin(angle) * first.radius, z0 = t.centerZ + Math.cos(angle) * first.radius;
        const x1 = Math.sin(angle) * last.radius, z1 = t.centerZ + Math.cos(angle) * last.radius;
        beam([x0, first.floorY + .95, z0], [x1, last.floorY + .95, z1], .035);
        for (let j = 0; j <= 5; j++) {
          const f = j / 5, x = THREE.MathUtils.lerp(x0, x1, f), z = THREE.MathUtils.lerp(z0, z1, f), y = THREE.MathUtils.lerp(first.floorY, last.floorY, f);
          beam([x, y, z], [x, y + .95, z], .035);
        }
        beam([x0, first.floorY + .035, z0], [x1, last.floorY + .035, z1], .026, lightMatrices);
      }
      // The pronounced first balcony overhang is part of the baseline, not an improvement.
      if (t.id >= 200) {
        const under = new THREE.Mesh(sector(first.radius - t.tread / 2, last.radius + t.tread / 2, s.start, s.end, [first.floorY - .18, last.floorY - .18], [first.floorY - 1.3, last.floorY - 1.3], 18, t.centerZ), soffit);
        under.name = 'warm-balcony-underside';
        this.group.add(under);
        const railRadius = first.radius - t.tread / 2;
        for (let j = 0; j < 18; j++) {
          const a0 = s.start + (s.end - s.start) * j / 18, a1 = s.start + (s.end - s.start) * (j + 1) / 18;
          const p = a => [Math.sin(a) * railRadius, first.floorY + 1.02, t.centerZ + Math.cos(a) * railRadius];
          beam(p(a0), p(a1), .045);
          if (j % 3 === 0) beam([p(a0)[0], first.floorY, p(a0)[2]], p(a0), .035);
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
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, .4, 96), new THREE.MeshStandardMaterial({ color: '#0b141c', roughness: .97 }));
    floor.position.set(0, -.27, 0); this.group.add(floor);
    const event = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, .08, 64), new THREE.MeshStandardMaterial({ color: '#18232a', roughness: 1 }));
    event.position.set(0, -.02, -19); this.group.add(event);
    this.stageGroup = new THREE.Group(); this.stageGroup.visible = false; this.group.add(this.stageGroup);
    const st = BUILDING.stage;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(st.width, st.y, st.depth), new THREE.MeshStandardMaterial({ color: '#070d12', roughness: .77 }));
    stage.position.set(st.x, st.y / 2, st.z); this.stageGroup.add(stage);
    const stageLine = new THREE.Mesh(new THREE.BoxGeometry(st.width, .022, .035), new THREE.MeshBasicMaterial({ color: '#7c8a8d' }));
    stageLine.position.set(0, st.y + .012, st.z + st.depth / 2); this.stageGroup.add(stageLine);
    const stageLabel = this.makeLabel('EVENT STAGE', '#9cb4ba'); stageLabel.position.set(0, 1.4, st.z); stageLabel.scale.set(4, 2, 1); this.stageGroup.add(stageLabel);
    // Two hospitality bands behind the bowl, separate from the four public tiers.
    for (const [tierId, height] of [[200, 10.2], [300, 23.0]]) {
      const tier = TIERS.find(t => t.id === tierId);
      for (const section of this.layout.sections.filter(s => s.tier.id === tierId)) {
        const last = section.rows.get(section.range.last)[0];
        const band = new THREE.Mesh(sector(last.radius + 1, last.radius + 3.5, section.start, section.end, height, height - 1, 12, tier.centerZ), fascia);
        this.group.add(band);
      }
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
    // Luxx-family rail mount, drawn from the public manufacturer's profile.
    // The 580 mm variant is a reconstruction choice, not a verified Sphere order.
    const seatPad = roundedPanel(.46, .47, .10, .055); seatPad.rotateX(-Math.PI / 2);
    const parts = [
      { geometry: seatPad, position: [0, .40, -.095], fabric: true },
      { geometry: roundedPanel(.46, .56, .09, .07), position: [0, .64, .185], tilt: radians(12), fabric: true },
      { geometry: new THREE.PlaneGeometry(.39, .45).rotateY(Math.PI), position: [0, .64, .137], tilt: radians(12), fabric: true },
      { geometry: new THREE.BoxGeometry(.048, .365, .35), position: [-.265, .455, .045] },
      { geometry: new THREE.BoxGeometry(.048, .365, .35), position: [.265, .455, .045] },
      { geometry: roundedPanel(.064, .34, .055, .025).rotateX(Math.PI / 2), position: [-.265, .651, -.025] },
      { geometry: roundedPanel(.064, .34, .055, .025).rotateX(Math.PI / 2), position: [.265, .651, -.025] },
      { geometry: new THREE.CylinderGeometry(.057, .057, .045, 10).rotateZ(Math.PI / 2), position: [-.267, .37, .12] },
      { geometry: new THREE.CylinderGeometry(.057, .057, .045, 10).rotateZ(Math.PI / 2), position: [.267, .37, .12] },
      { geometry: new THREE.BoxGeometry(.58, .10, .065), position: [0, .23, .10], rail: true },
      { geometry: new THREE.BoxGeometry(.035, .23, .065), position: [0, .115, .10] },
      { geometry: new THREE.BoxGeometry(.18, .025, .20), position: [0, .018, .10] },
      { geometry: new THREE.CylinderGeometry(.046, .040, .08, 10, 1, true), position: [.265, .615, -.235] },
      { geometry: new THREE.RingGeometry(.035, .046, 12), position: [.265, .656, -.235], tilt: -Math.PI / 2 },
      { geometry: new THREE.BoxGeometry(.13, .012, .004), position: [0, .665, .137] },
    ];
    const fabric = new THREE.MeshStandardMaterial({ color: '#e0e8ee', roughness: .90, metalness: 0 });
    const frame = new THREE.MeshStandardMaterial({ color: '#30363b', roughness: .48, metalness: .42 });
    const o = new THREE.Object3D(), part = new THREE.Object3D();
    const baseColors = new Map(TIERS.map(t => [t.id, new THREE.Color(t.id === 100 ? '#252b30' : t.id === 200 ? '#293035' : t.id === 300 ? '#2b3339' : '#30383e')]));
    parts.forEach((def, partIndex) => {
      const mesh = new THREE.InstancedMesh(def.geometry, def.fabric ? fabric : frame, count);
      mesh.userData.baseColors = def.fabric ? baseColors : new Map(TIERS.map(t => [t.id, new THREE.Color('#9aa8b3')]));
      mesh.name = partIndex === 0 ? 'selectable-seats' : 'chair-detail';
      for (const s of this.layout.seats) {
        o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.yaw, 0); o.updateMatrix();
        part.position.fromArray(def.position); part.rotation.set(def.tilt || 0, 0, 0); part.updateMatrix();
        mesh.setMatrixAt(s.index, o.matrix.clone().multiply(part.matrix));
        mesh.setColorAt(s.index, def.fabric ? baseColors.get(s.tier) : new THREE.Color('#9aa8b3'));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
      this.group.add(mesh); this.chairMeshes.push(mesh);
      if (partIndex < 2) this.pickables.push(mesh);
    });
    this.baseColors = baseColors;
  }

  createScreen(mode) {
    this.screenMaterial = this.makeScreenMaterial(mode);
    const { geometry, boundary } = createScreenGeometry();
    this.screen = new THREE.Mesh(geometry, this.screenMaterial); this.screen.name = 'interior-LED';
    this.group.add(this.screen);
    this.screenEdge = new THREE.LineSegments(boundary, new THREE.LineBasicMaterial({ color: '#a7b9ba', transparent: true, opacity: .48, depthWrite: false }));
    this.screenEdge.name = 'LED-boundary'; this.screenEdge.renderOrder = 1; this.group.add(this.screenEdge);
  }

  createEnclosure() {
    // Matte enclosure behind the LED, with only a small visibility fill. It is a visual boundary, not a
    // measured model of the hidden roof trusses, catwalks, or acoustic lining.
    const radius = 68;
    const geometry = new THREE.SphereGeometry(radius, 64, 40, 0, Math.PI * 2, 0, Math.acos(-16 / radius));
    this.enclosure = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#343c43', emissive: '#11161a', emissiveIntensity: .25, roughness: 1, metalness: 0, side: THREE.BackSide }));
    this.enclosure.name = 'dark-interior-enclosure';
    this.enclosure.position.set(0, 16, 0);
    this.group.add(this.enclosure);
  }

  makeScreenMaterial(mode) {
    this.texture = mode === 'aurora' ? null : screenTexture(mode);
    return mode === 'aurora' ? createAuroraMaterial(BUILDING.screen)
      : new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true, toneMapped: false });
  }

  createExterior() {
    const radius = BUILDING.diameter / 2;
    const exterior = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.acos(-BUILDING.centerY / radius));
    this.exterior = new THREE.LineSegments(new THREE.WireframeGeometry(exterior), new THREE.LineBasicMaterial({ color: '#617d84', transparent: true, opacity: .075, depthWrite: false }));
    this.exterior.position.set(0, BUILDING.centerY, 0); this.group.add(this.exterior); this.exterior.visible = false;
    exterior.dispose();
  }

  select(seat) {
    for (const mesh of this.chairMeshes) {
      if (this.selected) mesh.setColorAt(this.selected.index, mesh.userData.baseColors.get(this.selected.tier));
      mesh.setColorAt(seat.index, new THREE.Color('#edd096')); mesh.instanceColor.needsUpdate = true;
    }
    this.selected = seat; this.marker.position.set(seat.x, seat.y + .015, seat.z);
    this.setHoverSeats(this.hovered, true);
    this.audience?.exclude(seat);
  }
  setStage(enabled) { this.stageGroup.visible = enabled; }
  setAudience(enabled, seat = this.selected) {
    this.audienceEnabled = enabled;
    if (enabled && !this.audience) { this.audience = new Audience(this.layout); this.group.add(this.audience); }
    if (this.audience) { this.audience.visible = enabled; if (seat) this.audience.exclude(seat); }
  }
  setHoverSeats(seats, force = false) {
    const next = [...new Map(seats.filter(Boolean).map(s => [s.id, s])).values()].slice(0, 2);
    if (!force && next.length === this.hovered.length && next.every((s, i) => s.id === this.hovered[i].id)) return;
    const affected = new Map([...this.hovered, ...next].map(s => [s.id, s]));
    const ids = new Set(next.map(s => s.id));
    for (const mesh of this.chairMeshes) {
      for (const seat of affected.values()) {
        const color = ids.has(seat.id) ? new THREE.Color('#77ffe0') : this.selected?.id === seat.id ? new THREE.Color('#edd096') : mesh.userData.baseColors.get(seat.tier);
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
    const opacity = this.screenMaterial.opacity, depthWrite = this.screenMaterial.depthWrite;
    this.texture?.dispose(); this.screenMaterial.dispose();
    this.screenMaterial = this.makeScreenMaterial(mode);
    this.screenMaterial.opacity = opacity; this.screenMaterial.depthWrite = depthWrite;
    if (this.screenMaterial.uniforms?.uOpacity) this.screenMaterial.uniforms.uOpacity.value = opacity;
    this.screen.material = this.screenMaterial;
  }
  setOverview(on, labels = true) {
    this.screenMaterial.opacity = on ? .16 : 1; this.screenMaterial.depthWrite = !on;
    if (this.screenMaterial.uniforms?.uOpacity) this.screenMaterial.uniforms.uOpacity.value = this.screenMaterial.opacity;
    this.exterior.visible = on; this.labels.visible = on || labels;
    this.enclosure.visible = !on;
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

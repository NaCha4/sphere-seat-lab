import * as THREE from 'three';
import { RECLINER, reclinedPoint } from './seating-pose.js';
import { BUILDING, TIERS, radians, rowGeometry, rowPoint, rowPath, sectionAngles, resolveSeat } from './layout.js';
import { bankBounds, bankPoint, createBankGeometry, createAisleGeometry, mergeBowlSurfaces } from './bowl-geometry.js';
import { createAuroraMaterial } from './screen-content.js';
import { DomeMovie } from './screen-video.js';
import { getVideoPreset } from './video-library.js';
import { Audience } from './audience.js';
import { createScreenGeometry } from './screen-geometry.js';
import { FanPartitions } from './fan-partitions.js';
import { createBandScreenMaterial } from './band-screen.js';

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

function ribbon(tier, innerRow, outerRow, start, end, top, bottom) {
  const points = rowPath(tier, innerRow, start, end), p = [], indices = [];
  for (const point of points) {
    const other = rowPoint(tier, outerRow, point.u);
    const upper = Array.isArray(top) ? top : [top, top], lower = Array.isArray(bottom) ? bottom : [bottom, bottom];
    p.push(point.x, upper[0], point.z, other.x, upper[1], other.z, point.x, lower[0], point.z, other.x, lower[1], other.z);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const k = i * 4;
    indices.push(k,k+4,k+1, k+1,k+4,k+5, k+2,k+3,k+6, k+3,k+7,k+6, k,k+2,k+4, k+2,k+6,k+4, k+1,k+5,k+3, k+3,k+5,k+7);
  }
  const k = (points.length - 1) * 4;
  indices.push(0,1,2, 1,3,2, k,k+2,k+1, k+1,k+2,k+3);
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
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
  constructor(scene, layout, { screenMode = 'aurora', videoId = 'motion' } = {}) {
    this.scene = scene; this.layout = layout; this.videoId = getVideoPreset(videoId).id; this.group = new THREE.Group();
    this.group.name = 'Sphere world'; scene.add(this.group);
    this.createWorld(layout); this.createScreen(screenMode); this.createEnclosure(); this.createExterior();
  }

  createWorld(layout) {
    this.layout = layout; this.selected = null;
    const root = this.group;
    this.worldGroup = new THREE.Group(); this.worldGroup.name = layout.world.id; root.add(this.worldGroup);
    this.group = this.worldGroup;
    this.pickables = []; this.chairMeshes = []; this.labels = new THREE.Group(); this.group.add(this.labels);
    this.createArchitecture(); this.createSeats();
    this.fans = layout.world.partitions ? new FanPartitions() : null;
    if (this.fans) {
      this.setPartitionAmount(this.partitionAmount ?? 0);
      this.worldGroup.add(this.fans);
    }
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
    this.group = root;
  }

  setLayout(layout) {
    if (layout === this.layout) return;
    const oldScreenLayout = this.layout.world.screenLayout;
    const previousSeat = this.selected, stage = this.stageGroup.visible;
    const labels = this.labels.visible, overview = this.overview, audience = this.audienceEnabled;
    this.group.remove(this.worldGroup);
    disposeGroup(this.worldGroup, [...this.bankShells, ...this.aisleShells].map(s => s.geometry));
    this.audience = null;
    this.createWorld(layout);
    if (oldScreenLayout !== layout.world.screenLayout) this.setScreen(layout.world.screenLayout ? 'video' : this.screenMode);
    if (previousSeat) this.select(resolveSeat(layout, previousSeat));
    this.setStage(stage); this.setAudience(audience); this.setOverview(overview, labels);
  }

  createArchitecture() {
    const concrete = new THREE.MeshStandardMaterial({ color: '#45545e', roughness: .94, flatShading: true });
    const fascia = new THREE.MeshStandardMaterial({ color: '#3b505e', roughness: .8, metalness: .2, side: THREE.DoubleSide, flatShading: true });
    // A subtle fill keeps the downward-facing structure readable from the
    // lower seats; these colours are navigation aids, not as-built finishes.
    const soffit = new THREE.MeshStandardMaterial({ color: '#8f7d67', emissive: '#6d5a45', emissiveIntensity: .18, roughness: .94, flatShading: true });
    const beamMatrices = [], lightMatrices = [];
    const beam = (from, to, width, target = beamMatrices) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
      const o = new THREE.Object3D(); o.position.copy(a).lerp(b, .5);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      o.scale.set(width, a.distanceTo(b), width); o.updateMatrix(); target.push(o.matrix.clone());
    };
    this.bankShells = this.layout.sections.map(section => ({ section, geometry: createBankGeometry(section) }));
    this.aisleShells = [];
    for (const tier of TIERS) {
      const sections = this.layout.sections.filter(s => s.tier.id === tier.id);
      for (let i = 1; i < sections.length; i++) {
        const left = sections[i - 1], right = sections[i];
        this.aisleShells.push({ left, right, geometry: createAisleGeometry(left, right) });
      }
    }
    const surfaces = mergeBowlSurfaces([...this.bankShells, ...this.aisleShells].map(s => s.geometry));
    this.bowlMeshes = surfaces.map((geometry, i) => {
      const mesh = new THREE.Mesh(geometry, [concrete, soffit, fascia][i]);
      mesh.name = ['closed-bowl-decks', 'closed-bowl-soffits', 'closed-bowl-side-walls'][i];
      this.group.add(mesh); return mesh;
    });
    for (const s of this.layout.sections) {
      const t = s.tier, first = s.rows.get(s.range.first)[0], last = s.rows.get(s.range.last)[0];
      const label = this.makeLabel(String(s.id), t.color);
      const labelPoint = rowPoint(t, s.range.first + 1.5, s.center);
      label.position.set(labelPoint.x, first.floorY + 2, labelPoint.z);
      label.scale.set(2.4, 1.2, 1); this.labels.add(label);
      for (const angle of [s.start, s.end]) {
        if (t.id === 100 && ![101,103,104,107,108,110].includes(s.id)) continue;
        if (t.id === 100 && (([101,104,108].includes(s.id) && angle !== s.start) || ([103,107,110].includes(s.id) && angle !== s.end))) continue;
        const side = angle === s.start ? 'start' : 'end';
        let previous;
        for (let row = s.range.first; row <= s.range.last; row++) {
          const p = t.id === 100 ? bankPoint(s,row,side === 'start' ? 0 : 1) : rowPoint(t,row,sectionAngles(t,s.id,row)[side]);
          const y = rowGeometry(t,row).floorY, top = [p.x,y+.95,p.z];
          if (previous) {
            beam(previous,top,.035);
            beam([previous[0],previous[1]-.915,previous[2]],[p.x,y+.035,p.z],.026,lightMatrices);
          }
          // Embed each post slightly into the tread rather than leave a
          // floating foot where the inclined rail crosses a staircase riser.
          if ((row-s.range.first)%2===0 || row===s.range.last) beam([p.x,y-.12,p.z],top,.035);
          previous = top;
        }
      }
      // The pronounced first balcony overhang is part of the baseline, not an improvement.
      if (t.id >= 200) {
        const frontBounds = bankBounds(s, s.range.first - .5);
        const face = new THREE.Mesh(ribbon(t, s.range.first - .65, s.range.first - .45, frontBounds.start, frontBounds.end, first.floorY + .05, first.floorY - (t.id === 200 ? 3.1 : 1.65)), fascia);
        face.name = 'vertical-balcony-fascia'; this.group.add(face);
        const rail = rowPath(t, s.range.first - .5, frontBounds.start, frontBounds.end);
        for (let j = 1; j < rail.length; j++) {
          const a = rail[j-1], b = rail[j];
          beam([a.x,first.floorY+1.02,a.z], [b.x,first.floorY+1.02,b.z], .045);
          const posts = Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/1.8);
          for (let i=0;i<posts;i++) {
            const x = THREE.MathUtils.lerp(a.x,b.x,i/posts), z = THREE.MathUtils.lerp(a.z,b.z,i/posts);
            beam([x,first.floorY-.08,z],[x,first.floorY+1.02,z],.035);
          }
        }
      }
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
    stageLine.position.set(st.x, st.y + .012, st.z + st.depth / 2); this.stageGroup.add(stageLine);
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(st.turntableRadius, st.turntableRadius, .12, 80), new THREE.MeshStandardMaterial({ color: '#30383c', roughness: .8 }));
    turntable.position.set(st.x, st.y + .06, st.z); this.stageGroup.add(turntable);
    const stageLabel = this.makeLabel('U2 / 2023', '#9cb4ba'); stageLabel.position.set(0, 1.5, st.z); stageLabel.scale.set(4, 2, 1); this.stageGroup.add(stageLabel);
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
    const parts = this.layout.world.seating === 'recliner' ? [
      { geometry: new THREE.BoxGeometry(.82, .30, .72), position: [0,.17,-.02] },
      { geometry: roundedPanel(.63,.60,.16,.09).rotateX(-Math.PI/2), position: [0,.43,-.14], fabric: true },
      { geometry: roundedPanel(.66,.78,.15,.09), position: [0,.947,.099], reclines: true, fabric: true },
      { geometry: roundedPanel(.57,.22,.17,.08), position: [0,1.332,.098], reclines: true, fabric: true },
      { geometry: roundedPanel(.14,.68,.27,.06).rotateX(-Math.PI/2), position: [-.38,.52,-.10], fabric: true },
      { geometry: roundedPanel(.14,.68,.27,.06).rotateX(-Math.PI/2), position: [.38,.52,-.10], fabric: true },
      { geometry: roundedPanel(.64,.51,.12,.07).rotateX(-Math.PI/2), position: [0,.32,-.67], fabric: true },
      { geometry: new THREE.BoxGeometry(.43,.08,.46), position: [0,.23,-.55] },
      { geometry: new THREE.CylinderGeometry(.046,.038,.07,10,1,true), position: [.38,.675,-.33] },
    ] : [
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
        o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.yaw, 0);
        // Standard width options are visual approximations, not installed-seat IDs.
        const width = s.pitch >= .579 ? .58 : s.pitch >= .555 ? .555 : .53;
        o.scale.set(s.recliner ? 1 : width / .58, 1, 1); o.updateMatrix();
        if(def.reclines) {
          const p=reclinedPoint({x:def.position[0],y:def.position[1],z:def.position[2]},s.backAngle);
          part.position.set(p.x,p.y,p.z); part.rotation.set(s.backAngle ?? RECLINER.backAngle,0,0);
        } else { part.position.fromArray(def.position); part.rotation.set(def.tilt || 0, 0, 0); }
        part.updateMatrix();
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
    if (this.layout.world.screenLayout === 'two-bands') mode = 'video';
    this.screenMode = mode;
    this.screenMaterial = this.makeScreenMaterial(mode);
    const { geometry, boundary } = createScreenGeometry();
    this.screen = new THREE.Mesh(geometry, this.screenMaterial); this.screen.name = 'interior-LED';
    this.group.add(this.screen);
    this.screenEdge = new THREE.LineSegments(boundary, new THREE.LineBasicMaterial({ color: '#a7b9ba', transparent: true, opacity: .48, depthWrite: false }));
    this.screenEdge.name = 'LED-boundary'; this.screenEdge.renderOrder = 1; this.group.add(this.screenEdge);
  }

  createEnclosure() {
    // Page 8 shows a separate dark rear roof, not another spherical screen.
    // Heights and beam spacings are interpretive, not dimensions in that photo.
    this.enclosure = new THREE.Group(); this.enclosure.name = 'dark-rear-roof';
    const material = new THREE.MeshStandardMaterial({ color: '#171c21', roughness: 1, side: THREE.DoubleSide });
    const beamMaterial = new THREE.MeshStandardMaterial({ color: '#30363d', roughness: .9 });
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute([-66,77,15, 66,77,15, -66,66,65, 66,66,65],3));
    roof.setIndex([0,2,1,1,2,3]); roof.computeVertexNormals();
    const roofMesh = new THREE.Mesh(roof, material); roofMesh.name = 'non-screen-roof'; this.enclosure.add(roofMesh);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(132.4,66.5,.4), material); rear.position.set(0,32.75,65); rear.name = 'sealed-rear-wall'; this.enclosure.add(rear);
    const sideShape = new THREE.Shape();
    sideShape.moveTo(-45,-.5); sideShape.lineTo(65,-.5); sideShape.lineTo(65,66);
    sideShape.lineTo(15,77); sideShape.lineTo(-45,77); sideShape.closePath();
    const sideGeometry = new THREE.ExtrudeGeometry(sideShape, { depth: .4, bevelEnabled: false });
    sideGeometry.rotateY(-Math.PI / 2);
    for (const x of [-66,66]) {
      const side = new THREE.Mesh(sideGeometry, material); side.position.x = x + .2; side.name = 'sealed-roof-side-wall'; this.enclosure.add(side);
    }
    for (let z = 20; z <= 64; z += 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(132,.48,.4), beamMaterial);
      beam.position.set(0,77-(z-15)*.22-.4,z); this.enclosure.add(beam);
    }
    for (let x = -56; x <= 56; x += 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.35,.55,51.2), beamMaterial);
      beam.rotation.x = Math.atan(.22); beam.position.set(x,71.2,40); this.enclosure.add(beam);
    }
    this.group.add(this.enclosure);
  }

  makeScreenMaterial(mode) {
    if (mode === 'video') {
      if (!this.movie) this.movie = new DomeMovie({ screen: BUILDING.screen, clipId: this.videoId, onChange: () => {
        this.syncVideoMaterial(); this.onPlaybackChange?.(this.getVideoState());
      } });
      this.movie.setSource(this.layout.world.screenLayout === 'two-bands' ? 'bands' : 'sphere', this.videoId);
      void this.movie.setActive(true);
      if (this.layout.world.screenLayout === 'two-bands') {
        this.texture = this.movie.texture;
        return createBandScreenMaterial(this.texture, this.movie.ready, BUILDING.screen);
      }
      if (getVideoPreset(this.videoId).projection === 'landscape') {
        this.texture = this.movie.texture;
        return createBandScreenMaterial(this.texture, this.movie.ready, BUILDING.screen, { panoramic: true });
      }
      // Keep the existing image visible until a decoded frame is available.
      if (!this.movie.ready) { this.texture = null; return createAuroraMaterial(BUILDING.screen); }
      this.texture = this.movie.texture;
      return new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true, toneMapped: false });
    }
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
  setPartitions(deployed, immediate = false) {
    this.fans?.setDeployed(deployed, immediate);
    if (this.fans) this.partitionAmount = this.fans.target;
  }
  setPartitionAmount(amount) {
    this.fans?.setAmount(amount);
    if (this.fans) this.partitionAmount = this.fans.target = this.fans.amount;
  }
  getPartitionState() { return this.fans?.getState() ?? null; }
  update(delta) { return this.fans?.update(delta) ?? false; }
  setAudience(enabled, seat = this.selected) {
    this.audienceEnabled = enabled;
    if (enabled && !this.audience) { this.audience = new Audience(this.layout); this.worldGroup.add(this.audience); }
    if (this.audience) { this.audience.visible = enabled; if (seat) this.audience.exclude(seat); }
  }
  setHoverSeats(seats, force = false) {
    const next = [...new Map(seats.filter(Boolean).map(s => [s.id, s])).values()].slice(0, 2);
    if (!force && next.length === this.hovered.length && next.every((s, i) => s.id === this.hovered[i].id)) return;
    // Move only the two reusable highlight objects. Updating instanceColor on
    // every chair part here re-uploaded the entire auditorium on each target
    // change (about 2.5 MB), needlessly stalling the XR frame.
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
    if (this.layout.world.screenLayout === 'two-bands') mode = 'video';
    this.screenMode = mode;
    if (mode !== 'video') void this.movie?.setActive(false);
    const opacity = this.screenMaterial.opacity, depthWrite = this.screenMaterial.depthWrite;
    if (this.texture !== this.movie?.texture) this.texture?.dispose();
    this.screenMaterial.dispose();
    this.screenMaterial = this.makeScreenMaterial(mode);
    this.screenMaterial.opacity = opacity; this.screenMaterial.depthWrite = depthWrite;
    if (this.screenMaterial.uniforms?.uOpacity) this.screenMaterial.uniforms.uOpacity.value = opacity;
    this.screen.material = this.screenMaterial;
  }
  syncVideoMaterial() {
    if (this.screenMaterial?.uniforms?.uReady) {
      this.screenMaterial.uniforms.uReady.value = this.movie?.ready ? 1 : 0; return;
    }
    if (this.screenMode !== 'video' || !this.movie?.ready || !this.screen || this.screenMaterial.map === this.movie.texture) return;
    const { opacity, depthWrite } = this.screenMaterial;
    this.screenMaterial.dispose(); this.texture = this.movie.texture;
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true, toneMapped: false, opacity, depthWrite });
    this.screen.material = this.screenMaterial;
  }
  getVideoState() { return this.movie?.getState() ?? { active: false, requested: true, ready: false, playing: false, status: 'inactive' }; }
  setVideo(id) {
    const next = getVideoPreset(id).id;
    if (next === this.videoId) return;
    this.videoId = next;
    if (this.screenMode === 'video') this.setScreen('video');
  }
  setVideoPlaying(playing) { return this.movie?.setPlaying(playing); }
  setOverview(on, labels = true) {
    this.overview = on;
    this.screenMaterial.opacity = on ? .16 : 1; this.screenMaterial.depthWrite = !on;
    if (this.screenMaterial.uniforms?.uOpacity) this.screenMaterial.uniforms.uOpacity.value = this.screenMaterial.opacity;
    this.exterior.visible = on; this.labels.visible = on || labels;
    this.enclosure.visible = !on;
  }
  dispose() {
    this.scene.remove(this.group);
    disposeGroup(this.group, [...this.bankShells, ...this.aisleShells].map(s => s.geometry), this.movie?.texture);
    this.movie?.dispose();
  }
}

function disposeGroup(group, extra = [], keepTexture = null) {
  const geometries = new Set(extra), materials = new Set(), textures = new Set();
  group.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.isInstancedMesh) o.dispose();
    for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
      materials.add(m); if (m.map && m.map !== keepTexture) textures.add(m.map);
    }
  });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
}

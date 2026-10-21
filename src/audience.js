import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEAD, audienceVariation as variation, audienceStature, audienceHead } from './audience-shape.js';
import { RECLINER } from './seating-pose.js';

function transformed(geometry, position, scale, rotation = 0) {
  geometry.scale(...scale); geometry.rotateZ(rotation); geometry.translate(...position);
  return geometry;
}

// Approximate adult silhouettes for occlusion comparison, not a population model.
// A shared geometry and instanced transforms keep a full house to three draws.
export class Audience extends THREE.Group {
  constructor(layout) {
    super(); this.name = 'audience'; this.layout = layout; this.excludedSeat = null;
    const head = new THREE.SphereGeometry(1, 8, 5);
    const colors = [], p = head.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const hair = p.getY(i) > .28 || p.getZ(i) > .13;
      const color = new THREE.Color(hair ? '#302724' : '#d3a17d');
      colors.push(color.r, color.g, color.b);
    }
    head.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    head.scale(HEAD.x, HEAD.y, HEAD.z); head.translate(0, HEAD.height, HEAD.forward);
    const bodyParts = [
      transformed(new THREE.SphereGeometry(1, 6, 4), [0, .84, .01], [.195, .25, .13]),
      transformed(new THREE.CylinderGeometry(.058, .052, .32, 4, 1, true), [-.205, .79, -.045], [1, 1, 1], -.18),
      transformed(new THREE.CylinderGeometry(.058, .052, .32, 4, 1, true), [.205, .79, -.045], [1, 1, 1], .18),
      transformed(new THREE.CylinderGeometry(.05, .06, .10, 4, 1, true), [0, 1.07, -.025], [1, 1, 1]),
    ];
    const legs = [
      transformed(new THREE.BoxGeometry(.15, .14, .36), [-.095, .46, -.14], [1, 1, 1]),
      transformed(new THREE.BoxGeometry(.15, .14, .36), [.095, .46, -.14], [1, 1, 1]),
    ];
    const body = mergeGeometries(bodyParts), lap = mergeGeometries(legs);
    [...bodyParts, ...legs].forEach(g => g.dispose());
    if (layout.world.seating === 'recliner') {
      for (const geometry of [head,body]) {
        geometry.translate(0,-.46,.05); geometry.rotateX(RECLINER.backAngle); geometry.translate(0,.46,-.05);
      }
      lap.rotateX(-.15); lap.translate(0,-.03,-.04);
    }
    const specs = [
      [head, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 'audience-heads'],
      [body, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), 'audience-torsos'],
      [lap, new THREE.MeshStandardMaterial({ color: '#25303c', roughness: 1 }), 'audience-laps'],
    ];
    this.meshes = specs.map(([geometry, material, name]) => {
      const mesh = new THREE.InstancedMesh(geometry, material, layout.seats.length);
      mesh.name = name; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.add(mesh); return mesh;
    });
    const palette = ['#526675', '#74584e', '#88745f', '#6e7285', '#566d5d', '#854f4b', '#b0a18e'];
    for (const seat of layout.seats) {
      this.writeSeat(seat);
      this.meshes[1].setColorAt(seat.index, new THREE.Color(palette[Math.floor(variation(seat) * palette.length)]));
    }
    this.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); });
    this.meshes[1].instanceColor.needsUpdate = true;
  }

  stature(seat) { return audienceStature(seat); }
  headCenter(seat) {
    const p = audienceHead(seat);
    return new THREE.Vector3(p.x, p.y, p.z);
  }
  writeSeat(seat, hidden = false) {
    const object = new THREE.Object3D();
    object.position.set(seat.x, seat.y, seat.z); object.rotation.y = seat.yaw;
    object.scale.set(hidden ? 0 : 1, hidden ? 0 : this.stature(seat), hidden ? 0 : 1);
    object.updateMatrix();
    for (const mesh of this.meshes) { mesh.setMatrixAt(seat.index, object.matrix); mesh.instanceMatrix.needsUpdate = true; }
  }
  exclude(seat) {
    if (this.excludedSeat?.id === seat.id) return;
    if (this.excludedSeat) this.writeSeat(this.excludedSeat);
    this.writeSeat(seat, true); this.excludedSeat = seat;
  }
}

import * as THREE from 'three';
import { PARTITIONS, fanRing } from './partition-layout.js';

export class FanPartitions extends THREE.Group {
  constructor() {
    super(); this.name = 'foldable-physical-partitions'; this.amount = 0; this.target = 0;
    this.membranes = PARTITIONS.levels.map((level, i) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({
        color: i ? '#485366' : '#4c5d59', roughness: .96, metalness: .08, side: THREE.DoubleSide,
      }));
      mesh.name = `physical-separator-${i + 1}`; mesh.userData.level = level; this.add(mesh);
      const ribs = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9ba7a0' }));
      ribs.name = 'radial-fold-ribs'; ribs.userData.level = level; this.add(ribs);
      return { mesh, ribs, level };
    });
    for (const level of PARTITIONS.levels) {
      const cassette = new THREE.Mesh(new THREE.BoxGeometry(2, .32, .65), new THREE.MeshStandardMaterial({ color: '#9a8060', roughness: .65, metalness: .5 }));
      cassette.position.set(.65, level, PARTITIONS.rearZ - .1); cassette.name = 'rear-fold-cassette'; this.add(cassette);
    }
    this.setAmount(0);
  }

  setAmount(amount) {
    this.amount = THREE.MathUtils.clamp(amount, 0, 1);
    const hub = { x: 0, z: PARTITIONS.rearZ }, half = PARTITIONS.thickness / 2;
    for (const { mesh, ribs, level } of this.membranes) {
      const ring = fanRing(this.amount, level);
      const positions = [], indices = [], lines = [];
      for (const p of [hub, ...ring]) positions.push(p.x, level + half, p.z, p.x, level - half, p.z);
      for (let i = 0; i < ring.length - 1; i++) {
        const a = 2 + i * 2, b = a + 2;
        indices.push(0, b, a, 1, a + 1, b + 1, a, b, a + 1, a + 1, b, b + 1);
      }
      const last = ring.length * 2;
      indices.push(0, 2, 1, 1, 2, 3, 0, 1, last, 1, last + 1, last);
      for (const p of ring) for (const side of [-1,1]) {
        const y = level + side * (half + .012);
        lines.push(hub.x, y, hub.z, p.x, y, p.z);
      }
      if (!mesh.geometry.attributes.position) {
        mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); mesh.geometry.setIndex(indices);
        ribs.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      } else {
        mesh.geometry.attributes.position.array.set(positions); mesh.geometry.attributes.position.needsUpdate = true;
        ribs.geometry.attributes.position.array.set(lines); ribs.geometry.attributes.position.needsUpdate = true;
      }
      mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); ribs.geometry.computeBoundingSphere();
    }
  }

  setDeployed(deployed, immediate = false) {
    this.target = deployed ? 1 : 0;
    if (immediate) this.setAmount(this.target);
  }
  update(delta) {
    if (Math.abs(this.amount - this.target) < 1e-6) return false;
    const step = Math.min(.1, delta) / PARTITIONS.duration;
    this.setAmount(this.amount + Math.sign(this.target - this.amount) * Math.min(step, Math.abs(this.target - this.amount)));
    return true;
  }
  getState() {
    return { amount: this.amount, deployed: this.target === 1, moving: Math.abs(this.amount - this.target) > 1e-6, levels: [...PARTITIONS.levels] };
  }
}

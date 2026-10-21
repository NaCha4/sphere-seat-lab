import * as THREE from 'three';
import { PARTITIONS, partitionPanels } from './partition-layout.js';

export class FanPartitions extends THREE.Group {
  constructor() {
    super(); this.name = 'seat-edge-retractable-visors'; this.amount = 0; this.target = 0;
    this.membranes = partitionPanels(1).map((panel, i) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({
        color: i ? '#485366' : '#4c5d59', roughness: .96, metalness: .08, side: THREE.DoubleSide,
      }));
      mesh.name = `seat-edge-blade-${panel.section}-${i}`; mesh.userData.level = panel.y; this.add(mesh);
      const ribs = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9ba7a0' }));
      ribs.name = 'blade-edge'; ribs.userData.level = panel.y; this.add(ribs);
      const cassette = new THREE.Mesh(new THREE.BoxGeometry(panel.width, .10, .16), new THREE.MeshStandardMaterial({ color: '#9a8060', roughness: .65, metalness: .5 }));
      cassette.position.set((panel.a.x + panel.b.x) / 2 - (panel.normalA.x+panel.normalB.x)*.04, panel.y, (panel.a.z + panel.b.z) / 2 - (panel.normalA.z+panel.normalB.z)*.04);
      cassette.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), new THREE.Vector3(panel.b.x-panel.a.x,panel.b.y-panel.a.y,panel.b.z-panel.a.z).normalize());
      cassette.name = `seat-edge-cassette-${panel.section}`; this.add(cassette);
      return { mesh, ribs, level: panel.y, panel, cassette };
    });
    this.setAmount(0);
  }

  setAmount(amount) {
    this.amount = THREE.MathUtils.clamp(amount, 0, 1);
    const half = PARTITIONS.thickness / 2, panels = partitionPanels(Math.max(.0001, this.amount));
    for (const [index, { mesh, ribs, level }] of this.membranes.entries()) {
      mesh.visible = ribs.visible = this.amount > 0;
      const ring = panels[index].ring;
      const positions = [], indices = [], lines = [];
      for (const p of ring) positions.push(p.x, p.y + half, p.z, p.x, p.y - half, p.z);
      indices.push(0, 2, 4, 0, 4, 6, 1, 5, 3, 1, 7, 5);
      for (let i = 0; i < ring.length; i++) {
        const a = i * 2, b = ((i + 1) % ring.length) * 2;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
      // Draw only the continuous root and leading edges, not false gaps at
      // every internal joint.
      for (const i of [0,2]) for (const side of [-1,1]) {
        const p = ring[i], next = ring[(i + 1) % ring.length];
        lines.push(p.x, p.y + side*(half+.012), p.z, next.x, next.y + side*(half+.012), next.z);
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
    // The manual preview remains usable when the calculated minimum is zero.
    this.target = deployed ? 1 : 0;
    if (immediate) this.setAmount(this.target);
  }
  update(delta) {
    if (Math.abs(this.amount - this.target) < 1e-6) return false;
    const step = Math.min(.1, delta) / PARTITIONS.duration;
    const distance = Math.abs(this.target - this.amount);
    this.setAmount(distance <= step + 1e-9 ? this.target : this.amount + Math.sign(this.target - this.amount) * step);
    return true;
  }
  getState() {
    return { amount: this.amount, deployed: this.target > 0, resetAmount: 0, slopeDegrees: PARTITIONS.slopeDegrees,
      projectionMetres: this.amount * PARTITIONS.maximumProjection, maximumProjectionMetres: PARTITIONS.maximumProjection,
      moving: Math.abs(this.amount - this.target) > 1e-6, levels: [...PARTITIONS.levels] };
  }
}

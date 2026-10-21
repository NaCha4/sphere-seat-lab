import * as THREE from 'three';
import { PARTITIONS, partitionPanels } from './partition-layout.js';

export class FanPartitions extends THREE.Group {
  constructor() {
    super(); this.name = 'screen-attached-canopy'; this.amount = 1; this.target = 1;
    this.membranes = partitionPanels(1).map((panel, i) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({
        color: i ? '#485366' : '#4c5d59', roughness: .96, metalness: .08, side: THREE.DoubleSide,
      }));
      mesh.name = `seat-edge-blade-${panel.section}-${i}`; mesh.userData.level = panel.y; this.add(mesh);
      const ribs = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9ba7a0' }));
      ribs.name = 'blade-edge'; ribs.userData.level = panel.y; this.add(ribs);
      const skirtGeometry = new THREE.BufferGeometry();
      skirtGeometry.setAttribute('position',new THREE.Float32BufferAttribute(panel.mountRing.flatMap(p=>[p.x,p.y,p.z]),3));
      skirtGeometry.setIndex([0,1,2,0,2,3]); skirtGeometry.computeVertexNormals();
      const skirt = new THREE.Mesh(skirtGeometry,mesh.material);
      skirt.name = `closed-gallery-attachment-${i}`; this.add(skirt);
      const {rootA,rootB}=panel;
      const cassette = new THREE.Mesh(new THREE.BoxGeometry(rootB.x-rootA.x, .10, .16), new THREE.MeshStandardMaterial({ color: '#9a8060', roughness: .65, metalness: .5 }));
      cassette.position.set((rootA.x+rootB.x)/2, panel.y, rootA.z+.04);
      cassette.name = `seat-edge-cassette-${panel.section}`; this.add(cassette);
      return { mesh, ribs, skirt, level: panel.y, panel, cassette };
    });
    this.setAmount(1);
  }

  setAmount(amount) {
    this.amount = THREE.MathUtils.clamp(amount,0,1);
    const half = PARTITIONS.thickness / 2, panels = partitionPanels(Math.max(.0001, this.amount));
    for (const [index, { mesh, ribs, skirt }] of this.membranes.entries()) {
      mesh.visible = ribs.visible = this.amount > 0;
      skirt.visible = this.amount > 0 && (Math.abs(this.membranes[index].panel.a.mountY-this.membranes[index].panel.a.y)>1e-6 || Math.abs(this.membranes[index].panel.b.mountY-this.membranes[index].panel.b.y)>1e-6);
      skirt.geometry.attributes.position.array.set(panels[index].mountRing.flatMap(p=>[p.x,p.y,p.z]));
      skirt.geometry.attributes.position.needsUpdate=true;
      skirt.geometry.computeVertexNormals();skirt.geometry.computeBoundingSphere();
      const ring = panels[index].ring;
      const positions = [], indices = [], lines = [];
      for (const p of ring) positions.push(p.x, p.y + half, p.z, p.x, p.y - half, p.z);
      for(let i=1;i<ring.length-1;i++) indices.push(0,i*2,(i+1)*2,1,(i+1)*2+1,i*2+1);
      for (let i = 0; i < ring.length; i++) {
        const a = i * 2, b = ((i + 1) % ring.length) * 2;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
      // Draw only the continuous root and leading edges, not false gaps at
      // every internal joint.
      for (const i of [0,...Array.from({length:ring.length-3},(_,j)=>j+2)]) for (const side of [-1,1]) {
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
    this.target = deployed ? 1 : 0;
    if (immediate) this.setAmount(this.target);
  }
  update(delta) {
    const distance=Math.abs(this.target-this.amount);
    if (distance<1e-6) return false;
    const step=Math.max(0,Math.min(.1,delta))/PARTITIONS.duration;
    if (!step) return false;
    this.setAmount(distance<=step+1e-9 ? this.target : this.amount+Math.sign(this.target-this.amount)*step);
    return true;
  }
  getState() {
    return { amount:this.amount, deployed:this.target>0, screenAttached:this.amount>=1-1e-6, resetAmount:1, slopeDegrees: PARTITIONS.slopeDegrees,
      projectionMetres: this.amount * PARTITIONS.maximumProjection, maximumProjectionMetres: PARTITIONS.maximumProjection,
      moving: Math.abs(this.amount - this.target) > 1e-6, levels: [...PARTITIONS.levels] };
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { XR_OVERLAY_ORDER, overlayMaterial, createAimPointer, pickTarget } from '../src/interaction.js';

test('VR controls and pointer are composited after the transparent LED regardless of distance', () => {
  const list = new WebGLRenderList(), camera = new THREE.PerspectiveCamera();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ transparent: true }));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), overlayMaterial());
  panel.renderOrder = XR_OVERLAY_ORDER;
  const { group, ray, dot } = createAimPointer();
  // The bad ordering also occurred when the screen was nearer than the panel.
  for (const screenZ of [-.01, .99]) {
    list.init();
    for (const [object, z] of [[panel, .9], [dot, .5], [ray, .6], [screen, screenZ]]) {
      const groupOrder = object === panel ? XR_OVERLAY_ORDER : object === screen ? 0 : group.renderOrder;
      list.push(object, object.geometry, object.material, groupOrder, z, null, camera);
    }
    list.sort();
    assert.deepEqual(list.transparent.map(item => item.object), [screen, panel, ray, dot]);
    assert.equal(list.opaque.length, 0);
    for (const object of [panel, ray, dot]) {
      assert.equal(object.material.depthTest, false);
      assert.equal(object.material.depthWrite, false);
    }
  }
  for (const object of [screen, panel, ray, dot]) { object.geometry.dispose(); object.material.dispose(); }
});

test('aim resolves a seat without moving it, prioritizes UI, and clears when pointing away', () => {
  const seat = { id: '206-10-1', section: 206, row: 10, number: 1 };
  const chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 1);
  chairs.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -10));
  chairs.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
  const target = pickTarget(ray, [], [chairs], [seat]);
  assert.equal(target.seat, seat);
  assert.equal(target.type, 'seat');
  assert.equal(target.distance, 9.5);
  assert.equal(chairs.count, 1);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMaterial());
  panel.position.z = -1; panel.updateMatrixWorld(true);
  assert.equal(pickTarget(ray, [panel], [chairs], [seat]).type, 'button');
  ray.ray.direction.set(1, 0, 0);
  assert.equal(pickTarget(ray, [panel], [chairs], [seat]), null);
  chairs.geometry.dispose(); chairs.material.dispose(); chairs.dispose();
  panel.geometry.dispose(); panel.material.dispose();
});

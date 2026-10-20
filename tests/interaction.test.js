import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { XR_OVERLAY_ORDER, overlayMaterial, createAimPointer, pickTarget, pollMenuToggle } from '../src/interaction.js';

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
  const menu = new THREE.Group(); menu.add(panel); menu.updateMatrixWorld(true);
  menu.visible = false;
  assert.equal(pickTarget(ray, [panel], [chairs], [seat]).type, 'seat', 'a hidden menu cannot intercept seat selection');
  menu.visible = true;
  assert.equal(pickTarget(ray, [panel], [chairs], [seat]).type, 'button', 'showing the menu restores button picking');
  const partition = new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  partition.position.z=-5;partition.updateMatrixWorld(true);
  assert.equal(pickTarget(ray,[],[chairs],[seat],[partition]),null,'opaque fan must stop seat picking through another floor');
  assert.equal(pickTarget(ray,[panel],[chairs],[seat],[partition]).type,'button','VR menu stays operable above the physical partitions');
  partition.visible=false;
  assert.equal(pickTarget(ray,[],[chairs],[seat],[partition]).type,'seat');
  partition.geometry.dispose();partition.material.dispose();
  ray.ray.direction.set(1, 0, 0);
  assert.equal(pickTarget(ray, [panel], [chairs], [seat]), null);
  chairs.geometry.dispose(); chairs.material.dispose(); chairs.dispose();
  panel.geometry.dispose(); panel.material.dispose();
});

test('A/X menu toggle fires once per press, consumes simultaneous hands and ignores selection buttons', () => {
  const controller = () => ({ gamepad: { mapping: 'xr-standard', buttons: Array.from({ length: 7 }, () => ({ pressed: false, touched: false })) }, menuWasPressed: false });
  const left = controller(), right = controller(), controllers = [left, right];
  assert.equal(pollMenuToggle(controllers), false);
  left.gamepad.buttons[0].pressed = true;
  right.gamepad.buttons[1].pressed = true;
  right.gamepad.buttons[4].touched = true;
  assert.equal(pollMenuToggle(controllers), false, 'trigger, squeeze and resting thumb must not toggle');
  right.gamepad.buttons[4].pressed = true;
  assert.equal(pollMenuToggle(controllers), true);
  for (let i = 0; i < 120; i++) assert.equal(pollMenuToggle(controllers), false, 'holding A cannot repeatedly toggle');
  right.gamepad.buttons[4].pressed = false;
  assert.equal(pollMenuToggle(controllers), false);
  left.gamepad.buttons[4].pressed = right.gamepad.buttons[4].pressed = true;
  assert.equal(pollMenuToggle(controllers), true);
  assert.equal(pollMenuToggle(controllers), false, 'both edges must be consumed in the same frame');
  left.gamepad = null; right.gamepad = null;
  assert.equal(pollMenuToggle(controllers), false, 'hand tracking and disconnect must not toggle');
  left.gamepad = { mapping: 'standard', buttons: [{},{},{},{},{ pressed: true }] };
  assert.equal(pollMenuToggle(controllers), false, 'non-XR gamepads must not use the Quest mapping');
});

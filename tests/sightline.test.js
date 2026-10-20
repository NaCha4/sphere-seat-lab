import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Auditorium } from '../src/auditorium.js';
import { BUILDING, makeLayout, resolveSeat } from '../src/layout.js';

test('baseline balcony blocks the upper screen from rear 100 seats but not front 100 or central 200', () => {
  // Rendering is deliberately not mocked as a successful browser test. This
  // canvas stub only lets us build the real meshes and ray-test their geometry.
  const context = { fillRect() {}, strokeRect() {}, roundRect() {}, fill() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, putImageData() {}, createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, createLinearGradient() { return { addColorStop() {} }; } };
  const originalDocument = globalThis.document;
  globalThis.document = { createElement() { return { width: 0, height: 0, getContext() { return context; } }; } };
  const layout = makeLayout();
  const scene = new THREE.Scene();
  let model;
  try { model = new Auditorium(scene, layout); } finally { globalThis.document = originalDocument; }
  scene.updateMatrixWorld(true);
  const obstacles = [];
  model.group.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o !== model.marker) obstacles.push(o); });
  const target = new THREE.Vector3(0, BUILDING.screenApex - .5, -18);
  const seesUpperScreen = (section, row) => {
    const s = resolveSeat(layout, { section, row });
    const origin = new THREE.Vector3(s.x, s.y + BUILDING.eyeHeight, s.z);
    const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
    return ray.intersectObjects(obstacles, false)[0]?.object === model.screen;
  };
  try {
    assert.equal(seesUpperScreen(106, 14), true);
    assert.equal(seesUpperScreen(106, 35), false);
    assert.equal(seesUpperScreen(206, 10), true);
    assert.equal(seesUpperScreen(210, 10), true);
    assert.equal(seesUpperScreen(406, 23), true);
  } finally { model.dispose(); }
});

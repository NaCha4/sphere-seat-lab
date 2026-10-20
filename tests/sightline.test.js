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
    const selected = resolveSeat(layout, { section: 206, row: 10 });
    const pointed = resolveSeat(layout, { section: 210, row: 10 });
    const color = new THREE.Color();
    model.select(selected);
    model.setHoverSeats([pointed, pointed, selected]);
    assert.equal(model.selected, selected, 'hover must not teleport the viewer');
    assert.equal(model.hovered.length, 2, 'two hands may point at different seats; duplicates collapse');
    assert.ok(model.hoverSlots.every(slot => slot.visible));
    model.chairMeshes[0].getColorAt(pointed.index, color);
    assert.equal(color.getHexString(), '77ffe0');
    model.setHoverSeats([]);
    assert.ok(model.hoverSlots.every(slot => !slot.visible));
    model.chairMeshes[0].getColorAt(pointed.index, color);
    assert.equal(color.getHexString(), model.baseColors.get(pointed.tier).getHexString());
    model.chairMeshes[0].getColorAt(selected.index, color);
    assert.equal(color.getHexString(), 'edd096', 'clearing hover restores the selected-seat color');
    assert.equal(seesUpperScreen(106, 14), true);
    assert.equal(seesUpperScreen(106, 35), false);
    assert.equal(seesUpperScreen(206, 10), true);
    assert.equal(seesUpperScreen(210, 10), true);
    assert.equal(seesUpperScreen(406, 23), true);
    const g = model.screen.geometry, p = g.attributes.position, indices = g.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let area = 0, highest = -Infinity;
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(p, indices.getX(i)); b.fromBufferAttribute(p, indices.getX(i + 1)); c.fromBufferAttribute(p, indices.getX(i + 2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    for (let i = 0; i < p.count; i++) highest = Math.max(highest, p.getY(i));
    assert.ok(Math.abs(area / BUILDING.publishedScreenArea - 1) < .005, 'screen mesh must fit the published surface area');
    assert.ok(Math.abs(highest - BUILDING.screenApex) < .1, 'screen mesh must fit the published apex height');
  } finally { model.dispose(); }
});

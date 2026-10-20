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
  const target = new THREE.Vector3(0, BUILDING.screenApex - .5, 0);
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
    const colorVersions = model.chairMeshes.map(mesh => mesh.instanceColor.version);
    model.setHoverSeats([pointed, pointed, selected]);
    assert.equal(model.selected, selected, 'hover must not teleport the viewer');
    assert.equal(model.hovered.length, 2, 'two hands may point at different seats; duplicates collapse');
    assert.ok(model.hoverSlots.every(slot => slot.visible));
    model.chairMeshes[0].getColorAt(pointed.index, color);
    assert.equal(color.getHexString(), model.baseColors.get(pointed.tier).getHexString(), 'hover must not rewrite the base chair colours');
    assert.equal(model.hoverSlots[0].children[0].material.color.getHexString(), '77ffe0');
    for (let i = 0; i < 40; i++) model.setHoverSeats([i % 2 ? pointed : selected]);
    assert.deepEqual(model.chairMeshes.map(mesh => mesh.instanceColor.version), colorVersions, 'rapid target changes must not upload any auditorium-wide colour buffer');
    const highlightMatrix = model.hoverSlots[0].children[0].matrix;
    const chairMatrix = new THREE.Matrix4();
    model.chairMeshes[0].getMatrixAt(pointed.index, chairMatrix);
    assert.ok(new THREE.Vector3().setFromMatrixPosition(highlightMatrix).distanceTo(new THREE.Vector3().setFromMatrixPosition(chairMatrix)) < 1e-6, 'the highlight must move directly to the targeted chair');
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
    const ceilingRay = new THREE.Raycaster(new THREE.Vector3(0, 50, 50), new THREE.Vector3(0, 1, 0));
    assert.ok(ceilingRay.intersectObject(model.enclosure, true).length > 0, 'the non-screen rear ceiling must be enclosed, not open sky');
    assert.equal(model.enclosure.getObjectByName('non-screen-roof').material.map, null);
    model.setOverview(true);
    assert.equal(model.enclosure.visible, false, 'overview must expose the interior');
    model.setOverview(false);
    assert.equal(model.enclosure.visible, true);
    const g = model.screen.geometry, p = g.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let area = 0, highest = -Infinity;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    for (let i = 0; i < p.count; i++) highest = Math.max(highest, p.getY(i));
    assert.ok(Math.abs(area / BUILDING.publishedScreenArea - 1) < .005, 'screen mesh must fit the published surface area');
    assert.ok(Math.abs(highest - BUILDING.screenApex) < .1, 'screen mesh must fit the published apex height');
    assert.equal(model.stageGroup.visible, false);
    model.setStage(true); assert.equal(model.stageGroup.visible, true);
    model.setStage(false);
    for (let i = 0; i < p.count; i++) assert.ok(p.getY(i) >= -1e-5, 'LED cannot extend below the event floor');
    model.setAudience(true, selected);
    assert.equal(model.audience.visible, true);
    assert.equal(model.audience.meshes[0].count, layout.seats.length);
    const transform = new THREE.Matrix4();
    model.audience.meshes[0].getMatrixAt(selected.index, transform);
    assert.equal(transform.determinant(), 0, 'my seat must not contain a rendered person');
    model.audience.meshes[0].getMatrixAt(pointed.index, transform);
    assert.ok(transform.determinant() > 0, 'other seats must contain a person');
    model.audience.updateMatrixWorld(true);
    const head = model.audience.headCenter(pointed);
    const headRay = new THREE.Raycaster(head.clone().add(new THREE.Vector3(0, 0, -1)), new THREE.Vector3(0, 0, 1));
    assert.ok(headRay.intersectObject(model.audience.meshes[0]).some(hit => hit.instanceId === pointed.index), 'the head must actually occlude a sightline');
    model.select(pointed);
    model.audience.meshes[0].getMatrixAt(selected.index, transform);
    assert.ok(transform.determinant() > 0, 'the previous seat is filled after moving');
    model.audience.meshes[0].getMatrixAt(pointed.index, transform);
    assert.equal(transform.determinant(), 0, 'the new seat becomes empty');
    model.setAudience(false);
    assert.equal(model.audience.visible, false);
  } finally { model.dispose(); }
});

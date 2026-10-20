import * as THREE from 'three';

export const XR_OVERLAY_ORDER = 10000;

// The LED is transparent, even at opacity 1. An opaque panel would be drawn
// before it regardless of renderOrder. Keep all XR UI in the final alpha pass.
export function overlayMaterial(options = {}) {
  return new THREE.MeshBasicMaterial({
    ...options, transparent: true, depthTest: false, depthWrite: false,
    toneMapped: false, side: THREE.DoubleSide,
  });
}

export function pickTarget(raycaster, buttons, pickables, seats) {
  const button = raycaster.intersectObjects(buttons, false)[0];
  if (button) return { type: 'button', ...button };
  const hit = raycaster.intersectObjects(pickables, false)[0];
  if (hit?.instanceId == null || !seats[hit.instanceId]) return null;
  return { type: 'seat', seat: seats[hit.instanceId], ...hit };
}

export function createAimPointer() {
  const material = new THREE.LineBasicMaterial({
    color: '#badfcf', transparent: true, depthTest: false, depthWrite: false,
    toneMapped: false,
  });
  const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(0, 0, -1),
  ]), material);
  ray.renderOrder = XR_OVERLAY_ORDER + 2;
  ray.scale.z = 6;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 8), overlayMaterial({ color: '#77ffe0' }));
  dot.renderOrder = XR_OVERLAY_ORDER + 3;
  dot.visible = false;
  const group = new THREE.Group(); group.renderOrder = XR_OVERLAY_ORDER + 1;
  group.add(ray, dot);
  return { group, ray, dot };
}

import * as THREE from 'three';
import { seatEye } from './seating-pose.js';

export const XR_OVERLAY_ORDER = 10000;

// Meta Quest Touch Plus / Oculus Touch WebXR profiles map A (right) and X
// (left) to buttons[4]. Ignore touch-only state and the trigger used to select.
// https://github.com/immersive-web/webxr-input-profiles/blob/main/packages/registry/profiles/meta/meta-quest-touch-plus.json
export function isMenuButtonPressed(gamepad) {
  return gamepad?.mapping === 'xr-standard' && Boolean(gamepad.buttons?.[4]?.pressed);
}

export function pollMenuToggle(controllers) {
  let requested = false;
  for (const state of controllers) {
    const pressed = isMenuButtonPressed(state.gamepad);
    if (pressed && !state.menuWasPressed) requested = true;
    state.menuWasPressed = pressed;
  }
  // Both hands may press in one frame. Consume both edges and toggle once.
  return requested;
}

function visibleInHierarchy(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

// The LED is transparent, even at opacity 1. An opaque panel would be drawn
// before it regardless of renderOrder. Keep all XR UI in the final alpha pass.
export function overlayMaterial(options = {}) {
  return new THREE.MeshBasicMaterial({
    ...options, transparent: true, depthTest: false, depthWrite: false,
    toneMapped: false, side: THREE.DoubleSide,
  });
}

export function pickTarget(raycaster, buttons, pickables, seats, occluders = []) {
  // Raycaster does not automatically honour an invisible parent's visibility.
  const button = raycaster.intersectObjects(buttons.filter(visibleInHierarchy), false)[0];
  if (button) return { ...button, ...(button.object.userData.resolveHit?.(button) ?? {type:'button'}) };
  const hit = raycaster.intersectObjects(pickables, false)[0];
  if (hit?.instanceId == null || !seats[hit.instanceId]) return null;
  if (raycaster.intersectObjects(occluders.filter(visibleInHierarchy), false).some(block => block.distance < hit.distance)) return null;
  return { type: 'seat', seat: seats[hit.instanceId], ...hit };
}

// Place the tracked head at the selected chair's eye position and restore the
// chair's forward direction without changing the chair or forcing head pitch.
export function seatedVrTransform(seat, pose, eyeHeight=1.18) {
  const p=pose.transform.position,q=pose.transform.orientation;
  const headEuler=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w),'YXZ');
  const yaw=seat.yaw-headEuler.y;
  const offset=new THREE.Vector3(p.x,p.y,p.z).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  const eye=seatEye(seat,eyeHeight);
  return {yaw,position:new THREE.Vector3(eye.x,eye.y,eye.z).sub(offset)};
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

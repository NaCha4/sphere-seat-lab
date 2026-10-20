// Register future alternatives here. Baseline data is never mutated.
export const WORLDS = Object.freeze([
  Object.freeze({
    id: 'original', label: '원본 재구성', shortLabel: '원본',
    description: '공개 자료와 추정 좌표로 만든 기존 객석입니다.',
    geometry: null,
  }),
  Object.freeze({
    id: 'curvature-v1', label: 'V1 · 전층 곡률 재배치', shortLabel: 'V1 곡률',
    description: '209·210과 반대편을 포함해 전층의 열·통로를 함께 재곡률화합니다. 중앙부 후퇴 최대 12m, 여유가 있는 열은 엇갈림 배치합니다.',
    geometry: Object.freeze({ rearShift: 12, halfWidth: 64, stagger: .25 }),
  }),
]);

export function getWorld(id) {
  return WORLDS.find(world => world.id === id) ?? WORLDS[0];
}

// One continuous, invertible plan transform shared by every floor and aisle.
// Its Jacobian determinant is 1: separate banks do not cross merely because
// one ticketing section turns independently. Heights/risers stay unchanged.
export function warpPlan(point, geometry) {
  if (!geometry) return point;
  return { x: point.x, z: point.z + geometry.rearShift * (1 - (point.x / geometry.halfWidth) ** 2) };
}

// Register future alternatives here. Baseline data is never mutated.
export const WORLDS = Object.freeze([
  Object.freeze({
    id: 'original', label: '원본 재구성', shortLabel: '원본',
    description: '공개 자료와 추정 좌표로 만든 기존 객석입니다.',
    geometry: null,
  }),
  Object.freeze({
    id: 'curvature-v1', label: 'V1 · 리클라이너 / 시청 우선 배치', shortLabel: 'V1 리클라이너',
    description: '좌석 폭 0.90m · 중심 간격 1.02m · 앞뒤 약 1.8m의 리클라이너 배치. 간격을 유지하면서 곡선 객석의 여유 폭과 앞쪽 행을 활용해 좌석 수를 늘렸습니다.',
    geometry: Object.freeze({ rearShift: 12, halfWidth: 64, stagger: .25 }),
    seating: 'recliner',
  }),
  Object.freeze({
    id: 'fan-v2', label: 'V2 · 2구역 리클라이너 / 객석 전면 차양', shortLabel: 'V2 2구역',
    description: '하부는 전방, 상부는 천장을 보는 리클라이너 배치. 객석 전면에서 나오는 차양을 0–100m 범위에서 직접 조절합니다.',
    geometry: null, screenLayout: 'two-bands', partitions: true, seating: 'recliner',
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

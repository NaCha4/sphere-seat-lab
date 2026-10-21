// Register future alternatives here. Baseline data is never mutated.
export const WORLDS = Object.freeze([
  Object.freeze({
    id: 'original', label: '원본 재구성', shortLabel: '원본',
    description: '공개 자료와 추정 좌표로 만든 기존 객석입니다.',
    geometry: null,
  }),
  Object.freeze({
    id: 'curvature-v1', label: 'V1 · 리클라이너 / 시청 우선 배치', shortLabel: 'V1 리클라이너',
    description: '좌석 폭 0.90m · 중심 간격 1.02m · 두 행을 한 단으로 합친 리클라이너 배치. 좌석 수를 줄이고 전층 곡률과 의자 방향을 전방 화면에 맞춥니다.',
    geometry: Object.freeze({ rearShift: 12, halfWidth: 64, stagger: .25 }),
    seating: 'recliner',
  }),
  Object.freeze({
    id: 'fan-v2', label: 'V2 · 부채형 차광막 / 3단 영상', shortLabel: 'V2 차광막',
    description: '100번대 / 200번대 / 300·400번대를 세 그룹으로 나누고, 접이식 차광막 두 단과 같은 영상 세 개로 시야를 분리하는 실험입니다.',
    geometry: null, screenLayout: 'three-bands', partitions: true,
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

export const RECLINER = Object.freeze({ width: .90, pitch: 1.02, rowStep: 2, backAngle: 28 * Math.PI / 180 });

export function reclinedPoint(point, angle = RECLINER.backAngle) {
  const dy = point.y - .46, dz = (point.z ?? 0) + .05;
  return { x: point.x ?? 0, y: .46 + dy * Math.cos(angle) - dz * Math.sin(angle), z: -.05 + dy * Math.sin(angle) + dz * Math.cos(angle) };
}

export function seatPoint(seat, point) {
  const p = seat.recliner ? reclinedPoint(point, seat.backAngle ?? RECLINER.backAngle) : { x: point.x ?? 0, y: point.y, z: point.z ?? 0 };
  return {
    x: seat.x + p.x * Math.cos(seat.yaw) + p.z * Math.sin(seat.yaw),
    y: seat.y + p.y,
    z: seat.z - p.x * Math.sin(seat.yaw) + p.z * Math.cos(seat.yaw),
  };
}

export const seatEye = (seat, height = 1.18) => seatPoint(seat, { y: height, z: 0 });

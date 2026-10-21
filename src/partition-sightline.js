import { BUILDING } from './layout.js';
import { seatEye } from './seating-pose.js';
import { VIEW_FIELD } from './view-zones.js';
import { SCREEN_BANDS, bandForTier, bandSurfacePoint, fanRings, partitionBlocksSegment } from './partition-layout.js';

export const BAND_SAMPLE_COUNT = 25 * 17;
export function bandTargets(band) {
  return Array.from({ length: BAND_SAMPLE_COUNT }, (_, i) => bandSurfacePoint(
    band, .002 + (i % 25) / 24 * .996, .002 + Math.floor(i / 25) / 16 * .996, BUILDING.screen,
  ));
}

export function withinDefaultView(seat, target, eye = seatEye(seat)) {
  const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
  const yaw = seat.yaw, pitch = seat.viewPitch ?? 0;
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const forward = -dx * sy * cp + dy * sp - dz * cy * cp;
  if (forward <= 0) return false;
  const right = dx * cy - dz * sy, up = dx * sy * sp + dy * cp + dz * cy * sp;
  return Math.abs(right) <= forward * Math.tan(VIEW_FIELD.horizontalDegrees * Math.PI / 360)
    && Math.abs(up) <= forward * Math.tan(VIEW_FIELD.verticalDegrees * Math.PI / 360);
}

export function evaluatePartitions(seat, amount = 0) {
  const own = bandForTier(seat.tier), rings = fanRings(amount);
  const eye = seatEye(seat);
  const bands = SCREEN_BANDS.map(band => {
    const targets = bandTargets(band).filter(p => withinDefaultView(seat, p, eye));
    const blocked = targets.filter(p => partitionBlocksSegment(eye, p, amount, rings)).length;
    return { id: band.id, label: band.label, samples: targets.length, totalSamples: BAND_SAMPLE_COUNT, blocked, visible: targets.length - blocked };
  });
  return { amount, ownBand: own.id, bands, viewField: VIEW_FIELD,
    backDegrees: (seat.backAngle ?? 0) * 180 / Math.PI,
    pitchDegrees: (seat.viewPitch ?? 0) * 180 / Math.PI,
    ownBlocked: bands.find(b => b.id === own.id).blocked,
    leakage: bands.filter(b => b.id !== own.id).reduce((n, b) => n + b.visible, 0),
    otherSamples: bands.filter(b => b.id !== own.id).reduce((n, b) => n + b.samples, 0),
  };
}

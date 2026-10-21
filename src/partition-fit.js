import { seatEye } from './seating-pose.js';
import { bandTargets, withinDefaultView } from './partition-sightline.js';
import { SCREEN_BANDS, PARTITIONS, bandForTier, requiredPartitionAmount } from './partition-layout.js';
import { VIEW_FIELD } from './view-zones.js';

// Run offline when geometry or sampling changes, never in the render loop.
export function fitPartitionToViews(layout) {
  const targets = SCREEN_BANDS.map(bandTargets);
  const groups = SCREEN_BANDS.map(b => ({ id: b.id, label: b.label, seats: 0,
    minimumPitch: Infinity, maximumPitch: -Infinity, crossingSamples: 0, protectionRequired: b.id === 2 }));
  let required = 0, crossingSamples = 0, unshieldable = 0;
  for (const seat of layout.seats) {
    const own = bandForTier(seat.tier), group = groups.find(g => g.id === own.id);
    const eye = seatEye(seat), pitch = seat.viewPitch * 180 / Math.PI;
    group.seats++;
    group.minimumPitch = Math.min(group.minimumPitch, pitch);
    group.maximumPitch = Math.max(group.maximumPitch, pitch);
    for (const [index, band] of SCREEN_BANDS.entries()) {
      if (band.id === own.id) continue;
      for (const point of targets[index]) {
        if (!withinDefaultView(seat, point, eye)) continue;
        group.crossingSamples++;
        // Lower viewers may see the upper movie in peripheral/upward vision.
        // This is intentional, not a constraint that expands the canopy.
        if (own.id !== 2) continue;
        crossingSamples++;
        const needed = requiredPartitionAmount(eye, point);
        if (!Number.isFinite(needed) || needed > 1 + 1e-8) unshieldable++;
        else required = Math.max(required, needed);
      }
    }
  }
  // Do not report an inadequate capped deployment as a successful fit.
  const amount = unshieldable ? null : Math.min(1, required);
  return { amount, required, projectionMetres: amount === null ? null : amount * PARTITIONS.maximumProjection,
    crossingSamples, unshieldable, seats: layout.seats.length, viewField: VIEW_FIELD,
    scope: 'upper-seated-view-only', groups };
}

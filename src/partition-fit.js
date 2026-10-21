import { seatEye } from './seating-pose.js';
import { bandTargets, withinDefaultView } from './partition-sightline.js';
import { SCREEN_BANDS, bandForTier, fanRing, requiredPartitionAmount } from './partition-layout.js';
import { VIEW_FIELD } from './view-zones.js';

// Run offline when geometry or sampling changes, never in the render loop.
export function fitPartitionToViews(layout) {
  const ring = fanRing(1), targets = SCREEN_BANDS.map(bandTargets);
  const groups = SCREEN_BANDS.map(b => ({ id: b.id, label: b.label, seats: 0,
    minimumPitch: Infinity, maximumPitch: -Infinity, crossingSamples: 0 }));
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
        crossingSamples++; group.crossingSamples++;
        const needed = requiredPartitionAmount(eye, point, ring);
        if (!Number.isFinite(needed) || needed > 1 + 1e-8) unshieldable++;
        else required = Math.max(required, needed);
      }
    }
  }
  // The footprint itself is fitted; fully extend it to retain its 1m margin.
  const amount = 1;
  return { amount, required, crossingSamples, unshieldable, seats: layout.seats.length, viewField: VIEW_FIELD, groups };
}

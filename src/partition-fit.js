import { seatEye } from './seating-pose.js';
import { bandTargets, withinDefaultView } from './partition-sightline.js';
import { SCREEN_BANDS, PARTITIONS, bandForTier, partitionPanels, partitionBlocksSegment } from './partition-layout.js';
import { VIEW_FIELD } from './view-zones.js';

// Run offline when geometry or sampling changes, never in the render loop.
export function fitPartitionToViews(layout) {
  const targets = SCREEN_BANDS.map(bandTargets);
  const groups = SCREEN_BANDS.map(b => ({ id: b.id, label: b.label, seats: 0,
    minimumPitch: Infinity, maximumPitch: -Infinity, crossingSamples: 0, protectionRequired: b.id === 2 }));
  const panels=partitionPanels(1);
  let crossingSamples = 0, unshieldable = 0;
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
        if (!partitionBlocksSegment(eye,point,1,panels)) unshieldable++;
      }
    }
  }
  return { amount:1, projectionMetres:PARTITIONS.maximumProjection,
    crossingSamples, unshieldable, seats: layout.seats.length, viewField: VIEW_FIELD,
    scope: 'fixed-screen-attached-canopy', groups };
}

import { BUILDING } from './layout.js';
import { SCREEN_BANDS, bandForTier, bandSurfacePoint, fanRings, partitionBlocksSegment } from './partition-layout.js';

export function bandTargets(band) {
  // Cover the complete illuminated band, rather than the old central rectangle.
  return Array.from({ length: 17 * 9 }, (_, i) => bandSurfacePoint(
    band, .02 + (i % 17) / 16 * .96, .02 + Math.floor(i / 17) / 8 * .96, BUILDING.screen,
  ));
}

export function evaluatePartitions(seat, amount = 0) {
  const own = bandForTier(seat.tier), rings = fanRings(amount);
  const eye = { x: seat.x, y: seat.y + BUILDING.eyeHeight, z: seat.z };
  const bands = SCREEN_BANDS.map(band => {
    const targets = bandTargets(band);
    const blocked = targets.filter(p => partitionBlocksSegment(eye, p, amount, rings)).length;
    return { id: band.id, label: band.label, samples: targets.length, blocked, visible: targets.length - blocked };
  });
  return { amount, ownBand: own.id, bands,
    ownBlocked: bands.find(b => b.id === own.id).blocked,
    leakage: bands.filter(b => b.id !== own.id).reduce((n, b) => n + b.visible, 0),
    otherSamples: bands.filter(b => b.id !== own.id).reduce((n, b) => n + b.samples, 0),
  };
}

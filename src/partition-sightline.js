import { BUILDING } from './layout.js';
import { SCREEN_BANDS, bandForTier, bandFrame, fanRings, partitionBlocksSegment } from './partition-layout.js';

export function bandTargets(band) {
  const frame = bandFrame(band, BUILDING.screen), { radius, centerY, centerZ } = BUILDING.screen;
  return Array.from({ length: 17 * 9 }, (_, i) => {
    const x = ((i % 17) / 16 * .96 - .48) * frame.width;
    const y = frame.center + (Math.floor(i / 17) / 8 * .96 - .48) * frame.height;
    return { x, y, z: centerZ - Math.sqrt(radius ** 2 - x ** 2 - (y - centerY) ** 2) };
  });
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

import { CANOPY } from './canopy-profile.js';
export { CANOPY_SLOPE_DEGREES } from './canopy-profile.js';
// Band heights are measured in the frame tilted with the actual canopy.
export const PARTITION_HEIGHT = CANOPY.cut;
export const VIEW_ZONES = Object.freeze([
  Object.freeze({ id: 1, label: '하부 · 1·2층', tiers: [100,200], bottom: CANOPY.minimum, top: PARTITION_HEIGHT, color: '#9dcce5', backDegrees: 20, target: {x:0,y:14,z:-58.1} }),
  Object.freeze({ id: 2, label: '상부 · 3·4층', tiers: [300,400], bottom: PARTITION_HEIGHT, top: CANOPY.maximum, color: '#d5b5e2', backDegrees: 55, gazeDegrees: 55, target: {x:0,y:73.152,z:-58.1} }),
]);
export const zoneForTier = tier => VIEW_ZONES.find(zone => zone.tiers.includes(tier));
export const VIEW_FIELD = Object.freeze({ verticalDegrees: 72, horizontalDegrees: 100 });

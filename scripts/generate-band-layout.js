import { writeFileSync } from 'node:fs';
import { BUILDING } from '../src/layout.js';
import { SCREEN_BANDS, bandFrame } from '../src/partition-layout.js';
import { CANOPY } from '../src/canopy-profile.js';

// One video atlas keeps both viewing zones frame-accurate with one decoder.
const width = 3072;
let row = 0;
const bands = SCREEN_BANDS.map(band => {
  const frame = bandFrame(band, BUILDING.screen);
  const height = Math.max(2, 2 * Math.round(width * frame.height / frame.width / 2));
  const result = { id: band.id, width, height, row, referenceWidthMetres: frame.width, referenceHeightMetres: frame.height };
  row += height;
  return result;
});
for (const band of bands) {
  band.offset = 1 - (band.row + band.height) / row;
  band.scale = band.height / row;
}
const result = { width, height: row, fps: 24, duration: 20, frameRotationDegrees:CANOPY.slopeDegrees, boundaryCoordinate:CANOPY.cut, bands };
writeFileSync(new URL('../src/data/band-video.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

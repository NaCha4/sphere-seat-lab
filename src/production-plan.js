import trace from './data/production-plan.json' with { type: 'json' };

export const PRODUCTION_PLAN = trace;
// The floor intersection of the fitted LED establishes the viewer datum. The
// drawing's blue origin is 17 px behind its cyan front-screen line.
const floorScreenZ = -Math.sqrt(58.11 ** 2 - 15.042 ** 2);
export const PLAN_ORIGIN_Z = floorScreenZ + (trace.coordinateOriginPx[1] - trace.screenFrontPx[1]) / trace.pixelsPerMetre;
export function pixelToPlan([x, y]) {
  return { x: (x - trace.coordinateOriginPx[0]) / trace.pixelsPerMetre, z: PLAN_ORIGIN_Z + (y - trace.coordinateOriginPx[1]) / trace.pixelsPerMetre };
}
const left = trace.frontEdgeLeftToCentrePx.map(pixelToPlan);
export const LOWER_CONTOUR = [...left, ...left.slice(0, -1).reverse().map(p => ({ x: -p.x, z: p.z }))];
const lengths = LOWER_CONTOUR.slice(1).map((p, i) => Math.hypot(p.x - LOWER_CONTOUR[i].x, p.z - LOWER_CONTOUR[i].z));
export const LOWER_LENGTH = lengths.reduce((a, b) => a + b, 0);
export const LOWER_TREAD = (trace.visibleCentralRiserYpx.at(-1) - trace.visibleCentralRiserYpx[0]) / (trace.visibleCentralRiserYpx.length - 1) / trace.pixelsPerMetre;
export const LOWER_KNOTS = [0];
for (const length of lengths) LOWER_KNOTS.push(LOWER_KNOTS.at(-1) + length / LOWER_LENGTH);

export function lowerPoint(row, u) {
  u = Math.max(0, Math.min(1, u));
  const i = Math.min(lengths.length - 1, LOWER_KNOTS.findIndex((v, n) => n > 0 && v >= u) - 1);
  const a = LOWER_CONTOUR[Math.max(0, i)], b = LOWER_CONTOUR[Math.max(0, i) + 1];
  const t = (u - LOWER_KNOTS[Math.max(0, i)]) / (LOWER_KNOTS[Math.max(0, i) + 1] - LOWER_KNOTS[Math.max(0, i)]);
  const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
  // Rear rows are obscured in this plan. Extend radially from the approximate
  // centre of the traced front contour; never present this as measured rear data.
  const centreZ = -74, r = Math.hypot(x, z - centreZ), offset = (row - 11.5) * LOWER_TREAD;
  return { x: x + x / r * offset, z: z + (z - centreZ) / r * offset };
}

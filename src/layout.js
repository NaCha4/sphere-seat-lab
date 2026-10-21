import inventory from './data/seat-inventory.json' with { type: 'json' };
import plan from './data/plan-angles.json' with { type: 'json' };
import { lowerPoint, LOWER_KNOTS, LOWER_TREAD, LOWER_LENGTH, pixelToPlan, PRODUCTION_PLAN } from './production-plan.js';
import { getWorld, warpPlan } from './worlds.js';
import { RECLINER, seatEye } from './seating-pose.js';
import { zoneForTier } from './view-zones.js';

// Published dimensions. Interior estimates are documented in RECONSTRUCTION_AUDIT.md.
export const BUILDING = Object.freeze({
  diameter: 157.2768, height: 111.5568, centerY: 32.9184,
  screenApex: 73.152, publishedScreenArea: 14864.4864, publishedSeats: 17385,
  // Conditional fit of the public 2019 section, clipped at the event floor.
  screen: { radius: 58.11, tiltDegrees: 42, centerY: 15.042, centerZ: 0, clipOffset: 15.57436 },
  stage: { ...pixelToPlan(PRODUCTION_PLAN.stageCenterPx), y: .8, width: 14.127, depth: 14.127, turntableRadius: 5.08 },
  seatPitch: .58, aisleWidth: 1.1, eyeHeight: 1.18,
});

// Back-deck Z/Y anchors: conditional tracing of the 2019 section. Row depth,
// rise and curvature remain estimates. Each tier has its own curvature origin.
export const TIERS = Object.freeze([
  { id: 100, name: 'Main', label: '메인', first: 101, last: 110, firstRow: 12, maxRows: 37, referenceRow: 37, radius: 69, rearZ: -5, elevation: 6.73, tread: LOWER_TREAD, rise: .25, color: '#789ca7', access: 'Level 2' },
  { id: 200, name: 'Terrace', label: '테라스', first: 201, last: 211, firstRow: 1, maxRows: 21, referenceRow: 21, radius: 80, rearZ: 5.84, elevation: 21.84, tread: .90, rise: .48, color: '#a5c6bd', access: 'Level 4' },
  // The old estimated height put 202/210 rear viewers inside this slab.
  // A 1.5 m clearance correction stays an estimate, not an as-built dimension.
  { id: 300, name: 'Lower Gallery', label: '로어 갤러리', first: 301, last: 311, firstRow: 1, maxRows: 20, referenceRow: 20, radius: 106, rearZ: 19.92, elevation: 35.98, tread: .90, rise: .60, color: '#aab6d3', access: 'Level 6' },
  { id: 400, name: 'Upper Gallery', label: '어퍼 갤러리', first: 403, last: 409, firstRow: 1, maxRows: 25, referenceRow: 25, radius: 126, rearZ: 45.33, elevation: 50.97, tread: .90, rise: .64, color: '#ccada2', access: 'Level 6 / 7' },
].map(t => Object.freeze({ ...t, centerZ: t.rearZ - t.radius })));

export const radians = degrees => degrees * Math.PI / 180;
export const SEAT_INVENTORY = inventory.sections;
export const INVENTORY_TOTAL = Object.values(SEAT_INVENTORY).reduce((sum, rows) => sum + Object.entries(rows).reduce((n, [r, c]) => n + (/^\d+$/.test(r) ? c : 0), 0), 0);

export function rowGeometry(tier, row) {
  const offset = row - tier.referenceRow;
  return { radius: tier.radius + offset * tier.tread, floorY: tier.elevation + offset * tier.rise };
}

export function rowRange(tier, section) {
  const rows = Object.keys(SEAT_INVENTORY[section]).filter(r => /^\d+$/.test(r)).map(Number);
  return { first: Math.min(...rows), last: Math.max(...rows) };
}

export function sectionAngles(tier, section, row = 12) {
  if (tier.id === 100) {
    // Reserve only the two wide gaps visible on page 2. Other section divisions
    // are ticketing boundaries, not a reason to invent another radial aisle.
    const gaps = Array.from({ length: 9 }, (_, i) => [2, 6].includes(i) ? 1.5 : .12);
    // Assign unknown ticketing boundaries proportionally to the row inventory.
    // The shortened final rows retain the last full row's allocation, leaving
    // empty deck space instead of pulling exits into the middle of the bowl.
    const r = Math.max(12, Math.min(34, row)), low = Math.floor(r), high = Math.ceil(r), blend = r - low;
    const counts = Array.from({ length: 10 }, (_, i) => SEAT_INVENTORY[101 + i][low] * (1 - blend) + SEAT_INVENTORY[101 + i][high] * blend);
    const pitch = (LOWER_LENGTH - gaps.reduce((a, b) => a + b, 0)) / counts.reduce((a, b) => a + b, 0);
    const i = section - 101;
    const start = (counts.slice(0, i).reduce((a, b) => a + b * pitch, 0) + gaps.slice(0, i).reduce((a, b) => a + b, 0)) / LOWER_LENGTH;
    const end = start + counts[i] * pitch / LOWER_LENGTH;
    return { start, end, center: (start + end) / 2 };
  }
  const { start, end } = plan.sections[section];
  // Adjacent schematic polygons overlap slightly. Use one shared boundary so
  // physical decks/aisles never overlap or leave an accidental sliver.
  const a = section > tier.first ? (start + plan.sections[section - 1].end) / 2 : start;
  const b = section < tier.last ? (end + plan.sections[section + 1].start) / 2 : end;
  return { start: radians(a), end: radians(b), center: radians((a + b) / 2) };
}

// Shared by the actual meshes, seat map, labels and chair placement. A traced
// faceted lower contour replaces the old circular approximation.
export function rowPoint(tier, row, parameter) {
  if (tier.id === 100) return warpPlan(lowerPoint(row, parameter), tier.worldGeometry);
  const { radius } = rowGeometry(tier, row);
  // Construction drawings show polygonal rows. Interpolate at fixed 4° knots.
  const step = radians(4), a = Math.floor(parameter / step) * step, b = a + step, t = (parameter - a) / step;
  return warpPlan({ x: radius * (Math.sin(a) * (1 - t) + Math.sin(b) * t), z: tier.centerZ + radius * (Math.cos(a) * (1 - t) + Math.cos(b) * t) }, tier.worldGeometry);
}

export function rowPath(tier, row, start, end) {
  const knots = tier.id === 100 ? LOWER_KNOTS : Array.from({ length: 91 }, (_, i) => radians((i - 45) * 4));
  return [start, ...knots.filter(v => v > start + 1e-8 && v < end - 1e-8), end].map(u => ({ ...rowPoint(tier, row, u), u }));
}

export function sampleRow(path, distance) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= length || i === path.length - 1) {
      const t = Math.max(0, Math.min(1, distance / length));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(a.z - b.z, b.x - a.x) };
    }
    distance -= length;
  }
}

export function makeLayout(worldId = 'original') {
  const world = getWorld(worldId);
  const recliner = world.seating === 'recliner';
  const tiers = world.geometry || recliner ? TIERS.map(t => ({ ...t, worldGeometry: world.geometry, rowStep: recliner ? RECLINER.rowStep : 1 })) : TIERS;
  const seats = [], sections = [], accessibleInventory = [];
  const byId = new Map(), bySection = new Map();
  for (const tier of tiers) {
    const reclinerPitch = (world.partitions ? zoneForTier(tier.id)?.seatPitch : null) ?? RECLINER.pitch;
    for (let section = tier.first; section <= tier.last; section++) {
      const angles = sectionAngles(tier, section), sourceRange = rowRange(tier, section);
      // Keep reference-row labels for comparison, but merge two old steps into
      // one deep terrace. Reuse the front row while retaining a rear buffer.
      const selectedRows = recliner ? Object.keys(SEAT_INVENTORY[section]).filter(r => /^\d+$/.test(r)).map(Number)
        .filter(r => r < sourceRange.last && (r-sourceRange.first)%RECLINER.rowStep===0) : null;
      const range = recliner ? { first: selectedRows[0], last: selectedRows.at(-1) } : sourceRange;
      const group = { id: section, tier, ...angles, range, rows: new Map(), seats: [] };
      for (const [label, inventoryCount] of Object.entries(SEAT_INVENTORY[section])) {
        if (!/^\d+$/.test(label)) {
          // WC is not converted into an invented row of standard chairs.
          accessibleInventory.push({ section, label, count: inventoryCount }); continue;
        }
        const row = Number(label), { radius, floorY } = rowGeometry(tier, row);
        if (recliner && !selectedRows.includes(row)) continue;
        const rowBounds = sectionAngles(tier, section, row);
        const path = rowPath(tier, row, rowBounds.start, rowBounds.end);
        const length = path.slice(1).reduce((sum, b, i) => sum + Math.hypot(b.x - path[i].x, b.z - path[i].z), 0);
        const allowance = recliner ? 1.4 : (tier.id === 100 ? .06 : BUILDING.aisleWidth);
        // Fit the available curved deck, not a second reduction of the old
        // ticket inventory. Keep the same chair width, pitch and aisle buffer.
        const count = recliner ? Math.max(1, Math.floor((length-allowance)/reclinerPitch)) : inventoryCount;
        const span = Math.min(count * (recliner ? reclinerPitch : BUILDING.seatPitch), length - allowance);
        // Shift alternating rows only into existing spare deck width. Dense
        // rows retain their pitch; no seat is pushed into an aisle to stagger it.
        const spare = Math.max(0, (length - span - allowance) / 2);
        const stagger = Math.min(spare, (tier.worldGeometry?.stagger ?? 0) * span / count) * (row % 2 ? 1 : -1);
        const rowSeats = [];
        for (let number = 1; number <= count; number++) {
          const position = sampleRow(path, (length - span) / 2 + (number - .5) * span / count + stagger);
          const theta = position.yaw;
          const seat = {
            id: `${section}-${row}-${number}`, index: seats.length,
            tier: tier.id, section, row, number, theta, radius, floorY,
            centerZ: tier.centerZ, rowStart: rowBounds.start, rowEnd: rowBounds.end,
            pitch: span / count,
            ...position, y: floorY, ...(recliner ? { recliner: true, width: RECLINER.width, sourceCount: inventoryCount } : {}),
          };
          if (recliner) {
            // Orient the chairs toward the fixed front viewing axis rather
            // than forcing the viewer to face the tangent of the row.
            const zone = world.partitions ? zoneForTier(tier.id) : null;
            seat.backAngle = zone ? radians(zone.backDegrees) : RECLINER.backAngle;
            const target = zone?.target ?? {x:BUILDING.stage.x,y:30,z:BUILDING.stage.z};
            seat.yaw = Math.atan2(seat.x-target.x, seat.z-target.z);
            const eye = seatEye(seat);
            seat.viewPitch = zone?.gazeDegrees != null ? radians(zone.gazeDegrees)
              : Math.atan2(target.y-eye.y, Math.hypot(eye.x-target.x,eye.z-target.z));
            if(zone) seat.viewZone = zone.id;
          }
          seats.push(seat); rowSeats.push(seat); group.seats.push(seat); byId.set(seat.id, seat);
        }
        group.rows.set(row, rowSeats);
      }
      sections.push(group); bySection.set(section, group);
    }
  }
  return { world, tiers, seats, sections, byId, bySection, accessibleInventory };
}

export function resolveSeat(layout, { section = 206, row = 10, number = null } = {}) {
  const group = layout.bySection.get(Number(section)) || layout.bySection.get(206);
  const requested = Number(row);
  const r = [...group.rows.keys()].reduce((a, b) => Math.abs(b - requested) < Math.abs(a - requested) ? b : a);
  const list = group.rows.get(r), n = Number(number);
  const i = number == null ? Math.floor(list.length / 2) : !Number.isFinite(n) ? list.length - 1 : Math.max(0, Math.min(list.length - 1, Math.round(n) - 1));
  return list[i];
}

export function seatMetrics(seat, eyeHeight = BUILDING.eyeHeight) {
  const eye = seatEye(seat, eyeHeight);
  const dx = BUILDING.stage.x - eye.x, dz = BUILDING.stage.z - eye.z;
  const dy = BUILDING.stage.y - eye.y, horizontal = Math.hypot(dx, dz);
  let yawDifference = Math.atan2(-dx, -dz) - seat.yaw;
  while (yawDifference > Math.PI) yawDifference -= 2 * Math.PI;
  while (yawDifference < -Math.PI) yawDifference += 2 * Math.PI;
  return { distance: Math.hypot(horizontal, dy), elevation: eye.y, stagePitch: Math.atan2(dy, horizontal), yawDifference };
}

export const PRESETS = [
  { label: '중앙 기준석', section: 206, row: 10 },
  { label: '측면 비교석', section: 210, row: 10 },
  { label: '상부 후방', section: 406, row: 23 },
  { label: '하부 가림 구간', section: 106, row: 35 },
];

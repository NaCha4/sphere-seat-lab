import inventory from './data/seat-inventory.json' with { type: 'json' };
import plan from './data/plan-angles.json' with { type: 'json' };

// Published dimensions. Interior estimates are documented in RECONSTRUCTION_AUDIT.md.
export const BUILDING = Object.freeze({
  diameter: 157.2768, height: 111.5568, centerY: 32.9184,
  screenApex: 73.152, publishedScreenArea: 14864.4864, publishedSeats: 17385,
  // Conditional fit of the public 2019 section, clipped at the event floor.
  screen: { radius: 58.11, tiltDegrees: 42, centerY: 15.042, centerZ: 0, clipOffset: 15.57436 },
  stage: { x: 0, y: 1.2, z: -50, width: 25, depth: 13 },
  seatPitch: .58, aisleWidth: 1.1, eyeHeight: 1.18,
});

// Back-deck Z/Y anchors: conditional tracing of the 2019 section. Row depth,
// rise and curvature remain estimates. Each tier has its own curvature origin.
export const TIERS = Object.freeze([
  { id: 100, name: 'Main', label: '메인', first: 101, last: 110, firstRow: 12, maxRows: 37, referenceRow: 37, radius: 80, rearZ: 4.81, elevation: 6.73, tread: .82, rise: .25, color: '#789ca7', access: 'Level 2' },
  { id: 200, name: 'Terrace', label: '테라스', first: 201, last: 211, firstRow: 1, maxRows: 21, referenceRow: 21, radius: 80, rearZ: 5.84, elevation: 21.84, tread: .90, rise: .48, color: '#a5c6bd', access: 'Level 4' },
  { id: 300, name: 'Lower Gallery', label: '로어 갤러리', first: 301, last: 311, firstRow: 1, maxRows: 20, referenceRow: 20, radius: 106, rearZ: 19.92, elevation: 34.48, tread: .90, rise: .60, color: '#aab6d3', access: 'Level 6' },
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

export function sectionAngles(tier, section) {
  const { start, end } = plan.sections[section];
  return { start: radians(start), end: radians(end), center: radians((start + end) / 2) };
}

export function makeLayout() {
  const seats = [], sections = [], accessibleInventory = [];
  const byId = new Map(), bySection = new Map();
  for (const tier of TIERS) {
    for (let section = tier.first; section <= tier.last; section++) {
      const angles = sectionAngles(tier, section), range = rowRange(tier, section);
      const group = { id: section, tier, ...angles, range, rows: new Map(), seats: [] };
      for (const [label, count] of Object.entries(SEAT_INVENTORY[section])) {
        if (!/^\d+$/.test(label)) {
          // WC is not converted into an invented row of standard chairs.
          accessibleInventory.push({ section, label, count }); continue;
        }
        const row = Number(label), { radius, floorY } = rowGeometry(tier, row);
        const available = angles.end - angles.start - BUILDING.aisleWidth / radius;
        const span = Math.min(count * BUILDING.seatPitch / radius, available);
        const start = angles.center - span / 2;
        const rowSeats = [];
        for (let number = 1; number <= count; number++) {
          const theta = start + (number - .5) * span / count;
          const seat = {
            id: `${section}-${row}-${number}`, index: seats.length,
            tier: tier.id, section, row, number, theta, radius, floorY,
            centerZ: tier.centerZ, rowStart: start, rowEnd: start + span,
            x: Math.sin(theta) * radius, y: floorY,
            z: tier.centerZ + Math.cos(theta) * radius, yaw: theta,
          };
          seats.push(seat); rowSeats.push(seat); group.seats.push(seat); byId.set(seat.id, seat);
        }
        group.rows.set(row, rowSeats);
      }
      sections.push(group); bySection.set(section, group);
    }
  }
  return { seats, sections, byId, bySection, accessibleInventory };
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
  const dx = BUILDING.stage.x - seat.x, dz = BUILDING.stage.z - seat.z;
  const dy = BUILDING.stage.y - seat.y - eyeHeight, horizontal = Math.hypot(dx, dz);
  let yawDifference = Math.atan2(-dx, -dz) - seat.yaw;
  while (yawDifference > Math.PI) yawDifference -= 2 * Math.PI;
  while (yawDifference < -Math.PI) yawDifference += 2 * Math.PI;
  return { distance: Math.hypot(horizontal, dy), elevation: seat.y + eyeHeight, stagePitch: Math.atan2(dy, horizontal), yawDifference };
}

export const PRESETS = [
  { label: '중앙 기준석', section: 206, row: 10 },
  { label: '측면 비교석', section: 210, row: 10 },
  { label: '상부 후방', section: 406, row: 23 },
  { label: '하부 가림 구간', section: 106, row: 35 },
];

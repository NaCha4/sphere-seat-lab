// Metres. Only the exterior dimensions and screen apex are measured public facts.
// The independent interior axes, row coordinates and pitches are reconstruction
// parameters, calibrated against the linked venue maps and section photographs.
export const BUILDING = Object.freeze({
  diameter: 157.2768,
  height: 111.5568,
  centerY: 32.9184,
  screenApex: 73.152,
  publishedScreenArea: 14864.4864,
  publishedSeats: 17385,
  // A tilted spherical cap is fitted to the two independently published anchors.
  // Radius and tilt remain estimates; area and maximum height are constraints.
  screen: { radius: 55, tiltDegrees: 35, centerY: 18.152, centerZ: -13 },
  bowlCenterZ: -20,
  stage: { x: 0, y: 1.2, z: -40, width: 25, depth: 13 },
  seatPitch: 0.63,
  eyeHeight: 1.18,
});

export const TIERS = Object.freeze([
  { id: 100, name: 'Main', label: '메인', first: 101, last: 110, firstRow: 12, maxRows: 37, angle: 104, radius: 18, tread: .76, elevation: .75, rise: .29, color: '#789ca7', access: 'Level 2' },
  { id: 200, name: 'Terrace', label: '테라스', first: 201, last: 211, firstRow: 1, maxRows: 21, angle: 103, radius: 35, tread: .79, elevation: 15.8, rise: .47, color: '#a5c6bd', access: 'Level 4' },
  { id: 300, name: 'Lower Gallery', label: '로어 갤러리', first: 301, last: 311, firstRow: 1, maxRows: 20, angle: 99, radius: 45.8, tread: .69, elevation: 28.0, rise: .55, color: '#aab6d3', access: 'Level 6' },
  { id: 400, name: 'Upper Gallery', label: '어퍼 갤러리', first: 403, last: 409, firstRow: 1, maxRows: 25, angle: 59, radius: 59.8, tread: .55, elevation: 40.15, rise: .56, color: '#ccada2', access: 'Level 6 / 7' },
]);

export const radians = degrees => degrees * Math.PI / 180;

export function rowRange(tier, section, cinema = false) {
  const edge = Math.min(section - tier.first, tier.last - section);
  let count = tier.maxRows;
  if (tier.id === 300) count = [9, 14, 17, 19][edge] ?? 20;
  if (tier.id === 400) count = [13, 21, 25, 25][edge];
  return { first: tier.id === 100 && cinema ? 1 : tier.firstRow, last: count };
}

export function sectionAngles(tier, section) {
  const count = tier.last - tier.first + 1;
  const span = radians(tier.angle * 2) / count;
  const start = -radians(tier.angle) + (section - tier.first) * span;
  // Radial circulation aisles are retained as gaps, rather than occupied seats.
  const aisle = radians(tier.id === 400 ? 1.25 : 1.1);
  return { start: start + aisle, end: start + span - aisle, center: start + span / 2 };
}

export function makeLayout({ cinema = false } = {}) {
  const seats = [];
  const sections = [];
  const byId = new Map();
  const bySection = new Map();
  for (const tier of TIERS) {
    for (let section = tier.first; section <= tier.last; section++) {
      const angles = sectionAngles(tier, section);
      const range = rowRange(tier, section, cinema);
      const group = { id: section, tier, ...angles, range, rows: new Map(), seats: [] };
      for (let row = range.first; row <= range.last; row++) {
        const radius = tier.radius + (row - 1) * tier.tread;
        const floorY = tier.elevation + (row - 1) * tier.rise;
        const count = Math.max(7, Math.floor(radius * (angles.end - angles.start) / BUILDING.seatPitch));
        const rowSeats = [];
        for (let number = 1; number <= count; number++) {
          const theta = angles.start + (number - .5) / count * (angles.end - angles.start);
          const seat = {
            id: `${section}-${row}-${number}`, index: seats.length,
            tier: tier.id, section, row, number, theta, radius, floorY,
            x: Math.sin(theta) * radius,
            y: floorY,
            z: BUILDING.bowlCenterZ + Math.cos(theta) * radius,
            // A chair faces the centre of its original curved row, not a
            // corrected sightline. Side-seat yaw difference remains observable.
            yaw: theta,
          };
          seats.push(seat); rowSeats.push(seat); group.seats.push(seat); byId.set(seat.id, seat);
        }
        group.rows.set(row, rowSeats);
      }
      sections.push(group); bySection.set(section, group);
    }
  }
  return { seats, sections, byId, bySection, cinema };
}

export function resolveSeat(layout, { section = 206, row = 10, number = null } = {}) {
  const group = layout.bySection.get(Number(section)) || layout.bySection.get(206);
  const r = Math.max(group.range.first, Math.min(group.range.last, Math.round(Number(row)) || group.range.first));
  const list = group.rows.get(r);
  const i = number == null ? Math.floor(list.length / 2) : Math.max(0, Math.min(list.length - 1, Math.round(Number(number)) - 1 || 0));
  return list[i];
}

export function seatMetrics(seat, eyeHeight = BUILDING.eyeHeight) {
  const dx = BUILDING.stage.x - seat.x;
  const dz = BUILDING.stage.z - seat.z;
  const dy = BUILDING.stage.y - seat.y - eyeHeight;
  const horizontal = Math.hypot(dx, dz);
  const actualYaw = Math.atan2(-dx, -dz);
  let yawDifference = actualYaw - seat.yaw;
  while (yawDifference > Math.PI) yawDifference -= 2 * Math.PI;
  while (yawDifference < -Math.PI) yawDifference += 2 * Math.PI;
  return {
    distance: Math.hypot(horizontal, dy), elevation: seat.y + eyeHeight,
    stagePitch: Math.atan2(dy, horizontal), yawDifference,
  };
}

export const PRESETS = [
  { label: '중앙 기준석', section: 206, row: 10 },
  { label: '측면 비교석', section: 210, row: 10 },
  { label: '상부 후방', section: 406, row: 23 },
  { label: '하부 가림 구간', section: 106, row: 35 },
];

import { makeLayout, resolveSeat } from './layout.js';
import { evaluateSeat } from './sightline.js';
import { getWorld } from './worlds.js';
import { evaluatePartitions } from './partition-sightline.js';

// Worker-owned CPU data only. GPU resources belong solely to the active world.
const layouts = new Map(), results = new Map();
function evaluation(worldId, selection, audience) {
  const world = getWorld(worldId);
  if (!layouts.has(world.id)) {
    if (layouts.size >= 4) layouts.delete(layouts.keys().next().value);
    layouts.set(world.id, makeLayout(world.id));
  }
  const layout = layouts.get(world.id), seat = resolveSeat(layout, selection);
  const key = `${world.id}/${seat.id}/${audience}`;
  if (!results.has(key)) {
    if (results.size >= 256) results.delete(results.keys().next().value);
    results.set(key, { ...evaluateSeat(layout, seat, { audience }), seatCount: layout.seats.length, section: seat.section, row: seat.row, number: seat.number });
  }
  return results.get(key);
}

function correspondingSelection(worldId, selection) {
  const source = makeLayout(selection.worldId ?? 'original');
  const start = resolveSeat(source, selection), sourceRow = source.bySection.get(start.section).rows.get(start.row);
  const target = makeLayout(worldId), near = resolveSeat(target, { section: start.section, row: start.row });
  const targetRow = target.bySection.get(near.section).rows.get(near.row);
  return { section: near.section, row: near.row, number: Math.min(targetRow.length, Math.floor((start.number-.5)/sourceRow.length*targetRow.length)+1) };
}

export function compareWorlds({ worldId, selection, audience, partitionAmount = 0 }) {
  if (getWorld(worldId).partitions) {
    if (!layouts.has(worldId)) layouts.set(worldId, makeLayout(worldId));
    const seat = resolveSeat(layouts.get(worldId), selection);
    return { partition: evaluatePartitions(seat, partitionAmount) };
  }
  return {
    original: evaluation('original', correspondingSelection('original',selection), audience),
    variant: evaluation(worldId, correspondingSelection(worldId,selection), audience),
  };
}

import { makeLayout, resolveSeat } from './layout.js';
import { evaluateSeat } from './sightline.js';
import { getWorld } from './worlds.js';

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
    results.set(key, evaluateSeat(layout, seat, { audience }));
  }
  return results.get(key);
}

export function compareWorlds({ worldId, selection, audience }) {
  return {
    original: evaluation('original', selection, audience),
    variant: evaluation(worldId, selection, audience),
  };
}

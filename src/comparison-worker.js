import { compareWorlds } from './comparison.js';

let latest, scheduled = false;
self.onmessage = ({ data }) => {
  latest = data;
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    const request = latest; scheduled = false;
    try { self.postMessage({ request: request.request, result: compareWorlds(request) }); }
    catch { self.postMessage({ request: request.request, error: true }); }
  }, 0);
};

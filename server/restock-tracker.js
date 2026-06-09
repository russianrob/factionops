export function median(nums) {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function coeffVar(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  if (mean === 0) return 0;
  const variance = nums.reduce((s, x) => s + (x - mean) * (x - mean), 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

export function reliabilityTier(n, cv) {
  if (n >= 8 && cv < 0.3) return "high";
  if (n >= 4 && cv < 0.6) return "med";
  return "low";
}

export function gaps(restocks) {
  const g = [];
  for (let i = 1; i < restocks.length; i++) g.push(restocks[i] - restocks[i - 1]);
  return g;
}

export function recordSample(item, curQty, nowSec) {
  let restocks = (item && item.restocks) ? item.restocks.slice() : [];
  if (item && item.qty != null && curQty > item.qty) {
    restocks.push(nowSec);
    if (restocks.length > 24) restocks = restocks.slice(restocks.length - 24);
  }
  return { qty: curQty, restocks: restocks };
}

export function computeEntry(restocks) {
  if (!restocks || restocks.length < 2) return null;
  const g = gaps(restocks);
  return {
    interval: Math.round(median(g)),
    last: restocks[restocks.length - 1],
    n: restocks.length,
    rel: reliabilityTier(restocks.length, coeffVar(g))
  };
}

export function buildModel(state, nowSec) {
  const items = {};
  for (const c in state) {
    for (const id in state[c]) {
      const e = computeEntry(state[c][id].restocks || []);
      if (e) { if (!items[c]) items[c] = {}; items[c][id] = e; }
    }
  }
  return { updated: nowSec, items: items };
}

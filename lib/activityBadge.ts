let _count = 0;
const _listeners: Array<(n: number) => void> = [];

export function setActivityBadge(n: number) {
  _count = n;
  _listeners.forEach((l) => l(n));
}

export function getActivityBadge(): number {
  return _count;
}

export function subscribeActivityBadge(fn: (n: number) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

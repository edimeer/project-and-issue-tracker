export function newId(prefix: string): string {
  const c = globalThis.crypto;
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-6);
  return `${prefix}_${raw}`;
}

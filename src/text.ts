export const norm = (s = ''): string =>
  (s || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();

export function bestOptionIndex(options: string[], value: string): number {
  const v = norm(value);
  if (!v || !options?.length) return -1;
  const t = options.map(o => norm(o));
  let i = t.findIndex(x => x === v);
  if (i >= 0) return i;
  i = t.findIndex(x => x.startsWith(v));
  if (i >= 0) return i;
  i = t.findIndex(x => x.includes(v));
  if (i >= 0) return i;
  if (/^\d+$/.test(v)) return t.findIndex(x => x.split(' ')[0] === v); // "5" -> "5+ years"
  return -1;
}

export interface LyricLine {
  time: number | null; // seconds, null for plain-text fallback lines
  text: string;
}

const TS = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/** Parses LRC text. Supports multiple timestamps per line and [mm:ss.xx] / [mm:ss.xxx]. Result is sorted by time. */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(TS)];
    if (stamps.length === 0) continue;
    const text = raw.replace(TS, "").trim();
    for (const m of stamps) {
      const minutes = Number(m[1]);
      const seconds = Number(m[2]);
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      out.push({ time: minutes * 60 + seconds + frac, text });
    }
  }
  return out.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

/** Plain text fallback: one line per non-empty row, no timestamps. */
export function parsePlain(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ time: null, text: t }));
}

export function getLyrics(lrc: string | null, plain: string | null): { lines: LyricLine[]; synced: boolean } {
  if (lrc && lrc.trim()) {
    const lines = parseLrc(lrc);
    if (lines.length > 0) return { lines, synced: true };
  }
  if (plain && plain.trim()) return { lines: parsePlain(plain), synced: false };
  return { lines: [], synced: false };
}

/** Binary search: index of the last line whose timestamp <= t (or -1). */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]!.time ?? 0) <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

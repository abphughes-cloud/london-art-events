// Merge listings of the same event from different sources (or the same source twice).
// Exact match on dedupe_key first, then a fuzzy pass: same venue, overlapping dates, similar title.

const words = (s) => new Set((s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(["the", "and", "for", "with", "private", "view", "exhibition", "london"]);

export function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.min(A.size, B.size);
}

const overlaps = (a, b) => {
  const aEnd = a.end_date || a.start_date, bEnd = b.end_date || b.start_date;
  return a.start_date <= bEnd && b.start_date <= aEnd;
};

export function isSameEvent(a, b) {
  if (a.dedupe_key === b.dedupe_key) return true;
  // Same page on the same site (IanVisits lists a show again on every date page).
  if (a.source_name === b.source_name && a.source_url === b.source_url) return true;
  if ((a.event_type === "private_view") !== (b.event_type === "private_view")) return false;
  if (!overlaps(a, b)) return false;
  const titleSim = similarity(a.title, b.title);
  if (a.venue_name && b.venue_name && similarity(a.venue_name, b.venue_name) >= 0.6) return titleSim >= 0.8;
  // Venue missing or named differently ("V&A South Kensington" / "Victoria and Albert (V&A) Museum"):
  // only merge when the titles are near-identical and specific enough to be unambiguous.
  return titleSim >= 0.9 && Math.min(words(a.title).size, words(b.title).size) >= 3;
}

// Keep the more confident record and fill its gaps from the other.
export function merge(a, b) {
  const [keep, other] = (b.confidence ?? 0) > (a.confidence ?? 0) ? [b, a] : [a, b];
  const out = { ...keep };
  // The earliest known start wins (IanVisits only knows "open on the day we looked").
  if (other.start_date < out.start_date) { out.start_date = other.start_date; out.dedupe_key = keep.dedupe_key.replace(/\|[^|]*$/, `|${other.start_date}`); }
  for (const [k, v] of Object.entries(other)) {
    if (out[k] == null || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
    else if (Array.isArray(out[k]) && Array.isArray(v)) out[k] = [...new Set([...out[k], ...v])];
  }
  if (out.price_type === "unknown" && other.price_type !== "unknown") {
    out.price_type = other.price_type; out.price_min_gbp = other.price_min_gbp;
  }
  out.also_listed_on = [...new Set([...(keep.also_listed_on || []), other.source_name])].filter((s) => s !== out.source_name);
  return out;
}

export function dedupe(events) {
  const kept = [];
  let merged = 0;
  for (const ev of events) {
    const i = kept.findIndex((k) => isSameEvent(k, ev));
    if (i === -1) kept.push(ev);
    else { kept[i] = merge(kept[i], ev); merged++; }
  }
  return { events: kept, merged };
}

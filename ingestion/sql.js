// SQL the partner can paste into the Supabase SQL editor (no service key needed).

const COLS = [
  "id", "title", "event_type", "description", "artists", "art_forms", "tags", "image_url",
  "start_date", "end_date", "start_time", "end_time", "venue_name", "address", "postcode", "area",
  "lat", "lng", "price_type", "price_min_gbp", "booking_required", "booking_url",
  "source_name", "source_url", "scraped_at", "confidence", "dedupe_key",
];

const lit = (v) => {
  if (v == null) return "null";
  if (Array.isArray(v)) return v.length ? `array[${v.map(lit).join(",")}]::text[]` : "'{}'::text[]";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

export function toSeedSql(events, sources = []) {
  const rows = events.map((e) => `(${COLS.map((c) => (c === "event_type" || c === "price_type") ? `${lit(e[c])}::${c}` : lit(e[c])).join(", ")})`);
  const updates = COLS.filter((c) => !["id", "dedupe_key"].includes(c)).map((c) => `${c} = excluded.${c}`).join(", ");
  let sql = `-- Seed data: ${events.length} London art events. Generated ${new Date().toISOString()}.\n`;
  sql += `-- Safe to re-run: existing rows are updated by dedupe_key.\n\n`;
  if (rows.length) {
    sql += `insert into events (${COLS.join(", ")}) values\n${rows.join(",\n")}\non conflict (dedupe_key) do update set ${updates};\n\n`;
  }
  for (const s of sources) {
    sql += `insert into sources (name, url, method, priority, last_run_at, last_count) values (${lit(s.name)}, ${lit(s.url)}, ${lit(s.method)}, ${s.priority ?? 2}, now(), ${s.last_count ?? 0}) on conflict (name) do update set last_run_at = now(), last_count = excluded.last_count;\n`;
  }
  return sql;
}

// Build the seed dataset: run every source, clean, dedupe, keep the next two weeks.
//   node ingestion/run.js                 ArtRabbit, GalleriesNow, IanVisits, SPACE (no API key needed)
//   node ingestion/run.js --pages 8       more ArtRabbit pages (20 cards each)
// With ANTHROPIC_API_KEY set, it also reads any extra pages in data/sources.json with Claude and
// tags art forms with Claude on top of the keyword tags.
//   node ingestion/run.js --no-ai         skip Claude even if ANTHROPIC_API_KEY is set
// Writes data/events.json (the app can read this until Supabase is loaded) and data/seed.sql.

import fs from "node:fs";
import "./env.js";
import * as artrabbit from "./adapters/artrabbit.js";
import * as galleriesnow from "./adapters/galleriesnow.js";
import * as ianvisits from "./adapters/ianvisits.js";
import * as space from "./adapters/space.js";
import * as artscalendar from "./adapters/artscalendar.js";
import * as wearelewisham from "./adapters/wearelewisham.js";
import { smallSources } from "./adapters/small.js";
import { fetchRegistryEntry, toSourceRow } from "./adapters/generic.js";
import { locate } from "./locate.js";
import { tasteTagsForEvent } from "./taste-tags.js";
import { normalize, londonToday, addDays } from "./normalize.js";
import { dedupe } from "./dedupe.js";
import { extractEvents, enrichEvents } from "./extract.js";
import { toSeedSql } from "./sql.js";
import { keywordTags } from "./keyword-tags.js";

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i === -1 ? dflt : args[i + 1]; };
const pages = Number(flag("--pages", 5));
const days = Number(flag("--days", 47)); // to 31 Dec: grassroots venues list few events, mostly weeks ahead
const useAI = !args.includes("--no-ai") && !!process.env.ANTHROPIC_API_KEY;

const today = londonToday();
const horizon = addDays(today, days);
const sourcesFile = new URL("../data/sources.json", import.meta.url);
const llmSources = fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, "utf8")) : [];

const all = [];
const sourceRows = [];

// Plain parsers, no AI. Each runs on its own so one broken source never blocks the rest.
const adapters = [
  [artrabbit, { pages }],
  [galleriesnow, {}],
  [ianvisits, { days }],
  [space, {}],
  [artscalendar, {}],
  [wearelewisham, {}],
  ...smallSources.map((s) => [s, {}]),
];
// Sources are different websites, so they run side by side; each still paces its own requests.
await Promise.all(adapters.map(async ([adapter, opts]) => {
  try {
    const rows = (await adapter.fetchEvents(opts)).map((r) => normalize(r)).filter(Boolean);
    console.log(`${adapter.source.name}: ${rows.length} records`);
    all.push(...rows);
    sourceRows.push({ ...adapter.source, last_count: rows.length });
  } catch (err) {
    console.warn(`${adapter.source.name}: skipped: ${err.message}`);
  }
}));

// Registry sources: one row in data/registry.json each, read by the generic iCal / JSON-LD / Tribe readers.
const registryFile = new URL("../data/registry.json", import.meta.url);
const registry = fs.existsSync(registryFile) ? JSON.parse(fs.readFileSync(registryFile, "utf8")) : [];
let nextEntry = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (nextEntry < registry.length) {
    const entry = registry[nextEntry++];
    try {
      const rows = (await fetchRegistryEntry(entry, { today, horizon })).map((r) => normalize(r)).filter(Boolean);
      console.log(`${entry.name} (${entry.method}): ${rows.length} records`);
      all.push(...rows);
      sourceRows.push(toSourceRow(entry, rows.length));
    } catch (err) {
      console.warn(`${entry.name}: skipped: ${err.message}`);
    }
  }
}));

// Events read from venues' own what's-on pages (free text no parser handles). For this build they were
// read by Claude in a Claude Code session from the page text saved by fetch-pages.js; see data/read-events.json.
const readFile = new URL("../data/read-events.json", import.meta.url);
if (fs.existsSync(readFile)) {
  const read = JSON.parse(fs.readFileSync(readFile, "utf8"));
  const counts = {};
  for (const r of read.events) {
    const row = normalize({ confidence: 0.6, scraped_at: read.read_at, ...r });
    if (!row) continue;
    all.push(row);
    counts[row.source_name] = (counts[row.source_name] || 0) + 1;
  }
  for (const [name, n] of Object.entries(counts)) {
    sourceRows.push({ name, url: read.sources[name] || read.events.find((e) => e.source_name === name).source_url, method: "llm_extract", priority: 2, last_count: n });
  }
  console.log(`Read from venue pages: ${Object.values(counts).reduce((a, b) => a + b, 0)} records from ${Object.keys(counts).length} venues`);
}

if (useAI) {
  for (const s of llmSources) {
    try {
      console.log(`${s.name}: extracting with Claude…`);
      const found = await extractEvents({ url: s.url }, { sourceName: s.name, today });
      console.log(`  ${found.length} events`);
      all.push(...found);
      sourceRows.push({ name: s.name, url: s.url, method: "llm_extract", priority: s.priority ?? 2, last_count: found.length });
    } catch (err) {
      console.warn(`  skipped: ${err.message}`); // one broken source never blocks the rest
    }
  }
} else if (llmSources.length) {
  console.log(`Skipping ${llmSources.length} AI sources (set ANTHROPIC_API_KEY in .env to include them).`);
}

const inWindow = all.filter((e) => (e.end_date || e.start_date) >= today && e.start_date <= horizon);
let { events, merged } = dedupe(inWindow);

// Quality gate: every event needs a venue and a place in London (see locate.js).
const located = await locate(events, { offline: args.includes("--offline") });
console.log(`Location clean-up: ${located.dropped} dropped (no venue or no findable London location), ${located.lookups} new venue look-ups.`);
events = located.events;

if (useAI) {
  console.log("Tagging art forms and tags with Claude…");
  try { events = await enrichEvents(events); }
  catch (err) { console.warn(`  Claude tagging failed (${err.message}); using keyword tags only.`); }
}
events = events.map(keywordTags).map((e) => ({ ...e, tags: tasteTagsForEvent(e) }));

events.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
events = events.map(({ also_listed_on, ...e }, i) => ({ id: stableId(e.dedupe_key), ...e }));

fs.mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../data/events.json", import.meta.url), JSON.stringify(events, null, 2));
fs.writeFileSync(new URL("../data/seed.sql", import.meta.url), toSeedSql(events, sourceRows));

const byType = Object.entries(events.reduce((m, e) => ((m[e.event_type] = (m[e.event_type] || 0) + 1), m), {}));
console.log(`\n${events.length} events (${today} to ${horizon}), ${merged} duplicates merged.`);
console.log(byType.map(([t, n]) => `${t}: ${n}`).join(", "));
const bySource = Object.entries(events.reduce((m, e) => ((m[e.source_name] = (m[e.source_name] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`By source (after dedupe): ${bySource.map(([t, n]) => `${t} ${n}`).join(", ")}`);
console.log("Wrote data/events.json and data/seed.sql");

// Deterministic UUID-shaped id from the dedupe key, so re-runs keep the same ids.
function stableId(key) {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x12345678, h4 = 0x9abcdef0;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    h3 = Math.imul(h3 ^ c, 3266489917) >>> 0; h4 = Math.imul(h4 ^ c, 668265263) >>> 0;
  }
  const hex = [h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

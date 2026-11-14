// Apply the shared taste vocabulary to every event in data/events.json and every row in Supabase `artworks`.
//   node ingestion/apply-taste-tags.js            tag both and write to Supabase
//   node ingestion/apply-taste-tags.js --dry      show coverage only, write nothing
// Artworks keep their existing tags; the prefixed taste tags are added alongside.
import fs from "node:fs";
import "./env.js";
import { tasteTagsForEvent, tasteTagsForArtwork, tasteVector, TAXONOMY } from "./taste-tags.js";
import { upsertEvents } from "./load.js";

const dry = process.argv.includes("--dry");
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };

const summary = (rows) => Object.fromEntries(["medium", "style", "subject", "mood", "period"].map((dim) => {
  const counts = {};
  for (const r of rows) for (const v of tasteVector(r.tags)[dim] || []) counts[v] = (counts[v] || 0) + 1;
  return [dim, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")];
}));

const file = new URL("../data/events.json", import.meta.url);
const events = JSON.parse(fs.readFileSync(file, "utf8")).map((e) => ({ ...e, tags: tasteTagsForEvent(e) }));
console.log(`EVENTS (${events.length})`, summary(events));

const res = await fetch(`${url}/rest/v1/artworks?select=id,title,medium,media_type,date_sort,tags,visual_description&limit=2000`, { headers });
if (!res.ok) throw new Error(`artworks read failed: HTTP ${res.status}`);
const artworks = (await res.json()).map((a) => ({ ...a, tags: tasteTagsForArtwork(a) }));
console.log(`ARTWORKS (${artworks.length})`, summary(artworks));

if (!dry) {
  fs.writeFileSync(file, JSON.stringify(events, null, 2));
  fs.writeFileSync(new URL("../data/taxonomy.json", import.meta.url), JSON.stringify(TAXONOMY, null, 2) + "\n");
  console.log(`events upserted: ${await upsertEvents(events)}`);
  let done = 0;
  for (const a of artworks) {
    const r = await fetch(`${url}/rest/v1/artworks?id=eq.${encodeURIComponent(a.id)}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ tags: a.tags }) });
    if (!r.ok) throw new Error(`artwork ${a.id}: HTTP ${r.status} ${await r.text()}`);
    done++;
  }
  console.log(`artworks updated: ${done}`);
}

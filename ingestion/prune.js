// Remove rows from Supabase that are no longer in data/events.json (stale or failed the quality gate),
// so the database matches the latest build exactly. Run after `npm run load`.
import fs from "node:fs";
import "./env.js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };

const keep = new Set(JSON.parse(fs.readFileSync(new URL("../data/events.json", import.meta.url), "utf8")).map((e) => e.id));
const res = await fetch(`${url}/rest/v1/events?select=id&limit=5000`, { headers });
if (!res.ok) throw new Error(`Supabase read failed: HTTP ${res.status}`);
const stale = (await res.json()).map((r) => r.id).filter((id) => !keep.has(id));
for (let i = 0; i < stale.length; i += 100) {
  const del = await fetch(`${url}/rest/v1/events?id=in.(${stale.slice(i, i + 100).join(",")})`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
  if (!del.ok) throw new Error(`Supabase delete failed: HTTP ${del.status} ${await del.text()}`);
}
console.log(`Removed ${stale.length} stale rows; ${keep.size} events in the latest build.`);

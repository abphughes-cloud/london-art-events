// Upsert data/events.json into Supabase (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env).
// Without a service key, paste data/seed.sql into the Supabase SQL editor instead.

import fs from "node:fs";
import "./env.js";

export async function upsertEvents(events, { url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY } = {}) {
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or paste data/seed.sql into the SQL editor).");
  const rows = events.map(({ id, also_listed_on, ...e }) => e); // let the database keep its own ids
  for (let i = 0; i < rows.length; i += 200) {
    const res = await fetch(`${url}/rest/v1/events?on_conflict=dedupe_key`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
    if (!res.ok) throw new Error(`Supabase upsert failed: HTTP ${res.status} ${await res.text()}`);
  }
  return rows.length;
}

if (import.meta.main) {
  const file = process.argv[2] || new URL("../data/events.json", import.meta.url);
  const events = JSON.parse(fs.readFileSync(file, "utf8"));
  const n = await upsertEvents(events);
  console.log(`Upserted ${n} events into Supabase.`);
}

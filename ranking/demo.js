// Try the ranking on real data:  node ranking/demo.js [--ai]
// Simulates a person who swiped on the app's artworks, then ranks this build's events for them.
import fs from "node:fs";
import "../ingestion/env.js";
import { rank, tasteFromSwipes, explainPicks } from "./rank.js";

const events = JSON.parse(fs.readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));
const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/artworks?select=id,title,tags&limit=2000`, { headers: { apikey: process.env.SUPABASE_ANON_KEY } });
const artworks = res.ok ? await res.json() : [];
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const plus = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Two made-up swipers: likes calm, nature and landscape art and dislikes dark religious pictures; or the reverse taste.
const personas = {
  "calm nature lover": (tags) => tags.includes("subject:landscape and nature") || tags.includes("mood:calm") ? true
    : tags.includes("mood:dark") || tags.includes("subject:myth and spirituality") ? false : null,
  "drawn to portraits and drama": (tags) => tags.includes("subject:portrait and body") && (tags.includes("mood:spectacular") || tags.includes("style:expressive")) ? true
    : tags.includes("subject:landscape and nature") ? false : null,
};

const profile = {
  liked_art_forms: [], liked_tags: [], avoid_tags: [], free_text: "",
  free_slots: [
    { date: today, from: "14:00", to: "21:00" },
    { date: plus(3), from: "18:00", to: "22:00" },
    { date: plus(6), from: "10:00", to: "18:00" },
  ],
  max_price_gbp: 20,
};
const home = { lat: 51.4740, lng: -0.0693 }; // Peckham
const byId = Object.fromEntries(events.map((e) => [e.id, e]));

for (const [name, decide] of Object.entries(personas)) {
  const swipes = artworks.map((a) => ({ artwork_id: a.id, liked: decide(a.tags || []) })).filter((s) => s.liked != null).slice(0, 40);
  const taste = tasteFromSwipes(swipes, artworks);
  const top = Object.entries(taste.weights).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${name}: ${taste.swipes} swipes. Likes ${top.slice(0, 4).map(([t, w]) => `${t} ${w}`).join(", ")}`);
  let picks = rank(profile, events, { today, taste, home, max_km: 12 });
  if (process.argv.includes("--ai") && process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    picks = await explainPicks(new Anthropic(), profile, picks, byId);
  }
  for (const p of picks) {
    const e = byId[p.event_id];
    console.log(`${Math.round(p.score * 100)}%  ${e.title}  (${e.venue_name}, ${e.area}, ${e.start_date}${e.start_time ? " " + e.start_time.slice(0, 5) : ""})\n     ${p.reason}`);
  }
}

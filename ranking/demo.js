// Try the ranking on the seed data:  node ranking/demo.js [--ai]
import fs from "node:fs";
import "../ingestion/env.js";
import { rank, explainPicks } from "./rank.js";

const events = JSON.parse(fs.readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const plus = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const profile = {
  liked_art_forms: ["printmaking", "photography", "drawing"],
  liked_tags: ["free", "emerging", "community"],
  avoid_tags: [],
  free_text: "experimental print, hate crowds",
  free_slots: [
    { date: today, from: "14:00", to: "21:00" },
    { date: plus(3), from: "18:00", to: "22:00" },
    { date: plus(6), from: "10:00", to: "18:00" },
  ],
  max_price_gbp: 15,
};

let picks = rank(profile, events, { today });
if (process.argv.includes("--ai") && process.env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  picks = await explainPicks(new Anthropic(), profile, picks, Object.fromEntries(events.map((e) => [e.id, e])));
}
const byId = Object.fromEntries(events.map((e) => [e.id, e]));
for (const p of picks) {
  const e = byId[p.event_id];
  console.log(`${Math.round(p.score * 100)}%  ${e.title}  (${e.venue_name}, ${e.start_date}${e.start_time ? " " + e.start_time.slice(0, 5) : ""})\n     ${p.reason}`);
}

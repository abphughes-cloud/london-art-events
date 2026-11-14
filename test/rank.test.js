import { test } from "node:test";
import assert from "node:assert/strict";
import { rank, tasteFromSwipes, tasteScore, learn, distanceKm } from "../ranking/rank.js";

const art = [
  { id: "a1", tags: ["medium:painting", "style:abstract", "subject:pure form and colour", "mood:calm"] },
  { id: "a2", tags: ["medium:painting", "style:abstract", "subject:pure form and colour", "mood:playful"] },
  { id: "a3", tags: ["medium:painting", "style:figurative", "subject:portrait and body", "mood:dark"] },
  { id: "a4", tags: ["medium:painting", "style:figurative", "subject:portrait and body", "mood:dark"] },
];
const swipes = [{ artwork_id: "a1", liked: true }, { artwork_id: "a2", liked: true }, { artwork_id: "a3", liked: false }, { artwork_id: "a4", liked: false }];
const HOME = { lat: 51.474, lng: -0.069 }; // Peckham

const ev = (id, tags, o = {}) => ({
  id, title: `Event ${id}`, event_type: "exhibition", start_date: "2026-11-14", end_date: "2026-12-20", start_time: null,
  venue_name: `Venue ${id}`, art_forms: [], tags, price_type: "free", price_min_gbp: 0, lat: 51.474, lng: -0.069, ...o,
});

test("swipes become taste weights: liked traits positive, disliked negative, shared traits neutral", () => {
  const { weights, swipes: n } = tasteFromSwipes(swipes, art);
  assert.equal(n, 4);
  assert.ok(weights["style:abstract"] > 0.9);
  assert.ok(weights["style:figurative"] < -0.9);
  assert.equal(weights["medium:painting"] ?? 0, 0); // on every artwork, liked and disliked equally
});

test("events matching liked art score higher than events matching disliked art", () => {
  const { weights } = tasteFromSwipes(swipes, art);
  const good = tasteScore(weights, ev("1", ["style:abstract", "subject:pure form and colour", "mood:calm"]));
  const bad = tasteScore(weights, ev("2", ["style:figurative", "subject:portrait and body", "mood:dark"]));
  assert.ok(good.score > 0.8 && bad.score < 0.2);
  assert.ok(good.liked.includes("style:abstract"));
});

test("rank: taste wins, far events are cut by max_km, and the last pick is a wildcard", () => {
  const taste = tasteFromSwipes([...swipes, ...swipes, ...swipes], art); // 12 swipes = full confidence
  const events = [
    ev("match", ["style:abstract", "subject:pure form and colour", "mood:playful", "scale:independent"]),
    ev("match2", ["style:abstract", "mood:playful", "scale:independent"]),
    ev("dislike", ["style:figurative", "subject:portrait and body", "mood:dark", "scale:institution"]),
    ev("different", ["style:documentary", "subject:everyday life", "scale:grassroots", "period:emerging"]),
    ev("far", ["style:abstract", "mood:calm"], { lat: 51.6, lng: -0.4 }),
  ];
  const profile = { liked_art_forms: [], liked_tags: [], avoid_tags: [], free_text: "", free_slots: [], max_price_gbp: null };
  const picks = rank(profile, events, { today: "2026-11-14", taste, home: HOME, max_km: 10, limit: 3 });
  assert.equal(picks[0].event_id, "match");
  assert.ok(!picks.some((p) => p.event_id === "far"));
  assert.equal(picks[2].event_id, "different");
  assert.match(picks[2].reason, /^Something different/);
  assert.match(picks[0].reason, /like the art you've liked/);
});

test("learning from saves and skips, and distance", () => {
  const w = learn({ "mood:calm": 0.9 }, ev("x", ["mood:calm", "style:minimal"]), "save");
  assert.equal(w["mood:calm"], 1);
  assert.equal(w["style:minimal"], 0.15);
  assert.equal(learn(w, ev("y", ["style:minimal"]), "skip")["style:minimal"], 0);
  assert.ok(Math.abs(distanceKm(HOME, { lat: 51.5074, lng: -0.1278 }) - 5.5) < 0.5); // Peckham to Charing Cross
});

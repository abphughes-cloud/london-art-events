// rank(profile, events, options) -> Pick[]   (TasteProfile, ArtEvent and Pick types: contract/event.ts)
//
// 1. Hard filters: still on, fits a free slot (from the calendar), within budget, not something they avoid,
//    within max distance if one is given.
// 2. Score 0..1 from: taste (artwork swipes + stated likes), distance, discovery (grassroots / emerging),
//    timing (closing soon / happening soon), price.
// 3. Variety (one pick per venue), plus one wildcard outside their usual taste.
// 4. A one-line reason per pick.
//
// Taste uses the shared prefixed tags on artworks and events (medium:, style:, subject:, mood:, period:,
// format:, scale:; values in data/taxonomy.json). Swipes on artworks become weights on those tags:
//   const taste = tasteFromSwipes(swipes, artworks);           // swipes: [{ artwork_id, liked }]
//   rank(profile, events, { taste, home: { lat, lng } });
//   taste.weights = learn(taste.weights, event, "save" | "skip"); // feedback on events keeps refining it
//
// Plain JS with no imports, so the same file runs in Node, the browser and a Supabase edge function (Deno).

const DAY_MS = 86400000;

// How much each part counts towards the final score.
export const WEIGHTS = { taste: 0.62, distance: 0.15, discovery: 0.1, timing: 0.08, price: 0.05 };

// Which taste dimensions matter when matching swipes to events. Artworks are historic paintings and prints
// while events are mostly contemporary, so mood, subject and style carry the match; period is ignored.
export const DIMENSIONS = { mood: 0.3, subject: 0.3, style: 0.25, medium: 0.15 };

// The tagger falls back to these when an event's text says little, so they are over-represented on events.
const FALLBACK_TAGS = new Set(["medium:mixed media", "style:conceptual", "subject:identity and community", "mood:calm"]);
const TASTE_TAG = /^(medium|style|subject|mood|period|format|scale):(.+)$/;

const lower = (xs) => (xs || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
const tokens = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 2));
const clamp = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const tasteTags = (tags) => (tags || []).filter((t) => TASTE_TAG.test(t));
const dimOf = (tag) => tag.split(":")[0];

// ---------- taste from artwork swipes ----------

// swipes: [{ artwork_id, liked: true|false }], artworks: rows from the `artworks` table.
// Returns { weights: { "mood:calm": 0.8, "style:abstract": -0.4, ... }, swipes: n }, each weight in -1..1
// per dimension. A trait shared by most artworks says little about someone, so rarer traits count more.
export function tasteFromSwipes(swipes, artworks) {
  const byId = new Map((artworks || []).map((a) => [String(a.id), a]));
  const freq = {};
  for (const a of artworks || []) for (const t of tasteTags(a.tags)) freq[t] = (freq[t] || 0) + 1;
  const n = Math.max(1, (artworks || []).length);
  const raw = {};
  let count = 0;
  for (const s of swipes || []) {
    const a = byId.get(String(s.artwork_id));
    if (!a) continue;
    count++;
    const sign = s.liked ? 1 : -1;
    for (const t of tasteTags(a.tags)) raw[t] = (raw[t] || 0) + sign * Math.log(1 + n / (freq[t] || 1));
  }
  return { weights: normalise(raw), swipes: count };
}

function normalise(raw) {
  const maxByDim = {};
  for (const [t, v] of Object.entries(raw)) maxByDim[dimOf(t)] = Math.max(maxByDim[dimOf(t)] || 0, Math.abs(v));
  const out = {};
  for (const [t, v] of Object.entries(raw)) if (maxByDim[dimOf(t)]) out[t] = Math.round((v / maxByDim[dimOf(t)]) * 100) / 100;
  return out;
}

// Feedback on an event ("save" or "skip") nudges the weights of that event's taste tags.
export function learn(weights, event, action, rate = 0.15) {
  const out = { ...(weights || {}) };
  const sign = action === "save" ? 1 : action === "skip" ? -1 : 0;
  for (const t of tasteTags(event.tags)) out[t] = Math.round(clamp((out[t] || 0) + sign * rate) * 100) / 100;
  return out;
}

// How well an event matches taste weights: 0..1, 0.5 = neutral. Also returns the tags that drove it.
export function tasteScore(weights, e) {
  if (!weights || !Object.keys(weights).length) return { score: 0.5, liked: [], disliked: [] };
  const byDim = {};
  for (const t of tasteTags(e.tags)) (byDim[dimOf(t)] ||= []).push(t);
  let total = 0, wsum = 0;
  const contributions = [];
  for (const [dim, dw] of Object.entries(DIMENSIONS)) {
    const tags = byDim[dim];
    if (!tags?.length) continue;
    const vals = tags.map((t) => (weights[t] || 0) * (FALLBACK_TAGS.has(t) ? 0.5 : 1));
    total += dw * (vals.reduce((a, b) => a + b, 0) / vals.length);
    wsum += dw;
    tags.forEach((t, i) => contributions.push([t, vals[i] * dw]));
  }
  contributions.sort((a, b) => b[1] - a[1]);
  return {
    score: wsum ? (clamp(total / wsum) + 1) / 2 : 0.5,
    liked: contributions.filter(([, v]) => v > 0.03).map(([t]) => t),
    disliked: contributions.filter(([, v]) => v < -0.03).map(([t]) => t),
  };
}

// ---------- stated likes (TasteProfile fields) ----------

const NEGATION = /\b(?:hate|hates|no|not|avoid|avoids|dislike|dislikes|without|never)\s+([a-z-]+)/g;
const FILLER = new Set(["and", "the", "love", "like", "into", "really", "anything", "stuff", "things", "art"]);

// "experimental print, hate crowds" -> likes {experimental, print}, avoids {crowds}
export function readFreeText(text) {
  const t = String(text || "").toLowerCase();
  const avoid = new Set([...t.matchAll(NEGATION)].map((m) => m[1]));
  const like = new Set([...tokens(t.replace(NEGATION, " "))].filter((w) => !FILLER.has(w)));
  return { like, avoid };
}

// Synonyms so "print" finds printmaking, "crowds" avoids big institutions, etc.
const EXPAND = {
  print: ["printmaking", "prints", "etching", "screenprint", "lino", "risograph"],
  photo: ["photography", "photographs"], photography: ["photo", "photographs"],
  paint: ["painting", "paintings"], sculpture: ["sculptural", "installation"],
  crowds: ["blockbuster", "busy", "scale:institution"], kids: ["family"], children: ["family"],
  quiet: ["calm", "mood:calm"], hands: ["hands-on", "workshop", "format:make"], experimental: ["experimental", "emerging", "performance"],
  ceramics: ["ceramic", "clay", "pottery"], textile: ["textiles", "weaving", "embroidery"],
};
const expand = (set) => { const out = new Set(set); for (const w of set) for (const x of EXPAND[w] || []) out.add(x); return out; };

function eventWords(e) {
  return tokens([e.title, e.description, e.venue_name, e.area, e.event_type.replace("_", " "),
    ...(e.art_forms || []), ...lower(e.tags).map((t) => t.replace(TASTE_TAG, "$2")), ...(e.artists || [])].join(" "));
}

// 0..1 from liked_art_forms, liked_tags (plain or prefixed, e.g. "format:make") and the free text.
export function statedScore(profile, e) {
  const forms = expand(new Set(lower(profile.liked_art_forms)));
  const likedTags = expand(new Set(lower(profile.liked_tags)));
  const likeWords = expand(readFreeText(profile.free_text).like);
  if (!forms.size && !likedTags.size && !likeWords.size) return { score: 0.5, matchedForms: [] };
  const words = eventWords(e), evTags = lower(e.tags);
  const evForms = [...lower(e.art_forms), ...evTags.filter((t) => t.startsWith("medium:")).map((t) => t.slice(7))];
  const matchedForms = [...new Set(evForms.filter((f) => forms.has(f) || [...forms].some((x) => f.includes(x))))];
  const tagHit = evTags.filter((t) => likedTags.has(t)).length;
  const wordHit = [...likeWords].filter((w) => words.has(w)).length;
  const parts = [];
  if (forms.size) parts.push(Math.min(1, matchedForms.length));
  if (likedTags.size) parts.push(Math.min(1, tagHit / 2));
  if (likeWords.size) parts.push(Math.min(1, wordHit / 2));
  return { score: parts.reduce((a, b) => a + b, 0) / parts.length, matchedForms };
}

// ---------- place and time ----------

export function distanceKm(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof b.lat !== "number") return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Does the event happen during one of the user's free slots (e.g. from their calendar)? Returns the slot or null.
// One-off events (with a start_time) must start inside the slot. Exhibitions only need to be running that day;
// they're usually open roughly 10:00-18:00, and late openings are tagged "late".
export function fitSlot(e, slots) {
  if (!slots?.length) return { date: e.start_date };
  const end = e.end_date || e.start_date;
  for (const s of slots) {
    if (s.date < e.start_date || s.date > end) continue;
    if (e.start_time && !e.end_date) {
      const t = e.start_time.slice(0, 5);
      if (t >= s.from.slice(0, 5) && t <= s.to.slice(0, 5)) return s;
      continue;
    }
    const daytime = s.from.slice(0, 5) < "18:00" || (e.tags || []).includes("late");
    if (daytime) return s;
  }
  return null;
}

// ---------- scoring ----------

// options: { today, taste: { weights, swipes }, home: { lat, lng }, discovery: 0..1 (how much to favour the long tail) }
export function scoreEvent(profile, e, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const swipe = tasteScore(options.taste?.weights, e);
  const stated = statedScore(profile, e);
  // Trust swipes more as they add up: about 12 swipes for full weight.
  const conf = Math.min(1, (options.taste?.swipes || 0) / 12);
  const hasStated = lower(profile.liked_art_forms).length || lower(profile.liked_tags).length || readFreeText(profile.free_text).like.size;
  const taste = conf && hasStated ? 0.7 * (conf * swipe.score + (1 - conf) * 0.5) + 0.3 * stated.score
    : conf ? conf * swipe.score + (1 - conf) * 0.5 : stated.score;

  const km = distanceKm(options.home, e);
  const tags = lower(e.tags);
  const scale = tags.includes("scale:grassroots") ? 1 : tags.includes("scale:institution") ? 0.2 : 0.6;
  const discovery = Math.max(scale, tags.includes("period:emerging") ? 1 : 0);
  const daysToStart = Math.max(0, (Date.parse(e.start_date) - Date.parse(today)) / DAY_MS);
  const daysToEnd = e.end_date ? (Date.parse(e.end_date) - Date.parse(today)) / DAY_MS : null;

  const parts = {
    taste,
    distance: km == null ? 0.5 : Math.exp(-km / 6), // 1 km 0.85, 5 km 0.43, 10 km 0.19
    discovery,
    timing: daysToEnd != null ? (daysToEnd < 7 ? 1 : 0.5) : Math.max(0, 1 - daysToStart / 21),
    price: e.price_type === "free" ? 1 : e.price_type === "unknown" || e.price_type === "donation" ? 0.6 : 0.3,
  };
  const w = { ...WEIGHTS, ...(options.discovery != null ? { discovery: options.discovery * 0.25 } : {}) };
  const wsum = Object.values(w).reduce((a, b) => a + b, 0);
  const score = Object.entries(w).reduce((s, [k, v]) => s + v * parts[k], 0) / wsum;
  return { score: Math.round(score * 100) / 100, parts, km, swipe, matchedForms: stated.matchedForms };
}

// options: { limit = 5, today, taste, home, max_km, discovery, wildcard = true }
export function rank(profile, events, options = {}) {
  const { limit = 5, max_km = null, wildcard = true } = options;
  const today = options.today || new Date().toISOString().slice(0, 10);
  const avoid = expand(new Set([...lower(profile.avoid_tags), ...readFreeText(profile.free_text).avoid]));
  const candidates = [];
  for (const e of events) {
    if ((e.end_date || e.start_date) < today) continue;
    if (profile.max_price_gbp != null && e.price_type === "paid" && (e.price_min_gbp ?? Infinity) > profile.max_price_gbp) continue;
    if ([...avoid].some((a) => eventWords(e).has(a) || lower(e.tags).includes(a))) continue;
    const slot = fitSlot(e, profile.free_slots);
    if (!slot) continue;
    const s = scoreEvent(profile, e, { ...options, today });
    if (max_km != null && s.km != null && s.km > max_km) continue;
    candidates.push({ e, slot, ...s });
  }
  candidates.sort((a, b) => b.score - a.score || a.e.start_date.localeCompare(b.e.start_date));

  // Main picks: one per venue; at most limit-2 of one event type unless it scores close to the best.
  const mainCount = wildcard && limit >= 3 && options.taste?.swipes ? limit - 1 : limit;
  const best = candidates[0]?.score ?? 0;
  const picks = [], venues = new Set(), types = {};
  const take = (c) => { picks.push(c); venues.add((c.e.venue_name || c.e.id).toLowerCase()); types[c.e.event_type] = (types[c.e.event_type] || 0) + 1; };
  for (const c of candidates) {
    if (picks.length >= mainCount) break;
    const typeFull = (types[c.e.event_type] || 0) >= Math.max(1, limit - 2) && c.score < best * 0.9;
    if (venues.has((c.e.venue_name || c.e.id).toLowerCase()) || typeFull) continue;
    take(c);
  }
  for (const c of candidates) { if (picks.length >= mainCount) break; if (!picks.includes(c)) take(c); }

  // Wildcard: a good, nearby, long-tail event in a style or subject they haven't shown interest in.
  if (picks.length < limit && mainCount < limit) {
    const likedStyles = new Set(picks.flatMap((p) => tasteTags(p.e.tags).filter((t) => /^(style|subject):/.test(t))));
    const wild = candidates
      .filter((c) => !picks.includes(c) && !venues.has((c.e.venue_name || c.e.id).toLowerCase()) && c.swipe.score <= 0.55)
      .filter((c) => !tasteTags(c.e.tags).some((t) => /^style:/.test(t) && likedStyles.has(t)))
      .map((c) => ({ c, s: 0.5 * c.parts.discovery + 0.3 * c.parts.distance + 0.2 * c.parts.timing }))
      .sort((a, b) => b.s - a.s)[0];
    if (wild) take({ ...wild.c, wildcard: true });
  }
  for (const c of candidates) { if (picks.length >= limit) break; if (!picks.includes(c)) take(c); }

  return picks.map((c) => ({ event_id: c.e.id, score: c.score, reason: templateReason(profile, c) }));
}

// ---------- reasons ----------

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tagValue = (t) => t.replace(TASTE_TAG, "$2");

function templateReason(profile, c) {
  const { e, slot, km, swipe, matchedForms, wildcard } = c;
  const bits = [];
  const liked = (swipe?.liked || []).filter((t) => /^(mood|style|subject|medium):/.test(t) && !FALLBACK_TAGS.has(t)).slice(0, 2).map(tagValue);
  if (wildcard) {
    const style = tasteTags(e.tags).find((t) => t.startsWith("style:"));
    bits.push(`Something different${style ? `: ${tagValue(style)}` : ""}`);
  } else if (liked.length) bits.push(`${cap(liked.join(", "))}, like the art you've liked`);
  else if (matchedForms?.length) bits.push(`${cap(matchedForms[0])}, which you like`);
  if (e.event_type === "private_view") bits.push("an opening night");
  else if (e.event_type === "workshop") bits.push("hands-on");
  if (lower(e.tags).includes("period:emerging")) bits.push("emerging artists");
  else if (lower(e.tags).includes("scale:grassroots")) bits.push("a local find");
  if (e.price_type === "free") bits.push("free");
  if (km != null) bits.push(km < 1 ? "under 1 km away" : `${km.toFixed(km < 10 ? 1 : 0)} km away`);
  if (slot?.from) {
    const d = new Date(`${slot.date}T12:00:00Z`);
    bits.push(`fits your free ${WEEKDAY[d.getUTCDay()]}${e.start_time ? ` at ${e.start_time.slice(0, 5)}` : ""}`);
  }
  if (e.end_date && Date.parse(e.end_date) - Date.now() < 7 * DAY_MS) bits.push("closes soon");
  const s = bits.slice(0, 4).join(", ");
  return s ? `${cap(s)}.` : `${cap(e.event_type.replace("_", " "))} at ${e.venue_name ?? "a London venue"}.`;
}

// Optional: replace the template reasons with one line each written by Claude, in one call.
// `client` is an Anthropic SDK client, passed in so this file has no imports.
export async function explainPicks(client, profile, picks, eventsById, { model = "claude-opus-5-5" } = {}) {
  const list = picks.map((p, i) => {
    const e = eventsById[p.event_id];
    return `${i}. ${e.title} | ${e.event_type} | ${e.venue_name ?? ""} | ${e.start_date}${e.end_date ? `..${e.end_date}` : ""}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""} | forms: ${(e.art_forms || []).join(", ")} | tags: ${(e.tags || []).join(", ")} | ${e.price_type} | ${e.description ?? ""}`;
  }).join("\n");
  const response = await client.messages.create({
    model, max_tokens: 4000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: {
        type: "object", additionalProperties: false, required: ["reasons"],
        properties: { reasons: { type: "array", items: { type: "string" } } },
      } },
    },
    system: "You write the one-line reason shown on each pick in a personal 'Your art week' feed. Max 14 words each, second person, concrete (art form, timing, price, vibe). Only use facts given. No hype words.",
    messages: [{ role: "user", content: `Their taste: liked forms ${profile.liked_art_forms.join(", ") || "-"}; liked tags ${profile.liked_tags.join(", ") || "-"}; avoid ${profile.avoid_tags.join(", ") || "-"}; in their words: "${profile.free_text}".\nPicks, in order (return one reason per line, same order):\n${list}` }],
  });
  if (response.stop_reason === "refusal") return picks;
  const text = response.content.find((b) => b.type === "text")?.text;
  const reasons = text ? JSON.parse(text).reasons : [];
  return picks.map((p, i) => ({ ...p, reason: reasons[i] || p.reason }));
}

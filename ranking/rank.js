// rank(profile, events) -> Pick[]  (types in contract/event.ts)
// 1. Filter: dates that fit a free slot, price, things the user wants to avoid.
// 2. Score taste fit 0..1.  3. Keep variety (one pick per venue).  4. One-line reason per pick.
// Plain JS with no imports, so the same file runs in Node, the browser and a Supabase edge function (Deno).

const DAY_MS = 86400000;
const WEIGHTS = { artForm: 0.4, tag: 0.2, words: 0.2, price: 0.1, soon: 0.1 };

const lower = (xs) => (xs || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
const tokens = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 2));
const NEGATION = /\b(?:hate|hates|no|not|avoid|avoids|dislike|dislikes|without|never)\s+([a-z-]+)/g;
const FILLER = new Set(["and", "the", "love", "like", "into", "really", "anything", "stuff", "things", "art"]);

// "experimental print, hate crowds" -> likes {experimental, print}, avoids {crowds}
export function readFreeText(text) {
  const t = String(text || "").toLowerCase();
  const avoid = new Set([...t.matchAll(NEGATION)].map((m) => m[1]));
  const like = new Set([...tokens(t.replace(NEGATION, " "))].filter((w) => !FILLER.has(w)));
  return { like, avoid };
}

// Synonyms so "print" finds printmaking, "crowds" avoids blockbusters, etc.
const EXPAND = {
  print: ["printmaking", "prints", "etching", "screenprint", "lino", "risograph"],
  photo: ["photography", "photographs"], photography: ["photo", "photographs"],
  paint: ["painting", "paintings"], sculpture: ["sculptural", "installation"],
  crowds: ["blockbuster", "busy"], kids: ["family"], children: ["family"],
  quiet: ["calm"], hands: ["hands-on", "workshop"], experimental: ["experimental", "emerging", "performance"],
  ceramics: ["ceramic", "clay", "pottery"], textile: ["textiles", "weaving", "embroidery"],
};
const expand = (set) => { const out = new Set(set); for (const w of set) for (const x of EXPAND[w] || []) out.add(x); return out; };

function eventWords(e) {
  return tokens([e.title, e.description, e.venue_name, e.area, e.event_type.replace("_", " "),
    ...(e.art_forms || []), ...(e.tags || []), ...(e.artists || [])].join(" "));
}

// Does the event happen during one of the user's free slots? Returns the matching slot or null.
// One-off events (with a start_time) must start inside the slot. Exhibitions only need to be
// running that day; they're usually open roughly 10:00-18:00, and late openings are tagged "late".
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

export function scoreEvent(profile, e, today) {
  const forms = expand(new Set(lower(profile.liked_art_forms)));
  const likedTags = expand(new Set(lower(profile.liked_tags)));
  const free = readFreeText(profile.free_text);
  const likeWords = expand(free.like);
  const words = eventWords(e);
  const evForms = lower(e.art_forms), evTags = lower(e.tags);

  const matchedForms = evForms.filter((f) => forms.has(f) || [...forms].some((x) => f.includes(x)));
  const formHit = matchedForms.length;
  const tagHit = evTags.filter((t) => likedTags.has(t)).length;
  const wordHit = [...likeWords].filter((w) => words.has(w)).length;
  const days = Math.max(0, (Date.parse(e.start_date) - Date.parse(today)) / DAY_MS);

  const parts = {
    artForm: forms.size ? Math.min(1, formHit) : 0.5,
    tag: likedTags.size ? Math.min(1, tagHit / 2) : 0.5,
    words: likeWords.size ? Math.min(1, wordHit / 2) : 0.5,
    price: e.price_type === "free" ? 1 : e.price_type === "unknown" || e.price_type === "donation" ? 0.6 : 0.3,
    soon: e.end_date ? (Date.parse(e.end_date) - Date.parse(today) < 7 * DAY_MS ? 1 : 0.5) : Math.max(0, 1 - days / 14),
  };
  const score = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0);
  return { score: Math.round(score * 100) / 100, parts, formHit, matchedForms, tagHit, wordHit };
}

export function rank(profile, events, { limit = 5, today = new Date().toISOString().slice(0, 10) } = {}) {
  const avoid = expand(new Set([...lower(profile.avoid_tags), ...readFreeText(profile.free_text).avoid]));
  const candidates = [];
  for (const e of events) {
    if ((e.end_date || e.start_date) < today) continue;
    if (profile.max_price_gbp != null && e.price_type === "paid" && (e.price_min_gbp ?? Infinity) > profile.max_price_gbp) continue;
    const words = eventWords(e);
    if ([...avoid].some((a) => words.has(a) || lower(e.tags).includes(a))) continue;
    const slot = fitSlot(e, profile.free_slots);
    if (!slot) continue;
    candidates.push({ e, slot, ...scoreEvent(profile, e, today) });
  }
  candidates.sort((a, b) => b.score - a.score || a.e.start_date.localeCompare(b.e.start_date));

  // Variety: one pick per venue, and at most limit-2 of one event type, but only among
  // candidates that score close to the best (variety shouldn't promote poor matches).
  const best = candidates[0]?.score ?? 0;
  const picks = [], venues = new Set(), types = {};
  for (const c of candidates) {
    if (picks.length >= limit) break;
    const v = (c.e.venue_name || c.e.id).toLowerCase();
    const typeFull = (types[c.e.event_type] || 0) >= Math.max(1, limit - 2) && c.score < best * 0.9;
    if (venues.has(v) || typeFull) continue;
    venues.add(v); types[c.e.event_type] = (types[c.e.event_type] || 0) + 1;
    picks.push(c);
  }
  // Fill up if the variety rule left gaps.
  for (const c of candidates) { if (picks.length >= limit) break; if (!picks.includes(c)) picks.push(c); }

  return picks.map((c) => ({ event_id: c.e.id, score: c.score, reason: templateReason(profile, c) }));
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function templateReason(profile, { e, slot, matchedForms }) {
  const bits = [];
  const form = matchedForms?.[0] || lower(e.art_forms)[0];
  if (matchedForms?.length) bits.push(`${form[0].toUpperCase()}${form.slice(1)}, which you like`);
  else if (form) bits.push(`${form[0].toUpperCase()}${form.slice(1)}`);
  if (e.event_type === "private_view") bits.push("an opening night");
  if (e.price_type === "free") bits.push("free");
  if (slot?.from) {
    const d = new Date(`${slot.date}T12:00:00Z`);
    bits.push(`fits your free ${WEEKDAY[d.getUTCDay()]}${e.start_time ? ` at ${e.start_time.slice(0, 5)}` : ""}`);
  }
  if (e.end_date && Date.parse(e.end_date) - Date.now() < 7 * DAY_MS) bits.push("closes soon");
  const s = bits.join(", ");
  return s ? `${s[0].toUpperCase()}${s.slice(1)}.` : `${e.event_type.replace("_", " ")} at ${e.venue_name ?? "a London venue"}.`;
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

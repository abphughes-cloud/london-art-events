// Generic readers: one registry row (data/registry.json) per source, no new code per source.
//   ical    an .ics calendar feed
//   jsonld  schema.org Event objects embedded in a page (<script type="application/ld+json">)
//   tribe   WordPress "The Events Calendar" REST API (/wp-json/tribe/events/v1/events)
// Registry row: { name, url, method, priority, venue?, area?, artFilter?, tags? }
//   venue/area  defaults when the feed doesn't name a place (single-venue sites)
//   artFilter   true for general listings (libraries, councils): keep only art-looking events
import { UA, sleep, text, parsePrice, looksLikeArt, POSTCODE } from "../html.js";

// ---------- polite fetching: ~1 request/second per host, robots.txt respected ----------

const lastHit = new Map();
const robotsCache = new Map();

async function rawFetch(url, accept) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) || 0) + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  return fetch(url, {
    headers: { "User-Agent": UA, ...(accept ? { Accept: accept } : {}) },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
}

// Rules for "User-agent: *" only. A missing or unreadable robots.txt means no stated rules.
export function parseRobots(txt) {
  const rules = [];
  let applies = false, inGroup = false;
  for (const line of String(txt).split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2];
    if (key === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (val === "*") applies = true;
    } else {
      inGroup = false;
      if (applies && (key === "disallow" || key === "allow") && val) rules.push({ allow: key === "allow", path: val });
    }
  }
  return rules;
}

export function robotsAllows(rules, path) {
  let best = null;
  for (const r of rules) {
    const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? best.allow : true;
}

export async function allowed(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let rules = [];
    try {
      const res = await rawFetch(`${u.origin}/robots.txt`);
      if (res.ok) rules = parseRobots(await res.text());
    } catch { /* no robots.txt reachable */ }
    robotsCache.set(u.origin, rules);
  }
  return robotsAllows(robotsCache.get(u.origin), u.pathname + u.search);
}

// Fetch a page if robots.txt allows it. A 403/404 is an answer, not something to work around.
export async function politeGet(url, accept) {
  if (!(await allowed(url))) throw new Error(`${url}: disallowed by robots.txt`);
  const res = await rawFetch(url, accept);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// ---------- shared ----------

// Guess the contract's event_type from words in the title/category.
export function inferType(...parts) {
  const s = parts.filter(Boolean).join(" ").toLowerCase();
  if (/private view|opening (night|reception|party|event)|\bpreview\b|\bvernissage\b|launch (night|party)/.test(s)) return "private_view";
  if (/open studio/.test(s)) return "open_studio";
  if (/workshop|masterclass|\bclass(es)?\b|\bcourse\b|life drawing|drawing (group|session|club)|drop-in|make your own|\bsession\b/.test(s)) return "workshop";
  if (/\btalk\b|lecture|in conversation|panel|symposium|seminar|discussion|\bq&a\b|reading group/.test(s)) return "talk";
  if (/screening|\bfilm\b|cinema/.test(s)) return "screening";
  if (/\btour\b|\bwalk\b/.test(s)) return "tour";
  if (/\bfair\b|\bmarket\b/.test(s)) return "fair";
  if (/performance|\blive\b|concert|\bgig\b|dance/.test(s)) return "performance";
  if (/exhibition|\bshow\b|display|installation|retrospective/.test(s)) return "exhibition";
  return null;
}

// Wall-clock date and time in London for an instant.
function londonParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// "2026-11-19T18:30:00+00:00" | "2026-11-19 18:30:00" | "2026-11-19" -> { date, time }
export function splitDateTime(s) {
  if (!s) return {};
  const str = String(s).trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return {};
  if (m[2] && /(Z|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str.replace(" ", "T"));
    if (!isNaN(d)) return londonParts(d);
  }
  return { date: m[1], time: m[2] ? `${m[2]}:${m[3]}` : null };
}

// Making-and-looking words the stricter shared filter misses (community workshops mostly).
const MAKING = /\b(printing|lino\w*|screen ?print\w*|pottery|clay|collage|sketch\w*|life drawing|zine\w*|weaving|embroider\w*|knit\w*|crochet|calligraphy|mural\w*|mosaic\w*|private view|open studios?|makers?|creative|jewellery|risograph|cyanotype|film ?making|animation)\b/i;
export const artish = (...parts) => looksLikeArt(...parts) || MAKING.test(parts.filter(Boolean).join(" "));

function finish(entry, e) {
  if (!e.title || !e.start_date) return null;
  const venue = e.venue_name || entry.venue || null;
  const type = e.event_type || inferType(e.title, e.category)
    || (e.end_date && e.end_date > e.start_date ? "exhibition" : "other");
  if (entry.artFilter && !artish(e.title, e.category, e.description?.slice(0, 300))) return null;
  const { category, ...rest } = e;
  return {
    ...rest,
    title: e.title.slice(0, 200),
    description: e.description ? e.description.slice(0, 600) : null,
    event_type: type,
    venue_name: venue,
    area: e.area || entry.area || null,
    postcode: e.postcode || (e.address || "").match(POSTCODE)?.[1] || null,
    tags: [...(entry.tags || []), ...(e.tags || [])],
    source_name: entry.name,
    source_url: e.source_url || entry.url,
    scraped_at: new Date().toISOString(),
    confidence: 0.7,
  };
}

// ---------- iCal ----------

function icsDate(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return {};
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { date, time: null, allDay: true };
  if (m[7]) return londonParts(new Date(`${date}T${m[4]}:${m[5]}:00Z`));
  return { date, time: `${m[4]}:${m[5]}` }; // floating or TZID time: London sources, taken as local
}

const icsText = (s) => text(String(s || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1"));

export function parseIcs(ics, entry) {
  const lines = String(ics).replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur) {
        const s = icsDate(cur.DTSTART?.v || "", cur.DTSTART?.p), e = icsDate(cur.DTEND?.v || "", cur.DTEND?.p);
        let end = e.date || null;
        // All-day DTEND is exclusive: a one-day event "ends" the next morning.
        if (end && e.allDay && end > s.date) {
          const d = new Date(`${end}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); end = d.toISOString().slice(0, 10);
        }
        const loc = icsText(cur.LOCATION?.v);
        const [locName, ...locRest] = (loc || "").split(/,\s*/);
        const row = finish(entry, {
          title: icsText(cur.SUMMARY?.v),
          description: icsText(cur.DESCRIPTION?.v),
          category: icsText(cur.CATEGORIES?.v),
          start_date: s.date, end_date: end && end !== s.date ? end : null,
          start_time: s.time || null, end_time: end === s.date || !end ? e.time || null : e.time || null,
          venue_name: loc && !/^\d/.test(locName) && !/^https?:/i.test(loc) ? locName : null,
          address: locRest.length ? locRest.join(", ") : null,
          image_url: (cur.ATTACH?.v || "").match(/^https?:\S+\.(?:jpe?g|png|webp)/i)?.[0] || null,
          source_url: /^https?:/.test(cur.URL?.v || "") ? cur.URL.v : null,
          ...(cur.DESCRIPTION ? priceIfStated(icsText(cur.DESCRIPTION.v)) : {}),
        });
        if (row && cur.STATUS?.v !== "CANCELLED") out.push(row);
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
    if (m && !cur[m[1]]) cur[m[1]] = { v: m[3], p: m[2] };
  }
  return out;
}

const priceIfStated = (s) => {
  const p = parsePrice(s);
  return p.price_type === "unknown" ? {} : p;
};

// ---------- JSON-LD ----------

const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const isEventType = (t) => asArray(t).some((x) => /Event$/.test(String(x)) || /Exhibition/.test(String(x)));

function collectEvents(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => collectEvents(n, out)); return; }
  if (isEventType(node["@type"]) && node.name && node.startDate) out.push(node);
  for (const k of ["@graph", "itemListElement", "item", "mainEntity", "mainEntityOfPage", "event", "events", "subEvent", "hasPart"]) {
    if (node[k]) collectEvents(node[k], out);
  }
}

export function parseJsonLd(html, entry, pageUrl = entry.url) {
  const found = [];
  for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectEvents(JSON.parse(m[1].trim()), found); } catch { /* malformed block */ }
  }
  const out = [];
  for (const j of found) {
    const s = splitDateTime(j.startDate), e = splitDateTime(j.endDate);
    const loc = asArray(j.location).find((l) => l && typeof l === "object" && !/VirtualLocation/.test(l["@type"])) || null;
    if (!loc && asArray(j.location).some((l) => /VirtualLocation/.test(l?.["@type"]))) continue; // online only
    const addr = loc?.address;
    const address = typeof addr === "string" ? addr
      : addr ? [addr.streetAddress, addr.addressLocality, addr.postalCode].filter(Boolean).join(", ") : null;
    const offer = asArray(j.offers)[0];
    const priceNum = offer && offer.price != null && offer.price !== "" ? Number(offer.lowPrice ?? offer.price) : null;
    const free = j.isAccessibleForFree === true || j.isAccessibleForFree === "true" || priceNum === 0;
    const img = asArray(j.image)[0];
    let url = typeof j.url === "string" ? j.url : null;
    try { url = url ? new URL(url, pageUrl).href : null; } catch { url = null; }
    const row = finish(entry, {
      title: text(j.name),
      description: text(j.description),
      category: asArray(j["@type"]).join(" "),
      start_date: s.date, end_date: e.date && e.date !== s.date ? e.date : null,
      start_time: s.time || null, end_time: e.time || null,
      venue_name: text(typeof loc?.name === "string" ? loc.name : null),
      address: text(address), postcode: typeof addr === "object" ? addr?.postalCode || null : null,
      lat: Number(loc?.geo?.latitude) || null, lng: Number(loc?.geo?.longitude) || null,
      artists: asArray(j.performer).map((p) => text(typeof p === "string" ? p : p?.name)).filter(Boolean).slice(0, 8),
      image_url: typeof img === "string" ? img : img?.url || null,
      ...(free ? { price_type: "free", price_min_gbp: 0 } : priceNum > 0 ? { price_type: "paid", price_min_gbp: priceNum } : {}),
      booking_url: typeof offer?.url === "string" && /^https?:/.test(offer.url) ? offer.url : null,
      source_url: url || pageUrl,
    });
    if (row && !/Cancelled/.test(j.eventStatus || "")) out.push(row);
  }
  return out;
}

// ---------- WordPress: The Events Calendar (Tribe) ----------

export function tribeUrl(siteUrl, today, horizon) {
  const u = new URL("/wp-json/tribe/events/v1/events", siteUrl);
  u.searchParams.set("per_page", "50");
  if (today) u.searchParams.set("start_date", today);
  if (horizon) u.searchParams.set("end_date", horizon);
  return u.href;
}

export function parseTribe(json, entry) {
  const out = [];
  for (const ev of json?.events || []) {
    const s = splitDateTime(ev.start_date), e = splitDateTime(ev.end_date);
    const v = Array.isArray(ev.venue) ? ev.venue[0] : ev.venue;
    const cost = text(ev.cost);
    const row = finish(entry, {
      title: text(ev.title),
      description: text(ev.excerpt || ev.description),
      category: (ev.categories || []).map((c) => c.name).join(" "),
      start_date: s.date, end_date: e.date && e.date !== s.date ? e.date : null,
      start_time: ev.all_day ? null : s.time || null, end_time: ev.all_day ? null : e.time || null,
      venue_name: text(v?.venue),
      address: text([v?.address, v?.city].filter(Boolean).join(", ")), postcode: v?.zip || null,
      lat: Number(v?.geo_lat) || null, lng: Number(v?.geo_lng) || null,
      image_url: ev.image?.url || null,
      ...(cost ? priceIfStated(cost) : {}),
      booking_url: /^https?:/.test(ev.website || "") ? ev.website : null,
      source_url: ev.url,
    });
    if (row) out.push(row);
  }
  return out;
}

// ---------- registry runner ----------

const SOURCE_METHOD = { ical: "api", tribe: "api", jsonld: "scrape" };

export const toSourceRow = (entry, count) => ({
  name: entry.name, url: entry.url, method: SOURCE_METHOD[entry.method] || "scrape",
  priority: entry.priority ?? 2, last_count: count,
});

export async function fetchRegistryEntry(entry, { today, horizon } = {}) {
  if (entry.method === "ical") return parseIcs(await politeGet(entry.url, "text/calendar"), entry);
  if (entry.method === "jsonld") return parseJsonLd(await politeGet(entry.url), entry);
  if (entry.method === "tribe") {
    const out = [];
    let next = tribeUrl(entry.url, today, horizon);
    for (let page = 0; next && page < 4; page++) {
      const json = JSON.parse(await politeGet(next, "application/json"));
      out.push(...parseTribe(json, entry));
      next = json.next_rest_url || null;
    }
    return out;
  }
  throw new Error(`unknown method "${entry.method}"`);
}

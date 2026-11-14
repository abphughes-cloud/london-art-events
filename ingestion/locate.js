// Location clean-up: every event that reaches the app has a venue and a place on the map.
//   1. copy what another listing already knows about the same venue (postcode, address, coordinates)
//   2. postcode -> coordinates + borough, and coordinates -> nearest postcode (postcodes.io, bulk, free, no key)
//   3. venue name only -> OpenStreetMap search (Nominatim, 1 request/second, cached in data/venue-cache.json)
//   4. drop anything still without a venue name or a location in Greater London
import fs from "node:fs";
import { UA, sleep } from "./html.js";

const key = (name) => (name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/&/g, "and").replace(/\b(the|gallery|galleries|london|ltd)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hasPoint = (e) => typeof e.lat === "number" && typeof e.lng === "number";
const inLondon = (lat, lng) => lat > 51.28 && lat < 51.7 && lng > -0.52 && lng < 0.34;

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// Fill gaps on each event from the best-known facts about its venue.
function shareVenueFacts(events) {
  const known = new Map();
  for (const e of events) {
    const k = key(e.venue_name);
    if (!k) continue;
    const v = known.get(k) || {};
    for (const f of ["postcode", "address", "area"]) if (!v[f] && e[f]) v[f] = e[f];
    if (!hasPoint(v) && hasPoint(e)) { v.lat = e.lat; v.lng = e.lng; }
    known.set(k, v);
  }
  for (const e of events) {
    const v = known.get(key(e.venue_name));
    if (!v) continue;
    for (const f of ["postcode", "address", "area"]) if (!e[f] && v[f]) e[f] = v[f];
    if (!hasPoint(e) && hasPoint(v)) { e.lat = v.lat; e.lng = v.lng; }
  }
}

async function postcodesToPoints(events) {
  const need = [...new Set(events.filter((e) => e.postcode && (!hasPoint(e) || !e.area)).map((e) => e.postcode))];
  const found = new Map();
  for (let i = 0; i < need.length; i += 100) {
    const json = await postJson("https://api.postcodes.io/postcodes", { postcodes: need.slice(i, i + 100) });
    for (const r of json.result || []) if (r.result) found.set(r.query, r.result);
  }
  for (const e of events) {
    const r = found.get(e.postcode);
    if (!r) continue;
    if (!hasPoint(e)) { e.lat = r.latitude; e.lng = r.longitude; }
    if (!e.area) e.area = r.admin_district || null;
  }
}

async function pointsToPostcodes(events) {
  const need = events.filter((e) => hasPoint(e) && !e.postcode);
  const uniq = [...new Map(need.map((e) => [`${e.lat},${e.lng}`, { latitude: e.lat, longitude: e.lng, limit: 1, radius: 300 }])).entries()];
  const found = new Map();
  for (let i = 0; i < uniq.length; i += 100) {
    const batch = uniq.slice(i, i + 100);
    const json = await postJson("https://api.postcodes.io/postcodes", { geolocations: batch.map(([, g]) => g) });
    (json.result || []).forEach((r, j) => { if (r.result?.[0]) found.set(batch[j][0], r.result[0]); });
  }
  for (const e of need) {
    const r = found.get(`${e.lat},${e.lng}`);
    if (!r) continue;
    e.postcode = r.postcode;
    if (!e.area) e.area = r.admin_district || null;
  }
}

// Venue name -> point, via OpenStreetMap. Cached on disk so each venue is only ever looked up once.
async function lookUpVenues(events, { maxLookups = 150 } = {}) {
  const file = new URL("../data/venue-cache.json", import.meta.url);
  const cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const need = [...new Set(events.filter((e) => e.venue_name && !hasPoint(e) && !e.postcode).map((e) => e.venue_name))];
  let lookups = 0;
  for (const name of need) {
    const k = key(name);
    if (!k || k in cache || lookups >= maxLookups) continue;
    lookups++;
    try {
      const u = new URL("https://nominatim.openstreetmap.org/search");
      u.search = new URLSearchParams({ q: `${name}, London`, format: "jsonv2", limit: "1", countrycodes: "gb", addressdetails: "1", viewbox: "-0.52,51.7,0.34,51.28", bounded: "1" });
      const res = await fetch(u, { headers: { "User-Agent": "london-art-events-prototype/0.1 (hackathon; low volume)" }, signal: AbortSignal.timeout(15000) });
      const hit = res.ok ? (await res.json())[0] : null;
      cache[k] = hit ? { lat: Number(hit.lat), lng: Number(hit.lon), postcode: hit.address?.postcode || null, area: hit.address?.suburb || hit.address?.city_district || hit.address?.borough || null } : null;
    } catch { /* leave uncached: try again next run */ }
    await sleep(1050);
  }
  fs.writeFileSync(file, JSON.stringify(cache, null, 1) + "\n");
  for (const e of events) {
    const v = cache[key(e.venue_name)];
    if (!v || hasPoint(e) || e.postcode) continue;
    e.lat = v.lat; e.lng = v.lng;
    if (v.postcode && /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(v.postcode)) e.postcode = v.postcode.toUpperCase();
    if (!e.area && v.area) e.area = v.area;
  }
  return lookups;
}

// Returns { events, dropped, lookups }. Mutates copies, not the input rows.
export async function locate(input, opts = {}) {
  const events = input.map((e) => ({ ...e }));
  for (const e of events) if (hasPoint(e) && !inLondon(e.lat, e.lng)) { e.lat = null; e.lng = null; }
  shareVenueFacts(events);
  let lookups = 0;
  if (!opts.offline) {
    try { await postcodesToPoints(events); } catch (err) { console.warn(`  postcode lookup failed: ${err.message}`); }
    try { lookups = await lookUpVenues(events, opts); } catch (err) { console.warn(`  venue lookup failed: ${err.message}`); }
    shareVenueFacts(events);
    try { await pointsToPostcodes(events); } catch (err) { console.warn(`  reverse postcode lookup failed: ${err.message}`); }
  }
  const kept = events.filter((e) => e.venue_name && hasPoint(e) && inLondon(e.lat, e.lng));
  return { events: kept, dropped: events.length - kept.length, lookups };
}

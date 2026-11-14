// Small helpers shared by the plain-parsing adapters (no AI).
import { londonToday } from "./normalize.js";

export const UA = "Mozilla/5.0 (hackathon prototype; low volume)";

export async function getHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function text(s) {
  if (s == null) return null;
  const out = String(s)
    .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8250;/g, "›").replace(/&pound;/g, "£").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x27;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
  return out || null;
}

// First capture of `re` in `html`, as clean text.
export const grab = (html, re) => text(html.match(re)?.[1]);

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Pull a date range and times out of free text, e.g.
//   "Wed 25 Nov 2026 - Sat 23 Jan 2027" | "6 - 15 NOV 2026, FRI - SUN, 12 - 6PM"
//   "Thursday 19 Nov 2026 | 6–8 PM" | "Exhibition ends on Sunday 14th Feb 2027" | "SAT 21 NOV 2026"
// Missing years are inferred from later dates in the string, then from today.
export function parseDateText(s, today = londonToday()) {
  if (!s) return {};
  const str = String(s).replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  const dates = [];
  // "6 - 15 NOV 2026": a bare day before a full date shares its month.
  const short = str.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?(?:\s+(\d{4}))?/);
  if (short && MON[short[3].toLowerCase()]) {
    const m = MON[short[3].toLowerCase()];
    dates.push({ d: +short[1], m, y: short[4] ? +short[4] : null }, { d: +short[2], m, y: short[4] ? +short[4] : null });
  } else {
    for (const t of str.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?(?:\s+(\d{4}))?/g)) {
      const m = MON[t[2].toLowerCase()];
      if (m) dates.push({ d: +t[1], m, y: t[3] ? +t[3] : null });
    }
  }
  if (!dates.length) return {};
  // Fill years right to left: an earlier date with a later month belongs to the year before.
  let nextYear = null;
  for (let i = dates.length - 1; i >= 0; i--) {
    const dt = dates[i];
    if (dt.y) { nextYear = dt.y; continue; }
    if (nextYear != null) {
      const later = dates[i + 1];
      dt.y = later && dt.m > later.m ? nextYear - 1 : nextYear;
    } else {
      // No year anywhere: take the year that puts the date nearest today. Listings keep old
      // items around, so "15 Oct" seen in November is last month, not next October.
      const ty = +today.slice(0, 4);
      dt.y = [ty - 1, ty, ty + 1].sort((a, b) =>
        Math.abs(Date.parse(iso(a, dt.m, dt.d)) - Date.parse(today)) - Math.abs(Date.parse(iso(b, dt.m, dt.d)) - Date.parse(today)))[0];
    }
    nextYear = dt.y;
  }
  const start_date = iso(dates[0].y, dates[0].m, dates[0].d);
  const last = dates[dates.length - 1];
  const end_date = dates.length > 1 ? iso(last.y, last.m, last.d) : null;
  return { start_date, end_date: end_date && end_date !== start_date ? end_date : null, ...parseTimes(str) };
}

// "6–8 PM" | "11am-3pm" | "10:30AM-2PM" | "18:00" -> { start_time, end_time } (HH:MM)
export function parseTimes(s) {
  const r = String(s).match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i);
  if (r) {
    const to24 = (h, mer) => (mer === "pm" && h < 12 ? h + 12 : mer === "am" && h === 12 ? 0 : h);
    const endMer = r[6].toLowerCase();
    const eh = to24(+r[4], endMer);
    // "12 - 6PM" is noon to 6pm; "11 - 3pm" is 11am to 3pm.
    let sh = r[3] ? to24(+r[1], r[3].toLowerCase()) : to24(+r[1], endMer);
    if (!r[3] && sh > eh) sh = to24(+r[1], "am");
    const hm = (h, m) => `${String(h).padStart(2, "0")}:${m || "00"}`;
    return { start_time: hm(sh, r[2]), end_time: hm(eh, r[5]) };
  }
  const one = String(s).match(/\b(\d{1,2}):(\d{2})\b/);
  return one ? { start_time: `${one[1].padStart(2, "0")}:${one[2]}`, end_time: null } : {};
}

// "£15" | "Free" | "Free and all welcome" | "£5–£12" -> price fields
export function parsePrice(s) {
  if (!s) return { price_type: "unknown", price_min_gbp: null };
  if (/\bfree\b/i.test(s)) return { price_type: "free", price_min_gbp: 0 };
  if (/donation|pay what you/i.test(s)) return { price_type: "donation", price_min_gbp: null };
  const n = String(s).match(/£\s*(\d+(?:\.\d{2})?)/);
  return n ? { price_type: "paid", price_min_gbp: Number(n[1]) } : { price_type: "unknown", price_min_gbp: null };
}

export const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

// Without AI, "is this an art event?" is a keyword test. Generous on purpose; history and
// science shows on general listings (IanVisits) are what it's there to drop.
const ART = /\b(art|arts|artist|artists|artwork|painting|paintings|painter|print|prints|printmaking|etching|sculpture|sculptor|photograph\w*|drawing|drawings|gallery|galleries|ceramic\w*|textile\w*|portrait\w*|illustrat\w*|design|installation|exhibition of works|watercolou?r|canvas|craft|studio|studios|curated|contemporary|modern|surreal\w*|impressionis\w*|abstract)\b/i;
export const looksLikeArt = (...parts) => ART.test(parts.filter(Boolean).join(" "));

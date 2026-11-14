// We Are Lewisham: the borough's community listings (free workshops, open studios, creative-health sessions).
// Reads up to 3 listing pages, keeps the visual-art and making events, then one detail page each for the address.
import { text, parseDateText, POSTCODE } from "../html.js";
import { politeGet, artish, inferType } from "./generic.js";

export const source = {
  name: "We Are Lewisham",
  url: "https://www.wearelewisham.com/events/",
  method: "scrape",
  priority: 1,
};

const ART_CATS = /visual-arts|exhibition|artist-studios|museums-galleries|creative-health|crafts?/;
const TYPE_BY_CAT = [["artist-studios", "open_studio"], ["exhibition", "exhibition"], ["classes-worshops", "workshop"], ["talk", "talk"], ["film", "screening"], ["market", "fair"]];

export async function fetchEvents({ pages = 3, details = true } = {}) {
  const rows = [];
  for (let p = 1; p <= pages; p++) {
    let html;
    try { html = await politeGet(p === 1 ? source.url : `${source.url}?page=${p}`); } catch { break; }
    rows.push(...parseListing(html));
    if (!html.includes(`?page=${p + 1}`)) break;
  }
  if (details) {
    for (const r of rows) {
      try { Object.assign(r, parseDetail(await politeGet(r.source_url))); } catch { /* keep the listing fields */ }
    }
  }
  return rows;
}

export function parseListing(html, today) {
  const scrapedAt = new Date().toISOString();
  const out = [];
  for (const card of html.split('<div class="a-19">').slice(1)) {
    const link = card.match(/<a class="a-19__4" href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!link) continue;
    const title = text(link[2]);
    const cats = [...card.matchAll(/categories=([a-z-]+)/g)].map((m) => m[1]);
    // Borough listings mix in concerts and board games: keep art categories, or classes that are about making.
    const isArt = cats.some((c) => ART_CATS.test(c)) || (cats.includes("classes-worshops") && artish(title));
    if (!isArt || /\b(orchestra|symphony|choir|recital|concert)\b/i.test(title)) continue;
    const when = text(card.split("</h3>")[1]?.match(/<div>([\s\S]*?)<\/div>/)?.[1]);
    const [from, to] = (when || "").split("—");
    const s = parseDateText(from, today), e = to ? parseDateText(to, today) : {};
    if (!s.start_date) continue;
    const multiDay = e.start_date && e.start_date !== s.start_date;
    const time = (x) => x?.match(/\b(\d{2}:\d{2})\b/)?.[1] || null;
    const type = TYPE_BY_CAT.find(([c]) => cats.includes(c))?.[1] || inferType(title) || "other";
    const img = card.match(/<img[^>]+src="([^"]+)"/)?.[1];
    out.push({
      title,
      event_type: type,
      start_date: s.start_date, end_date: multiDay ? e.start_date : null,
      // For a run of dates the times are the first and last session's, so only the start is safe.
      start_time: time(from), end_time: multiDay ? null : time(to),
      area: "Lewisham",
      image_url: img ? new URL(img, source.url).href : null,
      ...(cats.includes("free-events") ? { price_type: "free", price_min_gbp: 0 } : {}),
      tags: ["community", ...cats.filter((c) => !/free-events|classes-worshops/.test(c)).map((c) => c.replace(/-/g, " "))],
      source_name: source.name, source_url: new URL(link[1], source.url).href, scraped_at: scrapedAt, confidence: 0.75,
    });
  }
  return out;
}

export function parseDetail(html) {
  const organiser = text(html.match(/<h2 class="headline-large">Info<\/h2>\s*<div[^>]*>\s*<div>([\s\S]*?)<\/div>/)?.[1]);
  const address = text(html.match(/<h2 class="headline-large">Address<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1]);
  const about = html.match(/<h2 class="headline-large">About<\/h2>([\s\S]*?)<\/div>/)?.[1];
  const book = html.match(/<a class="btn btn--0" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  const lat = Number(html.match(/class="a-31" data-lat="([-\d.]+)"/)?.[1]), lng = Number(html.match(/data-lng="([-\d.]+)"/)?.[1]);
  const inLondon = lat > 51.3 && lat < 51.7 && lng > -0.5 && lng < 0.3; // some pins are placed far outside the borough
  const out = {};
  if (address) {
    out.venue_name = address.split(",")[0];
    out.address = address;
    const pc = address.match(POSTCODE)?.[1];
    if (pc) out.postcode = pc;
  } else if (organiser) out.venue_name = organiser;
  if (about) out.description = text(about)?.slice(0, 500);
  if (book && /^https?:/.test(book)) { out.booking_url = book; out.booking_required = true; }
  if (inLondon) { out.lat = lat; out.lng = lng; }
  return out;
}

// ArtRabbit: London listings, parsed straight from the listing cards (no AI needed).
// Each card gives type, title, dates, opening time, venue and coordinates.

import { parseDayMonth, londonToday, addDays } from "../normalize.js";

export const source = {
  name: "ArtRabbit",
  url: "https://www.artrabbit.com/all-listings/united-kingdom/london",
  method: "scrape",
  priority: 1,
};

const TYPE_MAP = {
  exhibition: "exhibition", workshop: "workshop", talk: "talk", conference: "talk",
  screening: "screening", performance: "performance", "art fair": "fair", "art tour": "tour",
  "open studio": "open_studio", "open studios": "open_studio", "private view": "private_view",
  opening: "private_view", festival: "other", event: "other",
};

const UA = "Mozilla/5.0 (hackathon prototype; low volume)";

export async function fetchEvents({ pages = 5, delayMs = 800 } = {}) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${source.url}?page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.warn(`ArtRabbit page ${page}: HTTP ${res.status}`); break; }
    const cards = parseListing(await res.text());
    if (!cards.length) break;
    out.push(...cards);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

const decode = (s) => s
  .replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "’").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, " ").trim();

const pick = (html, cls) => {
  const m = html.match(new RegExp(`<p class="${cls}">([\\s\\S]*?)</p>`));
  return m ? decode(m[1].replace(/<[^>]+>/g, "")) : null;
};

export function parseListing(html, today = londonToday()) {
  const scrapedAt = new Date().toISOString();
  const records = [];
  const blocks = html.split('<article class="m_listing-item').slice(1);
  for (const block of blocks) {
    const card = block.split("</article>")[0];
    const href = card.match(/class="m_listing-link" href="([^"]+)"/)?.[1];
    if (!href) continue;
    const sourceUrl = new URL(href, "https://www.artrabbit.com").href;
    const typeLabel = (pick(card, "b_categorical-heading") || "").toLowerCase();
    const title = pick(card, "b_small-heading mod--primary");
    const dates = pick(card, "b_small-heading mod--colour") || "";
    const opening = pick(card, "b_small-heading b_highlight");
    const lines = [...card.matchAll(/<p class="b_instructional-text mod--large">([\s\S]*?)<\/p>/g)]
      .map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    const venue = lines[0] || null;
    const lat = Number(card.match(/data-lat="([-\d.]+)"/)?.[1]);
    const lng = Number(card.match(/data-lon="([-\d.]+)"/)?.[1]);
    let img = card.match(/<img[^>]+src="([^"]+)"/)?.[1] || null;
    if (img?.startsWith("//")) img = `https:${img}`;

    const [from, to] = dates.split("–").map((s) => s.trim());
    const start = parseDayMonth(from || "", today);
    const end = to ? parseDayMonth(to, today) : null;
    const eventType = TYPE_MAP[typeLabel] || "other";

    const base = {
      title, event_type: eventType, artists: guessArtists(title),
      image_url: img, start_date: start, end_date: end,
      venue_name: venue, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
      source_name: source.name, source_url: sourceUrl, scraped_at: scrapedAt, confidence: 0.9,
      tags: typeLabel && !TYPE_MAP[typeLabel] ? [typeLabel] : [],
    };

    const open = parseOpening(opening, today);
    if (eventType !== "exhibition" && open) {
      // A one-off event: the "Opening" line is its start time.
      base.start_time = open.time;
      if (open.date && !end) base.start_date = open.date;
    }
    records.push(base);

    // An exhibition's opening night is its own event: the private view.
    if (eventType === "exhibition" && open?.date) {
      records.push({
        ...base,
        title: `Private view: ${title}`,
        event_type: "private_view",
        start_date: open.date, end_date: null, start_time: open.time,
        price_type: "free", tags: [...base.tags, "opening night"],
        source_url: `${sourceUrl}#private-view`,
        confidence: 0.8,
      });
    }
  }
  return records;
}

// "Opening: Today, 19:00" | "Opening: Tomorrow, 18:30" | "Opening: Thu 19 Nov, 18:00"
export function parseOpening(s, today = londonToday()) {
  if (!s || !/opening/i.test(s)) return null;
  const time = s.match(/(\d{1,2}:\d{2})/)?.[1] || null;
  let date = null;
  if (/today/i.test(s)) date = today;
  else if (/tomorrow/i.test(s)) date = addDays(today, 1);
  else date = parseDayMonth(s, today);
  return { date, time };
}

// Titles are often "Artist A, Artist B: Show title". Take the part before the colon as artists
// only when it looks like a list of names (short, capitalised).
function guessArtists(title) {
  if (!title || !title.includes(":")) return [];
  const head = title.split(":")[0];
  const names = head.split(/,|&| and /).map((s) => s.trim()).filter(Boolean);
  const looksLikeNames = names.length <= 6 && names.every((n) => /^[A-ZÀ-Ý][\p{L}'’.-]+(\s+[\p{L}'’.-]+){0,3}$/u.test(n));
  return looksLikeNames ? names : [];
}

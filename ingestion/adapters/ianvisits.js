// IanVisits: museum and heritage exhibitions, one page per date, with a price and a short summary.
// A date page lists what's open that day and when it ends. Fetching a few dates across the window
// catches shows that open later; dedupe then merges the repeats.
import { getHtml, grab, text, parseDateText, parsePrice, looksLikeArt, sleep } from "../html.js";
import { londonToday, addDays } from "../normalize.js";

export const source = {
  name: "IanVisits",
  url: "https://www.ianvisits.co.uk/calendar/date/",
  method: "scrape",
  priority: 1,
};

export async function fetchEvents({ days = 14, every = 4 } = {}) {
  const today = londonToday();
  const out = [];
  for (let i = 0; i <= days; i += every) {
    const date = addDays(today, i);
    const url = `${source.url}${date.replaceAll("-", "/")}/exhibitions/`;
    try { out.push(...parseDay(await getHtml(url), date, url)); }
    catch (err) { console.warn(`  IanVisits ${date}: ${err.message}`); }
    await sleep(800);
  }
  return out;
}

export function parseDay(html, date, pageUrl) {
  const scrapedAt = new Date().toISOString();
  const out = [];
  for (const block of html.split('<div class="event_wrapper">').slice(1)) {
    const url = block.match(/<h3><a href="([^"]+)"/)?.[1];
    const title = grab(block, /<h3><a [^>]*>([\s\S]*?)<\/a>/);
    if (!url || !title) continue;
    const summary = text(block.match(/class="event_exerpt">([\s\S]*?)<div class="read-more"/)?.[1]?.replace(/<img[^>]*>/g, ""));
    const when = grab(block, /class="event_time">([\s\S]*?)<\/div>/);
    const priceText = grab(block, /class="event_price">([\s\S]*?)<\/div>/);
    const location = grab(block, /class="event_location">([\s\S]*?)<\/div>/);
    const image = block.match(/<img src="([^"]+)"/)?.[1]?.replace(/-150x150(\.\w+)$/, "$1") || null;
    if (!looksLikeArt(title, summary)) continue;

    // "Exhibition ends on Sunday 14th Feb 2027": the end date. The start isn't listed, so the
    // start is the day we saw it open. (The schema needs one; "on now" is what the feed shows.)
    const ends = /ends on/i.test(when || "") ? parseDateText(when, date).start_date : null;
    const [venue, area] = location ? splitLocation(location) : [null, null];
    out.push({
      title, event_type: "exhibition", description: summary?.slice(0, 300) ?? null,
      image_url: image, start_date: date, end_date: ends,
      venue_name: venue, area,
      ...parsePrice(priceText),
      tags: /closing soon/i.test(when || "") ? ["closing soon"] : [],
      source_name: source.name, source_url: url, scraped_at: scrapedAt, confidence: 0.8,
    });
  }
  return out;
}

// "Bethlem Museum of the Mind, Beckenham" -> ["Bethlem Museum of the Mind", "Beckenham"]
function splitLocation(s) {
  const i = s.lastIndexOf(",");
  return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : [s, null];
}

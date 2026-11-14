// SPACE Studios: the community long tail (open studios, free workshops, pop-ups) across its sites.
import { getHtml, grab, text, parseDateText, parsePrice } from "../html.js";

export const source = {
  name: "SPACE Studios",
  url: "https://spacestudios.org.uk/whats-on/",
  method: "scrape",
  priority: 2,
};

const TYPE = {
  exhibition: "exhibition", "pop-up": "exhibition", workshop: "workshop", workshops: "workshop",
  "open studios": "open_studio", "open studio": "open_studio", talk: "talk", screening: "screening",
  watch: "screening", performance: "performance",
};

// SPACE's sites, for the venue's area.
const AREA = { ilford: "Ilford", hackney: "Hackney", "the triangle": "Hackney", deptford: "Deptford", "martello": "Hackney", "bow": "Bow", "leytonstone": "Leytonstone", "stratford": "Stratford" };

export async function fetchEvents() {
  return parseListing(await getHtml(source.url));
}

export function parseListing(html, today) {
  const scrapedAt = new Date().toISOString();
  const out = [];
  for (const block of html.split(/<div class="grid-item2? grid-item--width4">/).slice(1)) {
    const url = block.match(/<a href="(https:\/\/spacestudios\.org\.uk\/[^"]+)"/)?.[1];
    if (!url || !block.includes('class="tile1"')) continue;
    const label = (grab(block, /tile-tag text-white">([\s\S]*?)<\/div>/) || "").toLowerCase();
    const when = grab(block, /font-AkkMono uppercase tracking-widest">([\s\S]*?)<\/div>/);
    const titleHtml = block.match(/<div class="pt-4 text-2xl">([\s\S]*?)<\/div>/)?.[1] || "";
    const [title, by] = titleHtml.split(/<br\s*\/?>/i).map(text);
    const venue = grab(block, /location-display-inner">([\s\S]*?)<\/div>/);
    const priceText = grab(block, /price-public-display-inner">([\s\S]*?)<\/div>/);
    const image = block.match(/data-src="([^"]+)"/)?.[1] || null;
    if (!title) continue;
    const dates = parseDateText(when, today);
    if (!dates.start_date) continue;
    const areaKey = Object.keys(AREA).find((k) => (venue || "").toLowerCase().includes(k));
    const artist = by?.replace(/^by\s+/i, "") || null;
    out.push({
      title: artist && !title.includes(artist) ? `${title} – ${artist}` : title,
      event_type: TYPE[label] || "other",
      artists: artist ? [artist] : [],
      image_url: image,
      ...dates,
      venue_name: venue ? (/space/i.test(venue) ? venue : `SPACE ${venue}`) : "SPACE Studios",
      area: areaKey ? AREA[areaKey] : null,
      ...(priceText ? parsePrice(priceText) : {}),
      tags: ["community", "independent", ...(label === "pop-up" ? ["pop-up"] : [])],
      source_name: source.name, source_url: url, scraped_at: scrapedAt, confidence: 0.75,
    });
  }
  return out;
}

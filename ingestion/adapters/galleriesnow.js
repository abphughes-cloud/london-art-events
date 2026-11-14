// GalleriesNow: every current and forthcoming London gallery show on one page (~150 cards).
// Gives title, dates, gallery, area, full address with postcode, opening hours and a short quote.
import { getHtml, grab, text, parseDateText, POSTCODE } from "../html.js";

export const source = {
  name: "GalleriesNow",
  url: "https://www.galleriesnow.net/exhibitions/london/",
  method: "scrape",
  priority: 1,
};

export async function fetchEvents() {
  return parseListing(await getHtml(source.url));
}

export function parseListing(html, today) {
  const scrapedAt = new Date().toISOString();
  const out = [];
  const cards = html.split('<div class="exhibition-panel grid-item').slice(1);
  for (const raw of cards) {
    const card = raw.split('<div class="exhibition-panel grid-item')[0];
    const url = card.match(/<a href="([^"]+)" class="exhibition-panel__info__main__text__title/)?.[1]
      || card.match(/<a href="([^"]+)" class="exhibition-panel__image/)?.[1];
    const title = grab(card, /class="exhibition-panel__info__main__text__title[^"]*">([\s\S]*?)<\/a>/);
    if (!url || !title) continue;
    const dateText = grab(card, /class="exhibition-panel__info__main__text__date">([\s\S]*?)<\/p>/);
    const address = grab(card, /class="exhibition-panel__info__main__text__address[^"]*">([\s\S]*?)<\/p>/);
    const hours = grab(card, /class="exhibition-panel__info__main__text__opening-times">([\s\S]*?)<\/p>/);
    const snippet = grab(card, /class="exhibition-panel__info__snippet[^"]*">([\s\S]*?)<\/p>/);
    const gallery = grab(card, /class="exhibition-panel__gallery__logo__text">\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const area = grab(card, /class="exhibition-panel__gallery__logo__text">[\s\S]*?<small>([\s\S]*?)<\/small>/);
    const image = card.match(/<img\s+src="([^"]+)"[^>]*class="listing-image"/)?.[1] || null;
    const { start_date, end_date } = parseDateText(dateText, today);

    // "Artist Name: Show title" -> artist, when the part before the colon is short.
    const head = title.includes(":") ? title.split(":")[0].trim() : null;
    const artists = head && head.split(/\s+/).length <= 4 && !/group|collective|show/i.test(head) ? [head] : [];

    out.push({
      title, event_type: "exhibition",
      description: snippet ? text(snippet.replace(/^[“"]|[”"]$/g, "")).slice(0, 300) : null,
      artists, image_url: image,
      start_date, end_date,
      venue_name: gallery, address, postcode: address?.match(POSTCODE)?.[1] ?? null,
      area: area?.replace(/^London\s+/i, "") || null,
      // Opening hours aren't in the contract; a late opening becomes a tag the ranking can use.
      tags: /\b(late|[89](:\d\d)?\s*pm)\b/i.test(hours || "") ? ["late"] : [],
      price_type: "free", // commercial galleries on GalleriesNow are free to visit
      source_name: source.name, source_url: url, scraped_at: scrapedAt, confidence: 0.85,
    });
  }
  return out;
}

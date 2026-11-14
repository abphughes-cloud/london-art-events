// Arts Calendar: Greater London exhibitions, life-drawing groups and workshops, many at small venues.
// One listing request. Each row carries venue, locality, coordinates and medium chips.
import { text, parseDateText } from "../html.js";
import { politeGet } from "./generic.js";
import { londonToday } from "../normalize.js";

export const source = {
  name: "Arts Calendar",
  url: "https://artscalendar.co.uk/in/greater-london/",
  method: "scrape",
  priority: 1,
};

const KIND = { exhibition: "exhibition", "drawing group": "workshop", workshop: "workshop", talk: "talk", "open studio": "open_studio", "open studios": "open_studio", "private view": "private_view", fair: "fair" };

export async function fetchEvents() {
  return parseListing(await politeGet(source.url));
}

export function parseListing(html, today = londonToday()) {
  const scrapedAt = new Date().toISOString();
  const out = [], seen = new Set();
  for (const row of html.split(/<li class="fc-row[ "]/).slice(1)) {
    const link = row.match(/<h3 class="fc-row__title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!link) continue;
    const kind = (text(row.match(/fc-row__kind[^>]*>([^<]+)/)?.[1]) || "").toLowerCase();
    const when = row.match(/<div class="fc-row__when[^"]*">([\s\S]*?)<\/div>/)?.[1] || "";
    const day = text(when.match(/fc-row__date">([^<]+)/)?.[1]);
    const start = text(when.match(/fc-row__start">([^<]+)/)?.[1]);
    const end = text(when.match(/fc-row__end">([^<]+)/)?.[1]);
    let dates;
    if (day) {
      // A dated session: "Sat 14 Nov" 12:00–16:00
      dates = { start_date: parseDateText(day, today).start_date, end_date: null, start_time: /^\d/.test(start || "") ? start : null, end_time: /^\d/.test(end || "") ? end : null };
    } else if (/^opens/i.test(start || "")) {
      dates = { start_date: parseDateText(start, today).start_date, end_date: null };
    } else if (/last day today/i.test(start || "")) {
      dates = { start_date: today, end_date: null };
    } else {
      // "Closes Sun 22 Nov" | "Until 17 Jan 2027": already open, so it starts (for us) today.
      const until = parseDateText(start, today).start_date;
      if (!until) continue;
      dates = { start_date: today, end_date: until };
    }
    if (!dates.start_date) continue;
    const key = `${link[1]}|${dates.start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const where = row.match(/<p class="fc-row__where">\s*<a[^>]*>([\s\S]*?)<\/a>,?([^<]*)/);
    const locality = text(where?.[2])?.split(",")[0].trim() || null;
    const chips = [...row.matchAll(/fc-chip--([a-z_]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], text(m[2]).toLowerCase()]);
    const lat = Number(row.match(/data-lat="([-\d.]+)"/)?.[1]), lng = Number(row.match(/data-lng="([-\d.]+)"/)?.[1]);
    const title = text(link[2]);
    out.push({
      title,
      event_type: KIND[kind] || "other",
      artists: kind === "exhibition" && /^[^:]{3,40}: /.test(title) && chips.some(([, v]) => v === "solo show") ? [title.split(": ")[0]] : [],
      art_forms: chips.filter(([k]) => k === "art_medium" || k === "drawing_kind" || k === "workshop_subject").map(([, v]) => v),
      tags: [...chips.filter(([k]) => k === "exhibition_kind" || k === "plain").map(([, v]) => v), ...(kind === "drawing group" ? ["drawing group", "drop-in"] : [])],
      ...dates,
      venue_name: text(where?.[1]),
      area: locality && locality !== "London" ? locality : null,
      lat: lat || null, lng: lng || null,
      // A weekly group has one page for all its sessions; the date anchor keeps each session a separate event.
      source_name: source.name, source_url: day ? `${link[1]}#${dates.start_date}` : link[1], scraped_at: scrapedAt, confidence: 0.75,
    });
  }
  return out;
}

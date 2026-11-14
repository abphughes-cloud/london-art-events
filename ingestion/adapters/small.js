// Small single-venue sources without a feed: one listing request each.
// Cockpit Studios (maker workshops, open studios), Pigment Press (print workshops),
// Thames-Side Studios Gallery, Goldsmiths School of Art events.
import { text, parseDateText, parseTimes } from "../html.js";
import { politeGet, inferType } from "./generic.js";

const base = (source, extra) => ({ source_name: source.name, scraped_at: new Date().toISOString(), confidence: 0.75, ...extra });

// ---------- Cockpit Studios ----------
const cockpit = {
  source: { name: "Cockpit Studios", url: "https://cockpitstudios.org/whats-on/", method: "scrape", priority: 2 },
  parse(html) {
    const out = [], seen = new Set();
    const SITES = { bloomsbury: { area: "Bloomsbury", postcode: "WC1N 2NP" }, deptford: { area: "Deptford", postcode: "SE8 3DZ" } };
    for (const m of html.matchAll(/<a href="(\/whats-on\/[^"]+)" class="event-thumbnail[\s\S]*?<\/a>/g)) {
      const card = m[0];
      const label = text(card.match(/<p class="title[^>]*>([\s\S]*?)<\/p>/)?.[1]) || "";
      const name = text(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]);
      const d = [...(card.match(/<p class="date[^>]*>([\s\S]*?)<\/p>/)?.[1] || "").matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map((x) => `${x[3]}-${x[2]}-${x[1]}`);
      if (!name || !d.length || seen.has(m[1] + d[0])) continue;
      seen.add(m[1] + d[0]);
      if (/music|jazz/i.test(label)) continue;
      const site = Object.keys(SITES).find((k) => name.toLowerCase().includes(k));
      out.push(base(this.source, {
        title: /open studios/i.test(label) ? `${label}: ${name}` : name,
        event_type: /open studios/i.test(label) ? "open_studio" : /workshop|club|course/i.test(label + name) ? "workshop" : inferType(label, name) || "other",
        start_date: d[0], end_date: d[1] || null,
        venue_name: site ? `Cockpit ${SITES[site].area}` : "Cockpit Studios", ...(site ? SITES[site] : {}),
        image_url: card.match(/<img[^>]+src="([^"]+)"/)?.[1] || null,
        art_forms: ["craft"], tags: ["makers", "craft", "independent"],
        source_url: new URL(m[1], this.source.url).href,
      }));
    }
    return out;
  },
};

// ---------- Pigment Press ----------
const pigment = {
  source: { name: "Pigment Press", url: "https://pigmentpress.co.uk/", method: "scrape", priority: 2 },
  parse(html, today) {
    const out = [];
    const section = html.split(/upcoming Workshops<\/h2>/i)[1] || "";
    for (const m of section.matchAll(/<h3 class="wp-block-heading[^"]*">([^<]+)<\/h3>\s*<h4 class="wp-block-heading">([\s\S]*?)<\/h4>/g)) {
      const { start_date } = parseDateText(m[1], today);
      const [name, time] = (text(m[2]) || "").split("•").map((s) => s.trim());
      const book = m[2].match(/href="(https:\/\/www\.eventbrite[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      if (!start_date || !name) continue;
      const t = time?.match(/^(\d{1,2})[.:](\d{2})/);
      out.push(base(this.source, {
        title: name, event_type: "workshop", start_date,
        start_time: t ? `${t[1].padStart(2, "0")}:${t[2]}` : null,
        venue_name: "Pigment Press", address: "Arch 182 Shepherds Bush Market, London", postcode: "W12 8DF", area: "Shepherd's Bush",
        price_type: "paid", booking_required: true, booking_url: book || null,
        art_forms: ["printmaking"], tags: ["print studio", "independent", "hands-on"],
        // The listing is one page; the anchor keeps each workshop's link distinct.
        source_url: `${this.source.url}#${start_date}`,
      }));
    }
    return out;
  },
};

// ---------- Thames-Side Studios Gallery ----------
const thamesSide = {
  source: { name: "Thames-Side Studios", url: "https://thames-sidestudios.co.uk/exhibitions", method: "scrape", priority: 2 },
  parse(html, today) {
    const out = [], seen = new Set();
    for (const tile of html.split(/<div class="exhibtile[^"]*">/).slice(1)) {
      const href = tile.match(/<a href="([^"]+)"/)?.[1];
      const name = text(tile.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
      const dates = parseDateText(text(tile.match(/class="card-date">([\s\S]*?)<\/p>/)?.[1]), today);
      if (!href || !name || !dates.start_date || seen.has(href)) continue;
      seen.add(href);
      const room = text(tile.match(/framed-button[^>]*>([\s\S]*?)<\/div>/)?.[1]);
      const img = tile.match(/<img[^>]+src="([^"]+)"/)?.[1];
      out.push(base(this.source, {
        title: name, event_type: inferType(name) === "fair" ? "fair" : "exhibition",
        start_date: dates.start_date, end_date: dates.end_date,
        venue_name: "Thames-Side Studios Gallery", address: `${room ? room + ", " : ""}Harrington Way, Warspite Road, London`, postcode: "SE18 5NR", area: "Woolwich",
        price_type: "free", image_url: img ? new URL(img, this.source.url).href : null,
        tags: ["artist studios", "independent"],
        source_url: new URL(href, this.source.url).href,
      }));
    }
    return out;
  },
};

// ---------- Goldsmiths School of Art ----------
const goldsmiths = {
  source: { name: "Goldsmiths School of Art", url: "https://www.gold.ac.uk/art/events/", method: "scrape", priority: 2 },
  parse(html, today) {
    const out = [];
    for (const item of html.split('<div class="ODcontainer">').slice(1)) {
      const name = text(item.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]);
      const { start_date } = parseDateText(text(item.match(/event-date">([\s\S]*?)<\/div>/)?.[1]), today);
      const href = item.match(/href="(https:\/\/www\.gold\.ac\.uk\/calendar\/[^"]+)"/)?.[1];
      if (!name || !start_date) continue;
      out.push(base(this.source, {
        title: name, event_type: inferType(name) || "talk", start_date,
        ...parseTimes(text(item.match(/event-time">([\s\S]*?)<\/div>/)?.[1]) || ""),
        venue_name: "Goldsmiths, University of London", postcode: "SE14 6NW", area: "New Cross",
        price_type: "free", tags: ["art school", "student"],
        source_url: href || this.source.url,
      }));
    }
    return out;
  },
};

export const smallSources = [cockpit, pigment, thamesSide, goldsmiths].map((s) => ({
  source: s.source,
  parse: s.parse.bind(s),
  fetchEvents: async () => s.parse(await politeGet(s.source.url)),
}));

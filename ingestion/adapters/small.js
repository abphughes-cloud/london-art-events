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

// ---------- Eat Work Art (Hackney Downs Studios, Netil House, Cornerstone Studios) ----------
const eatWorkArt = {
  source: { name: "Eat Work Art", url: "https://eatworkart.com/events", method: "scrape", priority: 2 },
  parse(html, today) {
    const SITES = {
      "hackney downs studios": { address: "17 Amhurst Terrace, London", postcode: "E8 2BT", area: "Hackney Downs" },
      "netil house": { address: "1 Westgate Street, London", postcode: "E8 3RL", area: "London Fields" },
      "netil market": { address: "13-23 Westgate Street, London", postcode: "E8 3RL", area: "London Fields" },
      "cornerstone studios": { address: "1 Addington Square, London", postcode: "SE5 7JZ", area: "Camberwell" },
    };
    const out = [], seen = new Set();
    for (const m of html.matchAll(/<a class="card-simple[^"]*" href="([^"]+\/events\/[^"]+)">[\s\S]*?<div class="date">([^<]+)<[\s\S]*?<p class="title">([^<]*)<[\s\S]*?<p class="location">([^<]*)</g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const venue = text(m[3]), name = text(m[4]);
      const { start_date } = parseDateText(m[2], today);
      const time = m[2].match(/(\d{2}:\d{2})\s*$/)?.[1];
      if (!name || !venue || !start_date) continue;
      out.push(base(this.source, {
        title: name,
        event_type: /four corners/i.test(name) ? "talk" : /opening night/i.test(name) ? "private_view" : inferType(name) || "other",
        start_date, start_time: time && time !== "00:00" ? time : null,
        venue_name: venue, ...(SITES[venue.toLowerCase()] || {}),
        tags: ["creative community", "independent", "grassroots"],
        source_url: m[1],
      }));
    }
    return out;
  },
};

// ---------- UAL Shows (Camberwell, Central Saint Martins, Chelsea, LCC, LCF, Wimbledon) ----------
const ualShows = {
  source: { name: "UAL Shows", url: "https://www.arts.ac.uk/students/ual-shows", method: "scrape", priority: 1 },
  parse(html, today) {
    const COLLEGES = {
      camberwell: { postcode: "SE5 8UF", area: "Camberwell" }, "central saint martins": { postcode: "N1C 4AA", area: "King's Cross" },
      chelsea: { postcode: "SW1P 4JU", area: "Pimlico" }, "london college of communication": { postcode: "SE1 6SB", area: "Elephant and Castle" },
      "london college of fashion": { postcode: "E20 2AR", area: "Stratford" }, wimbledon: { postcode: "SW19 3QA", area: "Wimbledon" },
    };
    const out = [];
    for (const section of html.split(/<section class="cell text-block/).slice(1)) {
      const college = text(section.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]);
      const site = college && Object.keys(COLLEGES).find((k) => college.toLowerCase().includes(k));
      if (!site) continue;
      const more = section.match(/<a href="([^"]+)">Visit [^<]*Shows/)?.[1];
      // Free-form copy: a line with a show's name, then a line with its dates.
      const lines = section.split("</h3>")[1].split(/<br\s*\/?>|<\/p>|<\/div>/).map(text).filter(Boolean);
      for (let i = 1; i < lines.length; i++) {
        const dates = /\d{4}/.test(lines[i]) && lines[i].length < 60 ? parseDateText(lines[i], today) : {};
        const name = lines[i - 1];
        if (!dates.start_date || /\d{4}$/.test(name) || /^visit /i.test(name)) continue;
        out.push(base(this.source, {
          title: `${college}: ${name.replace(/[.:]$/, "")}`.slice(0, 160),
          event_type: /symposium|talk/i.test(name) ? "talk" : "exhibition",
          start_date: dates.start_date, end_date: dates.end_date,
          venue_name: college, ...COLLEGES[site], price_type: "free",
          tags: ["art school", "student show", "emerging artists", "graduate show"],
          source_url: `${more || this.source.url}#${dates.start_date}`,
        }));
      }
    }
    return out;
  },
};

export const smallSources = [cockpit, pigment, thamesSide, goldsmiths, eatWorkArt, ualShows].map((s) => ({
  source: s.source,
  parse: s.parse.bind(s),
  fetchEvents: async () => s.parse(await politeGet(s.source.url)),
}));

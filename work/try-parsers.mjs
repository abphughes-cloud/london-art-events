// Dry run of the new parsers against the pages saved in work/probe/ (no network).
import fs from "node:fs";
import { parseListing as ac } from "../ingestion/adapters/artscalendar.js";
import { parseListing as wal, parseDetail } from "../ingestion/adapters/wearelewisham.js";
import { smallSources } from "../ingestion/adapters/small.js";
import { normalize } from "../ingestion/normalize.js";

const read = (f) => fs.readFileSync(new URL(`./probe/${f}`, import.meta.url), "utf8");
const show = (name, rows) => {
  const ok = rows.map(normalize).filter(Boolean);
  console.log(`\n== ${name}: ${rows.length} parsed, ${ok.length} valid`);
  for (const e of ok.slice(0, 4)) console.log(`  ${e.start_date}${e.end_date ? "→" + e.end_date : ""} ${e.start_time || ""} [${e.event_type}] ${e.title} @ ${e.venue_name} (${e.area || "-"}, ${e.postcode || "-"}) ${e.price_type} ${e.art_forms.join("/")}`);
};
show("Arts Calendar", ac(read("artscalendar-all.html"), "2026-11-14"));
show("We Are Lewisham", wal(read("wearelewisham.com.html"), "2026-11-14"));
console.log("  detail:", JSON.stringify(parseDetail(read("wal-detail.html"))).slice(0, 300));
const files = { "Cockpit Studios": "cockpitstudios.org.html", "Pigment Press": "pigmentpress.co.uk.html", "Thames-Side Studios": "thames-sidestudios.co.uk.html", "Goldsmiths School of Art": "gold.ac.uk.html" };
for (const s of smallSources) show(s.source.name, s.parse(read(files[s.source.name]), "2026-11-14"));

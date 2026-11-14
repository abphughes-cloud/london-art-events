// The live demo moment: a messy URL, pasted text or flyer image -> clean event cards.
//   node ingestion/extract-cli.js https://some-gallery.co.uk/whats-on
//   node ingestion/extract-cli.js flyer.jpg
//   node ingestion/extract-cli.js --text "Open studios this Sat 21st, 12-6, Bow Arts, free"
//   add --load to upsert the results into Supabase
import fs from "node:fs";
import "./env.js";
import { extractEvents } from "./extract.js";
import { upsertEvents } from "./load.js";

const args = process.argv.slice(2);
const load = args.includes("--load");
const rest = args.filter((a) => a !== "--load");
let source;
if (rest[0] === "--text") source = { text: rest.slice(1).join(" "), url: "manual://pasted-text" };
else if (/^https?:\/\//.test(rest[0] || "")) source = { url: rest[0] };
else if (rest[0] && fs.existsSync(rest[0])) source = { imagePath: rest[0] };
else { console.error("Give a URL, an image/PDF path, or --text \"…\""); process.exit(1); }

const t0 = Date.now();
const events = await extractEvents(source);
console.log(JSON.stringify(events, null, 2));
console.error(`\n${events.length} event(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (load && events.length) console.error(`Loaded ${await upsertEvents(events)} into Supabase.`);

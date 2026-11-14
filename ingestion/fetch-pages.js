// Save the readable text of venues' what's-on pages to work/read/, for events to be read out of them
// (by Claude in a session for this build; by the API extractor in ingestion/extract.js once a key is set).
//   node ingestion/fetch-pages.js <names.json>     [{ name, url, area? }]
// For each site: the given page, plus its own "What's on" / "Events" link if it has one. robots.txt respected.
import fs from "node:fs";
import { politeGet } from "./adapters/generic.js";

const WHATS_ON = /^(what'?s on|what’s on|whats on|events?|exhibitions?( (&|and) events)?|programme|program|calendar|workshops?|classes|courses|courses (&|and) workshops|shows)$/i;

// Main content as text, with link targets kept so each event can point back to its own page.
export function readable(html, pageUrl) {
  let b = html.replace(/<(script|style|svg|noscript|header|footer|nav|form)[\s\S]*?<\/\1>/gi, " ");
  const main = b.match(/<main[\s\S]*<\/main>/i)?.[0];
  if (main && main.length > 1500) b = main;
  b = b.replace(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    let abs = href;
    try { abs = new URL(href.replace(/&amp;/g, "&"), pageUrl).href; } catch { /* keep as is */ }
    const t = label.replace(/<[^>]+>/g, " ").trim();
    return t ? ` ${t} [${abs}] ` : " ";
  });
  return b.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "’").replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

async function one(site, dir) {
  const pages = [];
  try {
    const home = await politeGet(site.url);
    pages.push([site.url, home]);
    const links = [...home.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)]
      .map((m) => ({ href: m[1], label: m[2].replace(/<[^>]+>/g, " ").trim() }))
      .filter((l) => WHATS_ON.test(l.label));
    const seen = new Set([site.url]);
    for (const l of links) {
      let u;
      try { u = new URL(l.href.replace(/&amp;/g, "&"), site.url); } catch { continue; }
      if (u.host !== new URL(site.url).host || seen.has(u.href) || pages.length >= 3) continue;
      seen.add(u.href);
      try { pages.push([u.href, await politeGet(u.href)]); } catch { /* skip unreadable page */ }
    }
  } catch (err) {
    return `${site.name}: ${err.message.split(": ").pop()}`;
  }
  const body = pages.map(([u, h]) => `### PAGE ${u}\n${readable(h, u).slice(0, 7000)}`).join("\n\n");
  const file = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  fs.writeFileSync(new URL(`${file}.txt`, dir), `# ${site.name} | ${site.area || ""} | ${site.url}\n${body}\n`);
  return `${site.name}: ${pages.length} page(s), ${body.length} chars`;
}

if (import.meta.main) {
  const sites = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const dir = new URL("../work/read/", import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  let next = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < sites.length) console.log(await one(sites[next++], dir));
  }));
}

// Feed discovery: check a website once for a machine-readable events feed (JSON-LD, Tribe, iCal).
//   node ingestion/discover.js <url> [<url>…]        probe the given pages
//   node ingestion/discover.js --file urls.json      [{ name, url, area? }] or ["url", …]
//   …  --add         append hits with events in the window to data/registry.json
//   …  --save        keep each fetched page in work/probe/ (to write custom adapters without refetching)
//   …  --no-report   don't overwrite data/discovery-report.json
// At most 3 requests per site, ~1/second per host, robots.txt respected, blocks are recorded and left alone.
import fs from "node:fs";
import { politeGet, parseJsonLd, parseIcs, parseTribe, tribeUrl } from "./adapters/generic.js";
import { londonToday, addDays, normalize } from "./normalize.js";

const inWindow = (rows, today, horizon) => rows.map((r) => normalize(r)).filter(Boolean)
  .filter((e) => (e.end_date || e.start_date) >= today && e.start_date <= horizon).length;

export async function probeSite({ name, url, area }, { today = londonToday(), days = 14, save = false } = {}) {
  const horizon = addDays(today, days);
  const host = new URL(url).host.replace(/^www\./, "");
  const entry = { name: name || host, url, area };
  const result = { name: entry.name, url, status: "no feed", method: null, total: 0, in_window: 0 };
  let html;
  try { html = await politeGet(url); }
  catch (err) {
    const why = /robots/.test(err.message) ? "robots disallow" : `unreachable (${err.message.split(": ").pop()})`;
    return { ...result, status: why };
  }
  if (save) {
    fs.mkdirSync(new URL("../work/probe/", import.meta.url), { recursive: true });
    fs.writeFileSync(new URL(`../work/probe/${host}.html`, import.meta.url), html);
  }
  const hits = [];
  const ld = parseJsonLd(html, entry);
  if (ld.length) hits.push({ method: "jsonld", url, total: ld.length, in_window: inWindow(ld, today, horizon) });

  // Events usually live one click in: follow the site's own "What's on" / "Events" link once.
  if (!ld.length) {
    const link = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)]
      .map((m) => ({ href: m[1], label: m[2].replace(/<[^>]+>/g, " ").trim() }))
      .find((l) => /^(what'?s on|what’s on|events?|exhibitions?( (&|and) events)?|programme|calendar|whats on)$/i.test(l.label)
        || /\/(whats-on|what-s-on|events|whatson|programme)\/?$/i.test(l.href));
    try {
      const sub = link && new URL(link.href.replace(/&amp;/g, "&"), url);
      if (sub && sub.host === new URL(url).host && sub.href !== url) {
        const subHtml = await politeGet(sub.href);
        const rows = parseJsonLd(subHtml, entry, sub.href);
        if (rows.length) hits.push({ method: "jsonld", url: sub.href, total: rows.length, in_window: inWindow(rows, today, horizon) });
        html += subHtml; // so the Tribe / iCal checks below see this page too
      }
    } catch { /* what's-on page not readable */ }
  }

  if (/tribe-events|tribe_events|the-events-calendar/.test(html)) {
    try {
      const json = JSON.parse(await politeGet(tribeUrl(url, today, horizon), "application/json"));
      if (Array.isArray(json.events)) {
        const rows = parseTribe(json, entry);
        hits.push({ method: "tribe", url: new URL(url).origin + "/", total: json.total ?? rows.length, in_window: inWindow(rows, today, horizon) });
      }
    } catch { /* no Tribe API */ }
  }

  const ics = html.match(/href=["']((?:https?:|webcal:|\/)[^"']*(?:\.ics\b|[?&](?:ical|outlook-ical)=1)[^"']*)["']/i)?.[1];
  if (ics && !hits.some((h) => h.method === "tribe")) {
    try {
      const icsUrl = new URL(ics.replace(/^webcal:/, "https:").replace(/&amp;/g, "&"), url).href;
      const rows = parseIcs(await politeGet(icsUrl, "text/calendar"), entry);
      if (rows.length) hits.push({ method: "ical", url: icsUrl, total: rows.length, in_window: inWindow(rows, today, horizon) });
    } catch { /* link didn't return a calendar */ }
  }
  if (!hits.length) return result;
  const best = hits.sort((a, b) => b.in_window - a.in_window || b.total - a.total)[0];
  return { ...result, status: "feed found", method: best.method, feed_url: best.url, total: best.total, in_window: best.in_window, area };
}

export async function probeAll(sites, opts = {}, concurrency = 8) {
  const results = new Array(sites.length);
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < sites.length) {
      const i = next++;
      try { results[i] = await probeSite(sites[i], opts); }
      catch (err) { results[i] = { name: sites[i].name, url: sites[i].url, status: `error (${err.message})`, method: null, total: 0, in_window: 0 }; }
      const r = results[i];
      console.log(`${r.status === "feed found" ? "+" : "."} ${r.name}: ${r.status}${r.method ? ` (${r.method}, ${r.in_window} in window of ${r.total})` : ""}`);
    }
  }));
  return results;
}

export function addToRegistry(results, extra = {}) {
  const file = new URL("../data/registry.json", import.meta.url);
  const registry = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  let added = 0;
  for (const r of results) {
    if (r.status !== "feed found" || !r.in_window) continue;
    if (registry.some((e) => e.name === r.name || new URL(e.url).host === new URL(r.feed_url).host)) continue;
    registry.push({ name: r.name, url: r.feed_url, method: r.method, priority: 2, venue: r.name, ...(r.area ? { area: r.area } : {}), ...extra });
    added++;
  }
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + "\n");
  return added;
}

export function writeReport(results, note) {
  const found = results.filter((r) => r.status === "feed found");
  const report = {
    generated_at: new Date().toISOString(), note,
    checked: results.length, found: found.length, with_events_in_window: found.filter((r) => r.in_window).length,
    events_in_window: found.reduce((n, r) => n + r.in_window, 0),
    by_method: found.reduce((m, r) => ((m[r.method] = (m[r.method] || 0) + 1), m), {}),
    by_status: results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {}),
    sites: results,
  };
  fs.writeFileSync(new URL("../data/discovery-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const sites = fileIdx !== -1
    ? JSON.parse(fs.readFileSync(args[fileIdx + 1], "utf8")).map((s) => (typeof s === "string" ? { url: s } : s))
    : args.filter((a) => /^https?:/.test(a)).map((url) => ({ url }));
  const results = await probeAll(sites, { save: args.includes("--save") });
  if (!args.includes("--no-report")) {
    const rep = writeReport(results, "Sites checked once each for JSON-LD Event data, a Tribe Events API or an iCal link.");
    console.log(`\nChecked ${rep.checked}, feeds found ${rep.found} (${JSON.stringify(rep.by_method)}), ${rep.events_in_window} events in window.`);
  }
  if (args.includes("--add")) console.log(`Added ${addToRegistry(results)} sources to data/registry.json`);
}

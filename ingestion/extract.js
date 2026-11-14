// The AI step: any messy page, pasted text or flyer image -> clean event records.
// Claude reads the source and fills the contract's fields; normalize() then checks them.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { normalize, londonToday, EVENT_TYPES, PRICE_TYPES } from "./normalize.js";

export const MODEL = "claude-opus-5-5";
let client;
const claude = () => (client ??= new Anthropic());

const ExtractedEvent = z.object({
  title: z.string(),
  event_type: z.enum(EVENT_TYPES),
  description: z.string().nullable().describe("1-2 sentences in our own words, not copied from the source"),
  artists: z.array(z.string()),
  art_forms: z.array(z.string()).describe("lowercase, e.g. printmaking, painting, sculpture, photography, textiles, ceramics, film, performance, installation, drawing, digital"),
  tags: z.array(z.string()).describe("lowercase, e.g. free, family, emerging, quiet, hands-on, late, community, beginner-friendly, outdoor"),
  image_url: z.string().nullable(),
  start_date: z.string().describe("YYYY-MM-DD in Europe/London"),
  end_date: z.string().nullable().describe("YYYY-MM-DD, only for runs longer than one day"),
  start_time: z.string().nullable().describe("HH:MM 24h"),
  end_time: z.string().nullable(),
  venue_name: z.string().nullable(),
  address: z.string().nullable(),
  postcode: z.string().nullable(),
  area: z.string().nullable().describe("London neighbourhood, e.g. Peckham, Mayfair"),
  price_type: z.enum(PRICE_TYPES),
  price_min_gbp: z.number().nullable(),
  booking_required: z.boolean().nullable(),
  booking_url: z.string().nullable(),
  confidence: z.number().describe("0 to 1: how sure you are that the date, venue and title are right"),
});

const Extraction = z.object({
  events: z.array(ExtractedEvent).describe("Only art events in or near London. Empty if there are none."),
});

const SYSTEM = `You turn messy listings of London art events (web pages, newsletters, flyers) into clean records.
Only include real art events: exhibitions, private views, workshops, talks, open studios, performances, screenings, fairs, tours.
Never invent facts. Leave a field null (or the list empty) when the source does not say it. Use price_type "unknown" when cost isn't stated.
Resolve relative dates ("this Thursday", "Fri 20th") against today's date. If an event has no year, assume the next such date.
Write descriptions in your own words, at most two sentences.`;

// source: { url } | { text, url? } | { imagePath, url? }
export async function extractEvents(source, { sourceName, today = londonToday() } = {}) {
  const content = [];
  let sourceUrl = source.url;

  if (source.imagePath) {
    const ext = path.extname(source.imagePath).slice(1).toLowerCase().replace("jpg", "jpeg");
    if (ext === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fs.readFileSync(source.imagePath).toString("base64") } });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: `image/${ext}`, data: fs.readFileSync(source.imagePath).toString("base64") } });
    }
    sourceUrl ??= `upload://${path.basename(source.imagePath)}`;
  }

  let text = source.text;
  if (!text && source.url && !source.imagePath) text = await fetchPageText(source.url);
  if (text) content.push({ type: "text", text: `<source url="${sourceUrl ?? ""}">\n${text}\n</source>` });

  content.push({ type: "text", text: `Today is ${today}. Extract every art event in this source.` });

  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined this source");
  if (response.stop_reason === "max_tokens") console.warn("Extraction hit max_tokens; some events may be missing");
  const found = response.parsed_output?.events ?? [];

  const name = sourceName ?? (sourceUrl?.startsWith("http") ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "Flyer upload");
  const scrapedAt = new Date().toISOString();
  return found
    .map((e, i) => normalize({
      ...e,
      source_name: name,
      // One page can hold several events; keep (source_name, source_url) unique.
      source_url: found.length > 1 ? `${sourceUrl}#${i + 1}` : sourceUrl,
      scraped_at: scrapedAt,
    }))
    .filter(Boolean);
}

// Fetch a page and keep only readable text, plus image and link hints, so Claude reads less noise.
export async function fetchPageText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (hackathon prototype; low volume)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, " [image: $1] ")
    .replace(/<a[^>]*href="(http[^"]+)"[^>]*>/gi, " [link: $1] ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|article|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&#8217;/g, "’")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  const LIMIT = 150_000;
  if (text.length > LIMIT) {
    console.warn(`${url}: page text is ${text.length} chars; sending the first ${LIMIT}. Split the page if events are missing.`);
    return text.slice(0, LIMIT);
  }
  return text;
}

// Fill art_forms, tags and a short description for records that came from plain scraping.
// One call per batch of 40 titles. These are inferred from title and venue, so confidence drops a little.
const Enrichment = z.object({
  items: z.array(z.object({
    index: z.number(),
    art_forms: z.array(z.string()),
    tags: z.array(z.string()),
    description: z.string().nullable(),
  })),
});

export async function enrichEvents(events) {
  const out = events.map((e) => ({ ...e }));
  for (let start = 0; start < out.length; start += 40) {
    const batch = out.slice(start, start + 40);
    const list = batch.map((e, i) => `${i}. [${e.event_type}] ${e.title} — ${e.venue_name ?? "?"}${e.artists.length ? ` (artists: ${e.artists.join(", ")})` : ""}`).join("\n");
    const response = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Enrichment) },
      system: "You tag London art listings for a personalised feed. Use what you know about the venue and artists. If you can't tell the art form, return an empty list rather than guessing. Tags are lowercase and come from: free, family, emerging, established, quiet, hands-on, late, community, beginner-friendly, outdoor, blockbuster, experimental, political, craft. Description: one neutral sentence, or null if you know nothing beyond the title.",
      messages: [{ role: "user", content: `Tag each listing by its index:\n${list}` }],
    });
    if (response.stop_reason === "refusal") { console.warn("Enrichment batch declined; left as is"); continue; }
    for (const item of response.parsed_output?.items ?? []) {
      const ev = batch[item.index];
      if (!ev) continue;
      ev.art_forms = [...new Set([...ev.art_forms, ...item.art_forms.map((s) => s.toLowerCase())])];
      ev.tags = [...new Set([...ev.tags, ...item.tags.map((s) => s.toLowerCase())])];
      ev.description ??= item.description;
      if (ev.tags.includes("free") && ev.price_type === "unknown") { ev.price_type = "free"; ev.price_min_gbp = 0; }
    }
  }
  return out;
}

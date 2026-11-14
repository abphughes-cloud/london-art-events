import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, dedupeKey, parseDayMonth } from "../ingestion/normalize.js";
import { parseListing, parseOpening } from "../ingestion/adapters/artrabbit.js";
import { dedupe } from "../ingestion/dedupe.js";
import { rank, readFreeText, fitSlot } from "../ranking/rank.js";
import { toSeedSql } from "../ingestion/sql.js";

const ev = (o) => normalize({ title: "Show", start_date: "2026-11-14", source_name: "T", source_url: `u:${Math.random()}`, ...o });

test("dates", () => {
  assert.equal(parseDayMonth("14 Nov 2026"), "2026-11-14");
  assert.equal(parseDayMonth("Thu 3 Jan", "2026-11-14"), "2027-01-03");
  assert.deepEqual(parseOpening("Opening: Today, 19:00", "2026-11-14"), { date: "2026-11-14", time: "19:00" });
  assert.deepEqual(parseOpening("Opening: Tomorrow, 18:30", "2026-11-14"), { date: "2026-11-15", time: "18:30" });
});

test("normalize drops rows the card can't show, and keys ignore case and punctuation", () => {
  assert.equal(normalize({ title: "x", source_name: "a", source_url: "b" }), null);
  assert.equal(dedupeKey({ title: "Bridget Riley!", venue_name: "Hazlitt", start_date: "2026-10-01" }),
    dedupeKey({ title: "bridget  riley", venue_name: "HAZLITT", start_date: "2026-10-01" }));
  assert.equal(ev({ price_type: "free" }).price_min_gbp, 0);
});

test("ArtRabbit card -> exhibition plus its private view", () => {
  const html = `<article class="m_listing-item" data-lon="-0.1" data-lat="51.5"><a class="m_listing-link" href="/events/x">
    <img src="//img.artrabbit.com/a.jpg"><p class="b_categorical-heading">Exhibition</p>
    <p class="b_small-heading mod--primary">Jane Doe: Prints</p><p class="b_small-heading mod--colour">14 Nov 2026 &#8211; 19 Dec 2026</p>
    <p class="b_small-heading b_highlight">Opening: Today, 18:00</p><p class="b_instructional-text mod--large">Small Gallery</p></a></article>`;
  const [show, pv] = parseListing(html, "2026-11-14").map(normalize);
  assert.equal(show.event_type, "exhibition");
  assert.equal(show.end_date, "2026-12-19");
  assert.deepEqual(show.artists, ["Jane Doe"]);
  assert.equal(pv.event_type, "private_view");
  assert.equal(pv.start_time, "18:00:00");
  assert.notEqual(pv.source_url, show.source_url);
});

test("dedupe merges the same show listed twice and fills gaps", () => {
  const a = ev({ title: "Monika Sosnowska: Weight of Matter", venue_name: "Pilar Corrias", end_date: "2026-11-22", confidence: 0.9 });
  const b = ev({ title: "Weight of Matter – Monika Sosnowska", venue_name: "Pilar Corrias Gallery", start_date: "2026-11-01", end_date: "2026-11-22", price_type: "free", confidence: 0.5 });
  const { events, merged } = dedupe([a, b]);
  assert.equal(merged, 1);
  assert.equal(events[0].price_type, "free");
});

test("free text: likes and avoids", () => {
  const r = readFreeText("experimental print, hate crowds");
  assert.ok(r.like.has("print") && r.like.has("experimental"));
  assert.ok(r.avoid.has("crowds") && !r.like.has("crowds"));
});

test("slot fit: one-off must start inside the slot; exhibitions need a daytime slot", () => {
  const talk = ev({ start_time: "19:00" });
  assert.ok(fitSlot(talk, [{ date: "2026-11-14", from: "18:00", to: "22:00" }]));
  assert.equal(fitSlot(talk, [{ date: "2026-11-14", from: "10:00", to: "17:00" }]), null);
  const show = ev({ end_date: "2026-11-30" });
  assert.ok(fitSlot(show, [{ date: "2026-11-20", from: "12:00", to: "16:00" }]));
  assert.equal(fitSlot(show, [{ date: "2026-11-20", from: "19:00", to: "22:00" }]), null);
});

test("rank: filters price and avoids, prefers taste, one per venue", () => {
  const events = [
    { ...ev({ title: "Etching now", art_forms: ["printmaking"], venue_name: "A", price_type: "free" }), id: "1" },
    { ...ev({ title: "Etching two", art_forms: ["printmaking"], venue_name: "A" }), id: "2" },
    { ...ev({ title: "Big oils", art_forms: ["painting"], venue_name: "B", tags: ["blockbuster"] }), id: "3" },
    { ...ev({ title: "Pricey", art_forms: ["printmaking"], venue_name: "C", price_type: "paid", price_min_gbp: 40 }), id: "4" },
    { ...ev({ title: "Clay", art_forms: ["ceramics"], venue_name: "D" }), id: "5" },
  ];
  const picks = rank({ liked_art_forms: ["printmaking"], liked_tags: [], avoid_tags: [], free_text: "hate crowds", free_slots: [], max_price_gbp: 10 }, events, { today: "2026-11-14", limit: 2 });
  assert.equal(picks[0].event_id, "1");
  assert.ok(!picks.some((p) => ["3", "4"].includes(p.event_id)));
  assert.ok(picks[0].score > 0 && picks[0].score <= 1 && picks[0].reason.length > 0);
});

test("seed SQL escapes quotes and casts enums", () => {
  const sql = toSeedSql([{ ...ev({ title: "Artist's show", artists: ["O'Neil"] }), id: "00000000-0000-4000-a000-000000000000" }]);
  assert.match(sql, /'Artist''s show'/);
  assert.match(sql, /'other'::event_type/);
  assert.match(sql, /on conflict \(dedupe_key\)/);
});

import { parseDateText, parsePrice, looksLikeArt } from "../ingestion/html.js";
import * as galleriesnow from "../ingestion/adapters/galleriesnow.js";
import * as ianvisits from "../ingestion/adapters/ianvisits.js";

test("free-text dates and times from listings", () => {
  const t = "2026-11-14";
  assert.deepEqual(parseDateText("6 - 15 NOV 2026, FRI - SUN, 12 - 6PM", t),
    { start_date: "2026-11-06", end_date: "2026-11-15", start_time: "12:00", end_time: "18:00" });
  assert.equal(parseDateText("Wed 25 Nov 2026 - Sat 23 Jan 2027", t).end_date, "2027-01-23");
  assert.equal(parseDateText("15 - 18 Oct", t).start_date, "2026-10-15"); // past, not next year
  assert.equal(parseDateText("19 SEPT 2026 11am - 2:30pm", t).end_time, "14:30");
  assert.equal(parseDateText("Exhibition ends on Sunday 14th Feb 2027", t).start_date, "2027-02-14");
  assert.deepEqual(parsePrice("&pound;15".replace("&pound;", "£")), { price_type: "paid", price_min_gbp: 15 });
  assert.equal(parsePrice("Free and all welcome").price_type, "free");
  assert.ok(looksLikeArt("Monet and the sea", "paintings from"));
  assert.ok(!looksLikeArt("Dogs in jumpers parade along the Mall"));
});

test("GalleriesNow card", () => {
  const html = `<div class="exhibition-panel grid-item x"><a href="https://g/shows/a/" class="exhibition-panel__image fixed">
    <img src="https://g/a.webp" alt="" class="listing-image" /></a><div class="exhibition-panel__gallery__logo__text">
    <a href="https://g/gallery/x/" class="link-default">Albion Jeune</a><small>London West End</small></div>
    <a href="https://g/shows/a/" class="exhibition-panel__info__main__text__title link-default">Victor Bengtsson: Bagatelle</a>
    <p class="exhibition-panel__info__main__text__date">Wed 25 Nov 2026 - Sat 23 Jan 2027</p>
    <p class="exhibition-panel__info__main__text__address mt-10">16-17 Little Portland Street, W1W 8BP, London</p>
    <p class="exhibition-panel__info__main__text__opening-times">Thu until 8pm</p></div>`;
  const [e] = galleriesnow.parseListing(html, "2026-11-14").map(normalize);
  assert.equal(e.venue_name, "Albion Jeune");
  assert.equal(e.postcode, "W1W 8BP");
  assert.equal(e.area, "West End");
  assert.deepEqual(e.artists, ["Victor Bengtsson"]);
  assert.ok(e.tags.includes("late"));
});

test("IanVisits: drops non-art, keeps end date and price", () => {
  const block = (title, ex, when, price) => `<div class="event_wrapper"><h3><a href="https://iv/${title.length}">${title}</a></h3><div class="event_exerpt"><p>${ex}<div class="read-more"></div></p></div><div class="event_time">${when}</div><div class="event_price">${price}</div><div class="event_location">Old Royal Naval College, Greenwich</div></div>`;
  const html = block("Lost Worlds", "A light installation by artists", "Exhibition ends on Sunday 15th Nov", "&pound;22")
    + block("Dogs in jumpers", "A parade", "Exhibition ends on Sunday 15th Nov", "Free");
  const rows = ianvisits.parseDay(html, "2026-11-14").map(normalize);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].end_date, "2026-11-15");
  assert.equal(rows[0].price_min_gbp, 22);
  assert.equal(rows[0].area, "Greenwich");
});

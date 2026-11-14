import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIcs, parseJsonLd, parseTribe, parseRobots, robotsAllows, inferType } from "../ingestion/adapters/generic.js";
import { normalize } from "../ingestion/normalize.js";

const entry = { name: "Test Gallery", url: "https://example.org/whats-on", method: "ical", venue: "Test Gallery", area: "Peckham" };

test("iCal: timed event, all-day range, folded lines", () => {
  const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261119T183000", "DTEND;TZID=Europe/London:20261119T203000",
    "SUMMARY:Private view: Jane Doe\, new", "  prints", "LOCATION:Small Gallery\, 1 High St\, London SE15 4QN", "URL:https://example.org/e/1", "DESCRIPTION:Free\, all welcome", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261201", "SUMMARY:Winter show", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const [pv, show] = parseIcs(ics, entry).map(normalize);
  assert.equal(pv.title, "Private view: Jane Doe, new prints");
  assert.equal(pv.event_type, "private_view");
  assert.equal(pv.start_time, "18:30:00");
  assert.equal(pv.venue_name, "Small Gallery");
  assert.equal(pv.postcode, "SE15 4QN");
  assert.equal(pv.price_type, "free");
  assert.equal(pv.source_url, "https://example.org/e/1");
  assert.equal(show.end_date, "2026-11-30");
  assert.equal(show.event_type, "exhibition");
  assert.equal(show.venue_name, "Test Gallery");
  assert.equal(show.source_url, entry.url);
});

test("JSON-LD: events inside @graph, UTC time converted to London, free flag", () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},
    {"@type":"ExhibitionEvent","name":"Clay &amp; Fire","startDate":"2026-07-01T17:00:00Z","endDate":"2026-07-01T19:00:00Z","url":"/e/clay",
     "location":{"@type":"Place","name":"Kiln Rooms","address":{"streetAddress":"2 Arch","postalCode":"SE15 3SN"},"geo":{"latitude":51.47,"longitude":-0.07}},
     "isAccessibleForFree":true,"image":["https://example.org/a.jpg"]}]}</script>`;
  const [e] = parseJsonLd(html, { ...entry, method: "jsonld" }).map(normalize);
  assert.equal(e.title, "Clay & Fire");
  assert.equal(e.start_time, "18:00:00"); // BST
  assert.equal(e.venue_name, "Kiln Rooms");
  assert.equal(e.postcode, "SE15 3SN");
  assert.equal(e.lat, 51.47);
  assert.equal(e.price_type, "free");
  assert.equal(e.source_url, "https://example.org/e/clay");
});

test("Tribe: venue, cost and art filter", () => {
  const json = { events: [
    { title: "Lino printing workshop", url: "https://example.org/event/lino/", start_date: "2026-11-21 11:00:00", end_date: "2026-11-21 13:00:00", cost: "£12", venue: { venue: "The Hub", address: "3 Road", city: "London", zip: "E8 1AA" }, categories: [{ name: "Workshops" }] },
    { title: "Toddler rhyme time", url: "https://example.org/event/rhyme/", start_date: "2026-11-22 10:00:00", end_date: "2026-11-22 10:30:00", venue: [] },
  ] };
  const rows = parseTribe(json, { ...entry, method: "tribe", artFilter: true }).map(normalize);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, "workshop");
  assert.equal(rows[0].price_min_gbp, 12);
  assert.equal(rows[0].venue_name, "The Hub");
});

test("robots.txt: longest matching rule wins, other agents ignored", () => {
  const rules = parseRobots("User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-json/\nAllow: /wp-json/tribe/\nDisallow: /private");
  assert.equal(robotsAllows(rules, "/wp-json/wp/v2/posts"), false);
  assert.equal(robotsAllows(rules, "/wp-json/tribe/events/v1/events"), true);
  assert.equal(robotsAllows(rules, "/whats-on"), true);
  assert.equal(inferType("Open Studios weekend"), "open_studio");
});

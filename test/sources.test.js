import { test } from "node:test";
import assert from "node:assert/strict";
import { parseListing as artsCalendar } from "../ingestion/adapters/artscalendar.js";
import { parseListing as lewisham, parseDetail } from "../ingestion/adapters/wearelewisham.js";
import { smallSources } from "../ingestion/adapters/small.js";
import { locate } from "../ingestion/locate.js";
import { normalize } from "../ingestion/normalize.js";

const T = "2026-11-14";
const small = (name) => smallSources.find((s) => s.source.name === name);

test("Arts Calendar: dated drawing session and an open exhibition", () => {
  const html = `<ul><li class="fc-row fc-row--saveable" data-lat="51.54" data-lng="-0.08"><div class="fc-row__when"><span class="fc-row__date">Mon 16 Nov</span>
    <span class="fc-row__start">19:00</span><span class="fc-row__end">21:00</span></div><p class="fc-row__kind fc-row__kind--drawing">Drawing Group</p>
    <h3 class="fc-row__title"> <a href="https://artscalendar.co.uk/drawing/dalston/">Life Drawing Dalston</a></h3>
    <p class="fc-row__where"> <a href="https://artscalendar.co.uk/venues/st/">Sweet Thursday</a>, Hoxton, Greater London </p>
    <ul class="fc-chips"><li><a class="fc-chip fc-chip--drawing_kind" href="#">Life drawing</a></li></ul></li>
    <li class="fc-row fc-row--photo" data-lat="51.5" data-lng="-0.13"><div class="fc-row__when fc-row__when--span"><span class="fc-row__start">Until 17 Jan 2027</span></div>
    <p class="fc-row__kind fc-row__kind--exhibition">Exhibition</p><h3 class="fc-row__title"> <a href="https://artscalendar.co.uk/exhibitions/x/">Ann Lee: Clay</a></h3>
    <p class="fc-row__where"> <a href="#">Small Space</a>, London, Greater London </p>
    <ul class="fc-chips"><li><a class="fc-chip fc-chip--exhibition_kind" href="#">Solo show</a></li><li><a class="fc-chip fc-chip--art_medium" href="#">Ceramics</a></li></ul></li></ul>`;
  const [draw, show] = artsCalendar(html, T).map(normalize);
  assert.equal(draw.event_type, "workshop");
  assert.equal(draw.start_date, "2026-11-16");
  assert.equal(draw.start_time, "19:00:00");
  assert.equal(draw.area, "Hoxton");
  assert.deepEqual(draw.art_forms, ["life drawing"]);
  assert.ok(draw.source_url.endsWith("#2026-11-16"));
  assert.equal(show.end_date, "2027-01-17");
  assert.equal(show.start_date, T);
  assert.deepEqual(show.artists, ["Ann Lee"]);
  assert.equal(show.lat, 51.5);
});

test("We Are Lewisham: keeps art events, drops concerts, reads the address page", () => {
  const card = (cats, href, title, when) => `<div class="a-19"><a class="a-19__0" href="${href}"><img src="/m/a.jpg"></a><div class="a-19__1">${cats.map((c) => `<a class="a-19__2" href="/events/?categories=${c}">x</a>`).join("")}</div>
    <h3 class="headline-small a-19__3"><a class="a-19__4" href="${href}">${title}</a></h3><div>${when}</div></div>`;
  const html = card(["free-events", "classes-worshops", "visual-arts"], "/events/print/", "Free printmaking workshop", "Wed 18 Nov 2026 10:00 — Wed 18 Nov 2026 12:00")
    + card(["live-music", "music"], "/events/sea/", "A Sea Symphony", "Sat 14 Nov 2026 19:30 — Sat 14 Nov 2026 21:30")
    + card(["free-events", "artist-studios", "exhibition"], "/events/open/", "Lee Green Open Studios", "Sat 14 Nov 2026 11:00 — Sun 22 Nov 2026 17:00");
  const [ws, open] = lewisham(html, T).map(normalize);
  assert.equal(ws.event_type, "workshop");
  assert.equal(ws.price_type, "free");
  assert.equal(ws.end_time, "12:00:00");
  assert.equal(open.event_type, "open_studio");
  assert.equal(open.end_date, "2026-11-22");
  const d = parseDetail(`<h2 class="headline-large">Info</h2> <div class="margin-32"> <div>Org</div></div><h2 class="headline-large">Address</h2> <p>Parkside Centre, 1 Road, SE6 2UP</p><div class="a-31" data-lat="52.4" data-lng="1.7"></div>`);
  assert.equal(d.venue_name, "Parkside Centre");
  assert.equal(d.postcode, "SE6 2UP");
  assert.equal(d.lat, undefined); // pin outside London is ignored
});

test("small sources: Cockpit, Pigment Press, Thames-Side, Goldsmiths", () => {
  const [open] = small("Cockpit Studios").parse(`<a href="/whats-on/open/" class="event-thumbnail link-area"><img src="https://c.org/a.jpg"><p class="title text-black"> Cockpit Open Studios </p><h3 class="title"> Winter 2026 Deptford </h3><p class="date mt-1"> 04.12.2026 - 06.12.2026</p></a>
    <a href="/whats-on/jazz/" class="event-thumbnail"><p class="title"> Music </p><h3 class="title"> Jazz </h3><p class="date"> 26.11.2026</p></a>`).map(normalize);
  assert.equal(open.event_type, "open_studio");
  assert.equal(open.end_date, "2026-12-06");
  assert.equal(open.postcode, "SE8 3DZ");

  const [print] = small("Pigment Press").parse(`<h2>upcoming Workshops</h2><h3 class="wp-block-heading has-medium-font-size">Saturday 21st November</h3>
    <h4 class="wp-block-heading"><a href="https://www.eventbrite.co.uk/e/123?aff=x">Cyanotype Workshop</a> • 10.00</h4>`, T).map(normalize);
  assert.equal(print.start_date, "2026-11-21");
  assert.equal(print.start_time, "10:00:00");
  assert.equal(print.booking_url, "https://www.eventbrite.co.uk/e/123?aff=x");

  const [market] = small("Thames-Side Studios").parse(`<div class="exhibtile 2026 "><a href="/news/exhibitions/2026/makers"><h1 class="text-4xl"><i>Makers' Market 2026</i></h1><p class="card-date"> 21 Nov 2026 — 22 Nov 2026 </p><div class="framed-button w-max">Main Gallery</div></a></div>`, T).map(normalize);
  assert.equal(market.event_type, "fair");
  assert.equal(market.end_date, "2026-11-22");

  const [pv] = small("Eat Work Art").parse(`<a class="card-simple var3" href="https://eatworkart.com/hackney-downs-studios/events/x"><div class="date">3 December 2026 18:00</div><p class="title">Hackney Downs Studios</p><p class="location">Jo Bloggs Exhibition Opening Night</p></a>`, T).map(normalize);
  assert.equal(pv.event_type, "private_view");
  assert.equal(pv.start_time, "18:00:00");
  assert.equal(pv.postcode, "E8 2BT");

  const [screening] = small("Goldsmiths School of Art").parse(`<div class="ODcontainer"><h3>Works in Progress Screening</h3><div class="event-date">18 November 2026</div><div class="event-time">6:00pm - 8:00pm</div><a href="https://www.gold.ac.uk/calendar/?id=1">More</a></div>`, T).map(normalize);
  assert.equal(screening.event_type, "screening");
  assert.equal(screening.start_time, "18:00:00");
});

test("location clean-up: shares venue facts, drops events with no place", async () => {
  const ev = (o) => normalize({ title: "Show", start_date: T, source_name: "T", source_url: `u:${Math.random()}`, ...o });
  const { events, dropped } = await locate([
    ev({ title: "A", venue_name: "The Small Gallery", postcode: "E8 1AA", lat: 51.54, lng: -0.06 }),
    ev({ title: "B", venue_name: "Small Gallery London" }), // same venue, nothing but the name
    ev({ title: "C", venue_name: null, lat: 51.5, lng: -0.1 }), // no venue
    ev({ title: "D", venue_name: "Nowhere Hall" }), // no location
    ev({ title: "E", venue_name: "Far Away", lat: 53.4, lng: -2.2 }), // not London
  ], { offline: true });
  assert.deepEqual(events.map((e) => e.title), ["A", "B"]);
  assert.equal(events[1].postcode, "E8 1AA");
  assert.equal(events[1].lat, 51.54);
  assert.equal(dropped, 3);
});

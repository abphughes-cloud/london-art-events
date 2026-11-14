# London art-event source research

Checked 14 November 2026 for the 14–28 November window. Counts are a quick count of visible relevant listings, not a guarantee of unique additions: long-running exhibitions can be counted as active, and dedupe will remove overlap. “HTML; feed unverified” means the public listing page was readable, but this quick audit did not probe separate feed endpoints. No blocked page was retried or worked around.

## Existing sources and named candidates

| Name | URL | Method / feed check | Events in window | Fields visible | Long-tail | Status |
|---|---|---|---:|---|---|---|
| ArtRabbit (existing) | [London listings](https://www.artrabbit.com/all-listings/united-kingdom/london) | Existing HTML-card adapter; no feed check | ~124 (latest seed) | title, date, venue, URL; private views from opening text | High | works |
| GalleriesNow (existing) | [London exhibitions](https://www.galleriesnow.net/exhibitions/london) | Existing clean HTML-card adapter; no feed check | ~124 (latest seed) | title, date, venue, address/postcode, hours, URL | Medium | works |
| IanVisits (existing) | [Exhibitions calendar](https://ianvisits.co.uk/calendar/date/2026/11/14/exhibitions/) | Existing date-page HTML adapter; no feed check | ~67 (latest seed) | title, end date, venue, price, URL; start date is approximate | Medium | works |
| SPACE Studios (existing) | [What’s on](https://spacestudios.org.uk/whats-on/) | Existing HTML listing adapter; no feed check | ~4 (latest seed) | title, dates, venue, URL | High | works |
| Tate | [What’s on](https://www.tate.org.uk/whats-on) | Direct page request | Not counted | Page fields not inspected | Low | blocked (403; stopped) |
| Whitechapel Gallery | [Exhibitions](https://www.whitechapelgallery.org/exhibitions/) | Clean HTML list; feed/JSON-LD unverified | ~5 active / opening-window shows | title, date range, event page; times/prices not on list | Medium | works |
| Serpentine | [What’s on](https://www.serpentinegalleries.org/whats-on/) | HTML exhibition/event pages; feed unverified | ~2 active shows; opening-event details sometimes shown | title, dates, opening time, URL | Medium | works |
| Barbican | [What’s on](https://www.barbican.org.uk/whats-on) | HTML cards; feed unverified | ~2–5 visual-art items, mixed with other arts | title, date, venue, ticket link | Low | works |
| ICA | [What’s on](https://www.ica.art/whats-on) | Direct page request to this route | Not counted | Not inspected | Medium | blocked (404 on tested route; do not retry until route is confirmed) |
| South London Gallery | [What’s on](https://www.southlondongallery.org/) | Clean HTML home/listing page; feed unverified | ~3 relevant shows/events | title, dates; one visible free event with time | Medium | works |
| Camden Art Centre | [What’s on](https://camdenartcentre.org/whats-on) | HTML listing page; feed unverified | Not reliably countable from quick page result | Title / event detail links; dates and price need detail-page parse | Low | works |
| Chisenhale Gallery | [What’s on](https://chisenhale.org.uk/whats-on/) | Page route not confirmed in this check | Not counted | Not inspected | High | blocked (route unresolved; do not guess endpoints) |
| Hayward Gallery | [Visual arts at Southbank Centre](https://www.southbankcentre.co.uk/whats-on/visual-arts) | Southbank Centre HTML event listings; feed unverified | Not reliably countable in quick check | Event detail pages should carry dates, venue and ticketing | Low | works |
| Acme Studios | [Acme Studios](https://www.acme-studios.co.uk/) | No current public event list confirmed | 0 confirmed | No event fields confirmed | High | works (no usable rolling listing found) |
| Bow Arts | [Bow Arts](https://bowarts.org/) | Public home page; older handover reports event-detail 403s | 0 confirmed without opening blocked details | Home page has event titles; detail fields unavailable | High | blocked (do not fetch pages known to return 403) |
| ACAVA | [What’s on](https://www.acava.org/whats-on/) | Clean HTML cards; feed unverified | 0 dated London events after 14 Nov on the visible list | titles, dates/descriptions on event pages, location sometimes | High | works |
| SET | [SET Studios](https://setspace.uk/) | Public site; no rolling event list located | 0 confirmed | Not available on the inspected studio pages | High | works (calendar not found) |
| Thames-Side Studios | [Exhibitions](https://thames-sidestudios.co.uk/exhibitions) | Clean HTML title/date/room list; feed unverified | 2: one show to 15 Nov, Makers’ Market 21–22 Nov | title, date range, gallery/room; no times/prices on list | High | works |
| Lewisham Arthouse | [Lewisham Arthouse](https://www.lewishamarthouse.org.uk/) | Home page works; previous handover says what’s-on URLs returned 404 | 0 confirmed | No usable dated listing found | High | blocked (old route 404; no retry) |
| Cockpit Studios | [What’s on](https://cockpitstudios.org/whats-on/) | Clean month-grouped HTML list; feed unverified | 4 relevant listings in November (including workshops and open studios) | event type, title, dates, venue; detail links for times/price | High | works |
| Art Hub Studios | [Art Hub Studios](https://www.arthubstudios.com/) | Exact London event listing not confirmed | Not counted | Not inspected | High | blocked (source page not confirmed) |
| Time Out London Art | [London art](https://www.timeout.com/london/art) | Editorial HTML list, not a dated event feed | ~10 curated exhibitions/reviews | titles and linked venues; dates/times/prices mostly on venue pages | Low | works |
| London Art Map | [Search for current London Art Map](https://www.google.com/search?q=London+Art+Map+London+gallery+listings) | No current canonical event calendar confirmed | Not counted | Not inspected | Medium | blocked (current source URL unresolved) |
| This Is Tomorrow | [This Is Tomorrow](https://thisistomorrow.info/) | Art publication; no rolling London calendar confirmed | 0 confirmed | Editorial pages, not event records | Low | works (not a useful calendar found) |
| Art Licks | [Art Licks](https://www.artlicks.com/) | HTML news/events feed; current surfaced item is not a London listing | 0 confirmed | title and event text, dates inconsistently exposed | High | works (no current London event found) |
| Studio International | [Studio International](https://www.studiointernational.com/) | Editorial art magazine; no event calendar confirmed | 0 confirmed | Editorial pages | Low | works (not a useful calendar found) |
| Londonist | [London exhibitions guide](https://londonist.com/london/art-and-photography/the-top-exhibitions-to-see-in-london-november-and-december-2026) | Editorial HTML guide | ~8 curated shows, not a comprehensive feed | title, venue, dates in article text; price/time often absent | Low | works |
| Arts Calendar | [Greater London exhibitions](https://artscalendar.co.uk/in/greater-london/?show=exhibitions) | HTML directory; search result reports 122 exhibitions, 11 drawing groups and 8 workshops/classes across 84 venues; feed unverified | 122 active exhibitions plus 19 recurring activities reported (not unique starts) | title, venue, dates; time/price vary by listing | High | works (page load not confirmed by this viewer; count from indexed page) |
| On View | [London](https://onview.so/london) | Clean searchable/map listing; aggregator; feed unverified | ~45 active shows; ~6 previews/openings dated 19–26 Nov | title, venue/area, dates, opening time for some; source-venue link | Medium | works |
| Ocula | [London exhibitions map](https://ocula.com/art-exhibitions/map/) | Structured-looking HTML map/list; feed/API unverified | ~46 London exhibition records in snapshot | title, gallery, date range; limited times/prices | Low | works |
| London Art History Society | [Monthly London exhibition list](https://londonarthistorysociety.org.uk/) | Monthly PDF/listing | Not counted from PDF for this quick audit | title, gallery, date range; little time/price | Low | works |
| Pigment Press | [Upcoming workshops](https://pigmentpress.co.uk/) | Clean HTML list; booking links go to Eventbrite | 4 workshops (14, 21, 26, 28 Nov) | title, date, start time, studio address; price on booking page | High | works |
| London Print Studio | [Courses and studio](https://www.londonprintstudio.org.uk/) | Public studio/course pages; no dated 14-day listing confirmed | 0 confirmed | Course pages; dates/prices vary | High | works (calendar not found) |
| HAUSPRINT | [HAUSPRINT](https://hausprint.studio/) | Public studio page; no dated listing confirmed | 0 confirmed | No rolling event fields confirmed | High | works (calendar not found) |
| Rabbits Road Press | [Rabbits Road Press](https://rabbitsroadpress.co.uk/) | Public press/studio page; event calendar not confirmed | 0 confirmed | Not inspected | High | blocked (canonical calendar not confirmed) |
| Eventbrite Art / Workshops | [London art events](https://www.eventbrite.co.uk/d/united-kingdom--london/art/) | Public search, but broad/dynamic; official API access is paid/limited | Many, but not safely countable without API | event title/date/time/venue/price on individual pages | Medium | paid API (do not scrape around limits) |
| Meetup Art Galleries | [London art-galleries events](https://www.meetup.com/find/gb--london/art-galleries/) | Public search page; RSVP/member actions require login | 15+ visible art-related items across the date window; noisy | title, date/time, group, attendee count; venue on detail page | Medium | needs login (for RSVP/member details; listing is public) |
| We Are Lewisham | [Events](https://www.wearelewisham.com/events/) | Filterable HTML event directory; feed unverified | 11 visible art/creative listings spanning the window | title, category, start/end date and time, free tag, venue/detail link | High | works |
| Lewisham Libraries | [Events and bookings](https://lewisham.events.mylibrary.digital/) | Searchable events platform | ~3 art/culture listings in the window | title, date/time, venue, category; booking link | High | works |
| Wandsworth council | [Brightside events/newsletter](https://www.wandsworth.gov.uk/) | Monthly PDF/newsletter, not a clean event feed | ~1 art/creative item identified | title/date/time in PDF; venue/price variable | Medium | works (manual PDF only) |
| UAL Shows | [Shows 2026](https://www.arts.ac.uk/students/ual-shows) | Clean HTML show list; feed unverified | 4 shows, 19–28 Nov | title, college, date range, detail link; times/price on detail pages | High | works |
| Goldsmiths School of Art | [Events](https://www.gold.ac.uk/art/events/) | Clean HTML event list; feed unverified | 1 event, 18 Nov | title, date, start/end time; venue on detail page | High | works |
| Royal College of Art | [Events](https://www.rca.ac.uk/news-and-events/events/) | Public events pages; this check did not count art-specific items | Not counted | Event detail pages | Medium | works |

## Top 10 to add

Rank uses a simple triage score: long-tail value (high 3 / medium 2 / low 1) × visible 14-day volume × ease (clean public HTML 3 / mixed page 2). Counts for directories include active shows and can overstate genuinely new events; compare the seed’s post-dedupe total before deciding whether to keep an adapter.

| Rank | Source | Value × volume × ease | Why it ranks here |
|---:|---|---:|---|
| 1 | Arts Calendar | 2 × 141 × 2 = 564 | Largest mix of exhibitions, drawing groups and workshops; includes smaller venues. Expect duplicates and filter out non-art records. |
| 2 | On View | 2 × 45 × 3 = 270 | Broad current London gallery coverage and useful opening previews; likely overlap with GalleriesNow. |
| 3 | We Are Lewisham | 3 × 11 × 3 = 99 | Best verified source for local free workshops, community open studios and creative-health events. |
| 4 | Cockpit Studios | 3 × 4 × 3 = 36 | Real maker workshops and open studios with dates and places in the listing itself. |
| 5 | Pigment Press | 3 × 4 × 3 = 36 | Four concrete, small-studio print workshops with dates, times and address. |
| 6 | UAL Shows | 3 × 4 × 3 = 36 | Several dated student shows in the window; seasonal but a strong long-tail burst. |
| 7 | Whitechapel Gallery | 1 × 5 × 3 = 15 | Reliable public programme and free exhibitions, but less long-tail than studio/community sources. |
| 8 | Lewisham Libraries | 3 × 3 × 2 = 18 | Small, bookable creative events and community workshops; filter categories carefully. |
| 9 | South London Gallery | 2 × 3 × 3 = 18 | Good local programme, including free daytime events; smaller volume. |
| 10 | Thames-Side Studios | 3 × 2 × 3 = 18 | Studio gallery, makers’ market and prize show, with an easy date/venue list. |

The scores are a shortlist tool, not a promise of net-new rows. For an aggregator (Arts Calendar or On View), compare its raw count with its post-dedupe count; drop it if the net gain is small. Sources whose page returned 403/404 or whose calendar could not be confirmed are not adapter targets.

## Feed and crawl notes

- The visible pages reviewed above expose readable HTML lists. I did not confirm iCal, RSS, WordPress Tribe endpoints, or JSON-LD Event feeds in this quick pass; they need a separate, allowed `robots.txt` and one-request check before any adapter fetches them.
- Do not retry Tate (403), the tested ICA route (404), Bow Arts event-detail pages reported as 403 in the handover, or the old Lewisham Arthouse route (404). Do not infer alternate endpoints to get around a block.
- Eventbrite links are useful booking links for a source’s own events (Pigment Press), but Eventbrite should not be bulk-scraped. Treat its own search feed as paid/API-limited.
- Keep each new adapter to one listing request per run, about one second apart, and preserve the listing’s own `source_url` on every event.

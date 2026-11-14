# Handover: London art events platform (LBS AI Cup 2026)

Read this first. It is everything decided so far, written for Claude Code to pick up and build.

## 1. The situation

- **Event:** LBS AI Cup 2026 hackathon, Saturday 14 November 2026, London Business School.
- **Team:** two people. I (Arthur) build the data side here; my partner builds the app in **Lovable** on her laptop. We merge later.
- **Hard deadline:** submit on **Commfy by 15:30 GMT**. Shortlist judging 16:00–17:00 (3 min: 2-min pitch and demo, 1-min Q&A). Top 8 final 17:15–19:00 (5 min pitch, 5 min Q&A).
- **Rules that constrain the build:**
  - Only code written after the tracks were released (Friday 13 Nov, 19:00) counts. Do not pull in code from earlier projects.
  - Libraries, templates and datasets are fine, but **list everything reused in the submission**.
  - Only **public, synthetic or consented data**.

## 2. The product

An aggregator of London art events, big and small, free and paid, followed by a personalisation layer.

- **Today, in scope:** (1) aggregation into one clean database, (2) personalisation by taste and calendar.
- **Out of scope today:** social features (sharing, ratings). Mention them as the roadmap only.
- **The pitch:** Time Out, ArtRabbit and Eventbrite cover the big shows. The long tail (small-gallery private views, open studios, free community workshops) lives on Instagram posters, newsletters and tiny websites. AI is what makes aggregating that long tail possible.
- **Target user:** a curious Londoner who wants more than blockbuster shows but has no time to follow 50 gallery accounts. Secondary: small artists and spaces who can't reach new audiences.

## 3. How we're judged (shortlist)

| Criterion | Weight | What scores lower |
|---|---|---|
| Pain & Impact | 40% | Vague user, invented problem, benefit asserted not shown |
| Build & Live Demo | 30% | Slides or mock-ups; only works in theory |
| AI Value & Integration | 30% | A chatbot bolted onto an ordinary app |

The final adds **Adoption & Feasibility (15%)**: first users or pilot, costs, next steps.

Implications for the build:
- One core workflow must work **live**. Pre-load the data; show one extraction live as the "wow" moment.
- AI must do real work: extracting structured events from messy pages and flyers, deduplicating, tagging, ranking, and explaining each pick.

## 4. Architecture: modular, joined at the database

The **database is the seam**. This side writes to it; the Lovable app only reads from it. Neither side touches the other's code.

| Module | Owner | Reads | Writes |
|---|---|---|---|
| `ingestion/` (fetch, extract, dedupe, load) | Arthur + Claude | Source sites | `events`, `sources` tables |
| `ranking/` (taste + calendar → picks) | Arthur + Claude | `events`, a `TasteProfile` | A list of `Pick` |
| App (onboarding, feed, cards) | Partner, in Lovable | `events`, `Pick` | The user's `TasteProfile` |
| Voice agent (ElevenLabs) | Whoever is free after lunch | `events` via a search tool | Nothing |

**The contract** (three files next to this one, in `contract/`):
- `schema.sql`: Supabase tables `events` and `sources`, enums, indexes, read-only public access policies. Run once in the Supabase SQL editor behind the Lovable project.
- `event.ts`: TypeScript types `ArtEvent`, `TasteProfile`, `Pick`.
- `events.sample.json`: three real but deliberately sparse records, so the app handles missing fields.

**Rule:** change `schema.sql` and `event.ts` together, and only by agreement.

Key fields of an event: `title, event_type, description, artists[], art_forms[], tags[], start_date, end_date, start_time, end_time, venue_name, address, postcode, area, lat, lng, price_type, price_min_gbp, booking_required, booking_url, source_name, source_url, scraped_at, confidence, dedupe_key`.

`dedupe_key` = `lower(title) | lower(venue_name) | start_date`, set by ingestion. `(source_name, source_url)` and `dedupe_key` are both unique, so loads should upsert.

## 5. Suggested repo layout

```
contract/     schema.sql, event.ts, events.sample.json, HANDOVER.md
ingestion/    one adapter per source, plus extract, dedupe, load
ranking/      rank(profile, events) -> Pick[]
data/         seed dataset (JSON)
README.md     how the pieces fit, plus the sources list for the submission
```

Lovable can sync to GitHub, so the app code can sit in the same repo alongside these folders.

## 6. Ingestion design

1. **Source registry:** the `sources` table, one row per source with its fetch method.
2. **Fetch:** use an API where one exists; otherwise fetch the page.
3. **Extract:** an LLM maps each page (or a flyer image, via a vision model) to the event record. Firecrawl's JSON mode does this against a schema: about 5 credits a page, free plan 1,000 credits a month (so roughly 200 pages).
4. **Clean:** classify "is this an art event?" and "are these two listings the same event?" (TypeSafe, below), then merge.
5. **Load:** upsert into `events`.
6. **Schedule:** a daily Supabase cron job re-runs each source. This can wait until after the demo.

Each source is its own small adapter, so one broken source never blocks the others. MCP is not for the ingestion itself (that is plain scheduled code); it's useful at the edges, e.g. exposing the `events` table as a tool for the voice agent.

### Priority sources for today

Full registry (26 sources, with methods, fields and caveats): https://claude.ai/artifact/QnvSKifRWEmN3Sbgn4AsbQ

| Source | Why | How |
|---|---|---|
| ArtRabbit | Backbone. Open submission, so small spaces sit next to museums; ~400 current London events | Scrape `artrabbit.com/all-listings/united-kingdom/london` (paginated), then each event page. No public API found |
| GalleriesNow | Private views, talks, performances by day | Scrape `galleriesnow.net/exhibitions/london/` and its weekly "Week in Art" pages |
| IanVisits | Museums and heritage, with a free flag | Scrape `ianvisits.co.uk/calendar/date/YYYY/MM/DD/exhibitions/` per date |
| Eventbrite | Workshops, life drawing, classes | Public search API was shut in Dec 2019. Use SerpApi's Eventbrite engine or an Apify actor with slug `united-kingdom--london` |
| Studio providers (Bow Arts, SET, ACAVA, Acme, SPACE, Thames-Side, Lewisham Arthouse, Art Hub Studios) | The community long tail: open studios, free workshops | LLM extraction per what's-on page. On WordPress sites with The Events Calendar plugin, try `/wp-json/tribe/events/v1/events` and `?ical=1` first (untested on these sites) |

Checked and not worth it today: Ticketmaster (real free API, 5,000 calls/day, but mostly theatre and music), Skiddle (non-commercial only, nightlife), Luma (official API only lists your own calendars), Seb's Art List (newsletter only), Data Thistle (commercial licence, the "proper feed" option for later).

### Etiquette and legal

No reuse terms were found on these sites. For the demo: keep volumes low, always store and show `source_url`, write descriptions in our own words, and credit every source in the submission. Do not scrape Instagram; use flyer upload for the "paste a flyer" demo instead.

## 7. Personalisation design

- **Onboarding:** pick 6–8 events or images you like, plus one sentence ("experimental print, hate crowds").
- **Calendar:** upload an `.ics` file or tick free evenings. Skip Google OAuth today; it costs an hour.
- **Ranking:** `rank(profile: TasteProfile, events: ArtEvent[]) -> Pick[]`, exposed to the app as one Supabase edge function. Filter by date fit and price first, then score taste fit, then an LLM writes a one-line `reason` per pick.
- **Output:** a "Your art week" feed of about 5 picks.

## 8. Sponsor tools and where each fits

| Step | Tool |
|---|---|
| Messy page or flyer → structured event | LLM (Firecrawl JSON mode or direct call) |
| Is it art? Is it a duplicate? Did extraction get the date right? | **TypeSafe** (Jev model: typed answers with calibrated probabilities, no prose; $10 credit each) |
| Taste conversation and spoken picks | **ElevenLabs Agents** (voice agent with a knowledge base or a tool call into `events`) |
| Rank events for a user | TypeSafe scores (shown as "92% match") |
| One-line reason per pick | LLM |
| App and database | **Lovable** + its Supabase backend |

- **TypeSafe:** an upgrade, not a dependency. Get the pipeline working end to end with an LLM first, then swap in TypeSafe for dedupe and match scoring if on track by lunch. Docs at typesafe.ai; the model launched Sept 2026, so check the current request format.
- **ElevenLabs:** the "Best with ElevenLabs" award is open to all teams, no Top 8 place needed. Build after lunch, knowledge-base version first. Keep a typed fallback and a recorded backup; the room will be loud. If short on time, fall back to a 20-minute spoken weekly briefing using text-to-speech.

## 9. Status at handover (10:05)

Done:
- Rules reviewed, idea and scope agreed, scoring strategy set.
- Source research done; registry sheet published (link above).
- Contract written: `schema.sql`, `event.ts`, `events.sample.json`.

Not done / blocked:
- **GitHub repo not created yet.** Plan: create private repo `london-art-events` under `abphughes`, add the partner as a collaborator, and link GitHub to Claude so code can be pushed. The cloud session had no GitHub account linked.
- No events scraped yet. No ingestion or ranking code written yet.
- Track registration on Commfy (due 21:00 Friday): confirm it was done. Track B (Creativity & Commerce) fits best if we lean on helping small artists reach audiences; Track C (Social & Community) if the angle is community.

## 10. Next steps, in order

1. Create the repo and commit `contract/` and this file. Partner runs `schema.sql` in Supabase and builds the feed against `events.sample.json`.
2. Build a seed dataset of 60–100 real London art events for the next two weeks (mostly small and free, some big names) from the five priority sources. Load into `events`.
3. Build `ingestion/` adapters for ArtRabbit and one studio site, plus the generic "URL or flyer → event card" extractor (this is the live demo moment).
4. Build `ranking/` as an edge function.
5. After lunch: ElevenLabs agent, TypeSafe swap-in if time allows.
6. 14:45 onward: rehearse the 2-minute demo, record a backup screen capture, write the Commfy submission.

### Demo flow (2 minutes)

Problem with one stat from interviews (15s) → paste a messy gallery flyer, watch it become a clean event card (30s) → pick tastes and add a calendar, feed appears with reasons (45s) → why it's different, plus first users: LBS students, then artist communities (30s).

### Submission fields (Commfy, by 15:30)

Team name; track; team members and responsibilities; project name and one-line pitch; problem and target users; how it works and the AI's role; tools and tech used (list all reused libraries and data sources); value and what makes it different; demo or prototype link.

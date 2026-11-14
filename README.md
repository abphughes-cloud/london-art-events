# London art events: data side

The ingestion and ranking half of the LBS AI Cup 2026 project. The Lovable app reads what this writes.
The database is the seam: see `contract/` (`schema.sql`, `event.ts`, `events.sample.json`) and `contract/HANDOVER.md`.

## Set up

Needs Node 20.12+ (built on 24).

```
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

## Commands

| Command | What it does |
|---|---|
| `npm run seed` | Scrape ArtRabbit, GalleriesNow, IanVisits and SPACE (no key needed), dedupe, keep the next 14 days, tag. Adds Claude sources and tagging if a key is set. Writes `data/events.json` + `data/seed.sql` |
| `npm run seed -- --no-ai` | Same, without Claude (ArtRabbit + keyword tags only) |
| `npm run extract -- <url \| flyer.jpg \| --text "…">` | **The live demo.** Messy page, flyer image/PDF or pasted text → clean event cards. Add `--load` to push them to Supabase |
| `npm run load` | Upsert `data/events.json` into Supabase (service role key) |
| `npm run rank` | Show the top 5 picks for a sample profile (`-- --ai` for Claude-written reasons) |
| `npm test` | Unit tests |
| `npm run sync:edge` | Copy `ranking/rank.js` into the edge function before deploying it |

**No service key?** Paste `data/seed.sql` into the Supabase SQL editor (after `contract/schema.sql`). It upserts by `dedupe_key`, so it's safe to re-run.

## How it fits

```
ingestion/adapters/artrabbit.js   listing cards → records (plain parsing, no AI)
ingestion/extract.js              Claude: any page / flyer / text → records (structured output on the contract's fields)
                                  + enrichEvents(): art forms, tags, one-line description for scraped records
ingestion/keyword-tags.js         backup tagger when Claude isn't available
ingestion/normalize.js            checks every record against the contract, sets dedupe_key
ingestion/dedupe.js               exact key, then fuzzy (same venue + overlapping dates + similar title)
ingestion/run.js / load.js        build the seed / upsert to Supabase
ranking/rank.js                   rank(profile, events) → Pick[]: slot + price + avoid filters, taste score, variety,
                                  template reason; explainPicks() swaps in Claude-written reasons
supabase/functions/rank/          the same ranking as an edge function: POST { profile } → { picks, events }
```

Each exhibition with an opening on ArtRabbit also produces a separate `private_view` event (free, with time).

### Calling the ranking from the app

```ts
const { data } = await supabase.functions.invoke("rank", { body: { profile, limit: 5 } });
// data.picks: Pick[] (event_id, score 0..1, reason); data.events: the matching ArtEvent rows
```

Deploy: `npm run sync:edge`, then `supabase functions deploy rank --no-verify-jwt`; optional `supabase secrets set ANTHROPIC_API_KEY=…`.

## Sources (list these in the submission)

All four run as plain parsers, no API key needed. Last run (14 Nov): 319 events for 14–28 Nov after merging 177 duplicates.

| Source | Method | Events kept |
|---|---|---|
| ArtRabbit, London listings | Listing cards, 6 pages, ~1 request/second. Event detail pages return 403 to scripts, so we don't fetch them | 124 |
| GalleriesNow, London exhibitions | One page, ~150 cards: dates, gallery, address + postcode, opening hours, short quote | 124 |
| IanVisits, exhibitions by date | Date pages every 4 days across the window; keyword filter drops non-art shows | 67 |
| SPACE Studios, what's on | Studio events: open studios, free workshops, pop-ups | 4 |
| Bow Arts, ACAVA | — | 403 to scripts; skipped |
| Lewisham Arthouse, Acme, Thames-Side | — | What's-on URLs return 404; need the right page |

Extra pages can go in `data/sources.json` (`[{ "name", "url" }]`); those are read by Claude when a key is set.
Without a key, art forms and tags come from keywords (`ingestion/keyword-tags.js`): about 120 of 319 events get an art form.

Every record keeps `source_url`; descriptions are written by Claude in its own words.

## Reused libraries

`@anthropic-ai/sdk`, `zod` (ingestion); `@supabase/supabase-js` (edge function). Model: Claude Opus 5.5 (`claude-opus-5-5`) with server-side refusal fallbacks on.
All code here was written on 14 Nov 2026, after the tracks were released.

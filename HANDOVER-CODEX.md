# Handover: London art events, data side (for Codex)

Written 14 Nov 2026, ~10:40 GMT. Read this, then `README.md`, then `contract/HANDOVER.md` (the original plan and judging rules).

## The situation in one paragraph

LBS AI Cup 2026 hackathon, **submit on Commfy by 15:30 GMT today**. Two-person team: Arthur (me) builds the data side in this folder; my partner builds the app in Lovable. The product aggregates London art events (big and small, free and paid) into one database, then personalises a "Your art week" feed by taste and free time. Only code written after Fri 13 Nov 19:00 counts (all code here was written 14 Nov), and every reused library and data source must be listed in the submission.

## Rules for you

- **Don't add an LLM API key or new LLM calls yet.** Everything currently runs without AI. The Claude code paths exist but are switched off while `ANTHROPIC_API_KEY` is empty in `.env`. I'll add the key later.
- **Never print, commit or paste secrets.** `.env` is git-ignored. The Supabase secret key goes only in `.env`.
- **The contract is the seam:** `contract/schema.sql` and `contract/event.ts` change only by agreement with my partner. The app reads; this side writes.
- Keep scraping volumes low (≈1 request/second), keep `source_url` on every record, and don't fetch pages that return 403 (ArtRabbit event detail pages, Bow Arts, ACAVA).
- Run `npm test` before committing. Commit messages end with a co-author line if your tooling adds one; the repo is local only (no GitHub remote yet).

## What exists and works

Node 24, ES modules, deps: `@anthropic-ai/sdk`, `zod` (only used by the AI paths). `npm install` done.

| Piece | File(s) | Status |
|---|---|---|
| ArtRabbit parser | `ingestion/adapters/artrabbit.js` | Working. 6 listing pages ≈ 124 events. Each exhibition opening today/tomorrow also becomes a separate free `private_view` event |
| GalleriesNow parser | `ingestion/adapters/galleriesnow.js` | Working. One page, ~150 cards, address + postcode + area + opening hours |
| IanVisits parser | `ingestion/adapters/ianvisits.js` | Working. Date pages every 4 days; keyword filter drops non-art shows. Start date = first day seen open (site only gives end dates) |
| SPACE Studios parser | `ingestion/adapters/space.js` | Working, but only ~4 events in the window |
| Shared parsing helpers | `ingestion/html.js` | Free-text dates/times/prices ("6 - 15 NOV 2026, 12 - 6PM"), art keyword filter |
| Normalise + dedupe | `ingestion/normalize.js`, `ingestion/dedupe.js` | Checks rows against the contract, sets `dedupe_key`; merges same URL, same venue + similar title, or near-identical titles |
| Keyword tagger | `ingestion/keyword-tags.js` | Art forms and tags from words (≈120 of 319 events get an art form) |
| Seed builder | `ingestion/run.js` (`npm run seed`) | Runs all four sources, keeps next 14 days → `data/events.json` + `data/seed.sql` |
| Loader | `ingestion/load.js` (`npm run load`) | Upserts `data/events.json` into Supabase by `dedupe_key`. Supports new `sb_secret_` keys |
| Ranking | `ranking/rank.js` (`npm run rank` demo) | `rank(profile, events) → Pick[]`: free-slot fit, price cap, avoid words ("hate crowds" → skips big-name venues), taste score, one per venue, template reason |
| Edge function | `supabase/functions/rank/` | Written, **not deployed**. `npm run sync:edge` copies `rank.js` in first |
| AI paths (off) | `ingestion/extract.js`, `ingestion/extract-cli.js`, `explainPicks()` in `rank.js` | Written, **never run** (no key). URL/flyer/text → event cards; tagging; Claude-written reasons |
| Tests | `test/core.test.js` | 11 passing |

Latest seed (built 14 Nov morning): **319 events for 14–28 Nov**, 177 duplicates merged, 186 free. By source: ArtRabbit 124, GalleriesNow 124, IanVisits 67, SPACE 4.

## Supabase

- Our own project, **not** Lovable's built-in database (we told Lovable not to create one).
- Project `london-art-events`, ref `kpgigxnvoxdeavywigyf`, London (eu-west-2), free plan. URL: `https://kpgigxnvoxdeavywigyf.supabase.co`
- Tables `events` and `sources` created from `contract/schema.sql` plus `supabase/grants.sql` (anon/authenticated read, service role writes). RLS on.
- Verified: the publishable key reads `events` (HTTP 200, empty).
- `.env` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` (publishable, safe to share with the app). **`SUPABASE_SERVICE_ROLE_KEY` is still empty**; I'll paste the `sb_secret_…` key from the dashboard (Settings → API Keys).
- **No events loaded yet.**
- Note: my free plan allows 2 active projects. I paused `supabase-alizarin-sail` to make room. Don't touch `gut health` (it's my live nutrition app).

## Next steps, in order

1. **Load the data.** Once the secret key is in `.env`: `npm run load`, then check the count with the publishable key:
   `GET {SUPABASE_URL}/rest/v1/events?select=id` with header `apikey: <publishable key>` and `Prefer: count=exact` → expect 319.
2. **Give the app what it needs.** My partner needs the URL and publishable key (not the secret key) and the column list in `contract/event.ts`.
3. **Deploy ranking** so the app can call it: `npm run sync:edge`, then `supabase functions deploy rank --no-verify-jwt` (needs the Supabase CLI and login). The app calls `supabase.functions.invoke("rank", { body: { profile, limit: 5 } })` and gets `{ picks, events }`. Alternative if deploying is slow: the app ranks client-side by importing `ranking/rank.js` (no imports, runs in the browser).
4. **Improve tags without AI** if time allows: more keyword rules in `ingestion/keyword-tags.js` lift ranking quality. Rebuild with `npm run seed`, then `npm run load`.
5. **GitHub:** create private repo `london-art-events` under `abphughes`, add my partner, push. I'll do the account steps.
6. **Later, when I add the Anthropic key** (not before): the flyer → event card live demo (`npm run extract -- flyer.jpg`), Claude tagging on `npm run seed`, and `npm run rank -- --ai`. Model is `claude-opus-5-5`; the code uses structured outputs via `client.beta.messages.parse` with server-side refusal fallbacks.
7. 14:45 onward: rehearse the 2-minute demo, record a backup screen capture, write the Commfy submission (fields listed in `contract/HANDOVER.md`).

## Known gaps

- Only ≈120 of 319 events have an art form, so taste matching is thin until AI tagging is on.
- IanVisits start dates are approximate (first day seen open).
- Two near-duplicates remain (Serpentine North and Almas Art Foundation shows listed on both GalleriesNow/ArtRabbit and IanVisits without a venue).
- Skipped sources: Bow Arts and ACAVA (403 to scripts); Lewisham Arthouse, Acme, Thames-Side (what's-on URLs 404). Eventbrite needs a paid scraping service.
- `data/sources.json` is empty: it's for extra pages to be read by Claude once a key exists.

## Sources and libraries to list in the submission

Sources: ArtRabbit, GalleriesNow, IanVisits, SPACE Studios (each record links back via `source_url`).
Libraries: `@anthropic-ai/sdk`, `zod`, `@supabase/supabase-js` (edge function). Supabase for the database.

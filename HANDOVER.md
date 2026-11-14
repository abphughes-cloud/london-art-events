# Handover for a new chat: London art events, data side

Paste this into a new chat (Claude Code or Codex) opened **in this folder**:
`C:\Users\artyh\OneDrive\Documents\Special projects\Breadcrumb`

Last updated 14 Nov 2026 by Claude. Fuller detail: `HANDOVER-CODEX.md` (rules, file map), `README.md` (commands), `contract/HANDOVER.md` (original plan and judging).

## Situation

LBS AI Cup 2026 hackathon, **submit on Commfy by 15:30 GMT, 14 Nov**. Arthur builds the data side here; partner builds the app in Lovable. Product: aggregate London art events (big and small, especially the long tail: private views, open studios, free workshops, community events), then personalise a "Your art week" feed. Only code written after Fri 13 Nov 19:00 counts; list every source and library in the submission.

## Arthur's current job

**Massively expand the sources, especially the long tail.** Personalisation comes after.

## Rules

- No LLM API key or LLM calls yet (`ANTHROPIC_API_KEY` stays empty). All ingestion is plain parsing.
- Never print or commit secrets. `.env` holds `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable, shareable) and `SUPABASE_SERVICE_ROLE_KEY` (secret; never share).
- Don't change `contract/schema.sql` or `contract/event.ts` without asking.
- ~1 request/second, don't bypass 403s/logins/robots.txt, no Instagram, keep `source_url` on every record.
- `npm test` before committing. Repo is local git only (no GitHub remote yet).

## State

- Supabase project `london-art-events` (ref `kpgigxnvoxdeavywigyf`, London). Tables `events`, `sources`. **319 events loaded and verified** with the publishable key; public key can't write.
- Sources running (plain parsers in `ingestion/adapters/`): ArtRabbit 124, GalleriesNow 124, IanVisits 67, SPACE Studios 4 (after dedupe, window 14–28 Nov). 177 duplicates merged.
- `data/source-research.md`: 55 candidate sources checked by Codex, with a top 10 (Arts Calendar, On View, We Are Lewisham, Cockpit Studios, Pigment Press, UAL Shows, Whitechapel, Lewisham Libraries, South London Gallery, Thames-Side).
- Ranking (`ranking/rank.js`) works locally; edge function written, not deployed. Personalisation design not started.

## Commands

`npm run seed` (all sources → `data/events.json`, `data/seed.sql`) · `npm run load` (upsert to Supabase) · `npm test` · `npm run rank` (demo picks)

## Next

See the "Progress" section at the bottom (kept up to date as sources are added).

## Progress

- (in progress) Generic readers + source expansion.

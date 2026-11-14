# For the front end

This repo holds the data side (scrapers, Supabase schema, ranking). **Put the website in the `web/` folder** (replace the placeholder README if you like). Vercel project `london-art-events` (live at https://london-art-events.vercel.app) deploys from `web/`, so every push to `main` goes live automatically, and every other branch gets its own preview link.

## Supabase

- URL: `https://kpgigxnvoxdeavywigyf.supabase.co`
- Use the **publishable key** only (ask Arthur, or Supabase dashboard → Project Settings → API Keys). Never use the `sb_secret_…` key in the website: anything in the front end can be read by visitors.
- Keys go in Vercel's Environment Variables (and a git-ignored `web/.env.local` for local work), never in committed code. Tell Arthur the variable names your code expects so he can add them in Vercel.
- The site can **read** `events`, `artworks` and `sources`. It cannot write to them with the publishable key. If the app needs to save things (likes, profiles), ask Arthur for a new table with its own write rule.

## The data

- `events` columns: see `contract/event.ts`. About 600 London art events, 14 Nov to 31 Dec 2026; every row has venue, postcode, area, lat/lng and a `source_url`. Filter by date for "this week".
- `artworks`: 147 open-access artworks for swiping.
- Both tables share taste tags inside `tags`, e.g. `medium:painting`, `style:figurative`, `subject:portrait and body`, `mood:calm`, `period:contemporary`. Events also have `format:` (look / make / listen / meet) and `scale:` (grassroots / independent / institution). Allowed values: `data/taxonomy.json`.
- Useful tags: `read from venue page` (grassroots venues), `emerging artists` / `student show`.
- `ranking/rank.js` ranks events for a taste profile and runs in the browser (no imports). It does not use the taste tags yet.

## Working together

- Work on a branch, open a pull request, merge to `main` to go live.
- Don't rename or delete Supabase columns without agreeing it: the data pipeline writes to them.
- Scraped events are replaced when Arthur reloads the data, so don't hand-edit them in Supabase; add new rows instead and tell Arthur.

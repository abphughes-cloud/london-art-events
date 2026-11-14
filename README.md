# Mooncalf web app

Next.js app that Vercel deploys from this `web/` folder.

- `npm install && npm run dev` to run locally.
- Artworks are read from Supabase `artworks` when the publishable key is set (see `lib/data.js` for the env var names it looks for); otherwise the bundled copy in `data/artworks.json` (147 rows, plus a precomputed accent colour per painting) is used, so the demo always works.
- Podcast audio comes from `artwork_podcasts.audio_url` when available.
- Ratings are kept in the browser (localStorage) because the site cannot write to Supabase.

Screens built: 1.r rating (`app/RatingSweep.jsx` holds the rating mark on its own so it can be swapped), 2.e taste bands, the opened artwork, and the app-wide landscape pan (`app/ArtFrame.jsx`). Design notes: `mooncalf-behaviour-notes.md` in the project files.

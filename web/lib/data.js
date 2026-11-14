import bundled from '../data/artworks.json';

// Supabase is read with plain REST calls (no client library needed).
// The teammate set the variables in Vercel; we accept the usual names.
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
  'https://kpgigxnvoxdeavywigyf.supabase.co';
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  '';

const colours = Object.fromEntries(bundled.map((a) => [a.id, a]));

async function rest(path) {
  if (!KEY) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function firstSentences(s, n = 3) {
  if (!s) return '';
  return s.split(/(?<=[.!?])\s+/).slice(0, n).join(' ');
}

// Never shown again (keerthi 14 Nov): Niagara.
const BANNED = new Set(['nga-166436']);
export async function loadArtworks() {
  return (await loadArtworksRaw()).filter((a) => !BANNED.has(a.id));
}
async function loadArtworksRaw() {
  const rows = await rest(
    'artworks?select=id,title,artist,year,image_url,thumb_url,image_width,image_height,tags,story'
  );
  if (!rows || !rows.length) return bundled;
  return rows
    .filter((r) => r.image_url)
    .map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      year: r.year,
      img: r.image_url,
      thumb: r.thumb_url || r.image_url,
      w: r.image_width || colours[r.id]?.w || 1,
      h: r.image_height || colours[r.id]?.h || 1,
      tags: r.tags || [],
      story: firstSentences(r.story) || colours[r.id]?.story || '',
      accent: colours[r.id]?.accent || '#e0a35a',
      bg: colours[r.id]?.bg || '#141110',
      pod: !!colours[r.id]?.pod,
    }));
}

// Podcast MP3s live in the public Supabase Storage bucket `podcasts`,
// one file per artwork named <artwork id>.mp3. A table audio_url wins if readable.
const STORAGE = 'https://kpgigxnvoxdeavywigyf.supabase.co/storage/v1/object/public/podcasts/';
export const PODCAST_IDS = [
  'nga-46', 'nga-43626', 'nga-56101', 'nga-1138',
  'nga-121096', 'nga-231465', 'nga-50215', 'nga-51140', 'nga-61253',
];

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

// { artwork_id: audio_url } for stories that have audio. Fails silently.
export async function loadPodcasts(extraIds = []) {
  const out = {};
  const ids = [...new Set([...PODCAST_IDS, ...extraIds])];
  await Promise.all(
    ids.map(async (id) => {
      const url = STORAGE + encodeURIComponent(id) + '.mp3';
      if (await exists(url)) out[id] = url;
    })
  );
  const rows = await rest('artwork_podcasts?select=artwork_id,audio_url&audio_url=not.is.null');
  (rows || []).forEach((r) => {
    if (r.audio_url) out[r.artwork_id] = r.audio_url;
  });
  return out;
}

export function tagsOf(a) {
  return (a.tags || []).map((t) => String(t).replace(/^[a-z]+:/, ''));
}

export function moreLikeThis(a, all, n = 3) {
  const mine = new Set(tagsOf(a));
  return all
    .filter((b) => b.id !== a.id)
    .map((b) => ({ b, s: tagsOf(b).filter((t) => mine.has(t)).length + (b.artist === a.artist ? 2 : 0) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, n)
    .map((x) => x.b);
}

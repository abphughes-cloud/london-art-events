import { minutesTo } from './origin';
import events from '../data/events.json';

// The bundled artworks carry plain mood words; map them onto the shared
// taxonomy (medium:, style:, subject:, mood:) that events use, so a rating
// can be matched to what's on in London. Prefixed tags pass straight through.
const MAP = {
  intimate: ['mood:intimate', 'subject:portrait and body'],
  luminous: ['subject:landscape and nature', 'mood:calm'],
  earthy: ['subject:everyday life', 'style:figurative'],
  dramatic: ['mood:spectacular', 'mood:dark'],
  playful: ['mood:playful', 'style:pop and graphic'],
  calm: ['mood:calm'],
  serene: ['mood:calm', 'subject:landscape and nature'],
  spiritual: ['subject:myth and spirituality'],
  vibrant: ['subject:pure form and colour', 'style:expressive'],
  intricate: ['style:decorative and pattern'],
  eerie: ['style:surreal', 'mood:dark'],
  minimal: ['style:minimal', 'style:abstract'],
  monumental: ['mood:spectacular', 'subject:city and architecture'],
  romantic: ['mood:intimate'],
  melancholy: ['mood:dark'],
};

export function taxTags(a) {
  const out = new Set(['medium:painting']);
  (a.tags || []).forEach((t) => {
    if (String(t).includes(':')) out.add(t);
    else (MAP[t] || []).forEach((x) => out.add(x));
  });
  return [...out];
}

// weights per tag from ratings 0..1 (0.5 is neutral)
export function tasteWeights(all, ratings) {
  const w = {};
  all.forEach((a) => {
    const r = ratings[a.id];
    if (r == null) return;
    taxTags(a).forEach((t) => { w[t] = (w[t] || 0) + (r - 0.5) * 2; });
  });
  return w;
}

const CENTRE = { lat: 51.5036, lng: -0.1143 }; // Waterloo, until location is known
export function walkMin(lat, lng) {
  return minutesTo(lat, lng); // same origin and formula everywhere (lib/origin.js)
}

// London art events ranked by how well what's on matches your taste.
export function londonPicks(all, ratings, n = 12) {
  const w = tasteWeights(all, ratings);
  const rated = Math.max(1, Object.keys(ratings).length);
  const top = all.filter((a) => ratings[a.id] != null).sort((x, y) => ratings[y.id] - ratings[x.id]);
  const byVenue = {};
  events.forEach((e) => {
    const ts = e.tags.filter((t) => /^(medium|style|subject|mood):/.test(t));
    let s = 0;
    // concentration of overlap: how much of this show's tags you rated up
    ts.forEach((t) => { if (t !== 'medium:painting') s += (w[t] || 0) / rated; });
    s = ts.length ? s / Math.sqrt(ts.length) : 0;
    if (e.img) s += 0.01;
    const cur = byVenue[e.v];
    if (!cur || s > cur.score) byVenue[e.v] = { ...e, score: s };
  });
  const list = Object.values(byVenue).sort((a, b) => (b.score - a.score) || ((walkMin(a.lat, a.lng) || 999) - (walkMin(b.lat, b.lng) || 999))).slice(0, n);
  const max = Math.max(...list.map((x) => x.score));
  const min = Math.min(...list.map((x) => x.score));
  return list.map((g, i) => {
    const fav = top.length ? top[i % top.length] : all[i];
    return {
      ...g,
      match: (g.score - min) / (max - min || 1),
      pct: Math.round(40 + 58 * (g.score - min) / (max - min || 1)),
      walk: walkMin(g.lat, g.lng),
      art: fav, // the painting you rated highest stands in when the venue has no picture
    };
  });
}

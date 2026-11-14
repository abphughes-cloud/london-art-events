'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import events from '../data/events.json';
import { tick } from '../lib/haptics';

// Nearby shows as bars under the map, nearest first; the bar at the top of the list opens as you scroll (keerthi 15:46).
const LONDON = { lat: 51.5074, lng: -0.1278 };
let asked = false;

const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const away = (d) => { const m = Math.round(d * 12); return m > 60 ? `${d.toFixed(1)} km` : `${Math.max(1, m)} min walk`; };
const runs = (e) => {
  const f = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (e.s && e.e) return `${f(e.s)} – ${f(e.e)}`;
  if (e.e) return `Until ${f(e.e)}`;
  return '';
};

export default function NearList({ w, rated, onPlan, onFocus }) {
  const [me, setMe] = useState(LONDON);
  const [top, setTop] = useState(0);
  const [moved, setMoved] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (asked || typeof navigator === 'undefined' || !navigator.geolocation) return;
    asked = true;
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 4000, maximumAge: 600000 },
    );
  }, []);

  const list = useMemo(() => {
    const score = (e) => (e.tags || []).reduce((a, t) => a + Math.max(0, (w && w[t]) || 0), 0);
    const by = new Map();
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const cur = by.get(e.v);
      const better = !cur || (rated ? score(e) > score(cur) : (!cur.img && e.img));
      if (better) by.set(e.v, e);
    }
    return [...by.values()]
      .map((e) => ({ e, d: km(me, { lat: e.lat, lng: e.lng }), pct: rated ? Math.min(99, Math.round((score(e) / 4) * 100)) : null }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 15);
  }, [me, w, rated]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (el.scrollTop > 40) setMoved(true);
        const t = el.getBoundingClientRect().top;
        let best = 0, bd = Infinity;
        [...el.children].forEach((c, i) => {
          if (!c.classList.contains('nb')) return;
          const d = Math.abs(c.getBoundingClientRect().top - t);
          if (d < bd) { bd = d; best = i; }
        });
        setTop((p) => { if (p !== best) tick(4); return best; });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [list.length]);

  useEffect(() => { if (list[top] && onFocus) onFocus(list[top].e.v); }, [top, list]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (i) => {
    setTop(i);
    const el = box.current, c = el && el.children[i];
    if (c) el.scrollTo({ top: c.offsetTop - el.offsetTop - 0, behavior: 'smooth' });
  };

  return (
    <>
      <div ref={box} className="lbands near">
        {list.map(({ e, d, pct }, i) => (
          <div key={e.v} className={`nb ${i === top ? 'big' : ''}`} onClick={() => open(i)}>
            <div className="nb-img" style={e.img ? { backgroundImage: `url("${e.img}")` } : undefined} />
            <div className="nb-shade" />
            <div className="nb-text">
              <b>{e.t}</b>
              <span><u className="nb-venue" onClick={(ev) => { if (i !== top) return; ev.stopPropagation(); window.dispatchEvent(new CustomEvent('mooncalf-open-gallery', { detail: e.v })); }}>{e.v}</u> · {away(d)}{pct != null ? ` · ${pct}% match` : ''}</span>
              {i === top && runs(e) && <span className="nb-dates">{runs(e)}</span>}
            </div>
            {i === top && (
              <div className="nb-btns">
                <a className="nb-plan" href={e.url || `https://www.google.com/search?q=${encodeURIComponent(`${e.v} London`)}`} target="_blank" rel="noopener noreferrer"
                  onClick={(ev) => { ev.stopPropagation(); onPlan({ id: e.v, v: e.v, t: e.t, img: e.img, lat: e.lat, lng: e.lng, url: e.url, walk: Math.round(d * 12) }); }}>Plan visit</a>
                <a className="nb-dir" href={`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>Directions</a>
              </div>
            )}
          </div>
        ))}
        <div className="nb-pad" />
      </div>
      <div className={`nb-cue ${moved ? 'gone' : ''}`}><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" /></svg>Scroll</div>
    </>
  );
}

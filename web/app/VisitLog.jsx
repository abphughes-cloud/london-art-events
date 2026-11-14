'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import events from '../data/events.json';
import { tick } from '../lib/haptics';
import { readStars } from '../lib/stars';

// Visit log (keerthi 14:59): find an event, slide to say how much you liked it.
// The bar turns gold the more you liked it. Each review is about half a screen.
const KEY = 'mooncalf.log.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
// a short written note per visit, kept apart from the slider values (keerthi 15:43)
const NKEY = 'mooncalf.notes.v1';
const readN = () => { try { return JSON.parse(localStorage.getItem(NKEY) || '{}') || {}; } catch { return {}; } };

function Slide({ v, onChange }) {
  const set = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  return (
    <div className="vl-slide" role="slider" aria-label="How much you liked it" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((v || 0) * 100)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') set(e); }}
      onPointerUp={() => tick(8)}>
      <i style={{ width: `${(v || 0) * 100}%`, background: '#ffd84d', opacity: 0.95, boxShadow: v > 0.6 ? `0 0 ${Math.round(18 * v)}px rgba(255,216,77,${v * 0.7})` : 'none' }} />
    </div>
  );
}

export default function VisitLog({ visits = [], all = [], ratings = {} }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('visits'); // Visits | Art (keerthi 15:54)
  const [log, setLog] = useState({});
  const [notes, setNotes] = useState({});
  const [stars, setStars] = useState([]);
  const [ready, setReady] = useState(false); // never save the empty start state over saved data
  const noteRef = useRef(notes);
  noteRef.current = notes;
  useEffect(() => { setLog(read()); setNotes(readN()); setStars(readStars()); setReady(true); }, []);
  useEffect(() => { const f = () => setStars(readStars()); window.addEventListener('mooncalf-stars', f); return () => window.removeEventListener('mooncalf-stars', f); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(log)); } catch {} }, [log, ready]);
  useEffect(() => { if (ready) try { localStorage.setItem(NKEY, JSON.stringify(notes)); } catch {} }, [notes, ready]);

  const mine = (e) => stars.includes(e.id) || log[e.id] != null || (noteRef.current[e.id] || '').trim();
  const list = useMemo(() => {
    const planned = new Set(visits.map((x) => x.v));
    const s = q.trim().toLowerCase();
    const hit = (e) => !s || `${e.t} ${e.v}`.toLowerCase().includes(s);
    const rank = (e) => (stars.includes(e.id) ? 0 : log[e.id] != null || (noteRef.current[e.id] || '').trim() ? 1 : planned.has(e.v) ? 2 : e.img ? 3 : 4);
    let pool = events.filter(hit);
    if (!s && pool.some(mine)) pool = pool.filter(mine); // starred, rated or noted shows only, starred first
    return pool.sort((a, b) => rank(a) - rank(b)).slice(0, 40);
  }, [q, visits, log, ready, stars]); // notes stay out of the deps so a card never jumps while typing
  const empty = !q.trim() && !events.some(mine); // notes stay out of the deps so a card never jumps while typing

  return (
    <section className="screen vlog">
      <div className="vl-modes">
        <button className={mode === 'visits' ? 'on' : ''} onClick={() => { setMode('visits'); tick(6); }}>Visits</button>
        <button className={mode === 'art' ? 'on' : ''} onClick={() => { setMode('art'); tick(6); }}>Art</button>
      </div>
      {mode === 'art' && <ArtGrid all={all} ratings={ratings} />}
      {mode === 'visits' && <>
      <input className="vl-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an event" aria-label="Find an event" />
      <div className="vl-list">
        {empty && <p className="vl-hint">Star a show on the map and it appears here.</p>}
        {list.map((e) => (
          <article key={e.id} className={`vl-card ${e.img ? '' : 'noimg'}`}>
            <div className="vl-img" style={e.img ? { backgroundImage: `url("${e.img}")` } : undefined} />
            <div className="vl-shade" />
            {stars.includes(e.id) && <svg className="vl-star" viewBox="0 0 24 24" aria-label="Starred"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>}
            <div className="vl-info">
              <h3>{e.t}</h3>
              <span>{e.v}</span>
              <Slide v={log[e.id]} onChange={(v) => setLog((x) => ({ ...x, [e.id]: v }))} />
              <textarea className="vl-note" rows={2} maxLength={280} placeholder="Write about your visit" aria-label="Write about your visit"
                value={notes[e.id] || ''} onChange={(ev) => setNotes((x) => ({ ...x, [e.id]: ev.target.value }))} />
            </div>
          </article>
        ))}
        {!list.length && <p className="vl-none">Nothing found</p>}
      </div>
      </>}
    </section>
  );
}

// Art: everything rated near the top in Discover (same 0.85 line as the hearts), newest first
function ArtGrid({ all, ratings }) {
  const byId = new Map((all || []).map((a) => [String(a.id), a]));
  const loved = Object.keys(ratings || {}).filter((id) => ratings[id] >= 0.85).reverse().map((id) => byId.get(String(id))).filter(Boolean);
  if (!loved.length) return <p className="vl-hint vl-art-empty">Rate art near the top in Discover and it lands here.</p>;
  return (
    <div className="vl-art">
      {loved.map((a) => (
        <figure key={a.id} className="vl-tile">
          <div className="vl-tile-img" style={{ backgroundImage: `url("${a.thumb || a.img}")` }} />
          <figcaption><b>{a.title}</b><span>{a.artist}</span></figcaption>
        </figure>
      ))}
    </div>
  );
}

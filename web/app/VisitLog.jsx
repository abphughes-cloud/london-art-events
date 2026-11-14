'use client';
import { useEffect, useMemo, useState } from 'react';
import events from '../data/events.json';
import { tick } from '../lib/haptics';

// Visit log (keerthi 14:59): find an event, slide to say how much you liked it.
// The bar turns gold the more you liked it. Each review is about half a screen.
const KEY = 'mooncalf.log.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };

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
      <i style={{ width: `${(v || 0) * 100}%`, background: `rgba(240,201,90,${0.25 + 0.75 * (v || 0)})`, boxShadow: v > 0.6 ? `0 0 ${Math.round(18 * v)}px rgba(240,201,90,${v * 0.7})` : 'none' }} />
    </div>
  );
}

export default function VisitLog({ visits = [] }) {
  const [q, setQ] = useState('');
  const [log, setLog] = useState({});
  useEffect(() => { setLog(read()); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch {} }, [log]);

  const list = useMemo(() => {
    const planned = new Set(visits.map((x) => x.v));
    const s = q.trim().toLowerCase();
    const hit = (e) => !s || `${e.t} ${e.v}`.toLowerCase().includes(s);
    const rank = (e) => (log[e.id] != null ? 0 : planned.has(e.v) ? 1 : e.img ? 2 : 3);
    return events.filter(hit).sort((a, b) => rank(a) - rank(b)).slice(0, 40);
  }, [q, visits, log]);

  return (
    <section className="screen vlog">
      <input className="vl-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an event" aria-label="Find an event" />
      <div className="vl-list">
        {list.map((e) => (
          <article key={e.id} className="vl-card">
            <div className="vl-img" style={e.img ? { backgroundImage: `url("${e.img}")` } : undefined} />
            <div className="vl-shade" />
            <div className="vl-info">
              <h3>{e.t}</h3>
              <span>{e.v}</span>
              <Slide v={log[e.id]} onChange={(v) => setLog((x) => ({ ...x, [e.id]: v }))} />
            </div>
          </article>
        ))}
        {!list.length && <p className="vl-none">Nothing found</p>}
      </div>
    </section>
  );
}

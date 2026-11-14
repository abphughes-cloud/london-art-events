'use client';
import { useMemo, useRef, useState } from 'react';
import { tick, pattern } from '../lib/haptics';
import { Back } from './Icons';

// Screen 4 (4.a time sweep): the gallery full-bleed, the week as thin standing
// bars (taller = quieter), drag sideways anywhere for the time, tick saves.
const SLOTS = 16; // half hours from 10:00 to 18:00
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const at = (s) => 600 + s * 30;
const DN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MODES = [
  ['walk', 'M13 3a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zM9 21l2.5-7L9 11l3-4 3 3 3 1M11.5 14l3 2v5', 1],
  ['tube', 'M6 3.5h12v13.5H6zM6 11h12M9 17l-2 3.5M15 17l2 3.5', 0.55],
  ['bike', 'M6 12.4a3.6 3.6 0 110 7.2 3.6 3.6 0 010-7.2zM18 12.4a3.6 3.6 0 110 7.2 3.6 3.6 0 010-7.2zM6 16l3.6-7.5h5.2L18 16M9.6 8.5L12.6 16', 0.45],
];

export default function Plan({ g, onClose, onSave }) {
  const days = useMemo(() => {
    const t = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
      const wd = d.getDay();
      const q = wd === 0 || wd === 6 ? 0.25 + 0.1 * (i % 2) : 0.6 + ((i * 37) % 30) / 100; // weekends busier
      return { date: d, label: DN[wd], n: d.getDate(), q };
    });
  }, []);
  const [d, setD] = useState(2);
  const [s, setS] = useState(2);
  const [m, setM] = useState(0);
  const [drag, setDrag] = useState(false);
  const [saved, setSaved] = useState(false);
  const gs = useRef(null);
  const v = s / SLOTS;
  const mins = Math.round(g.walk * MODES[m][2]);

  const down = (e) => { gs.current = { x: e.clientX, s0: s, moved: false }; };
  const move = (e) => {
    const st = gs.current; if (!st) return;
    const dx = e.clientX - st.x;
    if (!st.moved && Math.abs(dx) > 8) { st.moved = true; setDrag(true); }
    if (!st.moved) return;
    const n = Math.max(0, Math.min(SLOTS, Math.round(st.s0 + (dx / (0.8 * window.innerWidth)) * SLOTS)));
    if (n !== s) { setS(n); tick(n === SLOTS ? 28 : 7); }
  };
  const up = () => { if (gs.current?.moved) pattern([10, 30, 20]); gs.current = null; setDrag(false); };

  // the half-circle: same family as the rating mark
  const R = 100, f = 0.12 + 0.88 * v, a = Math.PI * (1 - f);
  const px = R + R * Math.cos(a), py = R - R * Math.sin(a);
  const accent = g.art?.accent || '#f4d35e';
  const save = () => {
    const day = days[d];
    onSave({ v: g.v, t: g.t, img: g.img, art: g.art?.id, thumb: g.art?.thumb, date: day.date.toISOString().slice(0, 10), day: `${day.label} ${day.n}`, time: clock(at(s)), leave: clock(at(s) - mins), mode: MODES[m][0], url: g.url });
    setSaved(true);
    pattern([10, 40, 10, 40, 30]);
  };

  return (
    <div className="plan" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="art-drift" style={{ backgroundImage: g.img ? `url("${g.img}"), url("${g.art?.thumb}")` : `url("${g.art?.thumb}")` }} />
      <div className="pdusk" style={{ opacity: Math.pow(Math.max(0, (v - 0.4) / 0.6), 1.5) * 0.62 }} />
      <div className="pscrim" />
      <h1 className="title ptitle">{g.v}</h1>
      <button className="back" aria-label="Back" onClick={onClose}><Back /></button>
      <button className="pok" aria-label="Save visit" onClick={save}>
        <svg viewBox="0 0 24 24" width="26" height="26" className="ico"><path d="M5 12.5l4.6 4.6L19 7" /></svg>
      </button>
      <div className="pmodes">
        {MODES.map(([k, path, f2], i) => (
          <button key={k} className={i === m ? 'on' : ''} aria-label={k} onClick={() => { setM(i); tick(8); }}>
            <svg viewBox="0 0 24 24" width="19" height="19" className="ico"><path d={path} /></svg>
            <span className="tiny">{Math.round(g.walk * f2)}</span>
          </button>
        ))}
      </div>
      <div className="pweek">
        {days.map((x, i) => (
          <button key={i} className={i === d ? 'on' : ''} onClick={() => { setD(i); tick(8); }}>
            <em className="tiny">{x.n}</em>
            <b style={{ height: 10 + x.q * 40, background: i === d ? accent : undefined }} />
            <span className="tiny">{x.label}</span>
          </button>
        ))}
      </div>
      <div className="ptime tiny" style={{ left: `calc(50% + ${(px - R) * 1.15}px)`, bottom: 64 + (R - py) * 1.15 }}>{clock(at(s))}</div>
      <div className={`psemi ${drag ? 'show' : ''}`}>
        <svg viewBox={`0 0 ${2 * R} ${R}`} width={2 * R} height={R}>
          {drag && <path d={`M 0 ${R} A ${R} ${R} 0 0 1 ${2 * R} ${R} Z`} fill="rgba(150,150,150,.38)" />}
          <path d={`M 0 ${R} A ${R} ${R} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)} Q ${px.toFixed(1)} ${R} ${(R + (px - R) * 0.15).toFixed(1)} ${R} Z`} fill={accent} />
        </svg>
      </div>
      {saved && (
        <div className="psaved" onClick={onClose}>
          <div className="art-drift" style={{ backgroundImage: `url("${g.art?.img || g.art?.thumb}")` }} />
          <div className="shade" />
          <h1 className="title">{g.v}</h1>
          <div className="pwhen tiny">{days[d].label} {days[d].n} · {clock(at(s) - mins)} – {clock(at(s))}</div>
        </div>
      )}
    </div>
  );
}

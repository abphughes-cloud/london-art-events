'use client';
import { useMemo, useRef, useState } from 'react';
import { tick, pattern } from '../lib/haptics';
import { Back } from './Icons';

// Screen 4 (4.b quiet-day bars): the week as strips of the gallery's art, longer =
// quieter. Tap a day to open it, slide along its hour lines for the time, tap again or tick to save.
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
  const gs = useRef(null);
  const mins = Math.round(g.walk * MODES[m][2]);
  const hourQ = (dq, k) => { const x = (k - 8.5) / 4.2; return Math.max(0.1, Math.min(1, (1 - 0.8 * Math.exp(-x * x)) * (0.45 + dq * 0.65))); }; // busiest early afternoon
  const hrsRef = useRef([]);
  const setTime = (e) => {
    const el = hrsRef.current[d]; if (!el) return;
    const b = el.getBoundingClientRect();
    const n = Math.max(0, Math.min(SLOTS, Math.round(((e.clientX - b.left) / b.width) * SLOTS)));
    if (n !== s) { setS(n); tick(n === SLOTS ? 28 : 7); }
  };
  const down = (e) => { gs.current = { x: e.clientX, y: e.clientY, mode: null, acc: 0, row: e.target.closest('.prow') }; };
  const move = (e) => {
    const st = gs.current; if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.mode && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) st.mode = st.row && +st.row.dataset.i === d && Math.abs(dx) > Math.abs(dy) ? 'time' : 'day';
    if (st.mode === 'time') setTime(e);
    else if (st.mode === 'day') {
      st.acc += -(e.clientY - st.y) * 1.2; st.y = e.clientY;
      if (Math.abs(st.acc) > 46) { const n = Math.max(0, Math.min(6, d + Math.sign(st.acc))); st.acc = 0; if (n !== d) { setD(n); tick(7); } }
    }
  };
  const up = (e) => {
    const st = gs.current; gs.current = null; if (!st) return;
    if (st.mode === 'time') { pattern([10, 30, 20]); return; }
    if (st.mode || !st.row) return;
    const i = +st.row.dataset.i;
    if (i !== d) { setD(i); tick(7); return; }
    const b = st.row.getBoundingClientRect();
    if (e.clientY > b.bottom - 84) setTime(e); else save(); // second tap opens it, as in 2.e
  };
  const wheel = (e) => { const n = Math.max(0, Math.min(6, d + Math.sign(e.deltaY))); if (n !== d) { setD(n); tick(7); } };

  const accent = g.art?.accent || '#f4d35e';
  const save = () => {
    const day = days[d];
    onSave({ v: g.v, t: g.t, img: g.img, art: g.art?.id, thumb: g.art?.thumb, date: day.date.toISOString().slice(0, 10), day: `${day.label} ${day.n}`, time: clock(at(s)), leave: clock(at(s) - mins), mode: MODES[m][0], url: g.url });
    setSaved(true);
    pattern([10, 40, 10, 40, 30]);
  };

  return (
    <div className="plan" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
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
      <div className="plist" onWheel={wheel}>
        {days.map((x, i) => (
          <div key={i} data-i={i} className={`prow ${i === d ? 'big' : ''}`} style={{ '--q': `${Math.round(x.q * 100)}%` }}>
            <div className="pband" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
              <div className="pbart" style={{ top: -40 - i * 56, backgroundImage: g.img ? `url("${g.img}"), url("${g.art?.thumb}")` : `url("${g.art?.thumb}")`, animationDelay: `-${i * 3}s` }} />
              <div className="phrs" ref={(el) => { hrsRef.current[i] = el; }}>
                {Array.from({ length: SLOTS + 1 }, (_, k) => <u key={k} className={i === d && k === s ? 'on' : ''} style={{ '--h': `${(6 + hourQ(x.q, k) * 36).toFixed(1)}px` }} />)}
              </div>
              <span className="ptl tiny" style={{ left: `calc(14px + ${(s / SLOTS) * 100}% - ${(s / SLOTS) * 28}px)` }}>{clock(at(s))}</span>
            </div>
            <span className="pdl tiny">{x.label}<i> {x.n}</i></span>
          </div>
        ))}
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

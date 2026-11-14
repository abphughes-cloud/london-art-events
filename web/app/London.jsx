'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { londonPicks } from '../lib/taste';
import { tick, pattern } from '../lib/haptics';
import { Back } from './Icons';
import Plan from './Plan';
import events from '../data/events.json';

// every venue with something free on, for the map across the top
const VENUES = (() => { const m = new Map(); events.forEach((e) => { if (e.lat && e.lng && !m.has(e.v)) m.set(e.v, [e.lat, e.lng]); }); return [...m.entries()]; })();

// Screen 3 (3.a): free London galleries ranked by how well what's on matches
// your taste. Bars first; the top-right icon folds them into lights on a map.
const LON0 = -0.1265, LAT0 = 51.505, SX = 2362, SY = SX / 0.6225;
let FIT = { lon0: LON0, lat0: LAT0, sx: SX, sy: SY };
const XY = (lat, lng) => [150 + (lng - FIT.lon0) * FIT.sx, 310 + (FIT.lat0 - lat) * FIT.sy];
// zoom the map so every pick sits on screen
function fitTo(picks) {
  if (!picks.length) return;
  const lats = picks.map((p) => p.lat), lngs = picks.map((p) => p.lng);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lngs), lo1 = Math.max(...lngs);
  const sx = Math.min(SX, 220 / Math.max(lo1 - lo0, 0.01), (480 / Math.max(la1 - la0, 0.005)) * 0.6225);
  FIT = { lon0: (lo0 + lo1) / 2, lat0: (la0 + la1) / 2, sx, sy: sx / 0.6225 };
}
const TH = [[51.4655,-0.2],[51.465,-0.188],[51.474,-0.179],[51.481,-0.1725],[51.4823,-0.1668],[51.4847,-0.1497],[51.4852,-0.142],[51.4875,-0.1265],[51.4945,-0.1235],[51.5008,-0.1218],[51.506,-0.12],[51.5086,-0.117],[51.5097,-0.1043],[51.5095,-0.0985],[51.5088,-0.094],[51.5079,-0.0877],[51.5055,-0.0754],[51.503,-0.064],[51.5035,-0.056],[51.5075,-0.037]];
function thames() {
  // drawn after fitTo
  const q = TH.map((p) => XY(p[0], p[1]));
  let d = `M${q[0][0].toFixed(1)} ${q[0][1].toFixed(1)}`;
  for (let i = 1; i < q.length - 1; i++) {
    const mx = (q[i][0] + q[i + 1][0]) / 2, my = (q[i][1] + q[i + 1][1]) / 2;
    d += ` Q${q[i][0].toFixed(1)} ${q[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const e = q[q.length - 1];
  return d + ` L${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
}

const Ico = ({ d, size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className="ico"><path d={d} /></svg>
);
const MAP_D = 'M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13';
const BARS_D = 'M4 6.5h16M4 12h16M4 17.5h16';
const WALK_D = 'M13 3a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zM9 21l2.5-7L9 11l3-4 3 3 3 1M11.5 14l3 2v5';
const CAL_D = 'M4.5 5.5h15v14h-15zM4.5 10h15M9 3.5v3.6M15 3.5v3.6';
const PIN_D = 'M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0113 0C18.5 15 12 21 12 21zM12 7.6a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z';
const HEART_D = 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.3a4.2 4.2 0 017.5 2.5C19.5 15.4 12 20 12 20z';

function bgOf(g) {
  return g.img ? `url("${g.img}"), url("${g.art?.thumb}")` : `url("${g.art?.thumb}")`;
}

export default function London({ all, ratings, saved, onSave, onPlan, onBack }) {
  const picks = useMemo(() => londonPicks(all, ratings), [all, ratings]);
  const RIVER = useMemo(() => { fitTo(picks); return thames(); }, [picks]);
  const [fi, setFi] = useState(0);
  const [view, setView] = useState('list');
  const [open, setOpen] = useState(null); // {g, rect}
  const [clip, setClip] = useState(null);
  const [plan, setPlan] = useState(null);
  const box = useRef(null);
  const acc = useRef({ y: null, sum: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const step = (dir) => setFi((f) => { const n = Math.max(0, Math.min(picks.length - 1, f + dir)); if (n !== f) tick(6); return n; });
    const feed = (d) => {
      acc.current.sum += d;
      while (Math.abs(acc.current.sum) >= 46) { step(Math.sign(acc.current.sum)); acc.current.sum -= Math.sign(acc.current.sum) * 46; }
    };
    const wheel = (e) => { e.preventDefault(); feed(e.deltaY); };
    const ts = (e) => { acc.current.y = e.touches[0].clientY; acc.current.sum = 0; };
    const tm = (e) => { if (acc.current.y == null) return; e.preventDefault(); const y = e.touches[0].clientY; feed(acc.current.y - y); acc.current.y = y; };
    const te = () => { acc.current.y = null; };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); };
  }, [picks.length, view]);

  const inset = (r) => `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round 6px)`;
  const pick = (i, el) => {
    if (i !== fi) { setFi(i); tick(6); return; }
    const r = el.getBoundingClientRect();
    setOpen({ g: picks[i], from: inset(r) });
    setClip(inset(r));
    tick(12);
    setTimeout(() => requestAnimationFrame(() => setClip('inset(0px 0px 0px 0px round 0px)')), view === 'list' ? 420 : 30);
  };
  const close = () => { setClip(open.from); tick(8); setTimeout(() => setOpen(null), 800); };

  // the map is a 300 x 620 stage scaled to cover the phone
  const [k, setK] = useState(1);
  useEffect(() => { const f = () => setK(Math.max(window.innerWidth / 300, window.innerHeight / 620)); f(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);

  if (!picks.length) return null;
  const g = picks[fi];
  return (
    <section className="screen london">
      <div className={`lmap ${view === 'map' ? 'on' : ''}`}>
        <div className="lstage" style={{ transform: `translate(-50%,-50%) scale(${k})` }}>
          <svg viewBox="0 0 300 620" width="300" height="620" className="lriver">
            <path d={RIVER} fill="none" stroke="#f0c95a" strokeWidth="3.4" strokeLinecap="round" opacity=".9" />
          </svg>
          {picks.map((p, i) => {
            const [x, y] = XY(p.lat, p.lng);
            const sz = 4 + p.match * 3;
            return (
              <button key={p.id} className={`llight ${i === fi ? 'on' : ''}`} style={{ left: x, top: y, width: sz, height: sz }}
                aria-label={p.v} onClick={(e) => pick(i, e.currentTarget)} />
            );
          })}
          {(() => { const [x, y] = XY(g.lat, g.lng); return (
            <div className="llabel" style={{ left: x + 12, top: y - 12 }}>
              <span>{g.v}</span><i style={{ backgroundImage: bgOf(g) }} />
            </div>); })()}
        </div>
        <div className="lvig" />
      </div>
      <TopMap picks={picks} fi={fi} onPick={(i, el) => pick(i, el)} />
      <div ref={box} className={`bands lbands ${view === 'map' ? 'folded' : ''} ${open ? 'fading' : ''}`}>
        {picks.map((p, i) => (
          <div key={p.id} className={`band ${i === fi ? 'focus' : ''} ${open && open.g.id !== p.id ? 'vanish' : ''}`}
            style={{ flex: i === fi ? 5 : 0.6, animationDelay: `${i * 70}ms` }} onClick={(e) => pick(i, e.currentTarget)}>
            <div className="band-img" style={{ backgroundImage: bgOf(p) }} />
            <span className="lmeta"><Ico d={WALK_D} size={13} />{p.walk} MIN</span>
            <span className="band-name">{p.v}</span>
          </div>
        ))}
      </div>
      <button className="ltog" aria-label="Bars or map" onClick={() => { setView(view === 'map' ? 'list' : 'map'); pattern([10]); }}>
        <Ico d={view === 'map' ? BARS_D : MAP_D} />
      </button>
      {open && (
        <div className="gdet" style={{ clipPath: clip }}>
          <div className="art-drift" style={{ backgroundImage: bgOf(open.g) }} />
          <div className="shade" />
          <div className="gtop">
            <button aria-label="Back" onClick={close}><Back /></button>
            <span style={{ flex: 1 }} />
            <button aria-label="Plan a visit" onClick={() => setPlan(open.g)}><Ico d={CAL_D} /></button>
            <a aria-label="Directions" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${open.g.lat},${open.g.lng}&travelmode=walking`}><Ico d={PIN_D} /></a>
            <button aria-label="Save" className={saved[open.g.v] ? 'gold' : ''} onClick={() => { onSave(open.g); pattern([8, 30, 14]); }}>
              <svg viewBox="0 0 24 24" width="22" height="22" className="ico"><path d={HEART_D} fill={saved[open.g.v] ? 'currentColor' : 'none'} /></svg>
            </button>
          </div>
          <div className="ginfo">
            <span className="lmeta static"><Ico d={WALK_D} size={13} />{open.g.walk} MIN</span>
            <h1 className="gname">{open.g.v}</h1>
            <a className="gshow" href={open.g.url} target="_blank" rel="noreferrer">{open.g.t}</a>
          </div>
        </div>
      )}
      {plan && <Plan g={plan} onClose={() => setPlan(null)} onSave={(v) => { onPlan(v); setPlan(null); }} />}
    </section>
  );
}

// Map across the top: black, the gold Thames, a light for every London spot;
// your taste-matched picks glow brighter and open on tap.
function TopMap({ picks, fi, onPick }) {
  const W = 360, H = 200;
  const pts = VENUES.map(([, ll]) => ll).concat(picks.map((p) => [p.lat, p.lng]));
  const la = pts.map((p) => p[0]).sort((a, b) => a - b), lo = pts.map((p) => p[1]).sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.floor((arr.length - 1) * f)];
  const la0 = q(la, 0.04), la1 = q(la, 0.96), lo0 = q(lo, 0.04), lo1 = q(lo, 0.96);
  const sx = Math.min((W - 30) / (lo1 - lo0), ((H - 30) / (la1 - la0)) * 0.6225), sy = sx / 0.6225;
  const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
  const P = (lat, lng) => [W / 2 + (lng - cx) * sx, H / 2 + (cy - lat) * sy];
  const tq = TH.map((p) => P(p[0], p[1]));
  let d = `M${tq[0][0].toFixed(1)} ${tq[0][1].toFixed(1)}`;
  for (let i = 1; i < tq.length - 1; i++) d += ` Q${tq[i][0].toFixed(1)} ${tq[i][1].toFixed(1)} ${((tq[i][0] + tq[i + 1][0]) / 2).toFixed(1)} ${((tq[i][1] + tq[i + 1][1]) / 2).toFixed(1)}`;
  return (
    <div className="ltop">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="ltop-svg">
        <path d={d} fill="none" stroke="#f0c95a" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
        {VENUES.map(([v, [lat, lng]]) => { const [x, y] = P(lat, lng); return <circle key={v} cx={x} cy={y} r="1.3" className="ltop-dot" style={{ animationDelay: `${(x * 37 + y * 11) % 3000}ms` }} />; })}
        {picks.map((p, i) => { const [x, y] = P(p.lat, p.lng); return (
          <g key={p.id} className={`ltop-pick ${i === fi ? 'on' : ''}`} onClick={(e) => onPick(i, e.currentTarget)}>
            <circle cx={x} cy={y} r="12" fill="transparent" />
            <circle cx={x} cy={y} r={i === fi ? 4.2 : 2.8} className="ltop-glow" />
          </g>); })}
      </svg>
    </div>
  );
}

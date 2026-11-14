'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { londonPicks, tasteWeights, walkMin } from '../lib/taste';
import { tick, pattern } from '../lib/haptics';
import { Back } from './Icons';
import Plan from './Plan';
import NearList from './NearList';
import events from '../data/events.json';
import artists from '../data/artists.json';

// every venue with an art event on, for the map across the top
const VENUES = (() => { const m = new Map(); events.forEach((e) => { if (e.lat && e.lng && !m.has(e.v)) m.set(e.v, [e.lat, e.lng]); }); return [...m.entries()]; })();
const SHOWS = (() => { const m = {}; events.forEach((e) => { (m[e.v] = m[e.v] || []).push(e); }); return m; })();
const fmtD = (d) => { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (x.getFullYear() > new Date().getFullYear() ? ` ${x.getFullYear()}` : ''); };
const runs = (e) => (e.e && e.e < '2030' ? `${fmtD(e.s)} – ${fmtD(e.e)}` : e.s ? `From ${fmtD(e.s)}` : '');

// Screen 3 (3.a): London galleries ranked by how well what's on matches
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
  const W8 = useMemo(() => tasteWeights(all, ratings), [all, ratings]);
  const RIVER = useMemo(() => { fitTo(picks); return thames(); }, [picks]);
  const [fi, setFi] = useState(0);
  const [view, setView] = useState('list');
  const [down, setDown] = useState(false); // bars pushed down so the map fills the screen (keerthi 15:04)
  const gy = useRef(null);
  const flip = (d) => { setDown(d); tick(8); [120, 480, 700].forEach((t) => setTimeout(() => window.dispatchEvent(new Event('resize')), t)); };
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
  const rated = Object.keys(ratings || {}).length > 0;
  return (
    <section className={`screen london ${rated ? '' : 'bare'} ${down ? 'down' : ''}`}>
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
      <TopMap w={W8} fav={picks[0]?.art} onPlan={setPlan} picks={picks} fi={fi} onPick={(i) => { setFi(i); tick(6); }} />
      <NearList w={W8} rated={rated} onPlan={setPlan} />
      <button className="lgrab" aria-label={down ? 'Show the list' : 'Push the list down'}
        onPointerDown={(e) => { gy.current = e.clientY; }}
        onPointerUp={(e) => { const d = e.clientY - (gy.current ?? e.clientY); gy.current = null; flip(Math.abs(d) < 8 ? !down : d > 0); }}><i /></button>
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
// the taste tags this show shares with what you rated highly, strongest first
const matchOf = (e, w) => (e.tags || []).filter((t) => /^(style|subject|mood|medium):/.test(t) && t !== 'medium:painting' && (w[t] || 0) > 0.3)
  .sort((a, b) => w[b] - w[a]).slice(0, 2).map((t) => t.split(':')[1]);
function TopMap({ w, fav, onPlan, picks, fi, onPick }) {
  const [card, setCard] = useState(null); // venue name
  const [bar, setBar] = useState(0); // which show's bar is opened on the 5.g page
  const el = useRef(null), map = useRef(null), layer = useRef(null);
  const [ready, setReady] = useState(false);
  // a regular street map (keerthi 14:55): Leaflet + CARTO Voyager tiles, loaded from the CDN
  useEffect(() => {
    let dead = false;
    const go = () => {
      if (dead || !el.current || map.current) return;
      const L = window.L;
      const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([51.513, -0.11], 12);
      // black and white streets, the Thames in yellow (keerthi 14:57)
      // CARTO tiles now answer "API key required"; Esri's dark grey canvas needs no key
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, maxNativeZoom: 16, detectRetina: true, className: 'ltiles-base', attribution: 'Tiles © Esri',
      }).addTo(m);
      // street and area names on top, so the map reads clearly (keerthi 15:42)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, maxNativeZoom: 16, detectRetina: true, className: 'ltiles-labels',
      }).addTo(m);
      // the yellow Thames line is off (keerthi 15:45); to restore: L.polyline(TH, { color: '#f0c95a', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', smoothFactor: 1.5, interactive: false }).addTo(m);
      m.attributionControl.setPrefix(false);
      map.current = m; layer.current = L.layerGroup().addTo(m); setReady(true);
    };
    if (window.L) go();
    else {
      if (!document.getElementById('leaflet-css')) {
        const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = '/vendor/leaflet/leaflet.css'; document.head.appendChild(l);
      }
      let sc = document.getElementById('leaflet-js');
      if (!sc) { sc = document.createElement('script'); sc.id = 'leaflet-js'; sc.src = '/vendor/leaflet/leaflet.js'; document.head.appendChild(sc); }
      sc.addEventListener('load', go);
    }
    return () => { dead = true; if (map.current) { map.current.remove(); map.current = null; } };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const L = window.L, g = layer.current; g.clearLayers();
    const ranked = new Map(picks.map((p, i) => [p.v, i]));
    VENUES.forEach(([v, [lat, lng]], k) => {
      if (ranked.has(v)) return;
      const m = (SHOWS[v] || []).some((e) => matchOf(e, w).length);
      L.marker([lat, lng], { icon: L.divIcon({ className: '', html: `<i class="mdot ${m ? 'm' : ''} ${card === v ? 'on' : ''}" style="animation-delay:${(k * 377) % 3000}ms"></i>`, iconSize: [32, 32] }) })
        .on('click', () => { setCard(v); setBar(0); tick(8); }).addTo(g);
    });
    picks.forEach((p, i) => {
      L.marker([p.lat, p.lng], { zIndexOffset: 1000 - i, icon: L.divIcon({ className: '', html: `<b class="mrank ${i === fi ? 'on' : ''}">${i + 1}</b>`, iconSize: [32, 32] }) })
        .on('click', () => { setCard(p.v); setBar(0); onPick(i); }).addTo(g);
    });
  }, [ready, picks, w, card, fi]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`ltop ${card ? 'full' : ''}`}>
      <div ref={el} className="ltop-map" />
      {card && (() => {
        // 5.g (keerthi 15:03): thin bars that bloom, one bar per show; x closes back to the map
        const ll = (VENUES.find(([v]) => v === card) || [])[1] || [];
        const shows = (SHOWS[card] || []).map((e) => ({ e, m: matchOf(e, w) })).sort((x, y) => y.m.length - x.m.length).slice(0, 8);
        const first = shows[0]?.e || {};
        const addr = first.addr;
        const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr ? `${card}, ${addr}` : `${ll[0]},${ll[1]}`)}`;
        const area = (addr || '').split(',').slice(-2, -1)[0]?.trim().split(' ')[0] || '';
        const g = { id: card, v: card, t: first.t, img: first.img, lat: ll[0], lng: ll[1], url: first.url, walk: walkMin(ll[0], ll[1]), art: fav };
        const others = picks.filter((p) => p.v !== card).slice(0, 4);
        const bgi = (e) => (e.img ? `url("${e.img}"), url("${fav?.thumb}")` : `url("${fav?.thumb}")`);
        return (
          <div className="g5">
            <button className="g5-x" aria-label="Close" onClick={() => { setCard(null); setBar(0); tick(8); }}>
              <svg viewBox="0 0 24 24" width="22" height="22" className="ico"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="g5-col">
              <div className="g5-vis open">
                <h2 className="g5-g">{card}</h2>
                <div className="g5-meta">{[area, `${walkMin(ll[0], ll[1])} min walk`, `${shows.length} on now`].filter(Boolean).join(' · ')}</div>
                <div className="g5-bars">
                  {shows.map(({ e, m }, i) => {
                    const days = e.e ? Math.ceil((new Date(e.e + 'T18:00:00') - Date.now()) / 864e5) : 99;
                    return (
                      <div key={e.id} className={`g5-bar ${bar === i ? 'big' : ''}`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => { setBar(bar === i ? -1 : i); tick(6); }}>
                        <i style={{ backgroundImage: bgi(e) }} />
                        <span className="g5-t">{e.t}</span>
                        {bar === i && (
                          <div className="g5-more">
                            {m.length > 0 && <em>Matched for you · {m[0]}</em>}
                            {days <= 5 && days >= 0 && <em className="end">Ends in {days} day{days === 1 ? '' : 's'}</em>}
                            <p>{runs(e)}</p>
                            {(artists[e.id] || []).length > 0 && <p>{artists[e.id].slice(0, 6).join(', ')}</p>}
                            <div className="ltop-btns">
                              <button className="ltop-plan" onClick={(ev) => { ev.stopPropagation(); onPlan({ ...g, t: e.t, img: e.img, url: e.url }); }}>Plan visit</button>
                              <a className="ltop-maps" href={maps} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Google Maps ↗</a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {others.map((p) => (
                <div key={p.v} className="g5-vis" onClick={() => { setCard(p.v); setBar(0); tick(6); }}>
                  <h2 className="g5-g">{p.v}</h2>
                  <div className="g5-meta">{p.walk} min walk · {p.pct}% match</div>
                  <div className="g5-bars">
                    {(SHOWS[p.v] || []).slice(0, 4).map((e) => <div key={e.id} className="g5-bar thin"><i style={{ backgroundImage: bgi(e) }} /></div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

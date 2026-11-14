'use client';
import { useEffect, useMemo, useState } from 'react';
import Tour from './Tour';
import VisitLog from './VisitLog';
import { loadArtworks, loadPodcasts, PODCAST_IDS } from '../lib/data';
import RateScreen from './RateScreen';
import TasteScreen from './TasteScreen';
import London from './London';
import Visits from './Visits';
import Listen from './Listen';
import Grain from './Grain';

const DECK_SIZE = 12;
const TASTE_AFTER = 5; // ratings before your taste opens
const STORE = 'mooncalf.ratings.v1';
const VSTORE = 'mooncalf.visits.v1';
const SSTORE = 'mooncalf.saved.v1';
const readJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };

function readRatings() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
}

export default function Mooncalf() {
  const [all, setAll] = useState(null);
  const [pods, setPods] = useState({});
  const [ratings, setRatings] = useState({});
  const [tab, setTab] = useState('visit');
  const [view, setView] = useState('london'); // discover: rate | london ; you: taste | visits
  const [visits, setVisits] = useState([]);
  const [saved, setSaved] = useState({});
  const [listen, setListen] = useState(null);
  const [film, setFilm] = useState(0); // 0 none, 1 playing, 2 fading out
  const [tour, setTour] = useState(false);

  useEffect(() => {
    setRatings(readRatings());
    setVisits(readJ(VSTORE, []));
    setSaved(readJ(SSTORE, {}));
    // the Ross Long intro opens the app every time (keerthi 14 Nov 14:57)
    setFilm(1);
    // open order every time: intro film, then the tutorial, then the app (keerthi 14 Nov 14:57)
    setTour(true);
    const onMsg = (e) => {
      if (e.data === 'mooncalf-film-done') {
        try { sessionStorage.setItem('mooncalf.film', '1'); } catch {}
        setFilm(2);
        setTimeout(() => setFilm(0), 900);
      }
    };
    window.addEventListener('message', onMsg);
    window.addEventListener('mooncalf-listen', (e) => setListen(e.detail));
    loadArtworks().then(setAll);
    loadPodcasts().then(setPods);
  }, []);

  useEffect(() => { try { localStorage.setItem(VSTORE, JSON.stringify(visits)); } catch {} }, [visits]);
  useEffect(() => { try { localStorage.setItem(SSTORE, JSON.stringify(saved)); } catch {} }, [saved]);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(ratings));
    } catch {}
  }, [ratings]);

  // Deck: mixed hard (keerthi 14:55). Round-robin across kinds (old masters,
  // photos, prints, modern, drawings, world) so no two in a row feel the same;
  // a story-with-audio piece leads, then one every few cards.
  const deck = useMemo(() => {
    if (!all) return [];
    const unrated = all.filter((a) => ratings[a.id] == null);
    const seed = Math.floor(Math.random() * 1e9);
    const h = (s) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, seed);
    const hasPod = (a) => a.pod || PODCAST_IDS.includes(a.id);
    const kinds = {};
    unrated.forEach((a) => { const k = hasPod(a) ? 'pod' : (a.kind || 'classic'); (kinds[k] = kinds[k] || []).push(a); });
    Object.values(kinds).forEach((l) => l.sort((x, y) => h(x.id) - h(y.id)));
    const order = ['pod', 'photo', 'classic', 'print', 'modern', 'world', 'classic', 'drawing'];
    const out = [];
    while (out.length < unrated.length) {
      let moved = false;
      for (const k of order) { const l = kinds[k]; if (l && l.length) { out.push(l.shift()); moved = true; } }
      if (!moved) break;
    }
    return out;
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratedCount = Object.keys(ratings).length;
  const rate = (id, v) => {
    setRatings((r) => ({ ...r, [id]: v }));
  };

  if (!all) {
    return (
      <main className="app loading">
        <div className="loading-mark" />
        <Grain />
      </main>
    );
  }

  return (
    <main className="app">
      {tab === 'discover' && view === 'rate' && (
        <RateScreen
          deck={deck}
          ratings={ratings}
          onRate={rate}
          sessionGoal={TASTE_AFTER}
          onDone={() => setView('taste')}
        />
      )}
      {tab === 'discover' && view === 'taste' && (
        <TasteScreen all={all} ratings={ratings} pods={pods} onRate={rate} onEmpty={() => setView('rate')} />
      )}
      {tab === 'visit' && view !== 'visits' && (
        <London
          all={all}
          ratings={ratings}
          saved={saved}
          onSave={(g) => setSaved((x) => ({ ...x, [g.v]: !x[g.v] }))}
          onPlan={(v) => setVisits((x) => [...x.filter((y) => y.v !== v.v), v])}
          onBack={() => { setTab('discover'); setView('rate'); }}
        />
      )}
      {tab === 'visit' && view === 'visits' && (
        <Visits visits={visits} all={all} onBack={() => setView('london')} />
      )}
      {tab === 'log' && <VisitLog visits={visits} all={all} ratings={ratings} />}
      {tab === 'discover' && (
        <button className="corner" aria-label={view === 'taste' ? 'Rate more' : 'Your taste'}
          onClick={() => setView(view === 'taste' ? 'rate' : 'taste')}>
          {view === 'rate' && (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M4 5h16M4 10h11M4 15h14M4 20h8" /></svg>
          )}
          {view === 'taste' && (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
          )}
        </button>
      )}
      <nav className="tabs">
        <button className={tab === 'visit' ? 'on' : ''} onClick={() => { setTab('visit'); setView('london'); }}>Visit</button>
        <button className={tab === 'discover' ? 'on' : ''} onClick={() => { setTab('discover'); setView('rate'); }}>Discover</button>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => { setTab('log'); setView('log'); }}>Log</button>
      </nav>
      <Grain />
      {listen && (
        <Listen
          key={listen.art.id}
          art={listen.art}
          rect={listen.rect}
          url={pods[listen.art.id]}
          onClose={() => setListen(null)}
          onLondon={() => { setListen(null); setTab('visit'); setView('london'); }}
        />
      )}
      {tour && film === 0 && !listen && tab === 'visit' && view === 'london' && (
        <Tour onDone={() => setTour(false)} />
      )}
      {film > 0 && (
        <iframe className={`film ${film === 2 ? 'out' : ''}`} src="/film/index.html?v=4" title="Palette" />
      )}
    </main>
  );
}

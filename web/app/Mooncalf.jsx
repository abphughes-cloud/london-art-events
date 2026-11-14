'use client';
import { useEffect, useMemo, useState } from 'react';
import Tour from './Tour';
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
    try { if (localStorage.getItem('mooncalf.tour.v1') !== '1' || /tour=1/.test(location.search)) setTour(true); } catch {}
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

  // Deck: artworks with audio stories first, then a varied mix, unrated first.
  const deck = useMemo(() => {
    if (!all) return [];
    const unrated = all.filter((a) => ratings[a.id] == null);
    const hasPod = (a) => a.pod || PODCAST_IDS.includes(a.id);
    const withPod = unrated.filter(hasPod);
    const rest = unrated.filter((a) => !hasPod(a));
    // stable shuffle by id
    const h = (s) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
    rest.sort((x, y) => h(x.id) - h(y.id));
    return [...withPod, ...rest];
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
      {(tab === 'discover' || view !== 'visits') && (
        <button className="corner" aria-label={tab === 'discover' ? (view === 'taste' ? 'Rate more' : 'Your taste') : 'Visits'}
          onClick={() => setView(tab === 'discover' ? (view === 'taste' ? 'rate' : 'taste') : 'visits')}>
          {tab === 'discover' && view === 'rate' && (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M4 5h16M4 10h11M4 15h14M4 20h8" /></svg>
          )}
          {tab === 'discover' && view === 'taste' && (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
          )}
          {tab === 'visit' && (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M4.5 5.5h15v14h-15zM4.5 10h15M9 3.5v3.6M15 3.5v3.6" /></svg>
          )}
        </button>
      )}
      <nav className="tabs">
        <button className={tab === 'visit' ? 'on' : ''} onClick={() => { setTab('visit'); setView('london'); }}>Visit</button>
        <button className={tab === 'discover' ? 'on' : ''} onClick={() => { setTab('discover'); setView('rate'); }}>Discover</button>
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
        <Tour onDone={() => { setTour(false); try { localStorage.setItem('mooncalf.tour.v1', '1'); } catch {} }} />
      )}
      {film > 0 && (
        <iframe className={`film ${film === 2 ? 'out' : ''}`} src="/film/index.html" title="Mooncalf" />
      )}
    </main>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import { loadArtworks, loadPodcasts, PODCAST_IDS } from '../lib/data';
import RateScreen from './RateScreen';
import TasteScreen from './TasteScreen';
import London from './London';
import Visits from './Visits';
import Grain from './Grain';

const DECK_SIZE = 12;
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
  const [tab, setTab] = useState('discover');
  const [view, setView] = useState('rate'); // discover: rate | london ; you: taste | visits
  const [visits, setVisits] = useState([]);
  const [saved, setSaved] = useState({});
  const [film, setFilm] = useState(0); // 0 none, 1 playing, 2 fading out

  useEffect(() => {
    setRatings(readRatings());
    setVisits(readJ(VSTORE, []));
    setSaved(readJ(SSTORE, {}));
    let seen = false;
    try { seen = sessionStorage.getItem('mooncalf.film') === '1'; } catch {}
    if (!seen) setFilm(1);
    const onMsg = (e) => {
      if (e.data === 'mooncalf-film-done') {
        try { sessionStorage.setItem('mooncalf.film', '1'); } catch {}
        setFilm(2);
        setTimeout(() => setFilm(0), 900);
      }
    };
    window.addEventListener('message', onMsg);
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
      {tab === 'discover' && view !== 'london' && (
        <RateScreen
          deck={deck}
          ratings={ratings}
          onRate={rate}
          sessionGoal={DECK_SIZE}
          onDone={() => { setTab('you'); setView('taste'); }}
        />
      )}
      {tab === 'discover' && view === 'london' && (
        <London
          all={all}
          ratings={ratings}
          saved={saved}
          onSave={(g) => setSaved((x) => ({ ...x, [g.v]: !x[g.v] }))}
          onPlan={(v) => setVisits((x) => [...x.filter((y) => y.v !== v.v), v])}
          onBack={() => setView('rate')}
        />
      )}
      {tab === 'you' && view !== 'visits' && (
        <TasteScreen all={all} ratings={ratings} pods={pods} onRate={rate} onEmpty={() => { setTab('discover'); setView('rate'); }} />
      )}
      {tab === 'you' && view === 'visits' && (
        <Visits visits={visits} all={all} onBack={() => setView('taste')} />
      )}
      {((tab === 'discover' && view !== 'london') || (tab === 'you' && view !== 'visits')) && (
        <button className="corner" aria-label={tab === 'discover' ? 'London' : 'Visits'}
          onClick={() => setView(tab === 'discover' ? 'london' : 'visits')}>
          {tab === 'discover' ? (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0113 0C18.5 15 12 21 12 21zM12 7.6a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" className="ico"><path d="M4.5 5.5h15v14h-15zM4.5 10h15M9 3.5v3.6M15 3.5v3.6" /></svg>
          )}
        </button>
      )}
      <nav className="tabs">
        <button aria-label="Discover" className={tab === 'discover' ? 'on' : ''} onClick={() => { setTab('discover'); setView('rate'); }}>
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
        </button>
        <button aria-label="You" className={tab === 'you' ? 'on' : ''} onClick={() => { setTab('you'); setView('taste'); }}>
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 5h16M4 10h11M4 15h14M4 20h8" /></svg>
          {ratedCount > 0 && tab !== 'you' && <span className="dot" />}
        </button>
      </nav>
      <Grain />
      {film > 0 && (
        <iframe className={`film ${film === 2 ? 'out' : ''}`} src="/film/index.html" title="Mooncalf" />
      )}
    </main>
  );
}

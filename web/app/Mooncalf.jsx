'use client';
import { useEffect, useMemo, useState } from 'react';
import { loadArtworks, loadPodcasts, PODCAST_IDS } from '../lib/data';
import RateScreen from './RateScreen';
import TasteScreen from './TasteScreen';
import Grain from './Grain';

const DECK_SIZE = 12;
const STORE = 'mooncalf.ratings.v1';

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
  const [film, setFilm] = useState(0); // 0 none, 1 playing, 2 fading out

  useEffect(() => {
    setRatings(readRatings());
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
      {tab === 'discover' ? (
        <RateScreen
          deck={deck}
          ratings={ratings}
          onRate={rate}
          sessionGoal={DECK_SIZE}
          onDone={() => setTab('you')}
        />
      ) : (
        <TasteScreen all={all} ratings={ratings} pods={pods} onRate={rate} onEmpty={() => setTab('discover')} />
      )}
      <nav className="tabs">
        <button aria-label="Discover" className={tab === 'discover' ? 'on' : ''} onClick={() => setTab('discover')}>
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
        </button>
        <button aria-label="You" className={tab === 'you' ? 'on' : ''} onClick={() => setTab('you')}>
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

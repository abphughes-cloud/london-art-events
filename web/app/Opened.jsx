'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ArtFrame from './ArtFrame';
import Bands from './Bands';
import RatingSweep from './RatingSweep';
import { moreLikeThis } from '../lib/data';
import { toggleStory } from '../lib/audio';
import { pattern, tick } from '../lib/haptics';
import { Back, Speaker, useNowPlaying } from './Icons';

function inset(r) {
  if (!r) return 'inset(0 0 0 0)';
  const W = window.innerWidth;
  const H = window.innerHeight;
  return `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px)`;
}

// An artwork opened from a band: the bar's rectangle expands to full screen,
// then a scroll view: art first, a frosted panel slides up over it.
export default function Opened({ layer, all, pods, rating, onRate, onOpen, onClose }) {
  const { art, rect, toText } = layer;
  const [clip, setClip] = useState(inset(rect));
  const [p, setP] = useState(0);
  const [localRating, setLocalRating] = useState(rating);
  const [val, setVal] = useState(0);
  const [drag, setDrag] = useState(false);
  const scroller = useRef(null);
  const lastTick = useRef(0);
  const g = useRef(null);
  const now = useNowPlaying();
  const more = useRef(moreLikeThis(art, all)).current;

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setClip('inset(0 0 0 0)')));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', art.accent);
    if (toText) {
      const t = setTimeout(() => {
        scroller.current?.scrollTo({ top: window.innerHeight * 0.85, behavior: 'smooth' });
      }, 850);
      return () => clearTimeout(t);
    }
  }, [art, toText]);

  const onScroll = (e) => {
    const y = e.currentTarget.scrollTop;
    setP(Math.min(1, y / (window.innerHeight * 0.8)));
    if (Math.abs(y - lastTick.current) >= 200) {
      lastTick.current = y;
      tick(5);
    }
  };

  const back = () => {
    scroller.current?.scrollTo({ top: 0 });
    setClip(inset(rect));
    setTimeout(onClose, 750);
  };

  // Unrated: the 1.r sweep sits on the art; sideways drag rates, vertical scrolls.
  const unrated = localRating == null;
  const down = (e) => {
    if (!unrated) return;
    g.current = { x: e.clientX, y: e.clientY, start: val, moved: false, step: 0, dead: false };
  };
  const move = (e) => {
    const s = g.current;
    if (!s || s.dead) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moved) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { s.dead = true; return; }
      if (Math.abs(dx) > 8) { s.moved = true; setDrag(true); }
      else return;
    }
    const v = Math.max(0, Math.min(1, s.start + dx / (0.8 * window.innerWidth)));
    const st = Math.floor(v * 10);
    if (st !== s.step) { s.step = st; tick(v >= 1 ? 30 : 8); }
    setVal(v);
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s || !s.moved) return;
    setDrag(false);
    pattern([12, 40, 12, 40, 12]);
    setLocalRating(val);
    onRate(art.id, val);
  };

  return (
    <div className="opened" style={{ clipPath: clip }}>
      <div
        className="opened-hero"
        style={{ filter: `blur(${p * 14}px) brightness(${1 - p * 0.55})` }}
      >
        <ArtFrame art={art} className="full" delay={1.55} />
        <div className="shade" />
      </div>
      <div
        className="opened-scroll"
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ touchAction: unrated ? 'pan-y' : 'auto' }}
      >
        <div className="opened-spacer">
          <h1 className="title" style={{ opacity: 1 - p * 1.4 }}>{art.title}</h1>
          {unrated && <RatingSweep value={val} dragging={drag} accent={art.accent} />}
        </div>
        <div className="panel">
          <h2 className="panel-title">{art.title}</h2>
          <p className="meta">{art.artist}{art.year ? ` · ${art.year}` : ''}</p>
          <p className="story">{art.story}</p>
          {pods[art.id] && (
            <button className="panel-listen" aria-label="Listen" onClick={() => toggleStory(art, pods[art.id])}>
              <Speaker active={now === art.id} />
            </button>
          )}
          <div className="more">
            <Bands
              items={more}
              pods={pods}
              grow={false}
              scrollInput={false}
              onOpen={(a, r, t) => onOpen(a, r, t)}
            />
          </div>
        </div>
      </div>
      <button className="back" aria-label="Back" onClick={back}>
        <Back />
      </button>
    </div>
  );
}

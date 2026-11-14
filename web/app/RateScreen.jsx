'use client';
import { useEffect, useRef, useState } from 'react';
import ArtFrame from './ArtFrame';
import RatingSweep from './RatingSweep';
import { pattern, tick } from '../lib/haptics';

// Screen 1.r: full-bleed artwork, sideways drag anywhere rates it.
export default function RateScreen({ deck, ratings, onRate, sessionGoal, onDone }) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(0);
  const g = useRef(null);
  const art = deck[i];

  useEffect(() => {
    setValue(0);
    setInfo(false);
  }, [i]);

  useEffect(() => {
    if (art) document.documentElement.style.setProperty('--accent', art.accent);
    if (art) document.documentElement.style.setProperty('--bg', art.bg);
  }, [art]);

  if (!art) {
    return (
      <section className="screen rate empty" onClick={onDone}>
        <h1 className="title">Everything rated</h1>
      </section>
    );
  }

  const down = (e) => {
    if (leaving) return;
    g.current = { x: e.clientX, y: e.clientY, start: value, moved: false, lastStep: Math.floor(value * 10) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      s.moved = true;
      setDragging(true);
      setInfo(false);
    }
    if (!s.moved) return;
    const v = Math.max(0, Math.min(1, s.start + (dx - Math.sign(dx) * 8) / (0.8 * window.innerWidth)));
    const step = Math.floor(v * 10 + 1e-6);
    if (step !== s.lastStep) {
      s.lastStep = step;
      if (v >= 1) tick(30);
      else tick(8);
    }
    setValue(v);
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    if (!s.moved) {
      setInfo((x) => !x);
      return;
    }
    setDragging(false);
    pattern([12, 40, 12, 40, 12]);
    onRate(art.id, value);
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      const n = done + 1;
      setDone(n);
      if (n >= sessionGoal) {
        onDone();
        setDone(0);
      }
      setI((x) => x + 1);
    }, 900);
  };

  return (
    <section
      className={`screen rate ${leaving ? 'leaving' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="fade-in" key={art.id}>
        <ArtFrame art={art} className="full" />
        <div className="shade" />
        <h1 className="title">{art.title}</h1>
        <div className={`reveal ${info ? 'on' : ''}`}>
          <div className="reveal-inner">
            <p className="meta">{art.artist}{art.year ? ` · ${art.year}` : ''}</p>
            <p className="story">{art.story}</p>
          </div>
        </div>
        <RatingSweep value={value} dragging={dragging} accent={art.accent} />
      </div>
      <div className="progress" style={{ width: `${(done / sessionGoal) * 100}%` }} />
    </section>
  );
}

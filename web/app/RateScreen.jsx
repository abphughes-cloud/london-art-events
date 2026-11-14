'use client';
import { useEffect, useRef, useState } from 'react';
import ArtFrame from './ArtFrame';
import RatingSweep from './RatingSweep';
import Hearts from './Hearts';
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
  useEffect(() => { [deck[i + 1], deck[i + 2]].forEach((a) => { if (a) { const im = new Image(); im.src = a.img || a.thumb; } }); }, [i, deck]); // next two load ahead

  useEffect(() => {
    setValue(0);
    setInfo(false);
  }, [i]);

  // first painting: the fan opens and closes by itself until you touch, so the gesture is obvious
  const [hint, setHint] = useState(true);
  useEffect(() => {
    if (!hint || done > 0) return;
    let t0 = performance.now(), raf;
    const loop = (t) => {
      const u = ((t - t0) / 2600) % 1;
      setValue(u < 0.15 ? 0 : 0.7 * Math.sin(Math.PI * (u - 0.15) / 0.85));
      raf = requestAnimationFrame(loop);
    };
    const start = setTimeout(() => { raf = requestAnimationFrame(loop); }, 1400);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [hint, done]);
  const stopHint = () => { if (hint) { setHint(false); setValue(0); } };

  // keyboard and trackpad fallbacks: arrows or scroll set it, Enter or a pause rates it
  const vRef = useRef(0);
  vRef.current = value;
  const wheelT = useRef(null);
  const commitRef = useRef(null);
  const [burst, setBurst] = useState(0); // hearts when rated near the top
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        stopHint();
        const v = Math.max(0, Math.min(1, vRef.current + (e.key === 'ArrowRight' ? 0.1 : -0.1)));
        setDragging(true); setValue(v); tick(8);
      } else if ((e.key === 'Enter' || e.key === ' ') && commitRef.current) {
        e.preventDefault(); commitRef.current(vRef.current);
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

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

  const commit = (v) => {
    if (leaving) return;
    if (v >= 0.85) setBurst(Date.now());
    setDragging(false);
    pattern([12, 40, 12, 40, 12]);
    onRate(art.id, v);
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
  commitRef.current = commit;
  const wheel = (e) => {
    if (leaving) return;
    stopHint();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const v = Math.max(0, Math.min(1, vRef.current + d / 600));
    setDragging(true); setValue(v);
    clearTimeout(wheelT.current);
    wheelT.current = setTimeout(() => commit(vRef.current), 700);
  };
  const down = (e) => {
    if (leaving) return;
    stopHint();
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
    const v = Math.max(0, Math.min(1, s.start + (dx - Math.sign(dx) * 8) / (0.8 * (e.currentTarget.clientWidth || window.innerWidth))));
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
    commit(value);
  };

  return (
    <section
      className={`screen rate ${leaving ? 'leaving' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={wheel}
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
        <div className="frosthit"
          onPointerDown={(e) => { e.stopPropagation(); stopHint(); e.currentTarget.setPointerCapture?.(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); e.currentTarget._r = r; setDragging(true); setValue(Math.max(0, Math.min(1, (e.clientX - r.left - 12) / (r.width - 24)))); tick(8); }}
          onPointerMove={(e) => { e.stopPropagation(); const r = e.currentTarget._r; if (!r) return; setValue(Math.max(0, Math.min(1, (e.clientX - r.left - 12) / (r.width - 24)))); }}
          onPointerUp={(e) => { e.stopPropagation(); if (!e.currentTarget._r) return; e.currentTarget._r = null; commit(vRef.current); }}
          onPointerCancel={(e) => { e.stopPropagation(); e.currentTarget._r = null; setDragging(false); }} />
      </div>
      <div className="progress" style={{ width: `${(done / sessionGoal) * 100}%` }} />
      {burst > 0 && <Hearts key={burst} />}
    </section>
  );
}

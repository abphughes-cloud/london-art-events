'use client';
import { useEffect, useState } from 'react';

// First-open tutorial: four taps, a few words each (keerthi 14:49)
const STEPS = [
  { sel: '.ltop', text: 'Every light is an art event.', sub: 'Tap one to see what’s on.' },
  { sel: '.corner', text: 'Your visits.', sub: 'Plan one and it lands here.' },
  { sel: '.tabs button:nth-child(2)', text: 'Discover.', sub: 'Rate art, sharpen your matches.' },
  { bar: true, text: 'Slide to rate.', sub: 'Let go for the next one.' },
];

export default function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const [r, setR] = useState(null);
  const s = STEPS[i];

  useEffect(() => {
    const place = () => {
      const el = s.sel && document.querySelector(s.sel);
      if (!el) { setR(null); return; }
      const b = el.getBoundingClientRect();
      const big = b.width > 200;
      const d = big ? 150 : Math.max(b.width, b.height) + 26;
      setR({ x: b.left + b.width / 2, y: b.top + b.height / 2, d });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [i]);

  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : onDone());
  const below = r ? r.y < window.innerHeight * 0.55 : false;

  return (
    <div className="tour" onClick={next}>
      {r ? (
        <div className="tour-spot" style={{ left: r.x - r.d / 2, top: r.y - r.d / 2, width: r.d, height: r.d }}>
          {i === 0 && <span className="tour-tap" />}
        </div>
      ) : (
        <div className="tour-dim" />
      )}
      {s.bar && (
        <div className="tour-bar"><span /></div>
      )}
      <div key={i} className="tour-text" style={r ? (below ? { top: r.y + r.d / 2 + 18 } : { bottom: window.innerHeight - r.y + r.d / 2 + 18 }) : { bottom: 140 }}>
        <b>{s.text}</b>
        <span>{s.sub}</span>
      </div>
      <div className="tour-foot">
        <button className="tiny" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip</button>
        <span className="tiny">{i + 1} / {STEPS.length}</span>
        <span className="tiny">{i < STEPS.length - 1 ? 'Tap' : 'Start'}</span>
      </div>
    </div>
  );
}

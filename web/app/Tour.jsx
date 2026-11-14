'use client';
import { useEffect, useState } from 'react';

// Tutorial: one step per feature, one short line each (keerthi 15:42).
// A gold ring hugs the real element; steps without an element show a small drawing instead.
const STEPS = [
  { tab: 'discover', text: 'Welcome to Palette, a place to explore London’s art and your own taste.' },
  { tab: 'discover', bar: true, text: 'Slide right the more you like it.' },
  { tab: 'discover', demo: 'speaker', text: 'Tap the speaker to hear the story.' },
  { tab: 'visit', sel: '.ltop', text: 'Each yellow dot is an art event. Tap one.', tap: true },
  { tab: 'visit', sel: '.msearch-box', text: 'Search shows, galleries and areas.' },
  { tab: 'visit', sel: '.lbands.near .nb', text: 'Shows near you, best matched to your taste first. Scroll to open each one.' },
  { tab: 'visit', demo: 'x', text: 'You’ll see the gallery and its shows. Star the ones you like.' },
  { tab: 'log', sel: '.vl-modes', text: 'Log: your starred shows and the art you loved.' },
];

const PAD = 8;

function measure(s) {
  const el = (s.sel && document.querySelector(s.sel)) || (s.alt && document.querySelector(s.alt));
  if (!el) return null;
  const b = el.getBoundingClientRect();
  if (b.width < 2 || b.height < 2) return null; // never show an empty ring
  const W = window.innerWidth, H = window.innerHeight;
  const left = Math.max(4, b.left - PAD), top = Math.max(4, b.top - PAD);
  const right = Math.min(W - 4, b.right + PAD), bottom = Math.min(H - 4 - 92, b.bottom + PAD); // stop above the footer strip
  return { left, top, width: right - left, height: bottom - top };
}

export default function Tour({ onDone, go }) {
  const [i, setI] = useState(0);
  const [r, setR] = useState(null);
  const s = STEPS[i];

  // each step opens its own tab first, then the ring is placed once that screen has drawn (keerthi 16:27)
  useEffect(() => {
    const place = () => setR(measure(STEPS[i]));
    setR(null);
    if (go && STEPS[i].tab) go(STEPS[i].tab);
    let raf = 0;
    const t1 = setTimeout(() => { raf = requestAnimationFrame(place); }, 350);
    const t2 = setTimeout(place, 700);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', place); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = i === STEPS.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));

  // keep the text box on screen, clear of the footer row and the top edge
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  const FOOT = 130, TOP = 70, TXT = 110;
  let top = Math.round(H * 0.42);
  if (r) {
    if (r.height > H * 0.45) top = Math.round(r.top + r.height * 0.42);
    else if (r.top + r.height / 2 < H * 0.5) top = r.top + r.height + 16;
    else top = r.top - 16 - TXT;
  } else if (s.bar) top = Math.round(H * 0.5);
  top = Math.max(TOP, Math.min(top, H - FOOT - TXT));

  return (
    <div className="tour" onClick={next}>
      {r ? (
        <div className="tour-ring" style={{ left: r.left, top: r.top, width: r.width, height: r.height }}>
          {s.tap && <span className="tour-tap" />}
        </div>
      ) : (
        <div className="tour-dim" />
      )}
      {!r && s.demo === 'x' && (
        <div className="tour-demo" style={{ top: top - 100 }}>
          <div className="tour-demo-card"><b>{(typeof document !== 'undefined' && document.querySelector('.lbands.near .nb .nb-venue')?.textContent) || 'Hayward Gallery'}</b><i /><i className="short" /></div>
        </div>
      )}
      {!r && s.demo === 'speaker' && (
        <div className="tour-demo" style={{ top: top - 80 }}>
          <svg viewBox="0 0 24 24" width="52" height="52" className="tour-speaker"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
        </div>
      )}
      {s.bar && (
        <div className="tour-bar"><span /></div>
      )}
      <div key={i} className={`tour-line ${i === 0 ? 'welcome' : ''}`} style={{ top }}>{s.text}</div>
      <div className="tour-strip" />
      <div className="tour-foot">
        <button className="tour-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip</button>
        <span className="tour-dots">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</span>
        <button className="tour-next" onClick={(e) => { e.stopPropagation(); next(); }}>{last ? 'Start' : 'Next'}</button>
      </div>
    </div>
  );
}

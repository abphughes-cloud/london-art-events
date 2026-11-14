'use client';
import { useEffect, useRef, useState } from 'react';
import { tick } from '../lib/haptics';
import { toggleStory } from '../lib/audio';
import { Lines, Speaker, useNowPlaying } from './Icons';

// 2.e taste bands: one bar per artwork. Vertical scroll/swipe moves focus
// (every ~46px), first tap focuses, second tap opens.
export default function Bands({ items, pods, onOpen, fading, grow = true, scrollInput = true }) {
  const [focus, setFocus] = useState(0);
  const acc = useRef({ y: null, sum: 0 });
  const box = useRef(null);
  const now = useNowPlaying();

  const step = (dir) => {
    setFocus((f) => {
      const n = Math.max(0, Math.min(items.length - 1, f + dir));
      if (n !== f) tick(6);
      return n;
    });
  };

  useEffect(() => {
    if (!scrollInput) return;
    const el = box.current;
    if (!el) return;
    const wheel = (e) => {
      e.preventDefault();
      acc.current.sum += e.deltaY;
      while (Math.abs(acc.current.sum) >= 46) {
        step(Math.sign(acc.current.sum));
        acc.current.sum -= Math.sign(acc.current.sum) * 46;
      }
    };
    const ts = (e) => { acc.current.y = e.touches[0].clientY; acc.current.sum = 0; };
    const tm = (e) => {
      if (acc.current.y == null) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      acc.current.sum += acc.current.y - y;
      acc.current.y = y;
      while (Math.abs(acc.current.sum) >= 46) {
        step(Math.sign(acc.current.sum));
        acc.current.sum -= Math.sign(acc.current.sum) * 46;
      }
    };
    const te = () => { acc.current.y = null; };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
    };
  }, [items.length, scrollInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const click = (idx, e, toText) => {
    if (idx !== focus && !toText) {
      setFocus(idx);
      tick(6);
      return;
    }
    onOpen(items[idx], e.currentTarget.closest('.band').getBoundingClientRect(), !!toText);
  };

  return (
    <div ref={box} className={`bands ${grow ? 'grow' : ''} ${fading ? 'fading' : ''}`}>
      {items.map((a, idx) => (
        <div
          key={a.id}
          className={`band ${idx === focus ? 'focus' : ''} ${fading && fading !== a.id ? 'vanish' : ''}`}
          style={{ flex: idx === focus ? 5 : 0.6, animationDelay: `${idx * 70}ms` }}
          onClick={(e) => click(idx, e)}
        >
          <div className="band-img" style={{ backgroundImage: `url("${a.thumb}")` }} />
          <span className="band-name">{a.title}</span>
          <div className="band-icons" onClick={(e) => e.stopPropagation()}>
            {pods[a.id] && (
              <button aria-label="Listen" onClick={() => toggleStory(a, pods[a.id])}>
                <Speaker active={now === a.id} />
              </button>
            )}
            <button aria-label="Read" onClick={(e) => click(idx, e, true)}>
              <Lines />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

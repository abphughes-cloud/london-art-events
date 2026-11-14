'use client';
import { useEffect, useRef, useState } from 'react';

// App-wide rule: a painting wider than its frame is shown at full frame height
// and pans slowly across its whole width and back (31s per pass, starts 0.8s
// after opening). Taller paintings fill the frame with a slow drift.
export default function ArtFrame({ art, className = '', style, pan = true, delay = 0.8 }) {
  const ref = useRef(null);
  const [wide, setWide] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      setWide(art.w / art.h > (r.width / r.height) * 1.02);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [art.w, art.h]);

  const panning = pan && wide;
  return (
    <div ref={ref} className={`artframe ${className}`} style={style}>
      <div
        key={art.id + (panning ? 'p' : 'd')}
        className={panning ? 'art-pan' : 'art-drift'}
        style={{
          backgroundImage: `url("${art.img}"), url("${art.thumb}")`,
          animationDelay: panning ? `${delay}s` : undefined,
        }}
      />
    </div>
  );
}

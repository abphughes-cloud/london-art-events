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

  // soft placeholder until the picture arrives, then a 300ms fade in (keerthi 16:01)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const im = new Image();
    let live = true;
    im.onload = im.onerror = () => { if (live) setReady(true); };
    im.src = art.img || art.thumb;
    const t = setTimeout(() => { if (live) setReady(true); }, 6000);
    return () => { live = false; clearTimeout(t); };
  }, [art.img, art.thumb]);
  const panning = pan && wide;
  return (
    <div ref={ref} className={`artframe ${className} ${ready ? 'ready' : 'loading'}`} style={{ '--ph': `color-mix(in srgb, ${art.accent || art.bg || '#444'} 35%, #111)`, ...style }}>
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

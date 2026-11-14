'use client';
import { useEffect, useMemo, useState } from 'react';

// Yellow hearts fall over the artwork when you rate it near the top (keerthi 15:53).
const D = 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.3a4.2 4.2 0 017.5 2.5C19.5 15.4 12 20 12 20z';

export default function Hearts() {
  const [on, setOn] = useState(true);
  const hearts = useMemo(() => Array.from({ length: 18 }, () => ({
    x: Math.random() * 100,
    s: 14 + Math.random() * 16,
    r: -25 + Math.random() * 50,
    dx: -30 + Math.random() * 60,
    dur: 1.4 + Math.random() * 0.8,
    del: Math.random() * 0.5,
  })), []);
  useEffect(() => { const t = setTimeout(() => setOn(false), 2800); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div className="hearts" aria-hidden="true">
      {hearts.map((h, i) => (
        <svg key={i} viewBox="0 0 24 24" width={h.s} height={h.s}
          style={{ left: `${h.x}%`, '--r': `${h.r}deg`, '--dx': `${h.dx}px`, animationDuration: `${h.dur}s`, animationDelay: `${h.del}s` }}>
          <path d={D} />
        </svg>
      ))}
    </div>
  );
}

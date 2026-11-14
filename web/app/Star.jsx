'use client';
import { useEffect, useState } from 'react';
import { readStars, toggleStar } from '../lib/stars';
import { tick } from '../lib/haptics';

const D = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z';

export default function Star({ id }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(readStars().includes(id));
    f();
    window.addEventListener('mooncalf-stars', f);
    return () => window.removeEventListener('mooncalf-stars', f);
  }, [id]);
  return (
    <button className={`g5-star ${on ? 'on' : ''}`} aria-label="Favourite" aria-pressed={on}
      onClick={(ev) => { ev.stopPropagation(); toggleStar(id); tick(8); }}>
      <svg viewBox="0 0 24 24" width="24" height="24"><path d={D} /></svg>
    </button>
  );
}

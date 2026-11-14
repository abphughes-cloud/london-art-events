'use client';
import { useEffect, useState } from 'react';
import Mooncalf from './Mooncalf';

// On a laptop or any wide window, show the app as a phone-sized frame in the
// middle of the screen so every gesture and layout behaves as on a phone.
export default function Shell() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    const inFrame = window.self !== window.top;
    const wide = window.innerWidth > 640 && window.innerWidth > window.innerHeight * 0.9;
    setMode(!inFrame && wide ? 'frame' : 'app');
  }, []);
  if (mode === null) return <main className="app loading" />;
  if (mode === 'app') return <Mooncalf />;
  return (
    <div className="deskwrap">
      <iframe className="deskphone" src="/?phone=1" title="Mooncalf" allow="autoplay; vibrate" />
    </div>
  );
}

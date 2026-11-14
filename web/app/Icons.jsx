'use client';
import { useEffect, useState } from 'react';
import { onAudio, playing } from '../lib/audio';

export function useNowPlaying() {
  const [p, setP] = useState(playing());
  useEffect(() => onAudio(setP), []);
  return p;
}

export function Speaker({ active }) {
  if (active)
    return (
      <span className="eq" aria-hidden>
        <i /><i /><i /><i />
      </span>
    );
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className="ico">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
    </svg>
  );
}

export function Lines() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className="ico">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function Back() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" className="ico">
      <path d="M15 4l-8 8 8 8" />
    </svg>
  );
}

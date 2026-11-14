'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import ArtFrame from './ArtFrame';
import scripts from '../data/podcasts.json';
import { tick, pattern } from '../lib/haptics';

// L.b Listen: the painting stays full screen, captions one sentence at a time
// with each word lighting as it's spoken, and the bottom half-circle fills
// with the painting's colour as the story plays. Tap pauses, sideways drag scrubs.
export const hasStory = (id, pods) => !!(pods?.[id] || scripts[id]);
export function openListen(art, el) {
  const r = el?.getBoundingClientRect?.();
  window.dispatchEvent(new CustomEvent('mooncalf-listen', { detail: { art, rect: r ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom } : null } }));
}

const sentencesOf = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
const R = 100;

export default function Listen({ art, rect, url, onClose, onLondon }) {
  const chapters = scripts[art.id] || [art.story || art.title];
  const sents = useMemo(() => {
    const out = [];
    let pos = 0;
    chapters.forEach((c, ci) => sentencesOf(c).forEach((s) => { out.push({ s, ci, start: pos }); pos += s.length + 1; }));
    return { list: out, total: pos };
  }, [art.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const chapStarts = useMemo(() => chapters.map((_, ci) => sents.list.find((x) => x.ci === ci)?.start / sents.total), [sents]); // eslint-disable-line react-hooks/exhaustive-deps

  const inset = (r) => (r ? `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round 12px)` : 'inset(50% 50% 50% 50%)');
  const [clip, setClip] = useState(inset(rect));
  const [p, setP] = useState(0); // 0..1 through the story (by characters)
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(sents.total / 14); // ~14 chars per second when spoken
  const [down, setDown] = useState(false);
  const audio = useRef(null);
  const speech = useRef(null);
  const g = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setClip('inset(0px 0px 0px 0px round 0px)')));
    const t = setTimeout(() => play(0), 900);
    return () => { clearTimeout(t); stopAll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function media() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: art.title, artist: art.artist, album: 'Palette', artwork: [{ src: art.thumb, sizes: '512x512', type: 'image/jpeg' }] });
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
    } catch {}
  }
  function stopAll() {
    if (audio.current) audio.current.pause();
    try { window.speechSynthesis?.cancel(); } catch {}
  }
  function play(from) {
    media();
    if (url) {
      if (!audio.current) {
        const a = new Audio(url);
        a.addEventListener('loadedmetadata', () => setDur(a.duration || dur));
        a.addEventListener('timeupdate', () => setP(a.duration ? a.currentTime / a.duration : 0));
        a.addEventListener('ended', () => setPlaying(false));
        audio.current = a;
      }
      if (from != null && audio.current.duration) audio.current.currentTime = from * audio.current.duration;
      audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    // no recording yet: the browser reads the script aloud
    const ss = window.speechSynthesis;
    if (!ss) return;
    ss.cancel();
    const startChar = Math.floor((from ?? p) * sents.total);
    const text = sents.list.map((x) => x.s).join(' ').slice(startChar);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.98;
    const v = ss.getVoices().find((x) => /en-GB/.test(x.lang) && /Daniel|Serena|Kate|Female|Google UK/i.test(x.name)) || ss.getVoices().find((x) => /en-GB/.test(x.lang));
    if (v) u.voice = v;
    u.onboundary = (e) => setP((startChar + e.charIndex) / sents.total);
    u.onend = () => { setPlaying(false); };
    speech.current = u;
    ss.speak(u);
    setPlaying(true);
  }
  function pause() {
    if (url && audio.current) audio.current.pause();
    else try { window.speechSynthesis?.cancel(); } catch {}
    setPlaying(false);
  }

  // where we are in the text
  const char = p * sents.total;
  let si = sents.list.findIndex((x, i) => char < (sents.list[i + 1]?.start ?? Infinity));
  if (si < 0) si = sents.list.length - 1;
  const cur = sents.list[si];
  const words = cur.s.split(' ');
  let acc = cur.start;
  const ci = cur.ci;
  const last = ci === chapters.length - 1;
  const remain = Math.max(0, Math.round(dur * (1 - p)));

  const pd = (e) => { g.current = { x: e.clientX, p0: p, moved: false }; setDown(true); };
  const pm = (e) => {
    const s = g.current; if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 8) s.moved = true;
    if (s.moved) { const np = Math.max(0, Math.min(1, s.p0 + dx / (0.8 * window.innerWidth))); if (Math.floor(np * 10) !== Math.floor(p * 10)) tick(7); setP(np); }
  };
  const pu = (e) => {
    const s = g.current; g.current = null; setDown(false);
    if (!s) return;
    if (e.target.closest('button')) return;
    if (s.moved) { pattern([10, 30, 20]); play(p); return; }
    if (playing) pause(); else play(p);
    tick(10);
  };
  const close = () => { stopAll(); setClip(inset(rect)); setTimeout(onClose, 850); };

  // half-circle progress, same geometry as the 1.r sweep
  const f = Math.max(0.035, p), a = Math.PI * (1 - f);
  const px = R + R * Math.cos(a), py = R - R * Math.sin(a);
  const d = `M 0 ${R} A ${R} ${R} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)} Q ${px.toFixed(1)} ${R} ${(R + (px - R) * 0.15).toFixed(1)} ${R} Z`;
  const cam = [[50, 50, 1.0], [30, 35, 1.12], [70, 60, 1.15], [45, 70, 1.1]][ci % 4];

  return (
    <div className="listen" style={{ clipPath: clip }} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={() => { g.current = null; setDown(false); }}>
      <div className="lcam" style={{ transform: `scale(${cam[2]})`, transformOrigin: `${cam[0]}% ${cam[1]}%` }}>
        <ArtFrame art={art} className="full" />
      </div>
      <div className="shade" />
      <div className="lhead">
        <h1 className="lname">{art.title}</h1>
        <div className="tiny lsub">{art.artist}{art.year ? ` · ${art.year}` : ''}</div>
      </div>
      <div className="tiny lremain">{Math.floor(remain / 60)}:{String(remain % 60).padStart(2, '0')}</div>
      <div className="lcap" key={si}>
        {words.map((w, i) => { const lit = char >= acc; acc += w.length + 1; return <span key={i} className={lit ? 'lit' : ''}>{w} </span>; })}
      </div>
      <div className="lsweep">
        <svg viewBox={`0 0 ${2 * R} ${R}`} width={2 * R} height={R}>
          {down && <path d={`M 0 ${R} A ${R} ${R} 0 0 1 ${2 * R} ${R} Z`} fill="rgba(150,150,150,.38)" />}
          {down && chapStarts.slice(1).map((c, i) => { const aa = Math.PI * (1 - c); return <line key={i} x1={R + 88 * Math.cos(aa)} y1={R - 88 * Math.sin(aa)} x2={R + 100 * Math.cos(aa)} y2={R - 100 * Math.sin(aa)} stroke="#fff" strokeWidth="1.2" />; })}
          <path d={d} fill={art.accent} className={playing ? 'quiver' : ''} />
        </svg>
      </div>
      <button className={`lpin ${last ? 'ready' : ''}`} aria-label="London" onClick={() => { stopAll(); onLondon(); }}>
        <svg viewBox="0 0 24 24" width="22" height="22" className="ico"><path d="M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0113 0C18.5 15 12 21 12 21zM12 7.6a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z" /></svg>
      </button>
      <button className="ldown" aria-label="Close" onClick={close}>
        <svg viewBox="0 0 24 24" width="26" height="26" className="ico"><path d="M5 9l7 7 7-7" /></svg>
      </button>
    </div>
  );
}

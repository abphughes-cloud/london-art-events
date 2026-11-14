// One story plays at a time, through a plain <audio> element so it keeps
// going with the screen locked; the lock screen shows the artwork.
let el = null;
let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(current));

export function onAudio(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function playing() {
  return current;
}

export function toggleStory(art, url) {
  if (!url) return;
  if (!el) {
    el = new Audio();
    el.addEventListener('error', () => { current = null; emit(); });
    el.addEventListener('ended', () => { current = null; emit(); });
    el.addEventListener('pause', () => { if (!el.ended) { current = null; emit(); } });
  }
  if (current === art.id) {
    el.pause();
    current = null;
    emit();
    return;
  }
  el.src = url;
  el.play().catch(() => { current = null; emit(); });
  current = art.id;
  emit();
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: art.title,
        artist: art.artist,
        album: 'Palette',
        artwork: [{ src: art.thumb, sizes: '512x512', type: 'image/jpeg' }],
      });
      navigator.mediaSession.setActionHandler('play', () => { el.play(); current = art.id; emit(); });
      navigator.mediaSession.setActionHandler('pause', () => el.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => { el.currentTime = Math.max(0, el.currentTime - 10); });
      navigator.mediaSession.setActionHandler('seekforward', () => { el.currentTime = el.currentTime + 10; });
    } catch {}
  }
}

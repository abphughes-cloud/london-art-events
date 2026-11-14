// Starred shows, shared by the gallery page and the Visit log (keerthi 15:43)
const KEY = 'mooncalf.stars.v1';
export function readStars() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
export function toggleStar(id) {
  const a = readStars();
  const next = a.includes(id) ? a.filter((x) => x !== id) : [...a, id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event('mooncalf-stars')); } catch {}
  return next;
}

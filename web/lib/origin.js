// One shared starting point for every walking time: your location, else central London (keerthi 15:59)
export const LONDON = { lat: 51.5074, lng: -0.1278 };
let here = LONDON;
let asked = false;
export const getOrigin = () => here;
export function askOrigin() {
  if (asked || typeof navigator === 'undefined' || !navigator.geolocation) return;
  asked = true;
  navigator.geolocation.getCurrentPosition(
    (p) => { here = { lat: p.coords.latitude, lng: p.coords.longitude }; try { window.dispatchEvent(new Event('mooncalf-origin')); } catch {} },
    () => {},
    { timeout: 4000, maximumAge: 600000 },
  );
}
export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const minutesTo = (lat, lng) => Math.max(1, Math.round(km(here, { lat, lng }) * 12));

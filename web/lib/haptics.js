// Android: navigator.vibrate. iOS 18+: clicking a hidden switch gives a native tick.
let iosSwitch = null;
function ios() {
  if (typeof document === 'undefined') return null;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  return iosSwitch;
}
export function tick(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
    else ios()?.click();
  } catch {}
}
export function pattern(p) {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
    else {
      const el = ios();
      let t = 0;
      p.forEach((d, i) => {
        if (i % 2 === 0) setTimeout(() => el?.click(), t);
        t += d;
      });
    }
  } catch {}
}

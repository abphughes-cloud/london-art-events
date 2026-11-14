'use client';
// The rating mark: a thin frosted-glass bar at the bottom, no knob (keerthi 14 Nov 14:34).
// As you slide, the frost wipes away from the left and the painting shows through clear:
// the clear length is the rating. value: 0..1.
export default function RatingSweep({ value, dragging }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`frost ${dragging ? 'on' : ''}`} aria-hidden="true">
      <div className="frost-glass" style={{ clipPath: `inset(0 0 0 ${(v * 100).toFixed(2)}%)` }} />
      <div className="frost-clear" style={{ width: `${(v * 100).toFixed(2)}%` }} />
    </div>
  );
}

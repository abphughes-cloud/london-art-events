'use client';
// The rating mark: 1.v paper folding fan (locked 14 Nov 13:52).
// Same gesture as before; only the drawing lives here so it can be swapped.
// value: 0..1, dragging: finger is down, accent: painting colour.
const FOLDS = 14;
const RO = 46;
const RI = 15;
const W = 2 * (RO + 8);
const H = RO + 12;
const CX = W / 2;
const CY = H - 4; // pivot 4px above the bottom of the box

function pt(r, a) {
  // a = 0 points left along the bottom edge, PI points right, opening over the top
  return [CX - r * Math.cos(a), CY - r * Math.sin(a)];
}
const f = (n) => n.toFixed(2);

export default function RatingSweep({ value, dragging, accent }) {
  const v = Math.max(0.045, Math.min(1, value));
  const open = Math.PI * v;
  const folds = [];
  const ribs = [];
  for (let k = 0; k < FOLDS; k++) {
    const a0 = (open * k) / FOLDS;
    const a1 = (open * (k + 1)) / FOLDS;
    const [x0, y0] = pt(RO, a0);
    const [x1, y1] = pt(RO, a1);
    const [x2, y2] = pt(RI, a1);
    const [x3, y3] = pt(RI, a0);
    folds.push(
      <path
        key={'f' + k}
        d={`M ${f(x0)} ${f(y0)} A ${RO} ${RO} 0 0 1 ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)} A ${RI} ${RI} 0 0 0 ${f(x3)} ${f(y3)} Z`}
        fill={accent}
        fillOpacity={k % 2 ? 0.8 : 0.96}
      />
    );
  }
  for (let k = 0; k <= FOLDS; k++) {
    const a = (open * k) / FOLDS;
    const [x, y] = pt(RI, a);
    const outer = k === 0 || k === FOLDS;
    const [xo, yo] = pt(RO, a);
    ribs.push(
      <line
        key={'r' + k}
        x1={CX} y1={CY}
        x2={f(outer ? xo : x)} y2={f(outer ? yo : y)}
        stroke="#fff"
        strokeWidth={outer ? 1.1 : 0.55}
        strokeLinecap="round"
      />
    );
  }
  const [gx0, gy0] = pt(RO + 5, 0);
  const [gx1, gy1] = pt(RO + 5, Math.PI);
  return (
    <div className="fan" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <path
          d={`M ${f(gx0)} ${f(gy0)} A ${RO + 5} ${RO + 5} 0 0 1 ${f(gx1)} ${f(gy1)}`}
          fill="none"
          stroke="#fff"
          strokeOpacity=".55"
          strokeWidth="1"
          strokeDasharray="1 4"
          strokeLinecap="round"
          style={{ opacity: dragging ? 1 : 0, transition: 'opacity .3s ease' }}
        />
        <g style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.45))' }}>
          {folds}
          {ribs}
          <circle cx={CX} cy={CY} r="1.6" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}

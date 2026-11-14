'use client';
import { Back } from './Icons';

// Screen 5 (5.d): the next visit leads, then the rest in time order.
// Each visit shows the painting you love that stands for it.
export default function Visits({ visits, all, onBack }) {
  const byId = Object.fromEntries(all.map((a) => [a.id, a]));
  const list = [...visits].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!list.length) {
    return (
      <section className="screen visits empty">
        <button className="back" aria-label="Back" onClick={onBack}><Back /></button>
        <div className="vempty">
          <svg viewBox="0 0 24 24" width="40" height="40" className="ico"><path d="M4.5 5.5h15v14h-15zM4.5 10h15M9 3.5v3.6M15 3.5v3.6" /></svg>
        </div>
      </section>
    );
  }
  const [nx, ...rest] = list;
  const img = (v) => (v.img ? `url("${v.img}"), url("${v.thumb}")` : `url("${v.thumb}")`);
  return (
    <section className="screen visits">
      <div className="vscroll">
        <div className="vhero">
          <div className="art-drift" style={{ backgroundImage: img(nx) }} />
          <div className="vfade" />
          <h1 className="vt">{nx.v}</h1>
          <div className="vmeta tiny">{nx.day} · {nx.time}</div>
          {byId[nx.art] && (
            <div className="vtile">
              <i style={{ backgroundImage: `url("${byId[nx.art].thumb}")` }} />
              <span>{byId[nx.art].title}</span>
            </div>
          )}
        </div>
        <div className="vline">
          {rest.map((v, i) => (
            <div className="vev" key={i}>
              <i className="vdot" style={{ background: byId[v.art]?.accent || '#fff' }} />
              <div className="vg">{v.v}</div>
              <div className="vmeta tiny">{v.day} · {v.time}</div>
              <div className="vstrip">
                <div className="vtile wide"><i style={{ backgroundImage: img(v) }} /><span>{v.t}</span></div>
                {byId[v.art] && <div className="vtile wide"><i style={{ backgroundImage: `url("${byId[v.art].thumb}")` }} /><span>{byId[v.art].title}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button className="back" aria-label="Back" onClick={onBack}><Back /></button>
    </section>
  );
}

'use client';
import { useMemo, useState } from 'react';
import Bands from './Bands';
import Opened from './Opened';

// Screen 2.e: your taste, as bands ordered by rating.
export default function TasteScreen({ all, ratings, pods, onRate, onEmpty }) {
  const [stack, setStack] = useState([]); // [{art, rect, toText}]
  const [fading, setFading] = useState(null);

  const items = useMemo(
    () =>
      all
        .filter((a) => ratings[a.id] != null)
        .sort((x, y) => ratings[y.id] - ratings[x.id]),
    [all] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!items.length) {
    return (
      <section className="screen taste empty" onClick={onEmpty}>
        <h1 className="title">Rate a few first</h1>
      </section>
    );
  }

  const open = (art, rect, toText) => {
    if (stack.length === 0) {
      setFading(art.id);
      setTimeout(() => setStack([{ art, rect, toText }]), 1100);
    } else {
      setStack((s) => [...s, { art, rect, toText, delayless: true }]);
    }
  };
  const close = () => {
    setStack((s) => {
      const n = s.slice(0, -1);
      if (!n.length) setFading(null);
      return n;
    });
  };

  return (
    <section className="screen taste">
      <Bands items={items} pods={pods} onOpen={open} fading={fading} scrollInput={!stack.length} />
      {stack.map((layer, k) => (
        <Opened
          key={layer.art.id + k}
          layer={layer}
          all={all}
          pods={pods}
          rating={ratings[layer.art.id]}
          onRate={onRate}
          onOpen={open}
          onClose={close}
        />
      ))}
    </section>
  );
}

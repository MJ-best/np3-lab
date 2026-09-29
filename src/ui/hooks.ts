import { useEffect, useState } from "preact/hooks";
import type { PreparedSource } from "../render/renderer";
import { loadSample, type Sample } from "../render/samples";

/** Load and prepare a preview scene; null while loading or on failure. */
export function usePreparedSample(sample: Sample | undefined): PreparedSource | null {
  const [src, setSrc] = useState<PreparedSource | null>(null);
  useEffect(() => {
    if (!sample) return;
    let alive = true;
    loadSample(sample)
      .then((s) => alive && setSrc(s))
      .catch((err) => {
        console.warn("[NP3 Lab] could not load sample", sample.id, err);
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [sample?.id]);
  return src;
}

/** Track an element's content width (CSS pixels). */
export function useElementWidth<T extends HTMLElement>(ref: { current: T | null }): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref.current]);
  return width;
}

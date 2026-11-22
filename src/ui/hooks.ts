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

/** Reactive CSS media query hook; safe when matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Track window innerHeight so mobile preview sizing adapts on orientation/resize. */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

let lockCount = 0;

/** Lock document scrolling while a modal overlay or lightbox is mounted (safe for nested modals). */
export function useScrollLock() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    lockCount++;
    if (lockCount === 1) document.documentElement.classList.add("scroll-locked");
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.documentElement.classList.remove("scroll-locked");
    };
  }, []);
}



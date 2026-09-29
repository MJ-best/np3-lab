import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import type { RecipeParams } from "../np3/recipe";
import { drawInto, type PreparedSource } from "../render/renderer";
import { useElementWidth } from "./hooks";

interface Props {
  source: PreparedSource | null;
  params: RecipeParams | null;
  /** Max rendered height in CSS pixels. */
  maxHeight?: number;
}

const MAX_RENDER = 1600;

/** Before/after viewer: drag (or use ←/→) to move the divider. */
export function CompareSlider({ source, params, maxHeight = 640 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const width = useElementWidth(wrapRef);
  const frame = useRef(0);

  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  // Fit the stage inside the container width and maxHeight while keeping the photo's aspect ratio.
  const stageW = source ? Math.min(width, Math.round((maxHeight * source.width) / source.height)) : width;
  const renderW = Math.min(MAX_RENDER, Math.round(stageW * dpr));

  useEffect(() => {
    if (!source || !beforeRef.current || renderW <= 0) return;
    drawInto(beforeRef.current, source, null, renderW);
  }, [source, renderW]);

  useEffect(() => {
    if (!source || !afterRef.current || renderW <= 0) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (afterRef.current) drawInto(afterRef.current, source, params, renderW);
    });
    return () => cancelAnimationFrame(frame.current);
  }, [source, params, renderW]);

  const updateFromEvent = (e: PointerEvent) => {
    const el = wrapRef.current?.querySelector(".compare-stage");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
  };

  const aspect = source ? `${source.width} / ${source.height}` : "3 / 2";

  return (
    <div class="compare" ref={wrapRef}>
      <div
        class={`compare-stage${dragging ? " dragging" : ""}`}
        style={{ aspectRatio: aspect, width: stageW > 0 ? `${stageW}px` : "100%" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          updateFromEvent(e);
        }}
        onPointerMove={(e) => dragging && updateFromEvent(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {!source && <div class="compare-loading" />}
        <canvas ref={beforeRef} class="compare-canvas" />
        <canvas ref={afterRef} class="compare-canvas" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span class="compare-tag left">{t("before")}</span>
        <span class="compare-tag right">{t("after")}</span>
        <div
          class="compare-handle"
          style={{ left: `${pos}%` }}
          role="slider"
          tabIndex={0}
          aria-label={`${t("before")} / ${t("after")}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onDblClick={() => setPos(50)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
            if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
          }}
        >
          <span class="compare-knob">⟷</span>
        </div>
      </div>
    </div>
  );
}

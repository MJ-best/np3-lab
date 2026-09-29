import { useMemo, useRef, useState } from "preact/hooks";
import { t, type MessageKey } from "../i18n";
import { CURVE_PRESETS, MAX_CURVE_POINTS, cleanPoints, pointsToRaw, type CurvePoint } from "../np3/toneCurve";

interface Props {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
}

const SIZE = 256;
/** Padding around the plot so points on the edges aren't clipped. */
const PAD = 7;
const VIEW = SIZE + PAD * 2;
const HIT = 10;
const PRESET_LABELS: Record<string, MessageKey> = {
  linear: "presetLinear",
  sCurve: "presetSCurve",
  fade: "presetFade",
  matte: "presetMatte",
};

/** Tone curve editor in NP3 coordinates (0–255 on both axes). */
export function CurveEditor({ points, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const pts = useMemo(() => cleanPoints(points), [points]);

  const path = useMemo(() => {
    const raw = pointsToRaw(pts);
    return raw.map((v, i) => `${i === 0 ? "M" : "L"}${((i / 256) * SIZE).toFixed(1)},${(SIZE - (v / 32767) * SIZE).toFixed(1)}`).join(" ");
  }, [pts]);

  const toCurve = (e: PointerEvent | MouseEvent): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    // Client pixels → viewBox units (which include PAD on every side) → curve values.
    const ux = ((e.clientX - rect.left) / rect.width) * VIEW - PAD;
    const uy = ((e.clientY - rect.top) / rect.height) * VIEW - PAD;
    const x = (ux / SIZE) * 255;
    const y = 255 - (uy / SIZE) * 255;
    return { x: Math.round(Math.min(255, Math.max(0, x))), y: Math.round(Math.min(255, Math.max(0, y))) };
  };

  const hitIndex = (p: CurvePoint) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = (VIEW / rect.width) * (255 / SIZE);
    return pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) <= HIT * scale * 1.5);
  };

  const onPointerDown = (e: PointerEvent) => {
    const p = toCurve(e);
    let i = hitIndex(p);
    if (i < 0) {
      if (pts.length >= MAX_CURVE_POINTS) return;
      const next = cleanPoints([...pts, p]);
      i = next.findIndex((q) => q.x === p.x);
      onChange(next);
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag(i);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (drag === null) return;
    const p = toCurve(e);
    // Keep points in order: a point can't pass its neighbours.
    const lo = drag > 0 ? pts[drag - 1].x + 1 : 0;
    const hi = drag < pts.length - 1 ? pts[drag + 1].x - 1 : 255;
    const next = pts.map((q, j) => (j === drag ? { x: Math.min(hi, Math.max(lo, p.x)), y: p.y } : q));
    onChange(next);
  };

  const onDblClick = (e: MouseEvent) => {
    const i = hitIndex(toCurve(e));
    if (i >= 0 && pts.length > 2) onChange(pts.filter((_, j) => j !== i));
  };

  return (
    <div class="curve">
      <svg
        ref={svgRef}
        viewBox={`${-PAD} ${-PAD} ${VIEW} ${VIEW}`}
        class="curve-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onDblClick={onDblClick}
      >
        {[64, 128, 192].map((v) => (
          <g key={v} class="curve-grid">
            <line x1={v} y1={0} x2={v} y2={SIZE} />
            <line x1={0} y1={v} x2={SIZE} y2={v} />
          </g>
        ))}
        <line class="curve-diagonal" x1={0} y1={SIZE} x2={SIZE} y2={0} />
        <path class="curve-path" d={path} />
        {pts.map((p, i) => (
          <circle
            key={i}
            class={`curve-point${drag === i ? " active" : ""}`}
            cx={(p.x / 255) * SIZE}
            cy={SIZE - (p.y / 255) * SIZE}
            r={5}
          />
        ))}
      </svg>
      <div class="curve-bar">
        <div class="chips">
          {Object.entries(CURVE_PRESETS).map(([key, preset]) => (
            <button key={key} class="chip small" onClick={() => onChange(preset.map((p) => ({ ...p })))}>
              {t(PRESET_LABELS[key])}
            </button>
          ))}
        </div>
        <span class="curve-count">
          {pts.length}/{MAX_CURVE_POINTS}
        </span>
      </div>
      <p class="hint">{t("curveHelp")}</p>
    </div>
  );
}

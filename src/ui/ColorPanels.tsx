import { useState } from "preact/hooks";
import { t, type MessageKey } from "../i18n";
import {
  BLENDER_COLORS,
  GRADING_RANGES,
  type BlenderColor,
  type ColorBlender,
  type ColorGrading,
  type GradingRange,
} from "../np3/recipe";
import { Slider } from "./Slider";

/** Display hue (HSL) for each blender band. */
export const BAND_HUES: Record<BlenderColor, number> = {
  red: 0,
  orange: 30,
  yellow: 55,
  green: 120,
  cyan: 185,
  blue: 225,
  purple: 270,
  magenta: 310,
};

const RANGE_KEYS: Record<GradingRange, MessageKey> = {
  shadows: "rangeShadows",
  midTone: "rangeMidTone",
  highlights: "rangeHighlights",
};

const HUE_TRACK =
  "linear-gradient(90deg, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 80% 45%), hsl(180 80% 45%), hsl(240 80% 60%), hsl(300 80% 55%), hsl(360 80% 55%))";

export function ColorBlenderPanel({ value, onChange }: { value: ColorBlender; onChange: (v: ColorBlender) => void }) {
  const [active, setActive] = useState<BlenderColor>("red");
  const v = value[active] ?? {};
  const hue = BAND_HUES[active];
  const set = (patch: Partial<{ hue: number; chroma: number; brightness: number }>) =>
    onChange({ ...value, [active]: { hue: v.hue ?? 0, chroma: v.chroma ?? 0, brightness: v.brightness ?? 0, ...patch } });
  return (
    <div class="blender">
      <div class="swatches" role="tablist">
        {BLENDER_COLORS.map((c) => {
          const cv = value[c];
          const modified = !!cv && (cv.hue || cv.chroma || cv.brightness);
          return (
            <button
              key={c}
              role="tab"
              aria-selected={c === active}
              aria-label={t(c)}
              title={t(c)}
              class={`swatch${c === active ? " active" : ""}${modified ? " modified" : ""}`}
              style={{ background: `hsl(${BAND_HUES[c]} 80% 52%)` }}
              onClick={() => setActive(c)}
            />
          );
        })}
      </div>
      <div class="blender-title">
        <strong>{t(active)}</strong>
        <button class="link" onClick={() => onChange({ ...value, [active]: undefined })}>
          {t("resetColor")}
        </button>
      </div>
      <Slider
        label={t("hue")}
        value={v.hue ?? 0}
        min={-100}
        max={100}
        step={1}
        defaultValue={0}
        track={`linear-gradient(90deg, hsl(${hue - 35} 80% 52%), hsl(${hue} 80% 52%), hsl(${hue + 35} 80% 52%))`}
        onChange={(n) => set({ hue: n })}
      />
      <Slider
        label={t("chroma")}
        value={v.chroma ?? 0}
        min={-100}
        max={100}
        step={1}
        defaultValue={0}
        track={`linear-gradient(90deg, hsl(${hue} 0% 50%), hsl(${hue} 90% 50%))`}
        onChange={(n) => set({ chroma: n })}
      />
      <Slider
        label={t("brightness")}
        value={v.brightness ?? 0}
        min={-100}
        max={100}
        step={1}
        defaultValue={0}
        track={`linear-gradient(90deg, hsl(${hue} 60% 15%), hsl(${hue} 70% 50%), hsl(${hue} 60% 85%))`}
        onChange={(n) => set({ brightness: n })}
      />
    </div>
  );
}

export function ColorGradingPanel({ value, onChange }: { value: ColorGrading; onChange: (v: ColorGrading) => void }) {
  return (
    <div class="grading">
      {[...GRADING_RANGES].reverse().map((r) => {
        const v = value[r] ?? {};
        const set = (patch: Partial<{ hue: number; chroma: number; brightness: number }>) =>
          onChange({ ...value, [r]: { hue: v.hue ?? 0, chroma: v.chroma ?? 0, brightness: v.brightness ?? 0, ...patch } });
        return (
          <div class="grading-range" key={r}>
            <div class="grading-head">
              <span class="grading-dot" style={{ background: `hsl(${v.hue ?? 0} ${Math.min(100, Math.abs(v.chroma ?? 0) + 15)}% 55%)` }} />
              <strong>{t(RANGE_KEYS[r])}</strong>
            </div>
            <Slider label={t("hue")} value={v.hue ?? 0} min={0} max={360} step={1} defaultValue={0} track={HUE_TRACK} onChange={(n) => set({ hue: n })} />
            <Slider label={t("chroma")} value={v.chroma ?? 0} min={-100} max={100} step={1} defaultValue={0} onChange={(n) => set({ chroma: n })} />
            <Slider
              label={t("brightness")}
              value={v.brightness ?? 0}
              min={-100}
              max={100}
              step={1}
              defaultValue={0}
              onChange={(n) => set({ brightness: n })}
            />
          </div>
        );
      })}
      <Slider label={t("blending")} value={value.blending ?? 50} min={0} max={100} step={1} defaultValue={50} onChange={(n) => onChange({ ...value, blending: n })} />
      <Slider label={t("balance")} value={value.balance ?? 0} min={-100} max={100} step={1} defaultValue={0} onChange={(n) => onChange({ ...value, balance: n })} />
    </div>
  );
}

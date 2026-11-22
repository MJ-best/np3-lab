import { useRef } from "preact/hooks";
import { t } from "../i18n";
import { haptic } from "../native";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Double-click the label or tap reset to return here. */
  defaultValue?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** CSS background for the track, e.g. a hue gradient. */
  track?: string;
}

export function formatValue(v: number, step: number, signed = true): string {
  const decimals = step < 1 ? 2 : 0;
  const s = v.toFixed(decimals);
  return signed && v > 0 ? `+${s}` : s;
}

export function Slider({ label, value, min, max, step, defaultValue, onChange, disabled, track }: Props) {
  const reset = () => {
    if (defaultValue === undefined || disabled) return;
    haptic("selection");
    onChange(defaultValue);
  };
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9;
  // Touch: the thumb jumps to the finger on touch-down. If the finger then scrolls the page
  // (touch-action: pan-y), the browser cancels the pointer and the old value is put back.
  const before = useRef<number | null>(null);
  return (
    <div class={`slider${disabled ? " disabled" : ""}${changed ? " changed" : ""}`}>
      <div class="slider-label-wrap">
        <span class="slider-label" onDblClick={reset} title={defaultValue !== undefined ? t("resetSlider") : undefined}>
          {label}
        </span>
        {changed && !disabled && (
          <button type="button" class="slider-reset" onClick={reset} aria-label={`${label} ${t("resetSlider")}`} title={t("resetSlider")}>
            ↺
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={track ? { "--track": track } : undefined}
        class={track ? "custom-track" : undefined}
        aria-label={label}
        onInput={(e) => {
          const next = Number(e.currentTarget.value);
          if (defaultValue !== undefined && Math.abs(next - defaultValue) < 1e-9 && Math.abs(value - defaultValue) > 1e-9) {
            haptic("selection");
          }
          onChange(next);
        }}
        onPointerDown={() => (before.current = value)}
        onPointerUp={() => (before.current = null)}
        onPointerCancel={() => {
          if (before.current !== null) onChange(before.current);
          before.current = null;
        }}
        onDblClick={reset}
      />
      <input
        class="slider-number"
        type="number"
        min={min}
        max={max}
        step={step}
        value={step < 1 ? value.toFixed(2) : String(value)}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.currentTarget.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
        }}
        aria-label={label}
      />
    </div>
  );
}

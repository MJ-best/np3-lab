interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Double-click the label or value to return here. */
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
  const reset = () => defaultValue !== undefined && !disabled && onChange(defaultValue);
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9;
  return (
    <label class={`slider${disabled ? " disabled" : ""}${changed ? " changed" : ""}`}>
      <span class="slider-label" onDblClick={reset} title={defaultValue !== undefined ? "Double-click to reset" : undefined}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={track ? { "--track": track } : undefined}
        class={track ? "custom-track" : undefined}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
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
    </label>
  );
}

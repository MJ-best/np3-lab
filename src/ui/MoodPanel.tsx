import { signal } from "@preact/signals";
import { t, tx, type MessageKey } from "../i18n";
import {
  MOODS,
  MOOD_GROUPS,
  MOOD_STRENGTHS,
  STRENGTH_SCALE,
  applyMoods,
  moodById,
  type MoodGroup,
  type MoodPicks,
  type MoodStrength,
} from "../moods";
import type { RecipeParams } from "../np3/recipe";
import { draft, updateDraft } from "../state";
import { readStore, writeStore } from "../storage";

interface MoodState {
  /** The recipe before any look was picked; looks are always worked out from here. */
  base: RecipeParams;
  picks: MoodPicks;
  /** What the looks produced. Once the recipe differs (a slider moved), the looks are baked in. */
  applied: RecipeParams;
  /** The group picked last, whose description is shown. */
  last?: MoodGroup;
}

const moodState = signal<MoodState | null>(null);
const strength = signal<MoodStrength>(readStore<MoodStrength>("moodStrength") ?? "normal");

const GROUP_LABEL: Record<MoodGroup, MessageKey> = { look: "moodLook", skin: "moodSkin", accent: "moodAccent" };
const STRENGTH_LABEL: Record<MoodStrength, MessageKey> = { soft: "moodSoft", normal: "moodNormal", strong: "moodStrong" };

/** One-tap looks in the editor: a mood, a skin tone and a colour to bring out, at a chosen strength. */
export function MoodPanel() {
  const d = draft.value;
  const st = moodState.value;
  const live = st && d.params === st.applied ? st : null;
  const picks = live?.picks ?? {};
  const curve = d.toneMode === "curve";

  const apply = (base: RecipeParams, next: MoodPicks, s: MoodStrength, last?: MoodGroup) => {
    if (!Object.values(next).some(Boolean)) {
      updateDraft({ params: base });
      moodState.value = null;
      return;
    }
    const params = applyMoods(base, next, STRENGTH_SCALE[s], !curve);
    updateDraft({ params });
    moodState.value = { base, picks: next, applied: params, last };
  };
  // Tapping the picked chip again takes that look off.
  const pick = (group: MoodGroup, id: string) =>
    apply(live ? live.base : d.params, { ...picks, [group]: picks[group] === id ? undefined : id }, strength.value, group);
  const setStrength = (s: MoodStrength) => {
    strength.value = s;
    writeStore("moodStrength", s);
    if (live) apply(live.base, live.picks, s, live.last);
  };
  const described = live?.last ? moodById(live.last, live.picks[live.last]) : undefined;

  return (
    <details class="panel mood-panel" open>
      <summary>{t("moodTitle")}</summary>
      {MOOD_GROUPS.map((group) => (
        <div class="mood-row" key={group}>
          <span class="mood-label">{t(GROUP_LABEL[group])}</span>
          <div class="chips mood-chips" role="group" aria-label={t(GROUP_LABEL[group])}>
            {MOODS.filter((m) => m.group === group).map((m) => (
              <button
                key={m.id}
                aria-pressed={picks[group] === m.id}
                class={`chip${picks[group] === m.id ? " active" : ""}`}
                title={tx(m.hint)}
                onClick={() => pick(group, m.id)}
              >
                {m.dot && <span class="mood-dot" style={{ background: m.dot }} />}
                {tx(m.label)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div class="mood-foot">
        <div class="segmented" role="radiogroup" aria-label={t("moodStrength")}>
          {MOOD_STRENGTHS.map((s) => (
            <button key={s} role="radio" aria-checked={s === strength.value} class={s === strength.value ? "active" : ""} onClick={() => setStrength(s)}>
              {t(STRENGTH_LABEL[s])}
            </button>
          ))}
        </div>
        {live && (
          <button class="link" onClick={() => apply(live.base, {}, strength.value)}>
            ↺ {t("moodUndo")}
          </button>
        )}
      </div>
      <p class="hint">{described ? tx(described.hint) : t("moodHint")}</p>
      {curve && live && <p class="hint">{t("moodCurveNote")}</p>}
    </details>
  );
}

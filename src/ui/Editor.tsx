import { useEffect } from "preact/hooks";
import { activeCard, addToActiveCard } from "../cards";
import { t } from "../i18n";
import { isDesktop } from "../native";
import { NP_NAME_MAX, RANGES, TONE_KEYS, isValidNpName, paramsToBytes, type ScalarKey } from "../np3/recipe";
import { formatRecipeText } from "../np3/textFormat";
import { downloadBytes } from "../pack/download";
import {
  activeSample,
  addToCart,
  draft,
  draftParams,
  myRecipes,
  pasteOpen,
  resetDraft,
  saveDraft,
  showToast,
  updateDraft,
  updateDraftParams,
} from "../state";
import { ColorBlenderPanel, ColorGradingPanel } from "./ColorPanels";
import { CompareSlider } from "./CompareSlider";
import { CurveEditor } from "./CurveEditor";
import { usePreparedSample } from "./hooks";
import { SceneChips } from "./SceneChips";
import { Slider } from "./Slider";

function ScalarSlider({ k, disabled }: { k: ScalarKey; disabled?: boolean }) {
  const r = RANGES[k];
  return (
    <Slider
      label={t(k)}
      value={draft.value.params[k] ?? r.def}
      min={r.min}
      max={r.max}
      step={r.step}
      defaultValue={r.def}
      disabled={disabled}
      onChange={(v) => updateDraftParams({ [k]: v })}
    />
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(t("copied"), "ok");
}

export function Editor() {
  const d = draft.value;
  const source = usePreparedSample(activeSample.value);
  const nameOk = isValidNpName(d.npName);
  const curveMode = d.toneMode === "curve";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveAndAdd = () => {
    const saved = d.dirty || !d.editingId ? saveDraft() : null;
    const id = saved?.id ?? d.editingId;
    if (!id) return;
    if (isDesktop) {
      const recipe = myRecipes.value.find((r) => r.id === id);
      if (recipe) void addToActiveCard([recipe]);
      return;
    }
    addToCart(id);
    showToast(`${t("added")} ✓`, "ok");
  };

  return (
    <div class="editor">
      <section class="editor-preview">
        <SceneChips />
        <CompareSlider source={source} params={draftParams.value} maxHeight={560} />
        <p class="hint">{t("approxPreview")}</p>
      </section>

      <section class="editor-controls">
        <div class="panel">
          <div class="editor-status">
            <span class={`badge${d.editingId ? "" : " accent"}`}>{d.editingId ? t("editingExisting") : t("editingNew")}</span>
            {d.dirty && <span class="badge warn">{t("unsaved")}</span>}
            <span class="hint right">{t("shortcutSave")}</span>
          </div>
          <label class="field">
            <span>{t("titleField")}</span>
            <input value={d.title} onInput={(e) => updateDraft({ title: e.currentTarget.value })} />
          </label>
          <label class={`field${nameOk ? "" : " invalid"}`}>
            <span>{t("npNameField")}</span>
            <input
              class="mono"
              value={d.npName}
              maxLength={NP_NAME_MAX}
              spellcheck={false}
              onInput={(e) => updateDraft({ npName: e.currentTarget.value.replace(/[^A-Za-z0-9 _\-]/g, "") })}
            />
            {!nameOk && <small class="error">{t("nameInvalid")}</small>}
          </label>
          <label class="field">
            <span>{t("commentField")}</span>
            <input value={d.params.comment ?? ""} maxLength={256} onInput={(e) => updateDraftParams({ comment: e.currentTarget.value })} />
          </label>
          <div class="button-row">
            <button class="primary" onClick={() => saveDraft()} disabled={!nameOk}>
              {t("save")}
            </button>
            {d.editingId && (
              <button onClick={() => saveDraft(true)} disabled={!nameOk}>
                {t("saveAsNew")}
              </button>
            )}
            <button onClick={saveAndAdd} disabled={!nameOk || (isDesktop && !activeCard.value)}>
              {isDesktop && !activeCard.value ? t("noCardShort") : t("addToCard")}
            </button>
            <button
              onClick={() => downloadBytes(paramsToBytes(d.npName, draftParams.value), `${d.npName.replace(/ /g, "_") || "RECIPE"}.NP3`)}
              disabled={!nameOk}
            >
              {t("downloadNp3")}
            </button>
            <button class="ghost" onClick={() => confirm(t("confirmReset")) && resetDraft()}>
              {t("resetDraft")}
            </button>
          </div>
        </div>

        <details class="panel" open>
          <summary>{t("secDetail")}</summary>
          <ScalarSlider k="sharpning" />
          <ScalarSlider k="midRangeSharpning" />
          <ScalarSlider k="clarity" />
        </details>

        <details class="panel" open>
          <summary>{t("secTone")}</summary>
          <div class="segmented" role="radiogroup">
            <button role="radio" aria-checked={!curveMode} class={!curveMode ? "active" : ""} onClick={() => updateDraft({ toneMode: "sliders" })}>
              {t("toneSliders")}
            </button>
            <button role="radio" aria-checked={curveMode} class={curveMode ? "active" : ""} onClick={() => updateDraft({ toneMode: "curve" })}>
              {t("toneCurve")}
            </button>
          </div>
          {curveMode ? (
            <>
              <CurveEditor points={d.curvePoints} onChange={(curvePoints) => updateDraft({ curvePoints })} />
              <p class="hint">{t("curveNote")}</p>
            </>
          ) : (
            TONE_KEYS.map((k) => <ScalarSlider key={k} k={k} />)
          )}
        </details>

        <details class="panel" open>
          <summary>{t("secColor")}</summary>
          <ScalarSlider k="saturation" />
        </details>

        <details class="panel" open>
          <summary>{t("secBlender")}</summary>
          <ColorBlenderPanel value={d.params.colorBlender ?? {}} onChange={(colorBlender) => updateDraftParams({ colorBlender })} />
        </details>

        <details class="panel" open>
          <summary>{t("secGrading")}</summary>
          <ColorGradingPanel value={d.params.colorGrading ?? {}} onChange={(colorGrading) => updateDraftParams({ colorGrading })} />
        </details>

        <details class="panel">
          <summary>{t("secText")}</summary>
          <pre class="text-preview">{formatRecipeText(d.npName, draftParams.value)}</pre>
          <div class="button-row">
            <button onClick={() => copyText(formatRecipeText(d.npName, draftParams.value))}>{t("copyText")}</button>
            <button onClick={() => (pasteOpen.value = true)}>{t("pasteText")}</button>
          </div>
        </details>
      </section>
    </div>
  );
}

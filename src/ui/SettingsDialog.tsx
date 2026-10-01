import { useEffect, useState } from "preact/hooks";
import { autoBackup, setAutoBackup } from "../cards";
import { lang, setLang, t, LANGS } from "../i18n";
import { native, type NativeSettings } from "../native";
import { Overlay } from "./RecipeDetail";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<NativeSettings | null>(null);
  useEffect(() => {
    void native?.getSettings().then(setS);
  }, []);
  const update = async (patch: Partial<Pick<NativeSettings, "openOnCard" | "openAtLogin">>) => {
    if (native) setS(await native.setSettings(patch));
  };
  return (
    <Overlay onClose={onClose}>
      <div class="dialog settings" role="dialog" aria-modal="true" aria-label={t("settingsTitle")}>
        <div class="detail-head">
          <h2>{t("settingsTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={onClose}>
            ✕
          </button>
        </div>
        <div class="setting-row">
          <span>{t("language")}</span>
          <div class="segmented" role="radiogroup" aria-label={t("language")}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={lang.value === l.id}
                class={lang.value === l.id ? "active" : ""}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        {native && (
          <>
            <label class="toggle">
              <input type="checkbox" checked={autoBackup.value} onChange={(e) => setAutoBackup(e.currentTarget.checked)} />
              {t("setAutoBackup")}
            </label>
            <label class="toggle">
              <input
                type="checkbox"
                checked={s?.openOnCard ?? true}
                disabled={!s}
                onChange={(e) => update({ openOnCard: e.currentTarget.checked })}
              />
              {t("setOpenOnCard")}
            </label>
            <label class="toggle">
              <input
                type="checkbox"
                checked={s?.openAtLogin ?? true}
                disabled={!s || !s.canUseLoginItem}
                onChange={(e) => update({ openAtLogin: e.currentTarget.checked })}
              />
              {t("setOpenAtLogin")}
            </label>
            {s && !s.canUseLoginItem && <p class="hint">{t("setLoginDevNote")}</p>}
          </>
        )}
      </div>
    </Overlay>
  );
}

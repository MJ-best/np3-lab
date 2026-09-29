import { useEffect, useState } from "preact/hooks";
import { autoBackup, setAutoBackup } from "../cards";
import { lang, setLang, t } from "../i18n";
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
        <label class="toggle">
          <input type="checkbox" checked={autoBackup.value} onChange={(e) => setAutoBackup(e.currentTarget.checked)} />
          {t("setAutoBackup")}
        </label>
        <label class="toggle">
          <input type="checkbox" checked={s?.openOnCard ?? true} disabled={!s} onChange={(e) => update({ openOnCard: e.currentTarget.checked })} />
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
        <div class="segmented" role="radiogroup" aria-label="Language">
          <button role="radio" aria-checked={lang.value === "ko"} class={lang.value === "ko" ? "active" : ""} onClick={() => setLang("ko")}>
            한국어
          </button>
          <button role="radio" aria-checked={lang.value === "en"} class={lang.value === "en" ? "active" : ""} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </div>
    </Overlay>
  );
}

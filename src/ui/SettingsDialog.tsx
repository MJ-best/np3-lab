import { useEffect, useRef, useState } from "preact/hooks";
import { account, accountsEnabled, deleteAccount, guest, lastSynced, signOutAccount, syncNow, syncStatus } from "../account";
import { autoBackup, setAutoBackup } from "../cards";
import { exportAllRecipes } from "../exportAll";
import { lang, setLang, t, LANGS } from "../i18n";
import { isAndroid, native, type NativeSettings } from "../native";
import { downloadText } from "../pack/download";
import { entitlement, isPro, manageSubscription, proPageUrl } from "../pro";
import { askConfirm, exportBackup, importBackup, showToast } from "../state";
import { CameraSelect } from "./CameraGuide";
import { IconClose } from "./Icons";
import { Overlay } from "./RecipeDetail";

/** Pro status: the paid-until date and subscription management, or where to learn about Pro. */
function ProRow() {
  const e = entitlement.value;
  const until = e?.proUntil ? new Date(e.proUntil).toLocaleDateString(lang.value) : "";
  return (
    <div class="setting-row">
      <span>{isPro.value ? t("proActiveUntil", { date: until }) : t("proInactive")}</span>
      {isPro.value || e?.status ? (
        <button onClick={() => void manageSubscription()}>{t("proManage")}</button>
      ) : (
        <a class="button" href={proPageUrl()} target="_blank" rel="noopener">
          {t("proSeePlans")}
        </a>
      )}
    </div>
  );
}

/** Hosted web version: optional account that syncs My recipes, the card list and the camera. */
function AccountRows({ onClose }: { onClose: () => void }) {
  const me = account.value;
  const status = syncStatus.value;
  const time = lastSynced.value ? new Date(lastSynced.value).toLocaleTimeString(lang.value, { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div class="account">
      <div class="setting-row">
        <span>{t("account")}</span>
        {me ? (
          <button
            onClick={() => {
              onClose();
              void signOutAccount();
            }}
          >
            {t("signOut")}
          </button>
        ) : (
          <button
            class="primary"
            onClick={() => {
              onClose();
              guest.value = false;
            }}
          >
            {t("signInOrUp")}
          </button>
        )}
      </div>
      {me && (
        <p class="hint">
          {me.email}
          {" · "}
          {status === "syncing" && t("syncSyncing")}
          {status === "ok" && t("syncOk", { time })}
          {status === "error" && (
            <>
              {t("syncError")}{" "}
              <button class="link" onClick={() => void syncNow()}>
                {t("syncRetry")}
              </button>
            </>
          )}
        </p>
      )}
      {me && <ProRow />}
      <p class="hint">
        {t("syncHint")}{" "}
        <a href="privacy.html" target="_blank" rel="noopener">
          {t("privacyPolicy")}
        </a>
      </p>
      {me && (
        <button
          class="danger ghost"
          onClick={async () => {
            if (!(await askConfirm({ message: t("deleteAccountConfirm"), confirmLabel: t("deleteAccount"), danger: true }))) return;
            onClose();
            void deleteAccount();
          }}
        >
          {t("deleteAccount")}
        </button>
      )}
    </div>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<NativeSettings | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void native?.getSettings().then(setS);
  }, []);
  const update = async (
    patch: Partial<Pick<NativeSettings, "openOnCard" | "openAtLogin">>,
  ) => {
    if (native) setS(await native.setSettings(patch));
  };
  return (
    <Overlay onClose={onClose}>
      <div
        class="dialog settings"
        role="dialog"
        aria-modal="true"
        aria-label={t("settingsTitle")}
      >
        <div class="detail-head">
          <h2>{t("settingsTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <div class="ios-group">
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
          <div class="setting-row">
            <span>{t("cameraModel")}</span>
            <CameraSelect />
          </div>
        </div>
        {accountsEnabled && <AccountRows onClose={onClose} />}
        {native && (
          <div class="ios-group">
            <label class="toggle switch-row">
              <span>{t("setAutoBackup")}</span>
              <input
                class="ios-switch"
                type="checkbox"
                checked={autoBackup.value}
                onChange={(e) => setAutoBackup(e.currentTarget.checked)}
              />
            </label>
            {!isAndroid && (
              <>
                <label class="toggle switch-row">
                  <span>{t("setOpenOnCard")}</span>
                  <input
                    class="ios-switch"
                    type="checkbox"
                    checked={s?.openOnCard ?? true}
                    disabled={!s}
                    onChange={(e) =>
                      update({ openOnCard: e.currentTarget.checked })
                    }
                  />
                </label>
                <label class="toggle switch-row">
                  <span>{t("setOpenAtLogin")}</span>
                  <input
                    class="ios-switch"
                    type="checkbox"
                    checked={s?.openAtLogin ?? true}
                    disabled={!s || !s.canUseLoginItem}
                    onChange={(e) =>
                      update({ openAtLogin: e.currentTarget.checked })
                    }
                  />
                </label>
                {s && !s.canUseLoginItem && (
                  <p class="hint ios-group-hint">{t("setLoginDevNote")}</p>
                )}
              </>
            )}
          </div>
        )}
        <div class="ios-group ios-action-group">
          <button type="button" class="ios-group-btn" onClick={() => void exportAllRecipes()}>
            {t("exportAll")}
          </button>
          <button type="button" class="ios-group-btn" onClick={() => downloadText(exportBackup(), "np3-lab-backup.json")}>
            {t("backupExport")}
          </button>
          <button type="button" class="ios-group-btn" onClick={() => backupInput.current?.click()}>
            {t("backupImport")}
          </button>
          <input
            ref={backupInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              input.value = "";
              if (!file) return;
              try {
                showToast(t("backupRestored", { n: importBackup(await file.text()) }), "ok");
              } catch {
                showToast(t("backupInvalid"), "error");
              }
            }}
          />
        </div>
        {isAndroid && (
          <div class="settings-about">
            <strong>{t("aboutApp")}</strong>
            <p class="hint">{t("unofficial")}</p>
            <p class="hint">{t("creditsMobile")}</p>
          </div>
        )}
      </div>
    </Overlay>
  );
}

import { useRef } from "preact/hooks";
import { t, type MessageKey } from "../i18n";
import { isDesktop } from "../native";
import { canUseCardFolder, pickCardFolder, readNp3Files } from "../pack/cardWriter";
import { commitImport, importSession, openImport, showToast, updateImportEntry, type ImportEntry } from "../state";
import { Overlay } from "./RecipeDetail";

const STATUS_KEYS: Record<ImportEntry["status"], MessageKey> = {
  new: "statusNew",
  duplicate: "statusDuplicate",
  "no-preview": "statusNoPreview",
  invalid: "statusInvalid",
};

export async function np3FromFiles(files: File[]): Promise<{ name: string; bytes: Uint8Array }[]> {
  const np3 = files.filter((f) => /\.np3$/i.test(f.name));
  return Promise.all(np3.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
}

/** Read every NP3 in a card's CUSTOMPC folder. Resolves to null if the user cancelled. */
export async function np3FromCard(): Promise<{ name: string; bytes: Uint8Array }[] | null> {
  try {
    const files = await readNp3Files(await pickCardFolder("read"));
    if (files.length === 0) showToast(t("cardNoFiles"), "warn");
    return files;
  } catch (err) {
    if ((err as DOMException)?.name !== "AbortError") showToast(t("writeFailed", { msg: String((err as Error)?.message ?? err) }), "error");
    return null;
  }
}

function CloudGuide() {
  return (
    <div class="cloud-guide">
      <p>{t("cloudIntro")}</p>
      <ol>
        <li>{t("cloudStep1")}</li>
        <li>{t("cloudStep2")}</li>
        <li>{t("cloudStep3")}</li>
        <li>{t(isDesktop ? "cloudStep4Desktop" : "cloudStep4")}</li>
        <li>{t("cloudStep5")}</li>
      </ol>
      <p class="hint">{t("cloudNote")}</p>
      <p class="hint warn-text">{t("cloudRights")}</p>
    </div>
  );
}

export function ImportDialog() {
  const fileRef = useRef<HTMLInputElement>(null);
  const session = importSession.value;
  if (!session) return null;
  const cloud = session.mode === "imaging-cloud";
  const selected = session.entries.filter((e) => e.selected && e.status !== "invalid");
  const close = () => (importSession.value = null);

  return (
    <Overlay onClose={close}>
      <div class="dialog wide" role="dialog" aria-modal="true" aria-label={t(cloud ? "importTitleCloud" : "importTitleFile")}>
        <div class="detail-head">
          <h2>{t(cloud ? "importTitleCloud" : "importTitleFile")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={close}>
            ✕
          </button>
        </div>
        {cloud && <CloudGuide />}

        <div class="button-row">
          {!isDesktop && canUseCardFolder() && (
            <button
              onClick={async () => {
                const files = await np3FromCard();
                if (files) openImport(session.mode, files);
              }}
            >
              💾 {t("readCard")}
            </button>
          )}
          <button onClick={() => fileRef.current?.click()}>{t("pickFiles")}</button>
          <input
            ref={fileRef}
            type="file"
            accept=".np3,.NP3"
            multiple
            hidden
            onChange={async (e) => {
              const input = e.currentTarget;
              openImport(session.mode, await np3FromFiles(Array.from(input.files ?? [])));
              input.value = "";
            }}
          />
        </div>
        {!isDesktop && !canUseCardFolder() && <p class="hint">{t("safariCardHint")}</p>}

        {session.entries.length === 0 ? (
          <p class="empty small-empty">{t("importEmpty")}</p>
        ) : (
          <ul class="review-list">
            {session.entries.map((e) => (
              <li key={e.key} class={e.status}>
                <input
                  type="checkbox"
                  checked={e.selected}
                  disabled={e.status === "invalid"}
                  onChange={(ev) => updateImportEntry(e.key, { selected: ev.currentTarget.checked })}
                  aria-label={e.fileName}
                />
                <div class="review-main">
                  <input
                    class="review-title"
                    value={e.title}
                    disabled={e.status === "invalid"}
                    onInput={(ev) => updateImportEntry(e.key, { title: ev.currentTarget.value })}
                  />
                  <span class="review-meta mono">
                    {e.fileName}
                    {e.npName && ` · ${e.npName}`}
                  </span>
                </div>
                <span class={`badge status-${e.status}`}>{t(STATUS_KEYS[e.status])}</span>
              </li>
            ))}
          </ul>
        )}

        {cloud && (
          <label class="field">
            <span>{t("creatorField")}</span>
            <input
              value={session.author}
              onInput={(e) => (importSession.value = { ...session, author: e.currentTarget.value })}
            />
          </label>
        )}

        <div class="button-row end">
          <button class="ghost" onClick={close}>
            {t("cancel")}
          </button>
          <button class="primary" disabled={selected.length === 0} onClick={() => commitImport()}>
            {t("importSelected", { n: selected.length })}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

import { useState } from "preact/hooks";
import { t, tx } from "../i18n";
import { canUseCardFolder, pickCardFolder, writeRecipesToCard } from "../pack/cardWriter";
import { downloadBytes } from "../pack/download";
import { MAX_PER_CARD, chunk, planCardFiles } from "../pack/naming";
import { buildZip, zipFileName } from "../pack/zip";
import { CameraGuide } from "./CameraGuide";
import { cartRecipes, clearCart, detailId, moveInCart, naming, removeFromCart, route, setNaming, showToast } from "../state";

interface Outcome {
  kind: "card" | "zip";
  lines: string[];
}

/** How to load recipes on the camera, plus how to use the ZIP on a Mac (browser build). */
function LoadGuide() {
  return (
    <div class="panel guide">
      <CameraGuide />
      <h3>{t("macZipTitle")}</h3>
      <ol>
        <li>{t("macZip1")}</li>
        <li>{t("macZip2")}</li>
        <li>{t("macZip3")}</li>
        <li>{t("macZip4")}</li>
      </ol>
    </div>
  );
}

export function Cart() {
  const items = cartRecipes.value;
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const direct = canUseCardFolder();
  // File names as they will appear in the ZIP (one CARD-n folder per 99 recipes).
  const groups = chunk(items, MAX_PER_CARD);
  const previewNames = groups.flatMap((group, ci) =>
    planCardFiles(group, { mode: naming.value }).files.map((f) => (groups.length > 1 ? `CARD-${ci + 1}/` : "") + f.fileName),
  );

  const writeCard = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const folder = await pickCardFolder("readwrite");
      if (!folder.looksLikeCard && !confirm(t("notACard"))) return;
      const res = await writeRecipesToCard(folder, items, naming.value);
      const lines = [t("writeDone", { n: res.written.length, path: folder.label })];
      if (res.existingCount > 0) lines.push(t("existingOnCard", { n: res.existingCount }));
      if (res.overflow.length > 0) lines.push(t("writeOverflow", { n: res.overflow.length }));
      lines.push(...res.written.map((f) => `${f.fileName} — ${f.recipe.npName}`));
      setOutcome({ kind: "card", lines });
      showToast(lines[0], res.overflow.length ? "warn" : "ok");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        showToast(t("writeFailed", { msg: String((err as Error)?.message ?? err) }), "error", 8000);
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const { data, cards } = await buildZip(items, { mode: naming.value });
      downloadBytes(data, zipFileName(), "application/zip");
      const lines = [t("zipDone")];
      if (cards.length > 1) lines.push(t("over99"));
      setOutcome({ kind: "zip", lines });
      showToast(t("zipDone"), "ok");
    } catch (err) {
      showToast(t("writeFailed", { msg: String((err as Error)?.message ?? err) }), "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="cart">
      <section class="cart-list panel">
        <div class="cart-head">
          <h2>{t("cardTitle")}</h2>
          {items.length > 0 && (
            <>
              <span class="badge accent">{t("selectedCount", { n: items.length })}</span>
              <button class="link right" onClick={clearCart}>
                {t("clearAll")}
              </button>
            </>
          )}
        </div>
        {items.length === 0 ? (
          <div class="empty">
            <p>{t("cardEmpty")}</p>
            <button class="primary" onClick={() => (route.value = "gallery")}>
              {t("tabGallery")} →
            </button>
          </div>
        ) : (
          <ol class="cart-items">
            {items.map((r, i) => (
              <li key={r.id}>
                <span class="cart-file mono">{previewNames[i]}</span>
                <button class="cart-title" onClick={() => (detailId.value = r.id)}>
                  {tx(r.title)}
                  <code>{r.npName}</code>
                </button>
                <span class="cart-actions">
                  <button class="icon-btn" aria-label={t("moveUp")} disabled={i === 0} onClick={() => moveInCart(r.id, -1)}>
                    ↑
                  </button>
                  <button class="icon-btn" aria-label={t("moveDown")} disabled={i === items.length - 1} onClick={() => moveInCart(r.id, 1)}>
                    ↓
                  </button>
                  <button class="icon-btn" aria-label={t("remove")} onClick={() => removeFromCart(r.id)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        {items.length > MAX_PER_CARD && <p class="hint warn-text">{t("over99")}</p>}
      </section>

      <section class="cart-side">
        <div class="panel">
          <h3>{t("fileNaming")}</h3>
          <label class="radio">
            <input type="radio" name="naming" checked={naming.value === "piccon"} onChange={() => setNaming("piccon")} />
            {t("namingPiccon")}
          </label>
          <label class="radio">
            <input type="radio" name="naming" checked={naming.value === "name"} onChange={() => setNaming("name")} />
            {t("namingName")}
          </label>
          <div class="button-col">
            {direct && (
              <button class="primary big" disabled={busy || items.length === 0} onClick={writeCard}>
                💾 {t("writeToCard")}
              </button>
            )}
            {direct && <p class="hint">{t("writeHint")}</p>}
            <button class={direct ? "big" : "primary big"} disabled={busy || items.length === 0} onClick={downloadZip}>
              ⬇ {t("downloadZip")}
            </button>
            {!direct && <p class="hint">{t("chromeHint")}</p>}
          </div>
          {outcome && (
            <div class={`outcome ${outcome.kind}`}>
              {outcome.lines.map((l, i) => (
                <p key={i} class={i === 0 ? "" : "mono small"}>
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
        <LoadGuide />
      </section>
    </div>
  );
}

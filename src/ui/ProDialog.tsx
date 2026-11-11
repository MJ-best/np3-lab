import { guest } from "../account";
import { t } from "../i18n";
import { checkoutBusy, proPageUrl, startCheckout } from "../pro";
import { shareNeeds } from "../share";
import { Overlay } from "./RecipeDetail";

/** What sharing needs first: an account, or Pro (with what Pro is and what it costs). */
export function ProDialog() {
  const need = shareNeeds.value;
  if (!need) return null;
  const close = () => (shareNeeds.value = null);
  return (
    <Overlay onClose={close}>
      <div class="dialog pro-dialog" role="dialog" aria-modal="true" aria-label={t(need === "pro" ? "proUpsellTitle" : "shareSignInTitle")}>
        <div class="detail-head">
          <h2>{t(need === "pro" ? "proUpsellTitle" : "shareSignInTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={close}>
            ✕
          </button>
        </div>
        {need === "signIn" ? (
          <>
            <p>{t("shareSignInBody")}</p>
            <div class="button-row">
              <button
                class="primary"
                onClick={() => {
                  close();
                  // Back to the sign-up page; the recipe stays here for after.
                  guest.value = false;
                }}
              >
                {t("signInOrUp")}
              </button>
              <button onClick={close}>{t("cancel")}</button>
            </div>
          </>
        ) : (
          <>
            <p>{t("proUpsellBody")}</p>
            <ul class="pro-points">
              <li>{t("proPointShare")}</li>
              <li>{t("proPointOpen")}</li>
              <li>{t("proPointFree")}</li>
            </ul>
            <p class="pro-price">{t("proPrice")}</p>
            <div class="button-row">
              <button class="primary" disabled={checkoutBusy.value} onClick={() => void startCheckout()}>
                {checkoutBusy.value ? "…" : t("proStart")}
              </button>
              <a class="button" href={proPageUrl()} target="_blank" rel="noopener">
                {t("proLearnMore")}
              </a>
            </div>
            <p class="hint">{t("proBilling")}</p>
          </>
        )}
      </div>
    </Overlay>
  );
}

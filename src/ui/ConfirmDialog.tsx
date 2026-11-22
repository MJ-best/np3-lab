import { t } from "../i18n";
import { haptic } from "../native";
import { confirmModal, resolveConfirm } from "../state";
import { Overlay } from "./RecipeDetail";

/** Themed confirmation modal replacing native browser window.confirm() dialogs. */
export function ConfirmDialog() {
  const req = confirmModal.value;
  if (!req) return null;
  const close = (ok: boolean) => {
    if (ok) haptic(req.danger ? "warning" : "light");
    resolveConfirm(ok);
  };
  return (
    <Overlay onClose={() => close(false)}>
      <div class="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-label={req.confirmLabel ?? t("confirmOk")}>
        <p class="confirm-message">{req.message}</p>
        <div class="button-row end">
          <button class="ghost" onClick={() => close(false)}>
            {t("cancel")}
          </button>
          <button class={req.danger ? "danger confirm-active" : "primary"} onClick={() => close(true)} autoFocus>
            {req.confirmLabel ?? t("confirmOk")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

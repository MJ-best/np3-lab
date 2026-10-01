import { App as CapApp } from "@capacitor/app";
import { route } from "./state";

/**
 * Android back button: close the top dialog, then return to the card tab, then leave the app.
 * Dialogs already close on Escape (Overlay, the photo lightbox), so back sends them one.
 */
export function handleAndroidBack() {
  void CapApp.addListener("backButton", () => {
    if (document.querySelector(".overlay, .lightbox")) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else if (route.value !== "card") {
      route.value = "card";
    } else {
      // Keep the app (and the card listing) alive, like the home button.
      void CapApp.minimizeApp();
    }
  });
}

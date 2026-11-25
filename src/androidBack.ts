import { App as CapApp } from "@capacitor/app";
import { closeEditor, route } from "./state";

/**
 * Android back button: close the top dialog, exit the editor, return to Home, then leave the app.
 * Dialogs already close on Escape (Overlay, the photo lightbox), so back sends them one.
 */
export function handleAndroidBack() {
  void CapApp.addListener("backButton", () => {
    if (document.querySelector(".overlay, .lightbox")) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else if (route.value === "editor") {
      void closeEditor();
    } else if (route.value !== "home") {
      route.value = "home";
    } else {
      // Keep the app (and the card listing) alive, like the home button.
      void CapApp.minimizeApp();
    }
  });
}

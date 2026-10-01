import { t } from "../i18n";
import { androidNative, nativeErrorMessage } from "../native";
import { showToast } from "../state";

/**
 * Save bytes through the browser's normal download flow (works from file:// too).
 * Android's WebView ignores <a download>, so the app shows the system "Save as" dialog instead.
 */
export function downloadBytes(data: Uint8Array | Blob, fileName: string, mime = "application/octet-stream"): void {
  const blob = data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>], { type: mime });
  if (androidNative) {
    void saveOnAndroid(blob, fileName, blob.type || mime);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function saveOnAndroid(blob: Blob, fileName: string, mime: string) {
  try {
    if (await androidNative!.saveFile(new Uint8Array(await blob.arrayBuffer()), fileName, mime)) {
      showToast(t("fileSaved", { name: fileName }), "ok");
    }
  } catch (err) {
    showToast(t("writeFailed", { msg: nativeErrorMessage(err) }), "error", 8000);
  }
}

export function downloadText(text: string, fileName: string): void {
  downloadBytes(new Blob([text], { type: "application/json;charset=utf-8" }), fileName);
}

/** Save bytes through the browser's normal download flow (works from file:// too). */
export function downloadBytes(data: Uint8Array | Blob, fileName: string, mime = "application/octet-stream"): void {
  const blob = data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>], { type: mime });
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

export function downloadText(text: string, fileName: string): void {
  downloadBytes(new Blob([text], { type: "application/json;charset=utf-8" }), fileName);
}

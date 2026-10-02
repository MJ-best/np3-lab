import { createHash } from "node:crypto";

/** Hosts the page may talk to: GitHub and jsDelivr for the community recipes, nothing else. */
const CONNECT_SRC = ["https://api.github.com", "https://data.jsdelivr.com", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com", "data:"];

/**
 * Content Security Policy for the single-file build. Scripts are allowed by hash, so only
 * the bundled code runs (no injected or remote script); network access is limited to the
 * recipe sources; images may only come from the file itself, data: and blob: URLs.
 */
export function withCsp(html) {
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((m) => m[1].length > 0)
    .map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
  const policy = [
    "default-src 'none'",
    `script-src ${hashes.join(" ")}`,
    "style-src 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${CONNECT_SRC.join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
}

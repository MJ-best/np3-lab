/// <reference types="vitest/config" />
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { withCsp } from "./scripts/csp.mjs";

const OUTPUT_NAME = "NP3-Lab.html";

/** Add the CSP, then rename dist/index.html so the single-file build has a self-explanatory name. */
function renameOutput(): Plugin {
  return {
    name: "np3-lab:rename-output",
    apply: "build",
    closeBundle() {
      // The Android build keeps index.html: Capacitor loads it from dist/.
      if (process.env.CAP_BUILD) return;
      const from = resolve(import.meta.dirname, "dist/index.html");
      if (!existsSync(from)) return;
      writeFileSync(from, withCsp(readFileSync(from, "utf8")));
      renameSync(from, resolve(import.meta.dirname, "dist", OUTPUT_NAME));
      console.log(`\n→ dist/${OUTPUT_NAME}  (open this file in Chrome / Safari)\n`);
    },
  };
}

export default defineConfig({
  // Relative paths so the built file also works when opened via file://
  base: "./",
  plugins: [preact(), viteSingleFile({ removeViteModuleLoader: true }), renameOutput()],
  // Recipe files dropped into recipes/*.np3 are bundled as assets.
  assetsInclude: ["**/*.np3", "**/*.NP3"],
  build: {
    // Inline everything (sample photos, NP3 files) so the app is one portable HTML file.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 50_000,
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

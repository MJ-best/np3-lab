// Runs the Vite dev server and the Electron shell together (hot reload for the UI).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const server = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: true } });
await server.listen();
const url = "http://127.0.0.1:5173/";
console.log(`[dev] UI at ${url}`);

const electron = spawn(require("electron"), ["."], {
  stdio: "inherit",
  env: { ...process.env, NIKONPCLAB_DEV_URL: url },
});
electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

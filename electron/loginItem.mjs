// Start-at-login support. On macOS a LaunchAgent starts the app with an explicit
// flag, so a login launch can be told apart from the user opening the app
// (Electron's wasOpenedAtLogin is not available on macOS 13+).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const LOGIN_FLAG = "--launched-at-login";
export const AGENT_LABEL = "io.github.mj-best.np3lab.login";
/** Labels used by earlier versions (the app was called "NikonPC Lab"). */
const LEGACY_LABELS = ["io.github.nikonpclab.login"];

const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** LaunchAgent that opens the app in the background at login. */
export function launchAgentPlist(appBundlePath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-g</string>
    <string>-a</string>
    <string>${xml(appBundlePath)}</string>
    <string>--args</string>
    <string>${LOGIN_FLAG}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
}

/** ".../NP3 Lab.app/Contents/MacOS/NP3 Lab" → ".../NP3 Lab.app" */
export function appBundleFromExecPath(execPath) {
  return resolve(execPath, "..", "..", "..");
}

export function agentPath(homeDir, label = AGENT_LABEL) {
  return join(homeDir, "Library", "LaunchAgents", `${label}.plist`);
}

/** Create or remove the LaunchAgent. */
export function setMacLoginAgent(enabled, { homeDir, execPath }) {
  for (const label of LEGACY_LABELS) rmSync(agentPath(homeDir, label), { force: true });
  const path = agentPath(homeDir);
  if (!enabled) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, launchAgentPlist(appBundleFromExecPath(execPath)));
}

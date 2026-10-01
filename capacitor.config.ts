import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.mj_best.np3lab",
  appName: "NP3 Lab",
  webDir: "dist",
  android: {
    // The single-file build inlines photos and recipes; nothing is loaded from the network at start-up.
    allowMixedContent: false,
  },
};

export default config;

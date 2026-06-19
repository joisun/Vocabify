import path from "path";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    action: {
      default_title: "Click to open panel",
    },
    host_permissions: ["*://*/*"],
    permissions: ["storage", "identity", "scripting"],
  },
  dev: {
    server: {
      port: 45678,
      strictPort: true,
    },
  },
  webExt: {
    startUrls: ["https://www.tool-ui.com/docs/overview"],
    chromiumArgs: [
      "--enable-unsafe-extension-debugging",
      "--remote-debugging-port=9222",
      // Use a persistent user data directory to preserve login state and storage
      "--user-data-dir=./.wxt/chrome-data",
    ],
  },
  vite: () => ({
    // Override config here, same as `defineConfig({ ... })`
    // inside vite.config.ts files
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});

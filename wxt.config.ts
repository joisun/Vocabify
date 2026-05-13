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
    permissions: ["storage", "identity"],

  },
  dev: {
    server: {
      port: 45678,
    },
  },
  webExt: {
    startUrls: ["https://www.tool-ui.com/docs/overview"],
    chromiumArgs: ["--enable-unsafe-extension-debugging"],
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

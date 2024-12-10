import path from "path";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    action: {
      default_title: "Click to open panel",
    },
    host_permissions: ["*://*/*"],
    permissions: ["storage", "sidePanel"],
  },
  dev: {
    server: {
      port: 3000,
    },
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

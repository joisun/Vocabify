import path from "path";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // 这个key仅测试环境有效，它用于浏览器每次安装(所有设备)都会生成固定的 extension id
    key: 'thisissolidextensionidfordevvvvv',
    action: {
      default_title: "Click to open panel",
    },
    host_permissions: ["*://*/*"],
    permissions: ["storage", "sidePanel", "identity"],

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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const cloudProxy = {
  target: "http://127.0.0.1:8787",
  changeOrigin: true,
  configure(proxy: any) {
    proxy.on("proxyReq", (outgoing: any, incoming: any) => {
      if (incoming.headers.origin === `http://${incoming.headers.host}`) outgoing.setHeader("Origin", "http://127.0.0.1:8787");
    });
  }
};

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": cloudProxy } },
  preview: { proxy: { "/api": cloudProxy } },
  build: {
    outDir: "dist/client",
    sourcemap: true
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom"
  }
});

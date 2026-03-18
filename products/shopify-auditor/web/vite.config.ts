import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Shopify CLI injects SHOPIFY_APP_URL and a PORT for the dev server
const host = new URL(
  process.env.SHOPIFY_APP_URL || "http://localhost:3000"
).hostname;

const port = Number(process.env.PORT || 3000);

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  server: {
    port,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 64999,
    },
    allowedHosts: true,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
});

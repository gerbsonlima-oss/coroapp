import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["liturgia-plus-logo.png", "favicon.png"],
      manifest: {
        name: "Liturgia+ - Gestão de Coral",
        short_name: "Liturgia+",
        description: "App para gestão de repertório e liturgia de coral",
        theme_color: "#1a1a2e",
        background_color: "#0f0f1e",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "liturgia-plus-icon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "liturgia-plus-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "liturgia-plus-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          },
        ],
      },
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
}));

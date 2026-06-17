import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "src/server.ts" },
    }),
    nitro({
      rollupConfig: {
        external: ["undici"],
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    // In production, restrict CORS via CORS_ORIGINS env var (comma-separated)
    // In development, allow all origins
    cors: process.env.NODE_ENV === "production"
      ? { origin: process.env.CORS_ORIGINS ?? false, credentials: true }
      : true,
  },
});

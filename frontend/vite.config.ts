import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development: proxy /api/* to local backend (avoids CORS + cookie issues)
// In production: Vercel rewrites handle /api/* → Render backend (see vercel.json)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

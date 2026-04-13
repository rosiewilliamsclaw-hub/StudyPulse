import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api/* requests to the backend during development
// This keeps the frontend unaware of the backend port and avoids CORS issues
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

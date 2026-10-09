import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev only: bind to loopback and proxy /api to the FastAPI backend
// (which itself is bound to 127.0.0.1:8000). No CORS configuration needed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
});
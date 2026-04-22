import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_PATH = "/vqe" if deploying to github.io/vqe, else "/"
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});

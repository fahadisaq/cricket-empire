import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Share the engine/ai/data/world code from ../src directly.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "../src"),
    },
  },
  server: { port: 5180 },
});

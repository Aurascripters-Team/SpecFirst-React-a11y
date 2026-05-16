import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "src/specfirst-demo",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    fs: {
      allow: [projectRoot],
    },
  },
});

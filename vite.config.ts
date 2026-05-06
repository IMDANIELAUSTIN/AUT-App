import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("dompurify") || id.includes("canvg")) {
            return "pdf";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "react";
          }
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("sonner")) {
            return "ui";
          }
          return "vendor";
        },
      },
    },
  },
  base: "./",
});

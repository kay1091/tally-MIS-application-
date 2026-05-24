import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["apexcharts", "react-apexcharts"],
          spreadsheet: ["exceljs"],
          vendor: ["react", "react-dom", "lucide-react"]
        }
      }
    }
  },
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  }
});

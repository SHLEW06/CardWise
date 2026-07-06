import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite build → outputs to dist/, which Firebase Hosting serves (see firebase.json).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.js", "src/**/*.test.jsx"],
    /* Default fast node environment; UI tests opt into jsdom via a
       `// @vitest-environment jsdom` header on individual files, so the
       existing pure-node engine tests stay quick. */
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    /* Split the heaviest vendor chunks so the initial JS bundle stays under
       the size-warning threshold without changing what ships. */
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
          ],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: { port: 5173, open: true },
});

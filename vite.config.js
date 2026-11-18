import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const writeManifest = () => {
  try { execFileSync(process.execPath, [resolve(process.cwd(), "scripts/build-card-art-manifest.mjs")], { stdio: "ignore" }); } catch { /* keep the last manifest */ }
};

/* Card photos (docs/REDESIGN_SPEC.md §16.1). Root cause of "every card shows
   the designed face": src/data/cardArtManifest.js was a one-off snapshot
   written only by the predev/pretest hooks. A server started without them
   (`npx vite`, an IDE runner) or left running while art was dropped into
   public/cards/ kept an empty or stale manifest, so `card.image.localImage`
   was null everywhere. Vite now writes the manifest itself at startup and
   rewrites it whenever a file in public/cards/ is added or removed; the
   import then hot-reloads. */
function cardArtManifest() {
  const dir = resolve(process.cwd(), "public/cards");
  return {
    name: "cardwise-card-art-manifest",
    buildStart() { writeManifest(); },
    configureServer(server) {
      server.watcher.add(dir);
      const onChange = (file) => { if (file.startsWith(dir)) writeManifest(); };
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}

/* Fonts (§16.2): preload the two most-used weights, but only when the licensed
   files are actually in public/fonts/ — a preload of a missing file is a
   wasted request and a console warning. */
const PRELOAD_FONTS = ["PPEditorialNew-Regular.woff2", "PPNeueMontreal-Book.woff2"];
function fontPreload() {
  return {
    name: "cardwise-font-preload",
    transformIndexHtml() {
      return PRELOAD_FONTS.filter((f) => existsSync(resolve(process.cwd(), "public/fonts", f))).map((f) => ({
        tag: "link", injectTo: "head",
        attrs: { rel: "preload", href: `/fonts/${f}`, as: "font", type: "font/woff2", crossorigin: "" },
      }));
    },
  };
}

// Vite build → outputs to dist/, which Firebase Hosting serves (see firebase.json).
export default defineConfig({
  plugins: [cardArtManifest(), fontPreload(), react()],
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

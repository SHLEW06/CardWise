/* Phase 0 — the connector's dev token must never reach the public bundle. */
import { it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { findLeaks, parseEnv } from "../../scripts/check-dist-secrets.mjs";

const SRC = resolve(__dirname, "..");
function* sources(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "__tests__") yield* sources(p); }
    else if (/\.(jsx?|mjs)$/.test(n)) yield p;
  }
}
/* Code only: block and line comments removed before matching. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

it("no source reads import.meta.env as a whole object (Vite would inline every VITE_ value)", () => {
  const bad = [];
  for (const f of sources(SRC)) {
    const lines = code(readFileSync(f, "utf8")).split("\n");
    lines.forEach((l, i) => { if (/import\.meta\.env(?!\??\.[A-Za-z_])/.test(l)) bad.push(`${f.slice(SRC.length + 1)}:${i + 1}`); });
  }
  expect(bad).toEqual([]);
});

it("the connector token is read only behind import.meta.env.DEV", () => {
  const text = code(readFileSync(join(SRC, "connector/index.js"), "utf8"));
  const uses = text.split("\n").filter((l) => l.includes("VITE_CONNECTOR_TOKEN"));
  expect(uses.length).toBeGreaterThan(0);
  for (const l of uses) expect(l).toMatch(/import\.meta\.env\.DEV\s*\?/);
});

it("postbuild check finds the token name and .env.local values, and passes a clean build", () => {
  const dir = mkdtempSync(join(tmpdir(), "cw-dist-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<html></html>");
  writeFileSync(join(dir, "assets/a.js"), "const x = 1;");
  const env = parseEnv("# comment\nVITE_CONNECTOR_TOKEN=s3cret-dev-token-123\nVITE_CONNECTOR_URL=\"http://127.0.0.1:8787\"\nVITE_FB_API_KEY=AIzaPublicKey\n");
  expect(env).toMatchObject({ VITE_CONNECTOR_TOKEN: "s3cret-dev-token-123", VITE_CONNECTOR_URL: "http://127.0.0.1:8787" });
  writeFileSync(join(dir, "assets/url.js"), 'const u="http://127.0.0.1:8787";');   // loopback URL: not a secret
  expect(findLeaks(dir, env)).toEqual([]);
  expect(findLeaks(dir, { VITE_CONNECTOR_URL: "https://my-tunnel.example.com" })).toEqual([]);
  writeFileSync(join(dir, "assets/remote.js"), 'const u="https://my-tunnel.example.com";');
  expect(findLeaks(dir, { VITE_CONNECTOR_URL: "https://my-tunnel.example.com" })).toEqual([{ file: join("assets", "remote.js"), what: "the value of VITE_CONNECTOR_URL from .env.local" }]);
  writeFileSync(join(dir, "assets/b.js"), 'var t="s3cret-dev-token-123";');
  writeFileSync(join(dir, "assets/c.js"), "env.VITE_CONNECTOR_TOKEN");
  writeFileSync(join(dir, "assets/d.js"), 'apiKey:"AIzaPublicKey"');   // Firebase web config is public by design
  const leaks = findLeaks(dir, env);
  expect(leaks).toEqual(expect.arrayContaining([
    { file: join("assets", "b.js"), what: "the value of VITE_CONNECTOR_TOKEN from .env.local" },
    { file: join("assets", "c.js"), what: "the text VITE_CONNECTOR_TOKEN" },
  ]));
  expect(leaks.some((l) => l.file.endsWith("d.js"))).toBe(false);
});

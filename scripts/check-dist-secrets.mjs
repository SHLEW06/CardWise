#!/usr/bin/env node
/* Post-build guard: the public bundle must not contain the connector's dev
   token. Fails (exit 1) if any file in dist/ contains the text
   "VITE_CONNECTOR_TOKEN" or any value set in .env.local. Values are never
   printed, only the variable name and the file. Runs as `postbuild`. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* Firebase web config is public by design (it identifies the project; access
   is enforced by Firebase rules), so .env.local VITE_FB_* values may ship. */
const PUBLIC_BY_DESIGN = /^VITE_FB_/;
const MIN_LENGTH = 6;   // shorter values ("true", "1") would match by chance
/* A URL on this machine (the connector's http://127.0.0.1:8787 default, which
   the source already contains) reveals nothing. */
const isLoopbackUrl = (v) => { try { return /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/.test(new URL(v).hostname); } catch { return false; } };

/** KEY=value pairs from a dotenv file's text (comments and blanks skipped). */
export function parseEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

/** → [{ file, what }] for every forbidden string found under `dist`. */
export function findLeaks(dist, env = {}) {
  const needles = [{ what: "the text VITE_CONNECTOR_TOKEN", text: "VITE_CONNECTOR_TOKEN" }];
  for (const [k, v] of Object.entries(env)) {
    if (PUBLIC_BY_DESIGN.test(k) || !v || v.length < MIN_LENGTH || isLoopbackUrl(v)) continue;
    needles.push({ what: `the value of ${k} from .env.local`, text: v });
  }
  const out = [];
  for (const f of files(dist)) {
    const body = readFileSync(f, "latin1");
    for (const n of needles) if (body.includes(n.text)) out.push({ file: relative(dist, f), what: n.what });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dist = resolve(root, process.argv[2] || "dist");
  if (!existsSync(dist)) { console.error(`check-dist-secrets: ${dist} not found`); process.exit(1); }
  const envFile = join(root, ".env.local");
  const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const leaks = findLeaks(dist, env);
  if (leaks.length) {
    for (const l of leaks) console.error(`check-dist-secrets: ${l.file} contains ${l.what}`);
    console.error("Build output must not ship the connector token. Do not deploy this build.");
    process.exit(1);
  }
  console.log(`check-dist-secrets: dist/ is clean (${Object.keys(env).length} .env.local value(s) checked)`);
}

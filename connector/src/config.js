/* ============================================================================
   connector/src/config.js — all settings come from the environment.
   The connector refuses to start without a vault key and an API token, so a
   misconfigured server can never store bank sessions unencrypted or accept
   unauthenticated requests.
   ========================================================================== */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* Tiny .env loader (no dependency). Real env vars win over the file. */
function loadDotEnv(path = resolve(ROOT, ".env")) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const [, k, raw] = m;
    if (process.env[k] === undefined) process.env[k] = raw.replace(/^["']|["']$/g, "");
  }
}

export function loadConfig(env = process.env, { requireSecrets = true } = {}) {
  if (env === process.env) loadDotEnv();
  const cfg = {
    root: ROOT,
    host: env.CONNECTOR_HOST || "127.0.0.1",          // localhost only unless you deliberately change it
    port: Number(env.CONNECTOR_PORT || 8787),
    token: env.CONNECTOR_TOKEN || "",
    vaultKey: env.CARDWISE_VAULT_KEY || "",          // base64, 32 bytes
    dataDir: resolve(env.CONNECTOR_DATA_DIR || resolve(ROOT, "data")),
    chromePath: env.CHROME_PATH || "",
    chromeChannel: env.CHROME_CHANNEL || "",          // e.g. "chrome" to use installed Google Chrome
    headless: env.CONNECTOR_HEADLESS !== "false",
    allowedOrigins: (env.CONNECTOR_ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
      .split(",").map((s) => s.trim()).filter(Boolean),
    viewport: { width: 430, height: 860 },            // phone-shaped, like the "virtual phone" login
    loginTimeoutMs: Number(env.CONNECTOR_LOGIN_TIMEOUT_MS || 10 * 60 * 1000),
    mockbankUrl: env.MOCKBANK_URL || "http://127.0.0.1:8799",
  };
  if (requireSecrets) {
    if (!cfg.token || cfg.token.length < 24) throw new Error("CONNECTOR_TOKEN missing or too short (run: npm run keys)");
    const key = Buffer.from(cfg.vaultKey, "base64");
    if (key.length !== 32) throw new Error("CARDWISE_VAULT_KEY must be 32 bytes, base64 (run: npm run keys)");
  }
  return cfg;
}

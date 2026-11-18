#!/usr/bin/env node
/* Creates connector/.env with a random API token and vault key (once). */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envPath) && /CARDWISE_VAULT_KEY=\S+/.test(readFileSync(envPath, "utf8"))) {
  console.log(".env already has keys — not overwriting (losing the vault key makes saved sessions unreadable).");
  process.exit(0);
}
const lines = [
  "# CardWise connector — keep this file private. Never commit it.",
  `CONNECTOR_TOKEN=${randomBytes(32).toString("base64url")}`,
  `CARDWISE_VAULT_KEY=${randomBytes(32).toString("base64")}`,
  "CONNECTOR_HOST=127.0.0.1",
  "CONNECTOR_PORT=8787",
  "CHROME_CHANNEL=chrome",
  "# FIREBASE_PROJECT_ID=your-project-id   # set this to require real per-user sign-in",
  "",
];
writeFileSync(envPath, lines.join("\n"), { mode: 0o600 });
console.log("Wrote connector/.env (token + vault key). Put the same CONNECTOR_TOKEN in the app's .env.local as VITE_CONNECTOR_TOKEN for dev mode.");

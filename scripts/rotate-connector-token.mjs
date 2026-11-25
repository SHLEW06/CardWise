#!/usr/bin/env node
// Owner-invoked rotation only. Preserve the vault key and every other setting.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export function rotateConnectorToken(root) {
  const connector = resolve(root, "connector/.env"), app = resolve(root, ".env.local");
  if (!existsSync(connector)) throw new Error("Initialize connector/.env first with npm --prefix connector run keys; the vault encryption key must be preserved.");
  const oldConnector = readFileSync(connector, "utf8");
  if (!/^CARDWISE_VAULT_KEY=\S+/m.test(oldConnector)) throw new Error("No vault key found. Configure the connector before rotating its API token.");
  const token = randomBytes(32).toString("base64url");
  const patch = (text, key) => {
    const line = `${key}=${token}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    return re.test(text) ? text.replace(re,line) : text.trimEnd()+"\n"+line+"\n";
  };
  const newApp = patch(existsSync(app) ? readFileSync(app,"utf8") : "", "VITE_CONNECTOR_TOKEN");
  writeFileSync(app,newApp,{mode:0o600}); chmodSync(app,0o600);
  writeFileSync(connector,patch(oldConnector,"CONNECTOR_TOKEN"),{mode:0o600}); chmodSync(connector,0o600);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { rotateConnectorToken(resolve(dirname(fileURLToPath(import.meta.url)), "..")); console.log("Connector token rotated in both local files. Vault encryption key preserved. Restart the connector and dev server, then rebuild; redeploy only after approval."); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}

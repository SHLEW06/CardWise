import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rotateConnectorToken } from "../../scripts/rotate-connector-token.mjs";
it("rotates both token copies without changing vault encryption or unrelated values", () => {
  const root=mkdtempSync(join(tmpdir(),"cw-rotation-")); mkdirSync(join(root,"connector"));
  writeFileSync(join(root,"connector/.env"),"CONNECTOR_TOKEN=old\nCARDWISE_VAULT_KEY=preserve-this-key\nCONNECTOR_PORT=8787\n");
  writeFileSync(join(root,".env.local"),"VITE_CONNECTOR_TOKEN=old\nOTHER_SETTING=keep\n");
  rotateConnectorToken(root);
  const c=readFileSync(join(root,"connector/.env"),"utf8"),a=readFileSync(join(root,".env.local"),"utf8");
  const token=c.match(/^CONNECTOR_TOKEN=(.+)$/m)[1];
  expect(token).not.toBe("old"); expect(token.length).toBeGreaterThan(40);
  expect(a).toContain(`VITE_CONNECTOR_TOKEN=${token}`);
  expect(c).toContain("CARDWISE_VAULT_KEY=preserve-this-key\nCONNECTOR_PORT=8787");
  expect(a).toContain("OTHER_SETTING=keep");
});

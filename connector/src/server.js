/* ============================================================================
   connector/src/server.js — HTTP + WebSocket API the CardWise app talks to.
   ----------------------------------------------------------------------------
   GET    /health
   GET    /v1/banks                      banks + whether each is calibrated
   GET    /v1/connections                this user's connected banks
   POST   /v1/connect   {bankId}         start a remote login → {sessionId}
   WS     /v1/connect/:sessionId         first message {type:"auth",token};
                                         server → {type:"frame"|"status"}; client → input events
   POST   /v1/sync      {bankId}|{all:true}  → {results:[{bank, offers, syncedAt}|{bank,error}]}
   POST   /v1/offers/add {bankId, offers:[{externalId, merchant}]}
   DELETE /v1/connections/:bankId        forget a bank (deletes its session)

   Banks in "extension" mode (Amex, Chase) never sign in here. The CardWise
   Chrome extension reads offers on the page the person opened and sends them:
   POST   /v1/extension/offers {bankId, offers:[raw]}  store (encrypted vault)
   GET    /v1/extension/pending?bankId=…               offers the app chose to add
   For those banks /v1/sync returns what the extension last sent, and
   /v1/offers/add queues the offers for the extension instead of clicking.
   ========================================================================== */

import { pathToFileURL } from "node:url";
import http from "node:http";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config.js";
import { Vault } from "./vault.js";
import { buildAdapters } from "./adapters/index.js";
import { makeAuthenticator } from "./auth.js";
import { RemoteLogin } from "./remoteLogin.js";
import { syncOffers, addOffers } from "./sync.js";
import { closeBrowser } from "./browser.js";
import { mergeExtensionOffers, queueAdds, reconcilePending } from "./extensionStore.js";

export function createConnector(cfg = loadConfig(), deps = {}) {
  const vault = deps.vault || new Vault(cfg);
  const adapters = deps.adapters || buildAdapters(cfg);
  const authenticate = deps.authenticate || makeAuthenticator(cfg);
  const logins = new Map();   // sessionId → RemoteLogin

  const cors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && cfg.allowedOrigins.includes(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader("access-control-allow-headers", "authorization, content-type, x-cardwise-user");
      res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    }
  };
  const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const readJson = (req) => new Promise((resolve, reject) => {
    let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) reject(Object.assign(new Error("Too large"), { status: 413 })); });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(Object.assign(new Error("Bad JSON"), { status: 400 })); } });
  });
  const adapterOr404 = (id) => {
    const a = adapters[id];
    if (!a) throw Object.assign(new Error(`Unknown bank ${id}`), { status: 404 });
    return a;
  };

  const server = http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname === "/health") return send(res, 200, { ok: true });
      const user = await authenticate(req);

      if (req.method === "GET" && url.pathname === "/v1/banks") {
        return send(res, 200, { banks: Object.values(adapters).map((a) => ({ id: a.id, name: a.name, calibrated: a.calibrated, mode: a.mode || "server", ...(a.mode === "extension" ? { offersUrl: a.offersUrl } : {}) })) });
      }
      if (req.method === "GET" && url.pathname === "/v1/connections") {
        return send(res, 200, { connections: vault.list(user.vaultUser) });
      }
      if (req.method === "POST" && url.pathname === "/v1/connect") {
        const { bankId } = await readJson(req);
        const adapter = adapterOr404(bankId);
        if (adapter.mode === "extension") throw Object.assign(new Error(`${adapter.name} syncs through the CardWise Chrome extension`), { status: 409, code: "USE_EXTENSION" });
        const login = new RemoteLogin({ cfg, vault, adapter, user });
        await login.start();
        logins.set(login.id, login);
        login.on("closed", () => setTimeout(() => logins.delete(login.id), 30000));
        return send(res, 200, { sessionId: login.id, viewport: cfg.viewport, bank: adapter.id });
      }
      if (req.method === "POST" && url.pathname === "/v1/sync") {
        const body = await readJson(req);
        const ids = body.all ? vault.list(user.vaultUser).map((c) => c.bankId) : [body.bankId];
        const results = [];
        for (const id of ids) {
          try {
            const adapter = adapterOr404(id);
            if (adapter.mode === "extension") {
              const rec = vault.load(user.vaultUser, id);
              results.push(rec?.offers ? { bank: id, mode: "extension", offers: rec.offers, syncedAt: rec.lastSyncAt, pending: (rec.pending || []).length }
                : { bank: id, mode: "extension", error: "WAITING_FOR_EXTENSION", message: `Open your ${adapter.name} offers page with the CardWise extension installed` });
            } else results.push(await syncOffers({ cfg, vault, adapter, user }));
          }
          catch (e) { results.push({ bank: id, error: e.code || "SYNC_FAILED", message: e.message }); }
        }
        return send(res, 200, { results });
      }
      if (req.method === "POST" && url.pathname === "/v1/offers/add") {
        const { bankId, offers } = await readJson(req);
        if (!Array.isArray(offers) || !offers.length || offers.length > 100) throw Object.assign(new Error("offers must be a non-empty array (max 100)"), { status: 400 });
        const adapter = adapterOr404(bankId);
        if (adapter.mode === "extension") {
          const rec = vault.load(user.vaultUser, bankId) || { bankId, mode: "extension", offers: [], connectedAt: null, lastSyncAt: null };
          const pending = queueAdds(rec.pending, offers);
          vault.save(user.vaultUser, bankId, { ...rec, pending });
          return send(res, 200, { bank: bankId, mode: "extension", queued: pending.length - (rec.pending || []).length, pending: pending.length, results: [] });
        }
        return send(res, 200, await addOffers({ cfg, vault, adapter, user, offers }));
      }
      if (req.method === "POST" && url.pathname === "/v1/extension/offers") {
        const { bankId, offers } = await readJson(req);
        const adapter = adapterOr404(bankId);
        if (adapter.mode !== "extension") throw Object.assign(new Error(`${adapter.name} doesn't sync through the extension`), { status: 409, code: "WRONG_MODE" });
        const rec = vault.load(user.vaultUser, bankId) || { bankId, mode: "extension", offers: [], pending: [] };
        const merged = mergeExtensionOffers(rec.offers, offers, { bankId });
        const now = new Date().toISOString();
        const pending = reconcilePending(rec.pending, merged);
        vault.save(user.vaultUser, bankId, { ...rec, bankId, mode: "extension", offers: merged, pending, connectedAt: rec.connectedAt || now, lastSyncAt: now });
        return send(res, 200, { bank: bankId, stored: merged.length, pending: pending.length, syncedAt: now });
      }
      if (req.method === "GET" && url.pathname === "/v1/extension/pending") {
        const bankId = url.searchParams.get("bankId");
        const adapter = adapterOr404(bankId);
        if (adapter.mode !== "extension") throw Object.assign(new Error("Not an extension bank"), { status: 409, code: "WRONG_MODE" });
        const rec = vault.load(user.vaultUser, bankId);
        return send(res, 200, { bank: bankId, pending: rec?.pending || [] });
      }
      const del = url.pathname.match(/^\/v1\/connections\/([\w-]+)$/);
      if (req.method === "DELETE" && del) {
        vault.remove(user.vaultUser, del[1]);
        return send(res, 200, { removed: del[1] });
      }
      return send(res, 404, { error: "NOT_FOUND" });
    } catch (e) {
      return send(res, e.status || 500, { error: e.code || "ERROR", message: e.status ? e.message : "Internal error" });
    }
  });

  /* WebSocket for the live login. Auth is the FIRST message (tokens stay out
     of URLs and logs), and only the user who started the session may join. */
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const m = new URL(req.url, "http://x").pathname.match(/^\/v1\/connect\/([a-f0-9]{24})$/);
    const origin = req.headers.origin;
    if (!m || (origin && !cfg.allowedOrigins.includes(origin))) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => handleSocket(ws, req, m[1]));
  });

  function handleSocket(ws, req, sessionId) {
    let login = null;
    const authTimer = setTimeout(() => ws.close(4401, "auth timeout"), 5000);
    ws.on("message", async (buf) => {
      let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
      if (!login) {
        if (msg.type !== "auth") return ws.close(4401, "auth first");
        try {
          const user = await authenticate({ headers: { "x-cardwise-user": msg.user } }, msg.token);
          const l = logins.get(sessionId);
          if (!l || l.user.vaultUser !== user.vaultUser) return ws.close(4404, "no such session");
          clearTimeout(authTimer);
          login = l;
          const onFrame = (f) => ws.readyState === 1 && ws.bufferedAmount < 4e6 && ws.send(JSON.stringify({ type: "frame", ...f }));
          const onStatus = (s) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "status", ...s }));
          login.on("frame", onFrame); login.on("status", onStatus);
          login.once("closed", () => setTimeout(() => ws.close(1000, "done"), 200));
          ws.on("close", () => { login.off("frame", onFrame); login.off("status", onStatus); if (login.state === "waiting_for_login") login.fail("client_left"); });
          ws.send(JSON.stringify({ type: "status", state: login.state, bank: login.adapter.id }));
          if (login.lastFrame) ws.send(JSON.stringify({ type: "frame", ...login.lastFrame }));
        } catch { ws.close(4401, "bad auth"); }
        return;
      }
      login.input(msg).catch(() => {});
    });
  }

  return {
    server, vault, adapters, logins,
    listen: (port = cfg.port, host = cfg.host) => new Promise((r) => server.listen(port, host, () => r(server.address().port))),
    close: async () => {
      for (const l of logins.values()) await l.close().catch(() => {});
      await new Promise((r) => server.close(() => r()));
      wss.close();
      await closeBrowser();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig();
  const c = createConnector(cfg);
  c.listen().then((port) => {
    const banks = Object.values(c.adapters).map((a) => `${a.id}${a.calibrated ? "" : " (needs calibration)"}`).join(", ");
    console.log(`CardWise connector on http://${cfg.host}:${port}  ·  banks: ${banks}`);
    console.log(process.env.FIREBASE_PROJECT_ID ? `auth: Firebase ID tokens (${process.env.FIREBASE_PROJECT_ID})` : "auth: dev shared token (single machine only)");
  });
  const stop = () => c.close().then(() => process.exit(0));
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}

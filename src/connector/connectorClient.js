/* ============================================================================
   connector/client/connectorClient.js — the app's side of the connector API.
   Copy into the app as src/connector/connectorClient.js.

   const client = createConnectorClient({
     baseUrl: import.meta.env.VITE_CONNECTOR_URL,           // e.g. http://127.0.0.1:8787
     getToken: () => auth.currentUser?.getIdToken(),       // Firebase ID token (production)
     devToken: import.meta.env.VITE_CONNECTOR_TOKEN,       // dev only, when no Firebase user
     devUser: "me",
   });
   ========================================================================== */

export class ConnectorError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

export function createConnectorClient({ baseUrl, getToken, devToken, devUser = "me", fetchImpl = (...a) => fetch(...a) }) {
  const token = async () => (getToken && (await getToken())) || devToken;

  async function call(path, { method = "GET", body } = {}) {
    const t = await token();
    if (!t) throw new ConnectorError("NOT_SIGNED_IN", "Sign in first");
    const res = await fetchImpl(baseUrl + path, {
      method,
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json", ...(devToken && t === devToken ? { "x-cardwise-user": devUser } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => { throw new ConnectorError("OFFLINE", "Can't reach the CardWise connector"); });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ConnectorError(json.error || "ERROR", json.message, res.status);
    return json;
  }

  return {
    health: () => fetchImpl(baseUrl + "/health").then((r) => r.ok).catch(() => false),
    banks: () => call("/v1/banks").then((j) => j.banks),
    connections: () => call("/v1/connections").then((j) => j.connections),
    startConnect: (bankId) => call("/v1/connect", { method: "POST", body: { bankId } }),
    sync: (bankId) => call("/v1/sync", { method: "POST", body: bankId ? { bankId } : { all: true } }).then((j) => j.results),
    addOffers: (bankId, offers) => call("/v1/offers/add", { method: "POST", body: { bankId, offers } }),
    disconnect: (bankId) => call(`/v1/connections/${bankId}`, { method: "DELETE" }),

    /* Live login stream. handlers: { onFrame({data,width,height}), onStatus({state,reason}), onClose() } */
    async openStream(sessionId, { onFrame, onStatus, onClose } = {}) {
      const t = await token();
      const ws = new WebSocket(baseUrl.replace(/^http/, "ws") + `/v1/connect/${sessionId}`);
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: t, ...(devToken && t === devToken ? { user: devUser } : {}) }));
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === "frame") onFrame?.(m);
        else if (m.type === "status") onStatus?.(m);
      };
      ws.onclose = () => onClose?.();
      return {
        send: (ev) => ws.readyState === 1 && ws.send(JSON.stringify(ev)),
        close: () => ws.close(),
      };
    },
  };
}

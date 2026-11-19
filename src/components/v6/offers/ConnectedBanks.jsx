/* Connected banks (v6 §24, spec §15.1 step 2 + §15.5) — in Offers and Profile.
   Each bank says how it syncs:
     extension  Amex, Chase: "Sync with the CardWise Chrome extension" — open
                the bank's offers page in your own Chrome; install steps
                (load unpacked) while it isn't in the Chrome Web Store.
     server     banks that allow it: Connect / Reconnect / Disconnect through
                the streamed sign-in.
   Banks that aren't calibrated yet say "coming soon", never a broken flow. */
import React, { useEffect, useState } from "react";
import ConnectBankSheet from "../../../connector/ConnectBankSheet.jsx";
import { connector, CONNECT_CLAIMS, EXTENSION_CLAIMS, EXTENSION_INSTALL_STEPS, extensionBridge, lastSync } from "../../../connector/index.js";

const ago = (t) => {
  if (!t) return "never synced";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "synced just now" : m < 60 ? `synced ${m} min ago` : m < 1440 ? `synced ${Math.round(m / 60)} h ago` : `synced ${Math.round(m / 1440)} days ago`;
};
const time = (iso) => (iso ? Date.parse(iso) || 0 : 0);
const NO_EXT = { installed: false, linked: false, banks: [] };

export const MODE_LABEL = { extension: "Chrome extension", server: "Sign in here" };

export default function ConnectedBanks({ client = connector, bridge = extensionBridge(), onConnected, compact = false }) {
  const [state, setState] = useState({ status: "checking", banks: [], connections: [] });
  const [ext, setExt] = useState(bridge?.info || NO_EXT);
  const [intro, setIntro] = useState(null);     // bank being introduced (claims first)
  const [sheet, setSheet] = useState(null);     // bank being connected
  const [install, setInstall] = useState(false);
  const refresh = async () => {
    const up = await client.health();
    if (!up) return setState({ status: "offline", banks: [], connections: [] });
    try {
      const [banks, connections] = await Promise.all([client.banks(), client.connections().catch(() => [])]);
      setState({ status: "ready", banks, connections: connections || [] });
    } catch (e) {
      setState({ status: e.code === "NOT_SIGNED_IN" ? "signin" : "error", banks: [], connections: [], error: e.message });
    }
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (bridge ? bridge.subscribe(setExt) : undefined), [bridge]);
  const conn = (id) => state.connections.find((c) => (c.bankId || c.bank || c.id) === id);
  const modeOf = (b) => (b.mode === "extension" ? "extension" : "server");
  const hasServerBank = state.banks.some((b) => modeOf(b) === "server" && b.calibrated);

  const extensionRow = (b) => {
    const c = conn(b.id);
    const line = !b.calibrated ? "Sync with the CardWise Chrome extension · coming soon"
      : c?.lastSyncAt ? `Synced from the Chrome extension · ${ago(time(c.lastSyncAt))}${c.pending ? ` · ${c.pending} waiting to be added` : ""}`
      : "Sync with the CardWise Chrome extension";
    return (
      <li key={b.id} className="bank-row" data-mode="extension">
        <span className="bank-name"><span>{b.name}</span> <span className="tag">{MODE_LABEL.extension}</span></span>
        <span className="t-caption">{line}</span>
        <span className="bank-actions">
          {!ext.installed
            ? <button className="link" onClick={() => setInstall(true)}>Install the extension</button>
            : b.calibrated && b.offersUrl
              ? <a className="link" href={b.offersUrl} target="_blank" rel="noopener noreferrer">Open {b.name} offers</a>
              : null}
        </span>
      </li>
    );
  };
  const serverRow = (b) => {
    const c = conn(b.id);
    return (
      <li key={b.id} className="bank-row" data-mode="server">
        <span className="bank-name"><span>{b.name}</span> <span className="tag">{MODE_LABEL.server}</span></span>
        <span className="t-caption">{!b.calibrated ? "Coming soon" : c ? `Connected · ${ago(time(c.lastSyncAt) || lastSync())}` : "Not connected"}</span>
        {b.calibrated && (c ? (
          <span className="bank-actions">
            <button className="link" onClick={() => setIntro(b)}>Reconnect</button>
            <button className="link" onClick={async () => { await client.disconnect(b.id).catch(() => {}); refresh(); }}>Disconnect</button>
          </span>
        ) : (
          <button className="btn btn-ink btn-small" onClick={() => setIntro(b)}>Connect</button>
        ))}
      </li>
    );
  };

  return (
    <div className="banks">
      {state.status === "checking" && <p className="t-caption">Checking your bank connections…</p>}
      {state.status === "offline" && (
        <p className="t-caption">The CardWise connector isn't running on this computer. In development, start the app with <code>npm run dev:all</code>.</p>
      )}
      {state.status === "signin" && <p className="t-caption">Sign in (Profile → Settings) to connect a bank.</p>}
      {state.status === "error" && <p className="t-caption">Couldn't reach your connections: {state.error}</p>}
      {state.status === "ready" && (
        <>
          <ul className="rows" aria-label="Banks">
            {state.banks.map((b) => (modeOf(b) === "extension" ? extensionRow(b) : serverRow(b)))}
          </ul>
          {state.banks.some((b) => modeOf(b) === "extension") && (
            <p className="t-caption" role="status">
              {ext.installed ? `CardWise extension installed${ext.linked ? " and linked to your account" : ""}.` : "The CardWise Chrome extension isn't installed in this browser."}
            </p>
          )}
        </>
      )}
      {!compact && state.status === "ready" && (
        <>
          {state.banks.some((b) => modeOf(b) === "extension") && (
            <>
              <h3 className="t-h3">With the Chrome extension</h3>
              <ul className="claims" aria-label="Chrome extension promises">{EXTENSION_CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
          {hasServerBank && (
            <>
              <h3 className="t-h3">Signing in here</h3>
              <ul className="claims" aria-label="Sign-in promises">{CONNECT_CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
        </>
      )}
      {install && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Install the CardWise extension" onClick={() => setInstall(false)}>
          <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
            <h2 className="t-h2">Install the CardWise extension</h2>
            <p className="t-caption">Amex and Chase only let you sign in from your own browser, so CardWise reads their offers there — on the offers page you open.</p>
            <ol className="claims">{EXTENSION_INSTALL_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="t-caption">While CardWise is in development the extension isn't in the Chrome Web Store yet; these steps load it from this project (see <code>extension/README.md</code>).</p>
            <ul className="claims">{EXTENSION_CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="survey-foot-row">
              <button className="btn btn-quiet" onClick={() => setInstall(false)}>Close</button>
              <button className="btn btn-ink" onClick={() => bridge?.ping()}>Check again</button>
            </div>
          </div>
        </div>
      )}
      {intro && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`Connect ${intro.name}`} onClick={() => setIntro(null)}>
          <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
            <h2 className="t-h2">Connect {intro.name}</h2>
            <ul className="claims">{CONNECT_CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="survey-foot-row">
              <button className="btn btn-quiet" onClick={() => setIntro(null)}>Not now</button>
              <button className="btn btn-ink" onClick={() => { setSheet(intro); setIntro(null); }}>Continue to {intro.name}</button>
            </div>
          </div>
        </div>
      )}
      {sheet && (
        <div className="sheet-wrap" onClick={() => setSheet(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ConnectBankSheet client={client} bank={sheet} onClose={() => setSheet(null)}
              onConnected={(id) => { setSheet(null); refresh(); onConnected?.(id); }} />
          </div>
        </div>
      )}
    </div>
  );
}

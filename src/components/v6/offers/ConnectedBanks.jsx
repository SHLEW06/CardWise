/* Connected banks (v6 §24, spec §15.1 step 2) — in Offers and Profile.
   Lists banks from the connector; Connect / Reconnect / Disconnect; last
   sync; uncalibrated banks say "Coming soon" instead of a broken flow. */
import React, { useEffect, useState } from "react";
import ConnectBankSheet from "../../../connector/ConnectBankSheet.jsx";
import { connector, CONNECT_CLAIMS, lastSync } from "../../../connector/index.js";

const ago = (t) => {
  if (!t) return "never synced";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "synced just now" : m < 60 ? `synced ${m} min ago` : m < 1440 ? `synced ${Math.round(m / 60)} h ago` : `synced ${Math.round(m / 1440)} days ago`;
};

export default function ConnectedBanks({ client = connector, onConnected, compact = false }) {
  const [state, setState] = useState({ status: "checking", banks: [], connections: [] });
  const [intro, setIntro] = useState(null);     // bank being introduced (claims first)
  const [sheet, setSheet] = useState(null);     // bank being connected
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
  const connected = (id) => state.connections.some((c) => (c.bankId || c.bank || c.id) === id);

  return (
    <div className="banks">
      {state.status === "checking" && <p className="t-caption">Checking your bank connections…</p>}
      {state.status === "offline" && (
        <p className="t-caption">The CardWise connector isn't running on this computer. In development, start the app with <code>npm run dev:all</code>.</p>
      )}
      {state.status === "signin" && <p className="t-caption">Sign in (Profile → Settings) to connect a bank.</p>}
      {state.status === "error" && <p className="t-caption">Couldn't reach your connections: {state.error}</p>}
      {state.status === "ready" && (
        <ul className="rows">
          {state.banks.map((b) => (
            <li key={b.id} className="bank-row">
              <span className="bank-name">{b.name}</span>
              <span className="t-caption">{!b.calibrated ? "Coming soon" : connected(b.id) ? `Connected · ${ago(lastSync())}` : "Not connected"}</span>
              {b.calibrated && (connected(b.id) ? (
                <span className="bank-actions">
                  <button className="link" onClick={() => setIntro(b)}>Reconnect</button>
                  <button className="link" onClick={async () => { await client.disconnect(b.id).catch(() => {}); refresh(); }}>Disconnect</button>
                </span>
              ) : (
                <button className="btn btn-ink btn-small" onClick={() => setIntro(b)}>Connect</button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <ul className="claims">
          {CONNECT_CLAIMS.map((c) => <li key={c}>{c}</li>)}
        </ul>
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

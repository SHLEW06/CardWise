/* ============================================================================
   src/connector/ConnectBankSheet.jsx — the in-app "virtual phone" sign-in
   (copied from connector/client/, styled with the v6 tokens in
   styles/v6/offers.css).

   Shows the bank's real sign-in page (streamed from the connector), forwards
   taps, scrolls and typing, and closes itself when the bank says you're in.

   <ConnectBankSheet client={client} bank={{ id: "amex", name: "American Express" }}
                     onConnected={() => client.sync("amex").then(...)} onClose={...} />
   ========================================================================== */

import React, { useEffect, useRef, useState } from "react";

const COPY = {
  starting: "Opening your bank's sign-in page…",
  waiting_for_login: "Sign in on your bank's own page. What you type goes straight to the bank — CardWise never stores it.",
  saving: "Signed in — saving securely…",
  connected: "Connected",
  failed: "Couldn't connect. Please try again.",
};

export default function ConnectBankSheet({ client, bank, onConnected, onClose }) {
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const sizeRef = useRef({ width: 430, height: 860 });
  const [state, setState] = useState("starting");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sessionId, viewport } = await client.startConnect(bank.id);
        sizeRef.current = viewport;
        streamRef.current = await client.openStream(sessionId, {
          onFrame: async ({ data }) => {
            const c = canvasRef.current; if (!c || cancelled) return;
            const blob = await (await fetch(`data:image/jpeg;base64,${data}`)).blob();
            const img = await createImageBitmap(blob);
            c.width = img.width; c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);
            img.close?.();
          },
          onStatus: ({ state: s, reason }) => {
            if (cancelled) return;
            setState(s);
            if (s === "connected") onConnected?.(bank.id);
            if (s === "failed") setError(reason || "failed");
          },
        });
      } catch (e) {
        if (!cancelled) { setState("failed"); setError(e.message); }
      }
    })();
    return () => { cancelled = true; streamRef.current?.close(); };
  }, [bank.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Canvas pixels → bank page CSS pixels. */
  const toPage = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * sizeRef.current.width, y: ((e.clientY - r.top) / r.height) * sizeRef.current.height };
  };
  const send = (ev) => streamRef.current?.send(ev);

  const onPointerDown = (e) => { e.preventDefault(); send({ type: "mouse", action: "down", ...toPage(e) }); };
  const onPointerUp = (e) => {
    send({ type: "mouse", action: "up", ...toPage(e) });
    inputRef.current?.focus({ preventScroll: true });   // bring up the phone keyboard
  };
  const onWheel = (e) => send({ type: "wheel", ...toPage(e), dx: e.deltaX, dy: e.deltaY });
  const SPECIAL = new Set(["Enter", "Backspace", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Home", "End"]);
  const onKeyDown = (e) => { if (SPECIAL.has(e.key)) { e.preventDefault(); send({ type: "key", key: e.key }); } };
  const onBeforeInput = (e) => {
    if (e.data) { e.preventDefault(); send({ type: "text", text: e.data }); }   // typed characters go straight through
  };

  return (
    <div className="cb-sheet" role="dialog" aria-label={`Connect ${bank.name}`}>
      <header className="cb-head">
        <div>
          <div className="cb-title">Connect {bank.name}</div>
          <div className="cb-sub">{error ? COPY.failed : COPY[state] || ""}</div>
        </div>
        <button className="cb-close" onClick={onClose} aria-label="Close">Close</button>
      </header>
      <div className="cb-phone">
        <canvas
          ref={canvasRef}
          className="cb-screen"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{ touchAction: "none", aspectRatio: `${sizeRef.current.width} / ${sizeRef.current.height}` }}
        />
        {/* Invisible input that receives the keyboard; characters are forwarded, never kept. */}
        <input
          ref={inputRef}
          className="cb-keys"
          autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          aria-label="Keyboard input for your bank's page"
          value=""
          onChange={() => {}}
          onKeyDown={onKeyDown}
          onBeforeInput={onBeforeInput}
        />
        {state === "starting" && <div className="cb-loading" />}
      </div>
      <p className="cb-foot">Your sign-in happens on {bank.name}'s own page. CardWise keeps only an encrypted session so it can read your offers — never your password or full card numbers.</p>
    </div>
  );
}

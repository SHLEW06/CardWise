/* ============================================================================
   connector/src/remoteLogin.js — the "virtual phone" login.
   ----------------------------------------------------------------------------
   A real Chromium page opens the bank's own sign-in page. Its screen is
   streamed to the user as JPEG frames (Chrome DevTools screencast); the user's
   taps/typing are sent back and replayed on the page. When the bank shows the
   signed-in state, we save the cookies/localStorage (encrypted) and close.

   Privacy rules enforced here:
   - Input events are replayed and immediately discarded. They are never
     logged, stored, or inspected (passwords pass through only as keystrokes).
   - Only the resulting session (storageState) is stored, encrypted.
   ========================================================================== */

import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import { newContext } from "./browser.js";

const MOUSE = { down: "mousePressed", up: "mouseReleased", move: "mouseMoved" };

export class RemoteLogin extends EventEmitter {
  constructor({ cfg, vault, adapter, user }) {
    super();
    this.id = randomBytes(12).toString("hex");
    this.cfg = cfg; this.vault = vault; this.adapter = adapter; this.user = user;
    this.state = "starting";
    this.createdAt = Date.now();
  }

  async start() {
    this.context = await newContext(this.cfg);
    this.page = await this.context.newPage();
    this.cdp = await this.context.newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
      this.lastFrame = { data, width: metadata.deviceWidth, height: metadata.deviceHeight };
      this.emit("frame", this.lastFrame);
      await this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    /* Start streaming before navigating so the first paint is captured;
       late joiners get `lastFrame` (see server.js). */
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg", quality: 70,
      maxWidth: this.cfg.viewport.width * 2, maxHeight: this.cfg.viewport.height * 2, everyNthFrame: 1,
    });
    await this.page.goto(this.adapter.loginUrl, { waitUntil: "domcontentloaded" });
    this.state = "waiting_for_login";
    this.emit("status", { state: this.state, bank: this.adapter.id });
    this.#watch();
    this.timeout = setTimeout(() => this.fail("timeout"), this.cfg.loginTimeoutMs);
    return this;
  }

  /* Poll for the signed-in state instead of trusting any single navigation. */
  #watch() {
    this.poll = setInterval(async () => {
      if (this.state !== "waiting_for_login") return;
      try {
        if (await this.adapter.isLoggedIn(this.page)) await this.#complete();
      } catch { /* page mid-navigation; try again next tick */ }
    }, 1200);
  }

  async #complete() {
    this.state = "saving";
    const storageState = await this.context.storageState();
    const prev = this.vault.load(this.user.vaultUser, this.adapter.id);
    this.vault.save(this.user.vaultUser, this.adapter.id, {
      bankId: this.adapter.id, storageState,
      connectedAt: prev?.connectedAt || new Date().toISOString(), lastSyncAt: prev?.lastSyncAt || null,
    });
    this.state = "connected";
    this.emit("status", { state: "connected", bank: this.adapter.id });
    await this.close();
  }

  /* Replays one input event from the client. Never logs `ev`. */
  async input(ev) {
    if (!this.page || this.state !== "waiting_for_login") return;
    const p = this.page;
    switch (ev?.type) {
      case "mouse": {
        const type = MOUSE[ev.action]; if (!type) return;
        await this.cdp.send("Input.dispatchMouseEvent", {
          type, x: +ev.x || 0, y: +ev.y || 0, button: ev.action === "move" ? "none" : "left",
          clickCount: ev.action === "move" ? 0 : 1,
        });
        return;
      }
      case "wheel":
        await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: +ev.x || 0, y: +ev.y || 0, deltaX: +ev.dx || 0, deltaY: +ev.dy || 0 });
        return;
      case "text":   // printable characters (works for mobile keyboards too)
        if (typeof ev.text === "string" && ev.text.length <= 256) await p.keyboard.insertText(ev.text);
        return;
      case "key": {  // special keys only
        const allowed = ["Enter", "Backspace", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Home", "End"];
        if (allowed.includes(ev.key)) await p.keyboard.press(ev.key);
        return;
      }
      case "back":
        await p.goBack().catch(() => {}); return;
      default:
    }
  }

  async fail(reason) {
    if (["connected", "failed", "closed"].includes(this.state)) return;
    this.state = "failed";
    this.emit("status", { state: "failed", reason });
    await this.close();
  }

  async close() {
    clearInterval(this.poll); clearTimeout(this.timeout);
    if (this.state !== "connected" && this.state !== "failed") this.state = "closed";
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    await this.context?.close().catch(() => {});
    this.emit("closed");
  }
}

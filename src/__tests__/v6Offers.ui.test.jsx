// @vitest-environment jsdom
/* Offers + bank connection (v6 §24, Part K). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Offers from "../components/v6/offers/Offers.jsx";
import ConnectedBanks from "../components/v6/offers/ConnectedBanks.jsx";
import { planAutoAdd, syncAll, shouldAutoSync, SYNC_EVERY_MS, CONNECT_CLAIMS, byBank } from "../connector/index.js";
import { normalizeOffer, describeOffer } from "../engine/offers/offerModel.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const profile = { cardsHeld: ["amex-gold", "amex-plat", "csp"] };
const off = (o) => normalizeOffer({ source: "amex", status: "available", expires: "2099-01-01", ...o });

function mockClient(over = {}) {
  return {
    health: vi.fn(async () => true),
    banks: vi.fn(async () => [{ id: "amex", name: "American Express", calibrated: true }, { id: "chase", name: "Chase", calibrated: false }]),
    connections: vi.fn(async () => [{ bankId: "amex" }]),
    sync: vi.fn(async () => [{ bank: "amex", offers: [{ source: "amex", merchant: "Nike", rawText: "Spend $100 or more, get $20 back", expires: "2099-02-01", status: "available", externalId: "x1", cardName: "Gold Card", syncedAt: "2026-11-18" }] }]),
    addOffers: vi.fn(async (bank, list) => ({ bank, results: list.map((o) => ({ ...o, ok: true })) })),
    disconnect: vi.fn(async () => ({})),
    ...over,
  };
}

describe("auto-add planner", () => {
  it("adds each merchant once, to the card that earns most there; skips excluded merchants and cards with auto-add off", () => {
    const offers = [
      off({ id: "a", cardId: "amex-gold", merchant: "Starbucks", rawText: "Spend $10, get $2" }),
      off({ id: "b", cardId: "amex-plat", merchant: "Starbucks", rawText: "Spend $10, get $2" }),
      off({ id: "c", cardId: "amex-plat", merchant: "Shell", rawText: "Spend $50, get $5" }),
      off({ id: "d", cardId: "amex-gold", merchant: "Wayfair", rawText: "Spend $200, get $30" }),
    ];
    const plan = planAutoAdd(offers, { autoAdd: {}, exclude: ["wayfair"] }, profile);
    expect(plan.find((p) => p.offer.merchant === "Starbucks").cardId).toBe("amex-gold");   // 4x dining beats 1x
    expect(plan.filter((p) => p.offer.merchant === "Starbucks")).toHaveLength(1);
    expect(plan.some((p) => p.offer.merchant === "Wayfair")).toBe(false);
    const off2 = planAutoAdd(offers, { autoAdd: { "amex-plat": false }, exclude: [] }, profile);
    expect(off2.some((p) => p.offer.merchant === "Shell")).toBe(false);
    expect(byBank(plan).amex.length).toBe(plan.length);
  });
  it("syncs: bank offers → wallet cards → merged; auto-sync after 6 hours", async () => {
    const client = mockClient();
    const save = vi.fn();
    const r = await syncAll([], profile.cardsHeld, { client, save });
    expect(r.offers[0]).toMatchObject({ merchant: "Nike", cardId: "amex-gold", externalId: "x1" });
    expect(save).toHaveBeenCalled();
    expect(shouldAutoSync()).toBe(false);
    expect(shouldAutoSync(Date.now() + SYNC_EVERY_MS + 1)).toBe(true);
  });
});

describe("Offers tab", () => {
  it("plain amounts, filters, Add all through the connector", async () => {
    const client = mockClient({ health: vi.fn(async () => false) });
    const offers = [
      off({ id: "a", cardId: "amex-gold", merchant: "Starbucks", rawText: "Spend $75 or more, get $10 back", expires: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) }),
      off({ id: "b", cardId: "csp", merchant: "Shell", rawText: "Spend $50 or more, get $5 back", source: "chase", status: "added" }),
    ];
    expect(describeOffer(offers[0])).toBe("Spend $75, get $10");
    const setOffers = vi.fn();
    render(<Offers offers={offers} setOffers={setOffers} profile={profile} client={client} />);
    const list = screen.getByRole("list", { name: "Offers" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Expiring soon" }));
    expect(within(screen.getByRole("list", { name: "Offers" })).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Expiring soon" }));
    fireEvent.click(screen.getByRole("radio", { name: "Added" }));
    expect(within(screen.getByRole("list", { name: "Offers" })).getByText("Shell")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: /Add all \(1\)/ }));
    await waitFor(() => expect(client.addOffers).toHaveBeenCalledWith("amex", [expect.objectContaining({ merchant: "Starbucks" })]));
    await waitFor(() => expect(setOffers).toHaveBeenCalled());
  });
  it("per-card auto-add toggles and an excluded-merchant list", () => {
    render(<Offers offers={[]} setOffers={() => {}} profile={profile} client={mockClient({ health: vi.fn(async () => false) })} />);
    const toggles = screen.getAllByRole("button", { name: "Auto-add on" });
    expect(toggles).toHaveLength(3);
    fireEvent.click(toggles[0]);
    expect(screen.getAllByRole("button", { name: "Auto-add off" })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Merchant to exclude"), { target: { value: "Wayfair" } });
    fireEvent.click(screen.getByRole("button", { name: "Exclude" }));
    expect(screen.getByRole("button", { name: "Stop excluding Wayfair" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("cardwise/v6/offerPrefs")).exclude).toEqual(["Wayfair"]);
  });
});

describe("Connected banks", () => {
  it("lists banks; uncalibrated ones say Coming soon; Connect shows the claims first", async () => {
    render(<ConnectedBanks client={mockClient()} compact />);
    expect(await screen.findByText("American Express")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    const dlg = screen.getByRole("dialog", { name: "Connect American Express" });
    for (const c of CONNECT_CLAIMS) expect(within(dlg).getByText(c)).toBeInTheDocument();
  });
  it("says how to start the connector when it isn't running", async () => {
    render(<ConnectedBanks client={mockClient({ health: vi.fn(async () => false) })} />);
    expect(await screen.findByText(/npm run dev:all/)).toBeInTheDocument();
  });
  it("the claims are the ones our implementation keeps", () => {
    expect(CONNECT_CLAIMS.join(" ")).toMatch(/never store or log your password/);
    expect(CONNECT_CLAIMS.join(" ")).toMatch(/encrypted session/);
    expect(CONNECT_CLAIMS.join(" ")).toMatch(/never full card numbers/);
    expect(CONNECT_CLAIMS.join(" ")).toMatch(/never sell/);
  });
});

// @vitest-environment jsdom
/* v7e Part 4 — "Your benefits" checklist on every card: I'd use this /
   Worth to me / face / reason, live totals, saved per card in
   `benefitOverrides`, fed to the optimizer, with Reset. */
import React, { useState } from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { walletValue, optimalWallet } from "../engine/v5/methodology.js";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import BenefitChecklist, { withOverride, WalletChecklist } from "../components/v7/BenefitChecklist.jsx";
import CardDetail from "../components/v6/CardDetail.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const P = { brands: { habits: { takeout: { answer: "monthly", apps: ["any"] }, rideshare: { answer: "monthly", apps: ["any"] }, dunkin: { answer: "weekly" } } }, spend: { dining: 500, groceries: 500 } };
const uber = (id) => BY_ID[id].credits.find((c) => /Uber Cash/.test(c.name));
const idOf = (cardId, credit) => benefitBreakdown(BY_ID[cardId], normalizeProfile(P)).items.find((i) => i.label === credit.name).id;

function Harness({ cardId }) {
  const [p, setP] = useState(() => loadV5Profile());
  return <BenefitChecklist cardId={cardId} profile={p} onProfileChange={(next) => setP(saveV5Profile(next))} />;
}

describe("4.1 / 4.3 · engine: overrides feed the value and the optimizer", () => {
  it("unticking a benefit drops it to $0 and re-ranks the wallet", () => {
    const p = normalizeProfile(P);
    const id = idOf("amex-gold", uber("amex-gold"));
    const before = walletValue(["amex-gold"], p);
    const off = normalizeProfile(withOverride(p, "amex-gold", id, { use: false }));
    expect(benefitBreakdown(BY_ID["amex-gold"], off).items.find((i) => i.id === id)).toBeUndefined();
    expect(benefitBreakdown(BY_ID["amex-gold"], off).unused.find((u) => u.id === id).reason).toBe("You unticked it");
    expect(walletValue(["amex-gold"], off).N).toBe(before.N - 120);
    expect(optimalWallet(off).value.N).toBeLessThanOrEqual(optimalWallet(p).value.N);
  });
  it("a typed value is used as is", () => {
    const p = normalizeProfile(P);
    const id = idOf("amex-gold", uber("amex-gold"));
    const edited = normalizeProfile(withOverride(p, "amex-gold", id, { use: true, value: 50 }));
    expect(benefitBreakdown(BY_ID["amex-gold"], edited).items.find((i) => i.id === id).value).toBe(50);
  });
});

describe("4.1 / 4.2 / 4.3 · the checklist on a card", () => {
  it("rows with I'd use this, Worth to me, face, reason; totals update live; the edit persists after reload; Reset restores", () => {
    saveV5Profile(P);
    render(<Harness cardId="amex-gold" />);
    const box = screen.getByTestId("benefit-checklist");
    const label = uber("amex-gold").name;
    const worth = within(box).getByLabelText(`Worth to me: ${label}`);
    expect(worth).toHaveValue("120");
    expect(within(box).getByTestId("bc-totals")).toHaveTextContent("Benefits you'd use");
    const net0 = within(box).getByTestId("bc-net").textContent;
    fireEvent.change(worth, { target: { value: "40" } });
    expect(within(box).getByTestId("bc-net").textContent).not.toBe(net0);
    expect(within(box).getByText(/Your number \(CardWise: \$120\)/)).toBeInTheDocument();
    /* reload */
    cleanup();
    expect(Object.values(loadV5Profile().benefitOverrides["amex-gold"])).toContainEqual({ use: true, value: 40 });
    render(<Harness cardId="amex-gold" />);
    const box2 = screen.getByTestId("benefit-checklist");
    expect(within(box2).getByLabelText(`Worth to me: ${label}`)).toHaveValue("40");
    fireEvent.click(within(box2).getAllByRole("button", { name: "Reset to CardWise's estimate" })[0]);
    expect(within(box2).getByLabelText(`Worth to me: ${label}`)).toHaveValue("120");
    expect(loadV5Profile().benefitOverrides["amex-gold"]).toBeUndefined();
  });
  it("unticking in the checklist zeroes the row", () => {
    saveV5Profile(P);
    render(<Harness cardId="amex-gold" />);
    const box = screen.getByTestId("benefit-checklist");
    fireEvent.click(within(box).getByLabelText(`I'd use this: ${uber("amex-gold").name}`));
    expect(within(box).getByLabelText(`Worth to me: ${uber("amex-gold").name}`)).toHaveValue("0");
  });
  it("shows on the card detail", () => {
    render(<CardDetail cardId="amex-gold" profile={P} onProfileChange={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("benefit-checklist")).toBeInTheDocument();
  });
});

describe("4.4 · the wallet's combined checklist", () => {
  it("grouped, with 'covered by … already' for overlaps", () => {
    /* $150 of takeout a year: both cards' Uber Cash can't pay it back twice */
    const p = normalizeProfile({ brands: { habits: { takeout: { answer: "monthly", apps: ["any"], spend: 150 } } } });
    const setup = ["amex-gold", "amex-plat"];
    const value = walletValue(setup, p);
    render(<WalletChecklist setup={setup} value={value} profile={p} onProfileChange={() => {}} />);
    const box = screen.getByTestId("wallet-checklist");
    for (const g of ["Dining & delivery", "Nice extras ($0)"]) expect(within(box).getByRole("region", { name: g })).toBeInTheDocument();
    expect(within(box).getAllByText(/^Covered by the .* already$/).length).toBeGreaterThan(0);
  });
});

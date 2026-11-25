// @vitest-environment jsdom
/* v7c 5b — only count what they'd pay for. Statement credits and free bags
   at 100% (capped at the spending they can be used on), airline fee credits
   capped at the bag fees they'd pay, certificates at 2/3 of the most they're
   worth, lounges at 1/8 of face (one network), status and protections $0
   ("Nice extras"); every row shows Counted + Face; icons by type; hotel /
   airline multipliers only at that brand; "Worth applying?" on counted value. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, lanesFor, creditUsage, loungeFace } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { explainCard, worthVerdict, VERDICT_TEXT } from "../engine/v5/apply.js";
import { CERT_COUNTED_SHARE, LOUNGE_FACE_SHARE, LOUNGE_RETAIL_CAP, BAG_FEE } from "../data/benefitUsage.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import WhyThisCard from "../components/v7/WhyThisCard.jsx";

afterEach(cleanup);
beforeEach(() => { window.scrollTo = () => {}; });

const ATL = { airlinePerks: ["bags", "companion"], tripRows: [{ from: "ATL", to: "LAX", trips: 3 }], bags: { perTrip: 1, share: 1 } };
const OWNER = ["freedom-unlimited", "robinhood-gold", "delta-gold"];

describe("5b table · counted value", () => {
  it("statement credits they'd use count 100% of face", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  brands: { habits: { dunkin: { answer: "weekly" }, walmartplus: { answer: "pay" } } } });
    expect(benefitBreakdown(BY_ID["amex-gold"], p).items.find((i) => /Dunkin/.test(i.label)).value).toBe(84);
    expect(benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => /Walmart\+/.test(i.label)).value).toBe(155);
  });
  it("free checked bags on an airline they fly count in full: bags × trips × 2 × $35", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: ATL });
    expect(benefitBreakdown(BY_ID["delta-gold"], p).items.find((i) => i.kind === "bags").value).toBe(BAG_FEE * 1 * 3 * 2);
  });
  it("an airline fee credit is capped at the bag fees they'd pay, with the math shown", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { ...ATL, tripRows: [{ from: "ATL", to: "LAX", trips: 2 }] } });
    const it = benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => /airline fee credit/.test(i.label));
    expect(it.value).toBe(140);                                         // 1 bag × 2 trips × 2 ways × $35
    expect(it.note).toBe("You'd use $140 of $200: bag fees on Delta — 1 bag × 2 trips × 2 ways × $35 = $140 a year (one airline you pick).");
  });
  it("…minus bags another card already makes free", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: ATL });
    const alone = walletValue(["amex-plat"], p).benefits.find((b) => /airline fee credit/.test(b.label));
    const withGold = walletValue(["amex-plat", "delta-gold"], p).benefits.find((b) => /airline fee credit/.test(b.label));
    expect(alone.value).toBe(200);
    expect(withGold).toBeUndefined();                                    // the Gold already waives every bag
  });
  it("broad travel credit: 100%, capped at their travel spending", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 1, hotelNights: 0 }, spendYear: { flights: 150 } });
    expect(benefitBreakdown(BY_ID.csr, p).items.find((i) => /\$300 travel credit/.test(i.label)).value).toBe(150);
  });
  it("free night certificates count 2/3 of the most they're worth: an 85k Marriott night up to $629 counts $419", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 5, hotelNights: 6, hotelChoice: "manual" }, brands: { hotels: ["marriott"] } });
    const night = benefitBreakdown(BY_ID.ritz, p).items.find((i) => i.kind === "freeNight");
    expect(night.face).toBe(629);
    expect(night.value).toBe(419);
    expect(night.value).toBe(Math.round(night.face * CERT_COUNTED_SHARE));
  });
  it("…$0 with no hotel stays; spend-gated certificates count $0 and are listed under Unlocks with spending", () => {
    const none = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 5, hotelNights: 0, hotelChoice: "manual" }, brands: { hotels: ["marriott"] } });
    expect(benefitBreakdown(BY_ID.ritz, none).items.some((i) => i.kind === "freeNight")).toBe(false);
    const hy = benefitBreakdown(BY_ID.hyatt, normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 4, hotelNights: 10, hotelChoice: "manual" }, brands: { hotels: ["hyatt"] }, spend: { other: 5000 } }));
    expect(hy.items.filter((i) => i.kind === "freeNight")).toHaveLength(1);
    expect(hy.gated.map((g) => g.label)).toEqual(expect.arrayContaining([expect.stringMatching(/after \$15k/)]));
  });
  it("companion certificates count 2/3; $0 with no flights on that airline", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: ATL });
    const cc = benefitBreakdown(BY_ID["delta-plat"], p).items.find((i) => i.kind === "companion");
    expect(cc.value).toBe(Math.round(cc.face * CERT_COUNTED_SHARE));
    expect(benefitBreakdown(BY_ID["delta-plat"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", spend: { flights: 500 }, travel: { tripRows: [{ from: "EWR", to: "SFO", trips: 3 }] } })).items.some((i) => i.kind === "companion")).toBe(false);
  });
  it("lounge access counts 1/8 of face, one network", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 6, lounges: "yes", homeAirport: "SEA" } });
    const l = benefitBreakdown(BY_ID["amex-plat"], p).items.filter((i) => i.kind === "lounge");
    expect(l).toHaveLength(1);
    expect(l[0].face).toBe(LOUNGE_RETAIL_CAP);
    expect(l[0].value).toBeLessThanOrEqual(Math.round(LOUNGE_RETAIL_CAP));
    expect(loungeFace("Delta Sky Club (10 visits a year)")).toBe(350);
  });
  it("elite status and protections count $0, as Nice extras", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["hyatt"] } });
    const b = benefitBreakdown(BY_ID.hyatt, p);
    expect(b.items.some((i) => ["status", "protection"].includes(i.kind))).toBe(false);
    expect(b.extras.map((x) => x.kind)).toEqual(expect.arrayContaining(["status", "protection"]));
  });
});

describe("5b.1 / 5b.2 / 5b.4 · card detail rows", () => {
  const P = { spend: { dining: 500 }, wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["marriott"], habits: { resy: { answer: "monthly" } } } };
  it("every benefit row shows 'Counted $X' and a grey 'Face up to $Y'", () => {
    render(<CardDetail cardId="marriott-brilliant" profile={P} onClose={() => {}} />);
    const rows = screen.getAllByTestId("benefit-row");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.textContent).toMatch(/Counted \$\d/);
      expect(r.textContent).toMatch(/Face up to \$\d/);
    }
  });
  it("$0 items are in an unscored 'Nice extras' list with no dollar amounts", () => {
    render(<CardDetail cardId="marriott-brilliant" profile={P} onClose={() => {}} />);
    const extras = screen.getByTestId("nice-extras");
    expect(within(extras).getByText(/Platinum status \(Marriott\)/)).toBeInTheDocument();
    expect(extras.querySelector("ul").textContent).not.toMatch(/\$/);
  });
  it("each benefit type has its own icon — the dining credit is not a bed", () => {
    render(<CardDetail cardId="marriott-brilliant" profile={P} onClose={() => {}} />);
    const dining = screen.getAllByTestId("benefit-row").find((r) => /dining credit/.test(r.textContent));
    expect(dining.querySelector("[data-icon]").getAttribute("data-icon")).toBe("dining");
    const night = screen.getAllByTestId("benefit-row").find((r) => /free night/i.test(r.textContent));
    expect(night.querySelector("[data-icon]").getAttribute("data-icon")).toBe("freeNight");
  });
});

describe("5b.5 · a hotel or airline card's multiplier only at that brand", () => {
  it("hotel spending is split between the hotel programs picked", () => {
    const two = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["hyatt", "marriott"] } });
    const lanes = lanesFor(BY_ID["marriott-brilliant"], two).filter((l) => l.bucket === "hotels");
    expect(lanes.find((l) => l.rate === 6).brandShare).toBe(0.5);
    expect(lanes.some((l) => l.rate === 2 && !l.pools.length)).toBe(true);   // the rest at 2x
  });
  it("airline spending follows trips on that airline", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", spend: { flights: 500 }, travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 3 }, { from: "EWR", to: "SFO", trips: 3 }] } });
    const lane = lanesFor(BY_ID["delta-gold"], p).find((l) => l.bucket === "flights" && l.rate > 1);
    expect(lane.brandShare).toBeCloseTo(p.travel.tripsByAirline.delta / p.travel.trips, 6);
  });
  it("no stays with the brand → 'Earning it adds' $0 with a one-line reason", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: OWNER, travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["hyatt"] } });
    const e = explainCard("marriott-brilliant", OWNER, p, walletValue);
    expect(Math.round(e.earned)).toBe(0);
    expect(e.earnNote).toBe("No Marriott stays in your trips, and your other cards beat 3x dining / 3x flights / 2x everything else.");
    render(<WhyThisCard cardId="marriott-brilliant" wallet={OWNER} profile={p} open />);
    expect(screen.getByTestId("earn-note")).toHaveTextContent(/No Marriott stays in your trips/);
  });
  it("shows the stacked return at the brand, scoring only the card's part", () => {
    render(<CardDetail cardId="marriott-brilliant" profile={{ wants: "both", travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["marriott"] } }} onClose={() => {}} />);
    expect(screen.getByTestId("stacked-return").textContent).toMatch(/^≈13% back at Marriott \(4.8% from this card\)/);
  });
});

describe("5b.6 · Worth applying? on counted value only", () => {
  it("net ≤ $0 → 'Not worth it for you', with the top reason", () => {
    expect(worthVerdict(100, 100)).toBe("No");
    expect(VERDICT_TEXT.No).toBe("Not worth it for you");
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: OWNER, travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" }, brands: { hotels: ["hyatt"] } });
    render(<WhyThisCard cardId="marriott-brilliant" wallet={OWNER} profile={p} />);
    const w = screen.getByTestId("worth-applying");
    expect(w).toHaveTextContent(/Worth applying\? Not worth it for you — your other cards already earn as much on your spending, and none of its perks match your answers\./);
  });
  it("a Yes leads with the net after the application cost", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  cardsHeld: ["freedom-unlimited"], spend: { dining: 1500, groceries: 1500 } });
    const e = explainCard("amex-gold", ["freedom-unlimited"], p, walletValue);
    expect(e.verdict).toBe("Yes");
    render(<WhyThisCard cardId="amex-gold" wallet={["freedom-unlimited"]} profile={p} />);
    expect(screen.getByTestId("worth-applying")).toHaveTextContent(new RegExp(`Yes — \\+\\$${Math.round(e.net).toLocaleString("en-US")} a year after the \\$${e.hurdle.total} application cost`));
  });
});

describe("5b · nothing a person wouldn't pay for", () => {
  it("unpicked statement credits, unused lounges and status add nothing to the score", () => {
    const p = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 0 } });
    const v = walletValue(["amex-plat"], p);
    expect(v.U).toBe(0);
    expect(creditUsage(BY_ID["amex-plat"], BY_ID["amex-plat"].credits.find((c) => /lululemon/.test(c.name)), p).factor).toBe(0);
  });
});

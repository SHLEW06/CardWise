// @vitest-environment jsdom
/* Review fixes after v6 (2026-11-18): lounge limits, required memberships,
   explainable Wallet Score, Explore categories, Checkout credits, held-card
   detail, white first paint, likely approvals first. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown, loungeNetworks, cardFee, membershipCost, loungeFace } from "../engine/v5/value.js";
import { walletValue, optimalWallet, walletScore, scoreFrom, scoreNeeded, eligibility } from "../engine/v5/methodology.js";
import { exploreRows, isLuxury } from "../engine/v5/explore.js";
import { rankPurchase, matchStore } from "../engine/v5/checkout.js";
import { applyTimeline } from "../engine/v5/lab.js";
import { SAPPHIRE_LEFT_PRIORITY_PASS } from "../data/loungeLocations.js";
import { LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP } from "../data/benefitUsage.js";
import { buildPlan } from "../engine/v5/plan.js";
import Home from "../components/v6/Home.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import CardDetail from "../components/v6/CardDetail.jsx";
import Survey from "../components/v5/survey/Survey.jsx";
import { loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const spend = (o) => ({ dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 300, ...o });

describe("1 · lounge visit limits", () => {
  const flyer = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 10, lounges: "yes", homeAirport: "SEA" } });
  it("Altitude Connect: Priority Pass with 4 free visits a year, not unlimited", () => {
    expect(BY_ID["usb-altitude-connect"].loungeAccess.networks[0]).toMatch(/4 visits a year/);
    const nets = loungeNetworks(BY_ID["usb-altitude-connect"], flyer);
    expect(nets.prioritypass).toBeLessThanOrEqual(4 * LOUNGE_VISIT_VALUE);
  });
  /* v7c 5b: a visit / pass limit caps the network's face (limit × $35, at
     most $469 retail); 1/8 of that face × coverage is counted. */
  it("a Priority Pass membership never inherits another network's pass count", () => {
    const card = BY_ID["citi-strata-elite"];
    const pp = card.loungeAccess.networks.find((n) => /priority pass/i.test(n));
    const aa = card.loungeAccess.networks.find((n) => /admirals/i.test(n));
    expect(loungeFace(pp)).toBe(LOUNGE_RETAIL_CAP);                     // membership: no pass count
    expect(loungeFace(aa)).toBe(4 * LOUNGE_VISIT_VALUE);                 // 4 Admirals passes
    const nets = loungeNetworks(card, { ...flyer, brands: { ...flyer.brands, airlines: ["aa"] } });
    expect(nets.prioritypass).toBeGreaterThan(nets.aa || 0);
  });
  it("Delta Sky Club visit limits: Reserve 15, Platinum 10, AA Globe 4 passes", () => {
    const face = (id, re) => loungeFace(BY_ID[id].loungeAccess.networks.find((n) => re.test(n)));
    expect(face("delta-reserve", /sky club/i)).toBe(Math.min(15 * LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP));   // capped at retail access price
    expect(face("amex-plat", /sky club/i)).toBe(10 * LOUNGE_VISIT_VALUE);
    expect(face("citi-aa-globe", /admirals/i)).toBe(4 * LOUNGE_VISIT_VALUE);
    const delta = { ...flyer, brands: { ...flyer.brands, airlines: ["delta", "aa"] }, travel: { ...flyer.travel, trips: 20, homeAirport: "ATL" } };
    expect(loungeNetworks(BY_ID["delta-reserve"], delta).delta).toBeLessThanOrEqual(face("delta-reserve", /sky club/i) + 1e-9);
  });
  it("Sapphire Lounges left Priority Pass (Aug 15 2026): only cards that list them get them", () => {
    expect(SAPPHIRE_LEFT_PRIORITY_PASS).toBe("2026-08-15");
    const bos = normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  travel: { trips: 6, lounges: "yes", homeAirport: "BOS" } });
    expect(loungeNetworks(BY_ID["venture-x"], bos).sapphire).toBeUndefined();
    expect(loungeNetworks(BY_ID["csr"], bos).sapphire).toBeGreaterThan(0);
  });
});

describe("2 · required memberships count as fees unless already paid", () => {
  it("Robinhood Gold's $50 is in F(W); not when they already pay it", () => {
    expect(cardFee(BY_ID["robinhood-gold"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", }))).toBe(50);
    expect(cardFee(BY_ID["robinhood-gold"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  memberships: ["robinhood-gold"] }))).toBe(0);
    expect(walletValue(["robinhood-gold"], {}).F).toBe(50);
    expect(walletValue(["robinhood-gold"], { memberships: ["robinhood-gold"] }).N - walletValue(["robinhood-gold"], {}).N).toBe(50);
    expect(membershipCost(BY_ID["robinhood-gold"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  memberships: { robinhoodGold: true } })).paid).toBe(true);   // v4 object form
  });
  it("the Costco Visa needs a Costco membership the same way", () => {
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", }))).toBe(65);
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  memberships: ["costco"] }))).toBe(0);
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({ wants: "both", groceryStore: "supermarket", rotatingActivation: "yes",  spend: spend({ warehouse: 300 }), warehouseClub: "costco" }))).toBe(0);
  });
  it("the survey asks it (optional) on the fee step and saves it", () => {
    render(<Survey initialMode="quick" initialStepId="fee" />);
    const group = screen.getByRole("group", { name: "Memberships you already pay for" });
    fireEvent.click(within(group).getByRole("button", { name: "Robinhood Gold" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().memberships).toEqual(["robinhood-gold"]);
  });
});

describe("3 · Wallet Score is explainable and the same on Home and in Wallet Lab", () => {
  const P = { wants: "both", groceryStore: "supermarket", rotatingActivation: "yes", cardsHeld: ["amex-gold", "freedom-unlimited", "csp", "robinhood-gold"], feeBudget: 500, spend: spend({ dining: 600, groceries: 700, other: 600 }), travel: { trips: 4, homeAirport: "ATL", lounges: "sometimes" }, brands: { airlines: ["delta", "united"] } };
  it("score divides current annual net by recommended annual net", () => {
    const s = buildPlan(P);
    expect(s.score).toBe(scoreFrom(s.current.net, s.best.value.net));
    render(<Home profile={P} offers={[]} />);
    expect(screen.getByTestId("home-score-basis")).toHaveTextContent(s.scoreText);
  });
  it("Wallet Lab labels a suggested setup and shows 'Your wallet now' = Home's score", () => {
    const home = buildPlan(P).score;
    render(<WalletLab profile={P} />);
    expect(screen.getByRole("meter", { name: "Wallet Score, suggested setup" })).toBeInTheDocument();
    expect(screen.getByTestId("lab-now-score").textContent).toMatch(new RegExp(`^${home} `));
  });
});

describe("4 · Explore categories by card features", () => {
  it("Luxury = premium fee + full lounge or premium travel credits; cheap lounge cards go to Lounge on a budget", () => {
    expect(isLuxury(BY_ID["usb-altitude-connect"])).toBe(false);
    for (const id of ["amex-plat", "csr", "venture-x", "delta-reserve"]) expect(isLuxury(BY_ID[id]), id).toBe(true);
    const P = { feeBudget: 1000 };
    expect(exploreRows(P, { chip: "luxury" }).map((r) => r.card.id)).not.toContain("usb-altitude-connect");
    expect(exploreRows(P, { chip: "budgetLounge" }).map((r) => r.card.id)).toContain("usb-altitude-connect");
    const adds = exploreRows(P, { chip: "luxury" }).filter((r) => r.fitsBudget).map((r) => r.adds ?? -1e12);
    expect(adds).toEqual([...adds].sort((a, b) => b - a));
  });
});

describe("5 · Checkout lists every wallet card and the best card you don't have", () => {
  const P = { cardsHeld: ["amex-gold", "freedom-unlimited", "csp", "robinhood-gold"], feeBudget: 1000, credit: { score: 780 } };
  it("every held card is ranked", () => {
    const r = rankPurchase({ store: matchStore("lululemon") }, P);
    expect(r.rows.map((x) => x.cardId).sort()).toEqual([...P.cardsHeld].sort());
  });
  it("Amex Platinum's lululemon credit counts only if they picked lululemon", () => {
    expect(rankPurchase({ store: matchStore("lululemon") }, P).bestElsewhere?.credit).toBeFalsy();
    const r = rankPurchase({ store: matchStore("lululemon") }, { ...P, brands: { perks: ["lululemon"] } });
    expect(r.bestElsewhere.cardId).toBe("amex-plat");
    expect(r.bestElsewhere.credit.value).toBe(300);   // v7c Part 4: a purchase a month uses every quarter of the $300
  });
});

describe("6 · held-card detail: worth after its fee + break-even", () => {
  it("'Worth ≈ $X a year to you after its $325 fee' and one break-even line", () => {
    render(<CardDetail cardId="amex-gold" profile={{ cardsHeld: ["amex-gold"], spend: spend({ dining: 700, groceries: 700 }), brands: { perks: ["uber", "resy"] } }} onClose={() => {}} />);
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText(/after its \$325 fee/)).toBeInTheDocument();
    /* Acceptance G4 fix: the line explains the headline — what it earns beyond
       their other cards + benefits, against the fee — and the headline equals
       "What it adds to your wallet". */
    expect(within(dlg).getByText(/in rewards than your other cards would earn on the same spending.*against its \$325 fee\./)).toBeInTheDocument();
    const head = within(dlg).getByTestId("held-headline").textContent;
    const sentence = within(dlg).getByText(/minus its \$325 fee/).textContent;
    const n = (t) => Number(t.match(/[−-]?\$([\d,]+)/)[1].replace(/,/g, ""));
    expect(n(head)).toBe(n(sentence.split(":").pop()));
    expect(within(dlg).queryByText(/It adds/)).toBeNull();
  });
});

describe("7 · no white first paint", () => {
  it("index.html paints night before any CSS or JS loads", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const head = html.slice(0, html.indexOf("<link"));
    expect(head).toMatch(/<style>[^<]*html,body[^<]*background:#0B0A08/);
  });
});

describe("9 · likely approvals now; the rest in order", () => {
  it("a sub-670 student gets only cards they're likely approved for, one now", () => {
    const p = { feeBudget: 0, spend: spend({ dining: 400, groceries: 400 }), credit: { score: 640 } };
    const r = optimalWallet(p);
    for (const id of r.wallet) {
      expect(eligibility(BY_ID[id], normalizeProfile(p)).ok).toBe(true);
      expect(scoreNeeded(BY_ID[id]), id).toBeLessThanOrEqual(640);
    }
    const t = applyTimeline(r.wallet, p);
    expect(t.filter((x) => x.month === 0)).toHaveLength(1);
  });
  it("standard $0 rewards cards need about 670", () => {
    expect(scoreNeeded(BY_ID["freedom-flex"])).toBe(670);
    expect(scoreNeeded(BY_ID["discover-it-secured"])).toBe(0);
  });
});

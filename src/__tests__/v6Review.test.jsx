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
import { benefitBreakdown, loungeNetworks, cardFee, membershipCost } from "../engine/v5/value.js";
import { walletValue, optimalWallet, walletScore, scoreFrom, scoreNeeded, eligibility } from "../engine/v5/methodology.js";
import { exploreRows, isLuxury } from "../engine/v5/explore.js";
import { rankPurchase, matchStore } from "../engine/v5/checkout.js";
import { applyTimeline } from "../engine/v5/lab.js";
import { SAPPHIRE_LEFT_PRIORITY_PASS } from "../data/loungeLocations.js";
import { LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP } from "../data/benefitUsage.js";
import Home from "../components/v6/Home.jsx";
import WalletLab from "../components/v6/lab/WalletLab.jsx";
import CardDetail from "../components/v6/CardDetail.jsx";
import Survey from "../components/v5/survey/Survey.jsx";
import { loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const spend = (o) => ({ dining: 0, groceries: 0, warehouse: 0, gas: 0, ev: 0, transit: 0, flights: 0, hotels: 0, rentals: 0, streaming: 0, drugstores: 0, online: 0, rent: 0, phone: 0, other: 300, ...o });

describe("1 · lounge visit limits", () => {
  const flyer = normalizeProfile({ travel: { trips: 10, lounges: "yes", homeAirport: "SEA" } });
  it("Altitude Connect: Priority Pass with 4 free visits a year, not unlimited", () => {
    expect(BY_ID["usb-altitude-connect"].loungeAccess.networks[0]).toMatch(/4 visits a year/);
    const nets = loungeNetworks(BY_ID["usb-altitude-connect"], flyer);
    expect(nets.prioritypass).toBeLessThanOrEqual(4 * LOUNGE_VISIT_VALUE);
  });
  it("a Priority Pass membership never inherits another network's pass count", () => {
    const nets = loungeNetworks(BY_ID["citi-strata-elite"], { ...flyer, brands: { ...flyer.brands, airlines: ["aa"] } });
    expect(nets.prioritypass).toBeGreaterThan(4 * LOUNGE_VISIT_VALUE);   // 20 visits wanted, membership unlimited
    expect(nets.aa).toBeLessThanOrEqual(4 * LOUNGE_VISIT_VALUE);         // 4 Admirals passes
  });
  it("Delta Sky Club visit limits: Reserve 15, Platinum 10, AA Globe 4 passes", () => {
    const delta = { ...flyer, brands: { ...flyer.brands, airlines: ["delta", "aa"] }, travel: { ...flyer.travel, trips: 20, homeAirport: "ATL" } };
    expect(loungeNetworks(BY_ID["delta-reserve"], delta).delta).toBe(Math.min(15 * LOUNGE_VISIT_VALUE, LOUNGE_RETAIL_CAP));   // capped at retail access price
    expect(loungeNetworks(BY_ID["amex-plat"], delta).delta).toBe(10 * LOUNGE_VISIT_VALUE);
    expect(loungeNetworks(BY_ID["citi-aa-globe"], { ...delta, travel: { ...delta.travel, homeAirport: "DFW" } }).aa).toBe(4 * LOUNGE_VISIT_VALUE);   // at an American hub
  });
  it("Sapphire Lounges left Priority Pass (Aug 15 2026): only cards that list them get them", () => {
    expect(SAPPHIRE_LEFT_PRIORITY_PASS).toBe("2026-08-15");
    const bos = normalizeProfile({ travel: { trips: 6, lounges: "yes", homeAirport: "BOS" } });
    expect(loungeNetworks(BY_ID["venture-x"], bos).sapphire).toBeUndefined();
    expect(loungeNetworks(BY_ID["csr"], bos).sapphire).toBeGreaterThan(0);
  });
});

describe("2 · required memberships count as fees unless already paid", () => {
  it("Robinhood Gold's $60 is in F(W) and the fee budget; not when they already pay it", () => {
    expect(cardFee(BY_ID["robinhood-gold"], normalizeProfile({}))).toBe(60);
    expect(cardFee(BY_ID["robinhood-gold"], normalizeProfile({ memberships: ["robinhood-gold"] }))).toBe(0);
    expect(walletValue(["robinhood-gold"], {}).F).toBe(60);
    expect(optimalWallet({ feeBudget: 0 }).wallet).not.toContain("robinhood-gold");
    expect(membershipCost(BY_ID["robinhood-gold"], normalizeProfile({ memberships: { robinhoodGold: true } })).paid).toBe(true);   // v4 object form
  });
  it("the Costco Visa needs a Costco membership the same way", () => {
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({}))).toBe(65);
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({ memberships: ["costco"] }))).toBe(0);
    expect(cardFee(BY_ID["costco-citi"], normalizeProfile({ spend: spend({ warehouse: 300 }), warehouseClub: "costco" }))).toBe(0);
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
  const P = { cardsHeld: ["amex-gold", "freedom-unlimited", "csp", "robinhood-gold"], feeBudget: 500, spend: spend({ dining: 600, groceries: 700, other: 600 }), travel: { trips: 4, homeAirport: "ATL", lounges: "sometimes" }, brands: { airlines: ["delta", "united"] } };
  it("score = round(100 × shown extra ÷ shown best extra)", () => {
    const s = walletScore(P);
    expect(s.score).toBe(scoreFrom(s.current.N, s.best.value.N));
    render(<Home profile={P} offers={[]} />);
    const basis = screen.getByTestId("home-score-basis").textContent;
    const [, score, n, best] = basis.match(/^Score (\d+) = \$([\d,]+) of a possible \$([\d,]+)/);
    expect(Number(score)).toBe(Math.round((100 * Number(n.replace(/,/g, ""))) / Number(best.replace(/,/g, ""))));
  });
  it("Wallet Lab labels a suggested setup and shows 'Your wallet now' = Home's score", () => {
    const home = walletScore(P).score;
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
    expect(r.bestElsewhere.credit.value).toBe(180);   // $300 quarterly × 0.6
  });
});

describe("6 · held-card detail: worth after its fee + break-even", () => {
  it("'Worth ≈ $X a year to you after its $325 fee' and one break-even line", () => {
    render(<CardDetail cardId="amex-gold" profile={{ cardsHeld: ["amex-gold"], spend: spend({ dining: 700, groceries: 700 }), brands: { perks: ["uber", "resy"] } }} onClose={() => {}} />);
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText(/after its \$325 fee/)).toBeInTheDocument();
    expect(within(dlg).getByText(/(cover its \$325 fee with \$[\d,]+ to spare|short of breaking even)/)).toBeInTheDocument();
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

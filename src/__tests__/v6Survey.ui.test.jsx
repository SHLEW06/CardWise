// @vitest-environment jsdom
/* v6 survey (docs/REDESIGN_SPEC.md §19, Part D). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Survey from "../components/v5/survey/Survey.jsx";
import { STEP_DEFS, stepsFor } from "../state/surveyAnswers.js";
import { loadV5Record, saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { AIRLINE_KEYS, TRANSFER_AIRLINES, HOTEL_BRANDS, SPEND_ROWS } from "../data/surveyOptions.js";
import { CARDS } from "../data/cards/index.js";
import { defaultSpendUnit } from "../engine/profileDefaults.js";
import { LOYALTY } from "../data/programs.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const cont = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("steps (§19)", () => {
  it("ten steps (v7b: perks in two); Quick asks the starred six + the reveal; Thorough asks all", () => {
    expect(STEP_DEFS.map((s) => s.id)).toEqual(["cards", "spend", "travel", "brands", "perksMaybe", "fee", "credit", "points", "yourPoints", "reveal"]);
    expect(stepsFor("quick")).toEqual(["cards", "spend", "travel", "brands", "perksMaybe", "fee", "reveal"]);
    expect(stepsFor("thorough")).toHaveLength(10);
  });
  it("starts with Quick (2 min) or Thorough (6 min) and shows progress", () => {
    render(<Survey />);
    fireEvent.click(screen.getByRole("button", { name: /^Quick · 2 min/ }));
    expect(screen.getByText("Step 1 of 7")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(heading()).toBe("Which cards do you have?");
  });
  it("every question is optional: Continue is always enabled, defaults fill the gaps", () => {
    const onDone = vi.fn();
    render(<Survey initialMode="quick" onDone={onDone} />);
    for (let k = 0; k < 6; k++) { expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(); cont(); }
    expect(heading()).toMatch(/wallet/);
    fireEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    const [p] = onDone.mock.calls[0];
    expect(p.feeBudget).toBe(100);
    expect(p.travel.homeAirport).toBeNull();
    expect(loadV5Record().completedAt).toBeTruthy();
  });
  it("answers save after every step", () => {
    render(<Survey initialMode="thorough" />);
    cont();                                                        // cards
    expect(loadV5Record().answers).toMatchObject({ v: 6, mode: "thorough" });
    expect(loadV5Record().completedAt).toBeNull();
  });
});

describe("1 · cards", () => {
  it("searchable, real photos, selected tiles highlight", () => {
    render(<Survey initialMode="quick" />);
    fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "sapphire reserve" } });
    const tile = screen.getByRole("button", { name: /Sapphire Reserve/ });
    fireEvent.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(within(tile).getByRole("img").className).toMatch(/is-selected/);
    expect(screen.getByText("Your cards (1)")).toBeInTheDocument();
    cont();
    expect(loadV5Profile().cardsHeld).toEqual(["csr"]);
  });
});

describe("2 · spending", () => {
  it("every row has a slider and a typed $ field; yearly shown; Costco separate from groceries", () => {
    render(<Survey initialMode="thorough" initialStepId="spend" editOnly={false} />);
    /* v7 A1: flights, hotels and vacation rentals default to yearly. */
    for (const r of SPEND_ROWS) {
      const name = defaultSpendUnit(r.key) === "year" ? `${r.label}, yearly total, in dollars` : `${r.label} per month, in dollars`;
      expect(screen.getByLabelText(name)).toHaveAttribute("inputmode", "numeric");
    }
    expect(screen.getByText(/Warehouse clubs don't count as groceries/)).toBeInTheDocument();
    const dining = screen.getByLabelText("Dining out per month, in dollars");
    fireEvent.focus(dining);
    fireEvent.change(dining, { target: { value: "4,000" } });
    fireEvent.blur(dining);
    expect(screen.getByText("$48,000 a year")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Costco$/ }));
    cont();
    expect(loadV5Profile()).toMatchObject({ gasAt: "costco" });
    expect(loadV5Profile().spend.dining).toBe(4000);
    expect(loadV5Profile().spendYear.dining).toBe(48000);
  });
  it("v7: any row switches Monthly / Yearly; a typed yearly total is stored yearly", () => {
    render(<Survey initialMode="thorough" initialStepId="spend" />);
    expect(screen.getByText("Vacation rentals (Airbnb, Vrbo)")).toBeInTheDocument();
    expect(screen.getByText(/Not Fine Hotels \+ Resorts or The Edit/)).toBeInTheDocument();
    const seg = screen.getByRole("radiogroup", { name: "Groceries (supermarkets): monthly or yearly" });
    fireEvent.click(within(seg).getByRole("radio", { name: "Yearly" }));
    const f = screen.getByLabelText("Groceries (supermarkets), yearly total, in dollars");
    fireEvent.focus(f);
    fireEvent.change(f, { target: { value: "7,250" } });
    fireEvent.blur(f);
    expect(screen.getByText(/≈ \$604 a month/)).toBeInTheDocument();
    cont();
    const p = loadV5Profile();
    expect(p.spendYear.groceries).toBe(7250);
    expect(p.spend.groceries).toBeCloseTo(7250 / 12, 6);
    expect(p.spendUnits.groceries).toBe("year");
    expect(p.spendUnits.flights).toBe("year");
  });
  it("Quick shows the main rows with 'More categories'", () => {
    render(<Survey initialMode="quick" />);
    cont();
    expect(screen.queryByLabelText("EV charging per month, in dollars")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /More categories/ }));
    expect(screen.getByLabelText("EV charging per month, in dollars")).toBeInTheDocument();
  });
});

describe("3 · travel", () => {
  it("v7b: home airports by code or city, trips each; airlines inferred; lounges three ways", () => {
    render(<Survey initialMode="quick" initialStepId="travel" />);
    fireEvent.change(screen.getByLabelText("Add a home airport"), { target: { value: "atlanta" } });
    fireEvent.click(screen.getByRole("option", { name: /ATL · Atlanta/ }));
    expect(screen.getByLabelText("Round trips a year from ATL")).toHaveValue("4");
    expect(screen.getByTestId("airlines-inferred")).toHaveTextContent("Airlines you'd likely fly: Delta (most trips)");
    expect(screen.getByText(/Priority Pass is a network of independent lounges/)).toBeInTheDocument();
    for (const n of ["I'd pay extra for lounge access", /^I'd love it if my card included it/, "Don't care"]) expect(screen.getByRole("radio", { name: n })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "I'd pay extra for lounge access" }));
    fireEvent.click(screen.getByRole("radio", { name: "4–9" }));
    fireEvent.click(screen.getByRole("radio", { name: "I have brands I like" }));   // v7c: brand chips only after the mode question
    fireEvent.click(screen.getByRole("button", { name: "Hyatt" }));
    cont();
    expect(loadV5Profile().travel).toMatchObject({ trips: 4, homeAirport: "ATL", lounges: "yes", hotelNights: 6, airlineChoice: "auto", hotelChoice: "manual" });
    expect(loadV5Profile().travel.airports[0]).toMatchObject({ code: "ATL", trips: 4 });
    expect(loadV5Profile().brands).toMatchObject({ airlines: ["delta"], hotels: ["hyatt"] });
  });
  it("airlines: US carriers, every transfer partner and every co-brand, grouped by alliance", () => {
    for (const k of ["delta", "united", "aa", "southwest", "alaska", "jetblue", "spirit", "frontier", "breeze"]) expect(AIRLINE_KEYS).toContain(k);
    const airPartners = TRANSFER_AIRLINES.filter((k) => LOYALTY[k]?.kind === "air");
    for (const k of airPartners) expect(AIRLINE_KEYS, k).toContain(k);
    for (const c of CARDS) if (LOYALTY[c.pointCurrency]?.kind === "air") expect(AIRLINE_KEYS, c.id).toContain(c.pointCurrency);
    saveV5Profile({ travel: { airports: [{ code: "ATL", trips: 4 }] } });
    render(<Survey initialMode="thorough" initialStepId="travel" initialProfile={loadV5Profile()} />);
    fireEvent.click(within(screen.getByTestId("airlines-inferred")).getByRole("radio", { name: "I'll choose" }));   // v7b: airlines are inferred unless they choose
    for (const g of ["US airlines", "Star Alliance", "oneworld", "SkyTeam", "Other airlines"]) expect(screen.getByText(g)).toBeInTheDocument();
  });
  it("v7c: hotel brand chips are brands only — no 'let CardWise pick' chips", () => {
    expect(HOTEL_BRANDS.map((h) => h.label)).toEqual(["Marriott", "Hilton", "Hyatt", "IHG", "Wyndham", "Choice", "Best Western", "Accor", "Sonesta"]);
  });
});

describe("4 · brands (perks)", () => {
  it("v7b: Step A (already use, full value) then Step B (would use, bundles explained); perks named exactly", () => {
    saveV5Profile({ cardsHeld: ["amex-gold"] });
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={loadV5Profile()} />);
    expect(heading()).toBe("Perks you already pay for or use");
    expect(screen.getByText(/These are card perks, not point redemptions/)).toBeInTheDocument();
    for (const g of ["Food & delivery", "Rides", "Shopping & wellness", "Streaming & news", "Travel extras", "Travel credits"]) expect(screen.getByText(g)).toBeInTheDocument();
    const food = screen.getByRole("group", { name: "Food & delivery: already use" });
    fireEvent.click(within(food).getByRole("button", { name: "Dunkin' credit" }));
    fireEvent.click(within(food).getByRole("button", { name: "Resy dining credit" }));
    expect(screen.getByRole("heading", { name: "Your cards already give you" })).toBeInTheDocument();
    expect(screen.getAllByText("Uber Cash (Uber rides + Uber Eats)").length).toBeGreaterThan(0);   // Amex Gold pays it
    cont();
    expect(heading()).toBe("Would you use these if a card included them?");
    expect(screen.getByText(/Premium cards bundle many perks; you don't buy them one at a time/)).toBeInTheDocument();
    const food2 = screen.getByRole("group", { name: "Food & delivery: would use" });
    expect(within(food2).queryByRole("button", { name: "Dunkin' credit" })).toBeNull();          // Step A picks aren't asked again
    const travel = screen.getByRole("group", { name: "Travel extras: would use" });
    fireEvent.click(within(travel).getByRole("button", { name: "TSA PreCheck / Global Entry fee credit" }));
    cont();
    expect(loadV5Profile().brands.perks).toEqual(["dunkin", "resy"]);
    expect(loadV5Profile().brands.perksMaybe).toEqual(["globalentry"]);
  });
});

describe("5 · fee budget", () => {
  it("set amounts or a typed one", () => {
    render(<Survey initialMode="quick" initialStepId="fee" />);
    expect(heading()).toBe("Most you'd pay in yearly card fees, all cards combined.");
    fireEvent.click(screen.getByRole("radio", { name: "Type an amount" }));
    const f = screen.getByLabelText("Fee budget in dollars a year");
    fireEvent.change(f, { target: { value: "425" } });
    fireEvent.blur(f);
    cont();
    expect(loadV5Profile().feeBudget).toBe(425);
  });
});

describe("6–9 · thorough steps", () => {
  it("credit: score band, cards in 24 months, past Amex / Chase cards", () => {
    render(<Survey initialMode="thorough" initialStepId="credit" />);
    fireEvent.click(screen.getByRole("radio", { name: "740–799" }));
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Past Amex cards" })).getByRole("button", { name: "Amex Gold" }));
    cont();
    expect(loadV5Profile().credit).toMatchObject({ score: 770, newCards24mo: 3, pastAmex: ["amex-gold"] });
  });
  it("point values are pre-selected from the airlines and hotels they picked", () => {
    saveV5Profile({ cardsHeld: ["csp"], brands: { airlines: ["united"] } });
    render(<Survey initialProfile={loadV5Profile()} initialMode="thorough" initialStepId="points" />);
    const group = screen.getByRole("group", { name: /Chase points partners/ });
    expect(within(group).getByRole("button", { name: /^United/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: /^Aeroplan/ }));
    cont();
    expect(loadV5Profile().partnerPicks.chase).toEqual(["united", "aeroplan"]);
  });
  it("Your points: editorial rows with a photo and ≈ % back", () => {
    saveV5Profile({ cardsHeld: ["freedom-unlimited"], brands: { airlines: ["united"] } });
    render(<Survey initialProfile={loadV5Profile()} initialMode="thorough" initialStepId="yourPoints" />);
    expect(heading()).toBe("Here's what your points can do.");
    expect(screen.getByText(/% back$/)).toBeInTheDocument();
  });
  it("the reveal shows the score, the optimal wallet at their budget, and Open Wallet Lab", () => {
    saveV5Profile({ cardsHeld: ["citi-double-cash"], feeBudget: 250 });
    const onOpenLab = vi.fn();
    render(<Survey initialProfile={loadV5Profile()} initialMode="quick" initialStepId="reveal" onOpenLab={onOpenLab} />);
    expect(screen.getByRole("meter", { name: "Wallet Score" })).toBeInTheDocument();
    expect(screen.getByText(/a year with the best setup/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open Wallet Lab/ }));
    expect(onOpenLab).toHaveBeenCalled();
  });
});

describe("editing one step from Profile", () => {
  it("opens with the saved answers in place and Save returns", () => {
    saveV5Profile({ cardsHeld: ["csr"], feeBudget: 750, travel: { trips: 4, homeAirport: "SEA", lounges: "yes" } });
    const onDone = vi.fn();
    render(<Survey initialProfile={loadV5Profile()} initialStepId="travel" editOnly onDone={onDone} />);
    expect(screen.getByLabelText("Round trips a year from SEA")).toHaveValue("4");   // v7b: the old answer becomes the first airport row
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const [p] = onDone.mock.calls[0];
    expect(p).toMatchObject({ cardsHeld: ["csr"], feeBudget: 750 });
    expect(p.travel.homeAirport).toBe("SEA");
  });
});

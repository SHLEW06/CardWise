// @vitest-environment jsdom
/* C19 (v7c): no survey question allows contradictory selections, and the
   mode question comes first wherever "Let CardWise pick" exists. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { STEP_DEFS } from "../state/surveyAnswers.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const FLYER = { travel: { tripRows: [{ from: "ATL", to: "us", trips: 3 }, { from: "NYC", to: "c:Tokyo, Japan", trips: 1 }], lounges: "yes", hotelNights: 12 } };
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const open = (stepId, profile = FLYER) => { saveV5Profile(profile); render(<Survey initialMode="thorough" initialStepId={stepId} initialProfile={loadV5Profile()} />); };

describe("C19 · mode question first wherever 'Let CardWise pick' exists", () => {
  it("airlines, lounges and hotels: the mode radio comes first, its default is 'Let CardWise pick', item chips only after 'I'll choose' / 'I have brands I like'", () => {
    open("travel");
    const cases = [
      { mode: "How do you pick airlines?", auto: "Let CardWise pick", manual: "I'll choose", chips: () => screen.queryByText("Star Alliance") },
      { mode: "Which lounges?", auto: "Let CardWise pick the best value", manual: "I'll choose", chips: () => screen.queryByRole("group", { name: "Lounge networks" }) },
      { mode: "How do you pick hotels?", auto: "Let CardWise pick the best program for me", manual: "I have brands I like", chips: () => screen.queryByRole("group", { name: "Hotel brands you like" }) },
    ];
    for (const c of cases) {
      const g = screen.getByRole("radiogroup", { name: c.mode });
      expect(within(g).getByRole("radio", { name: c.auto }), c.mode).toHaveAttribute("aria-checked", "true");
      expect(c.chips(), c.mode).toBeNull();
      fireEvent.click(within(g).getByRole("radio", { name: c.manual }));
      const chips = c.chips();
      expect(chips, c.mode).not.toBeNull();
      expect(before(g, chips), `${c.mode} comes before its chips`).toBe(true);
    }
  });
  it("every radio group has at most one choice selected", () => {
    open("travel");
    for (const g of screen.getAllByRole("radiogroup")) {
      expect(within(g).queryAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true").length, g.getAttribute("aria-label") || g.getAttribute("aria-labelledby")).toBeLessThanOrEqual(1);
    }
  });
  it("mutually exclusive answers are radios, not checkbox chips", () => {
    open("travel");
    for (const name of ["How do you pick airlines?", "How do you pick hotels?", "Where do you usually stay?", "Which lounges?", "Checked bags per trip", "Paid hotel nights a year", "How you book flights and hotels", "Airport lounges"]) {
      expect(screen.getByRole("radiogroup", { name }), name).toBeInTheDocument();
    }
    expect(within(screen.getByTestId("strategy-helper")).queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("C19 · the engine never holds a contradiction", () => {
  it("hotels: 'Let CardWise pick' never also values brand picks; brands never also get a pick", () => {
    const auto = normalizeProfile({ ...FLYER, travel: { ...FLYER.travel, hotelChoice: "auto" }, brands: { hotelsPicked: ["hilton"] } });
    expect(auto.brands.hotels).toEqual([auto.brands.hotelPick.program]);
    const manual = normalizeProfile({ ...FLYER, travel: { ...FLYER.travel, hotelChoice: "manual" }, brands: { hotelsPicked: ["hilton"] } });
    expect(manual.brands.hotels).toEqual(["hilton"]);
    expect(manual.brands.hotelPick).toBeNull();
  });
  it("lounges: 'Let CardWise pick' clears networks; perks: 'already spend' is only asked about picked perks", () => {
    expect(normalizeProfile({ travel: { trips: 2, lounges: "yes", loungeChoice: "auto", loungeNetworks: ["centurion"] } }).travel.loungeNetworks).toEqual([]);
    const p = normalizeProfile({ brands: { perksUse: ["uber"], perksSpend: ["uber", "doordash"] } });
    expect(p.brands.perks).toEqual(["uber"]);
    expect(p.brands.perksMaybe).toEqual([]);
  });
  it("one perk step (no 'already use' and 'would use' lists that could both hold a perk)", () => {
    expect(STEP_DEFS.map((s) => s.id)).not.toContain("perksMaybe");
  });
});

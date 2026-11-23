// @vitest-environment jsdom
/* v7c 5e — now vs later: "Will your spending change?" after spending;
   results in two tabs (Now / Your plan); the plan respects 6-month spacing,
   Chase 5/24 and issuer rules, holds premium cards back until the future
   spending pays for them, and shows closed cards only as an upgrade path. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { NEW_GRAD_MONTHLY, cleanGrowth, monthsUntil } from "../data/growth.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { planRoadmap, futureProfile } from "../engine/v5/futurePlan.js";
import { isChase } from "../engine/v5/methodology.js";
import { STEP_DEFS } from "../state/surveyAnswers.js";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import Survey from "../components/v5/survey/Survey.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const TODAY = new Date(Date.UTC(2026, 10, 22));
const cont = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const STUDENT = {
  cardsHeld: ["freedom-unlimited"], spend: { dining: 150, groceries: 200, other: 150, online: 50 }, travel: { trips: 1 }, credit: { score: 720 }, wants: "travel",
  partnerPicks: { chase: ["hyatt", "united"] }, brands: { airlines: ["united"], hotels: ["hyatt"] },
  growth: { change: "grow", when: "2028-05", label: "after graduating", trips: 12, cabin: "economy", monthly: { dining: 900, groceries: 600, gas: 150, transit: 200, flights: 800, hotels: 500, online: 400, rent: 2200, phone: 150, other: 1200, streaming: 50, drugstores: 40 } },
};

describe("5e.1 · 'Will your spending change?'", () => {
  it("comes right after spending", () => {
    const ids = STEP_DEFS.map((s) => s.id);
    expect(ids.indexOf("growth")).toBe(ids.indexOf("spend") + 1);
  });
  it("'About the same' is the default and skips the rest", () => {
    render(<Survey initialMode="quick" initialStepId="growth" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Will your spending change?");
    expect(screen.getByRole("radio", { name: "About the same" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("growth-when")).toBeNull();
    cont();
    expect(loadV5Profile().growth).toEqual({ change: "same" });
  });
  it("'It'll grow' asks when, expected monthly spending (pre-filled for a new grad) and expected travel", () => {
    render(<Survey initialMode="quick" initialStepId="growth" />);
    fireEvent.click(screen.getByRole("radio", { name: "It'll grow" }));
    fireEvent.change(screen.getByLabelText("Month your spending changes"), { target: { value: "2028-05" } });
    fireEvent.change(screen.getByLabelText("What happens then"), { target: { value: "after graduating" } });
    expect(screen.getByLabelText("Expected monthly: Dining out")).toHaveValue(String(NEW_GRAD_MONTHLY.dining));
    fireEvent.change(screen.getByLabelText("Expected monthly: Dining out"), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Expected round trips a year"), { target: { value: "10" } });
    fireEvent.click(within(screen.getByTestId("growth-travel")).getByRole("radio", { name: "Premium economy" }));
    cont();
    expect(loadV5Profile().growth).toMatchObject({ change: "grow", when: "2028-05", label: "after graduating", trips: 10, cabin: "premium", monthly: { dining: 800, rent: NEW_GRAD_MONTHLY.rent } });
  });
  it("the future profile uses that spending and travel", () => {
    const f = futureProfile(STUDENT);
    expect(f.spendYear.dining).toBe(900 * 12);
    expect(f.travel.trips).toBe(12);
    expect(futureProfile({ ...STUDENT, growth: { change: "same" } })).toBeNull();
    expect(cleanGrowth({ change: "grow" }).monthly).toEqual(NEW_GRAD_MONTHLY);
  });
});

describe("5e.2 · Your plan", () => {
  const r = planRoadmap(STUDENT, { today: TODAY });
  const applies = r.steps.filter((s) => s.how === "apply");
  it("one new card every 6 months", () => {
    for (let i = 1; i < applies.length; i++) expect(applies[i].month - applies[i - 1].month).toBeGreaterThanOrEqual(6);
  });
  it("holds a premium card back until the future spending makes it worth it", () => {
    const G = monthsUntil("2028-05", TODAY);
    const premium = r.steps.filter((s) => s.cardId && BY_ID[s.cardId].annualFee >= 250);
    expect(premium.length).toBeGreaterThan(0);
    for (const s of premium) {
      expect(s.era).toBe("later");
      expect(s.month).toBeGreaterThanOrEqual(G);
      expect(r.now.wallet).not.toContain(s.cardId);
      expect(s.why).toMatch(/ from \w{3} \d{4}, when .* covers? its \$[\d,]+ fee\.$/);
    }
  });
  it("each step: date window, card, why now, its net value from then on, what to drop", () => {
    expect(r.steps.length).toBeGreaterThan(1);
    for (const s of r.steps) {
      expect(s.window).toMatch(/^(From )?\w{3} \d{4}( – \w{3} \d{4})?$/);
      expect(typeof s.why).toBe("string");
      expect(Number.isFinite(s.net)).toBe(true);
      expect(Array.isArray(s.drop)).toBe(true);
    }
  });
  it("Chase 5/24: no Chase application at 5 or more new cards; Chase cards say where they leave you", () => {
    const full = planRoadmap({ ...STUDENT, credit: { ...STUDENT.credit, newCards24mo: 5 } }, { today: TODAY });
    expect(full.steps.filter((s) => s.how === "apply" && isChase(BY_ID[s.cardId]))).toEqual([]);
    for (const s of applies.filter((x) => isChase(BY_ID[x.cardId]))) expect(s.notes.join(" ")).toMatch(/under 5\/24 \(you'd be at \d\/24 after this\)/);
  });
  it("closed cards only ever appear as an upgrade path", () => {
    const marriott = planRoadmap({ cardsHeld: ["marriott-boundless"], brands: { hotels: ["marriott"] }, travel: { trips: 2, hotelNights: 6, hotelChoice: "manual" },
      growth: { change: "grow", when: "2028-01", trips: 10, monthly: { ...NEW_GRAD_MONTHLY, hotels: 800, flights: 600 } } }, { today: TODAY });
    for (const p of [r, marriott]) for (const s of p.steps) if (s.cardId && BY_ID[s.cardId].availabilityStatus !== "openToNewApplicants") {
      expect(s.how, s.cardId).toBe("upgrade");
      expect(s.notes.join(" ")).toMatch(/^Upgrade path/);
    }
  });
  it("with no change, the plan is today's wallet one card at a time", () => {
    const same = planRoadmap({ ...STUDENT, growth: { change: "same" } }, { today: TODAY });
    expect(same.later).toBeNull();
    expect(same.steps.every((s) => s.era === "now")).toBe(true);
  });
});

describe("5e · results get two tabs", () => {
  it("Now and Your plan", () => {
    saveV5Profile(STUDENT);
    render(<Survey initialMode="quick" initialStepId="reveal" initialProfile={loadV5Profile()} />);
    const tabs = screen.getByRole("tablist", { name: "Now or later" });
    expect(within(tabs).getByRole("tab", { name: "Now" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Get now")).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("tab", { name: "Your plan" }));
    const plan = screen.getByTestId("plan-timeline");
    expect(within(plan).getAllByText(/a year from then on, after the application cost/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Get now")).toBeNull();
  });
});

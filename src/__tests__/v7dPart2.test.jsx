// @vitest-environment jsdom
/* v7d Part 2 — perk rows explain why the number doesn't move: the result
   line names the binding limit, a "plan around it" toggle counts every
   period, and a spending change that doesn't move the value says why. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { habitPools, habitCreditValue, creditLimit, cleanHabit, HABIT_BY_KEY } from "../data/perkHabits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { habitResult } from "../components/v5/survey/PerksStep.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const resyPlat = BY_ID["amex-plat"].credits.find((c) => /Resy/.test(c.name));

describe("2.1 · the result line names the binding limit", () => {
  it("timing: 'it's $100 a quarter, and a few visits a year usually fall in about 2–3 quarters'", () => {
    const habits = { resy: { answer: "few", spend: 400 } };
    const r = habitCreditValue(resyPlat, habitPools(habits));
    expect(Math.round(r.value)).toBe(247);
    expect(creditLimit(resyPlat, r, "few")).toEqual({ binding: "timing", text: "it's $100 a quarter, and a few visits a year usually fall in about 2–3 quarters" });
    expect(habitResult("resy", habits).text).toBe("You'd use about $247 of the $400 a year the Amex Platinum gives for this: it's $100 a quarter, and a few visits a year usually fall in about 2–3 quarters.");
  });
  it("spending: '…limited by your ~$X a year there'", () => {
    const habits = { resy: { answer: "monthly", spend: 150 } };
    expect(habitResult("resy", habits).text).toMatch(/You'd use about \$150 of the \$400 .*: limited by your ~\$150 a year there\.$/);
  });
  it("all of it: no reason needed", () => {
    expect(habitResult("resy", { resy: { answer: "weekly" } }).text).toMatch(/You'd use about \$400 of the \$400 a year the Amex Platinum gives for this\.$/);
  });
});

describe("2.2 · 'I'd plan visits to use it every quarter'", () => {
  it("counts every period: value = min(face, spend)", () => {
    const planned = { resy: { answer: "few", spend: 400, plan: true } };
    expect(habitCreditValue(resyPlat, habitPools(planned)).value).toBe(400);
    expect(cleanHabit(HABIT_BY_KEY.resy, planned.resy).plan).toBe(true);
    const p = normalizeProfile({ brands: { habits: planned } });
    expect(benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => /Resy/.test(i.label)).value).toBe(400);
  });
  it("Resy at 'A few times a year' + $400 shows the timing reason; with the toggle on it counts $400", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    const row = screen.getByTestId("habit-resy");
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    fireEvent.click(within(row).getByRole("button", { name: "Adjust" }));
    fireEvent.change(within(row).getByLabelText(/Yearly spending: Restaurants you book on Resy/), { target: { value: "400" } });
    expect(within(row).getByTestId("habit-result-resy")).toHaveTextContent("You'd use about $247 of the $400");
    expect(within(row).getByTestId("habit-result-resy")).toHaveTextContent("it's $100 a quarter, and a few visits a year usually fall in about 2–3 quarters");
    fireEvent.click(within(within(row).getByTestId("habit-plan-resy")).getByRole("checkbox"));
    expect(within(row).getByTestId("habit-plan-resy")).toHaveTextContent("I'd plan visits to use it every quarter");
    expect(within(row).getByTestId("habit-result-resy")).toHaveTextContent("You'd use about $400 of the $400");
  });
  it("only for monthly, quarterly and semiannual credits", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    const row = screen.getByTestId("habit-lululemon");      // the Platinum's lululemon credit is quarterly
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    expect(within(row).queryByTestId("habit-plan-lululemon")).not.toBeNull();
  });
});

describe("2.3 · a spending change that doesn't move the number says why", () => {
  it("inline reason instead of silence", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    const row = screen.getByTestId("habit-resy");
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    fireEvent.click(within(row).getByRole("button", { name: "Adjust" }));
    const input = within(row).getByLabelText(/Yearly spending: Restaurants you book on Resy/);
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.change(input, { target: { value: "800" } });
    expect(within(row).getByTestId("habit-result-resy")).toHaveTextContent("$247 of the $400");
    expect(within(row).getByTestId("habit-why-resy")).toHaveTextContent("Spending more here doesn't change it: it's $100 a quarter");
  });
});

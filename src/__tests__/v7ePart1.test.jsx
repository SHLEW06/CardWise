// @vitest-environment jsdom
/* v7e Part 1 — exact yearly amounts in the habits step: "About $___ a year"
   and "Over about ___ separate visits / purchases", always visible; typed
   numbers win; the result line shows the three limits. */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { habitPools, habitCreditValue } from "../data/perkHabits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { habitResult } from "../components/v5/survey/PerksStep.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });
const lulu = BY_ID["amex-plat"].credits.find((c) => /lululemon/.test(c.name));
const lv = (a) => habitCreditValue(lulu, habitPools({ lululemon: a })).value;

describe("1.4 · lululemon ($75 a quarter)", () => {
  it("$200 over 2 purchases → $150", () => expect(lv({ answer: "few", spend: 200, count: 2 })).toBe(150));
  it("over 3 purchases → $200", () => expect(lv({ answer: "few", spend: 200, count: 3 })).toBe(200));
  it("with the plan toggle on → $200", () => expect(lv({ answer: "few", spend: 200, count: 2, plan: true })).toBe(200));
  it("the result line shows the three limits and which applies", () => {
    expect(habitResult("lululemon", { lululemon: { answer: "few", spend: 200, count: 2 } }).text)
      .toBe("Counts $150 of the $300 a year the Amex Platinum gives: you'd spend $200, but 2 purchases use 2 of the 4 quarterly $75 credits. Spread over 3 quarters → $200.");
  });
  it("the engine uses the same numbers", () => {
    const p = normalizeProfile({ brands: { habits: { lululemon: { answer: "few", spend: 200, count: 2 } } } });
    expect(benefitBreakdown(BY_ID["amex-plat"], p).items.find((i) => /lululemon/.test(i.label)).value).toBe(150);
  });
});

describe("1.1 / 1.2 · two inputs, always visible; typed numbers win", () => {
  it("shows the estimate once an answer is picked, and typing $200 after 'A few times a year' changes the result", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    const row = screen.getByTestId("habit-lululemon");
    expect(within(row).queryByTestId("habit-numbers-lululemon")).toBeNull();          // Never: no inputs
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    const spend = within(row).getByLabelText("Yearly spending: lululemon");
    const count = within(row).getByLabelText("Separate purchases: lululemon");
    expect(spend).toHaveValue("300");       // 3 × $100, an estimate
    expect(count).toHaveValue("3");
    expect(within(row).getByTestId("habit-spend-tag-lululemon")).toHaveTextContent("estimate");
    const before = within(row).getByTestId("habit-result-lululemon").textContent;
    fireEvent.change(spend, { target: { value: "200" } });
    expect(within(row).getByTestId("habit-spend-tag-lululemon")).toHaveTextContent("your number");
    expect(within(row).getByTestId("habit-result-lululemon").textContent).not.toBe(before);
    expect(within(row).getByTestId("habit-result-lululemon")).toHaveTextContent("Counts $200 of the $300");
    fireEvent.change(count, { target: { value: "2" } });
    expect(within(row).getByTestId("habit-result-lululemon")).toHaveTextContent("Counts $150 of the $300");
  });
  it("changing the frequency after typing asks 'Reset to the estimate?'", () => {
    saveV5Profile({});
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={loadV5Profile()} />);
    const row = screen.getByTestId("habit-lululemon");
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    fireEvent.change(within(row).getByLabelText("Yearly spending: lululemon"), { target: { value: "200" } });
    fireEvent.click(within(row).getByRole("radio", { name: "About monthly" }));
    expect(within(row).getByTestId("habit-reset-lululemon")).toHaveTextContent("Reset to the estimate?");
    fireEvent.click(within(row).getByRole("button", { name: "Keep my numbers" }));
    expect(within(row).getByLabelText("Yearly spending: lululemon")).toHaveValue("200");
    fireEvent.click(within(row).getByRole("radio", { name: "Weekly+" }));
    fireEvent.click(within(row).getByRole("button", { name: "Reset" }));
    expect(within(row).getByLabelText("Yearly spending: lululemon")).toHaveValue("5200");
  });
});

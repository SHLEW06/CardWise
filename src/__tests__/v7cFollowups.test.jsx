// @vitest-environment jsdom
/* v7c follow-ups (owner, 2026-11-23):
   1. "Would start if free" subscriptions count $0 — only what they'd pay for
      anyway — and are listed under "Nice extras" as "you'd try it if free".
   2. Typical order sizes and prices are labelled "estimate" in Show the
      math, and the survey lets the person enter their own average (takeout
      order, ride). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BY_ID } from "../data/cards/index.js";
import { HABIT_BY_KEY, habitPools, habitSpend, cleanHabit, habitMathLines, triesIfFree } from "../data/perkHabits.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { allBenefits } from "../engine/v5/lab.js";
import Survey, { habitResult } from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import WhyThisCard from "../components/v7/WhyThisCard.jsx";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const prof = (habits, extra = {}) => normalizeProfile({ travel: { trips: 2 }, ...extra, brands: { habits } });

describe("1 · 'Would start if free' counts $0, listed as a Nice extra", () => {
  it("counts $0 — the same wallet value as 'No'", () => {
    const free = prof({ walmartplus: { answer: "free" }, peacock: { answer: "free" } });
    const no = prof({ walmartplus: { answer: "no" }, peacock: { answer: "no" } });
    for (const id of ["amex-plat"]) {
      const b = benefitBreakdown(BY_ID[id], free);
      expect(b.items.filter((i) => /Walmart\+|digital entertainment/i.test(i.label))).toEqual([]);
      expect(walletValue([id], free).net).toBe(walletValue([id], no).net);
    }
    expect(habitPools({ walmartplus: { answer: "free" } })).toEqual({});
    expect(habitSpend(HABIT_BY_KEY.walmartplus, { answer: "free" }).yearly).toBe(0);
    expect(triesIfFree(HABIT_BY_KEY.walmartplus, { answer: "free" })).toBe(true);
    expect(triesIfFree(HABIT_BY_KEY.walmartplus, { answer: "pay" })).toBe(false);
  });
  it("'Already pay for it' still counts up to the price", () => {
    expect(benefitBreakdown(BY_ID["amex-plat"], prof({ walmartplus: { answer: "pay" } })).items.find((i) => /Walmart\+/.test(i.label)).value).toBe(155);
  });
  it("is listed under Nice extras as 'you'd try it if free', with no dollar amounts", () => {
    const b = benefitBreakdown(BY_ID["amex-plat"], prof({ walmartplus: { answer: "free" } }));
    const x = b.extras.find((e) => e.kind === "tryFree");
    expect(x.label).toMatch(/Walmart\+.*: you'd try it if free$/);
    expect(x.label).not.toMatch(/\$/);
    expect(b.unused.find((u) => /Walmart\+/.test(u.label))).toBeUndefined();
    render(<CardDetail cardId="amex-plat" profile={{ travel: { trips: 2 }, brands: { habits: { walmartplus: { answer: "free" } } } }} onClose={() => {}} />);
    const extras = screen.getByTestId("nice-extras");
    expect(within(extras).getByText(/you'd try it if free/)).toBeInTheDocument();
    expect(extras.querySelector("ul").textContent).not.toMatch(/\$/);
  });
  it("the Wallet Lab's All benefits shows it as a Nice extra", () => {
    const rows = allBenefits(walletValue(["amex-plat"], prof({ walmartplus: { answer: "free" } })));
    const r = rows.find((x) => /you'd try it if free/.test(x.label));
    expect(r.flags).toContain("Nice extra");
    expect(r.value).toBe(0);
  });
  it("the survey says it counts $0", () => {
    const res = habitResult("walmartplus", { walmartplus: { answer: "free" } });
    expect(res.value).toBe(0);
    expect(res.text).toMatch(/^Counted \$0/);
    expect(res.text).toMatch(/try if free/);
  });
});

describe("2 · estimates are labelled; the person can enter their own average", () => {
  it("Show the math labels typical figures 'estimate' and own figures as theirs", () => {
    expect(habitMathLines(["takeout:any"], { takeout: { answer: "monthly", apps: ["any"] } }))
      .toEqual(["Takeout / food delivery: 12 orders a year × $35 an order (estimate) = $420 a year"]);
    expect(habitMathLines(["takeout:any"], { takeout: { answer: "monthly", apps: ["any"], size: 22 } }))
      .toEqual(["Takeout / food delivery: 12 orders a year × $22 an order (your average) = $264 a year"]);
    expect(habitMathLines(["peacock"], { peacock: { answer: "pay" } })).toEqual(["Peacock: $132 a year (estimate)"]);
    expect(habitMathLines(["rideshare:uber"], { rideshare: { answer: "few", apps: ["uber"], spend: 400 } })).toEqual(["Rideshare: $400 a year (your figure)"]);
    expect(habitMathLines(["dining", "flights"], {})).toEqual([]);
  });
  it("their own average changes the spending a credit can pay back", () => {
    expect(cleanHabit(HABIT_BY_KEY.takeout, { answer: "monthly", apps: ["any"], size: "8" }).size).toBe(8);
    expect(cleanHabit(HABIT_BY_KEY.peacock, { answer: "pay", size: 8 }).size).toBeUndefined();
    const own = prof({ takeout: { answer: "monthly", apps: ["any"], size: 8 } });
    expect(habitPools(own.brands.habits)["takeout:any"].yearly).toBe(96);
    /* the Amex Gold's $120 Uber Cash can only pay back the $96 they spend */
    expect(benefitBreakdown(BY_ID["amex-gold"], own).items.find((i) => /Uber Cash/.test(i.label)).value).toBe(96);
  });
  it("the survey asks for their average order and ride (typical figure marked as an estimate)", () => {
    saveV5Profile({ cardsHeld: ["amex-gold"] });
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={loadV5Profile()} />);
    const takeout = screen.getByTestId("habit-takeout");
    fireEvent.click(within(takeout).getByRole("radio", { name: "About monthly" }));
    expect(within(takeout).getByTestId("habit-size-takeout")).toHaveTextContent("Your average order: $typical $35, an estimate");
    fireEvent.change(within(takeout).getByLabelText("Your average order: Takeout / food delivery"), { target: { value: "20" } });
    expect(within(takeout).getByTestId("habit-size-takeout")).toHaveTextContent("your figure");
    expect(within(takeout).getByTestId("habit-result-takeout")).toHaveTextContent("You'd use about $120 of the $120");
    const ride = screen.getByTestId("habit-rideshare");
    fireEvent.click(within(ride).getByRole("radio", { name: "A few times a year" }));
    expect(within(ride).getByTestId("habit-size-rideshare")).toHaveTextContent(/Your average ride: \$.*typical \$25, an estimate/);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().brands.habits.takeout).toMatchObject({ answer: "monthly", size: 20 });
  });
  it("'Why this card?' Show the math carries the estimate line under the benefit", () => {
    const p = { travel: { trips: 2 }, brands: { habits: { takeout: { answer: "monthly", apps: ["any"] } } } };
    render(<WhyThisCard cardId="amex-gold" wallet={[]} profile={normalizeProfile(p)} open />);
    expect(screen.getAllByTestId("habit-math")[0]).toHaveTextContent("12 orders a year × $35 an order (estimate) = $420 a year");
  });
  it("the card's See the math does too", () => {
    render(<CardDetail cardId="amex-gold" profile={{ travel: { trips: 2 }, brands: { habits: { takeout: { answer: "monthly", apps: ["any"] } } } }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "See the math" }));
    expect(within(screen.getByTestId("the-math")).getAllByTestId("habit-math")[0]).toHaveTextContent("(estimate)");
  });
});

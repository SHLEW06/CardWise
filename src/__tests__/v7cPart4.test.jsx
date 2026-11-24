// @vitest-environment jsdom
/* v7c Part 4 (revised) — perks: ask about brands and habits, never about
   "credits". Grouped look-alike services with "Which app?"; one frequency or
   subscription question per service; credits count at 100% of the lesser of
   face, spending and months used; generic travel credits worked out from
   other answers; portal-tied hotel credits from one yes/no; TSA PreCheck /
   Global Entry / NEXUS at $24 a year, once per wallet. */
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import {
  HABITS, HABIT_BY_KEY, HABIT_GROUPS, FREQ_ANSWERS, SUB_ANSWERS, TT_ANSWERS, derivedRule, creditDraws,
  habitPools, habitCreditValue, periodsUsed, habitsFromChips,
} from "../data/perkHabits.js";
import { TRUSTED_TRAVELER_YEARLY } from "../data/perkChips.js";
import Survey, { HABIT_ROWS, habitResult } from "../components/v5/survey/Survey.jsx";
import { STEP_DEFS, stepsFor } from "../state/surveyAnswers.js";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { benefitBreakdown } from "../engine/v5/value.js";
import { walletValue } from "../engine/v5/methodology.js";
import { allBenefits } from "../engine/v5/lab.js";

const shown = new Set(HABIT_ROWS.flatMap((g) => g.habits.map((h) => h.key)));
const credit = (cardId, re) => BY_ID[cardId].credits.find((c) => re.test(c.name));
const valueOf = (cardId, re, habits, extra = {}) => {
  const p = normalizeProfile({ travel: { trips: 2 }, ...extra, brands: { habits, ...(extra.brands || {}) } });
  return benefitBreakdown(BY_ID[cardId], p).items.filter((i) => re.test(i.label)).reduce((t, i) => t + i.value, 0);
};

beforeEach(() => { cleanup(); localStorage.clear(); });

describe("4.1 · plain brand names, grouped look-alikes, never the word 'credit'", () => {
  it("one perk step", () => {
    expect(STEP_DEFS.filter((s) => s.title.match(/perk/i))).toHaveLength(1);
  });
  it("look-alike services are one row: 'Takeout / food delivery' and 'Rideshare', each with its apps", () => {
    expect(HABIT_BY_KEY.takeout.label).toBe("Takeout / food delivery");
    expect(HABIT_BY_KEY.takeout.apps.map((a) => a.label)).toEqual(["Uber Eats", "DoorDash", "Grubhub"]);
    expect(HABIT_BY_KEY.rideshare.label).toBe("Rideshare");
    expect(HABIT_BY_KEY.rideshare.apps.map((a) => a.label)).toEqual(["Uber", "Lyft"]);
    for (const separate of ["doordash", "grubhub", "uber", "lyft", "ubereats"]) expect(HABIT_BY_KEY[separate]).toBeUndefined();
  });
  it("no label, group, answer or question in the perk step contains 'credit'", () => {
    for (const x of [...HABITS, ...HABIT_GROUPS, ...FREQ_ANSWERS, ...SUB_ANSWERS, ...TT_ANSWERS]) expect(x.label).not.toMatch(/credit/i);
    for (const h of HABITS) for (const a of h.apps || []) expect(a.label).not.toMatch(/credit/i);
    saveV5Profile({ cardsHeld: ["amex-gold", "amex-plat"] });
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={loadV5Profile()} />);
    fireEvent.click(within(screen.getByTestId("habit-takeout")).getByRole("radio", { name: "About monthly" }));
    fireEvent.click(within(screen.getByTestId("habit-globalentry")).getByRole("radio", { name: "Have it or would get it" }));
    const step = document.querySelector(".survey-step");
    const labels = [...step.querySelectorAll("h1, h2, h3, legend, button, label, .habit-label, [role=radio]")].map((n) => n.textContent);
    expect(labels.length).toBeGreaterThan(40);
    expect(labels.filter((t) => /credit/i.test(t))).toEqual([]);
  });
  it("every survey step's questions and options avoid 'credit' — except the credit-score step itself", () => {
    saveV5Profile({ cardsHeld: ["amex-gold"], travel: { tripRows: [{ from: "ATL", to: "LAX", trips: 3 }] } });
    for (const id of stepsFor("thorough").filter((s) => !["credit", "reveal"].includes(s))) {
      cleanup();
      render(<Survey initialMode="thorough" initialStepId={id} initialProfile={loadV5Profile()} />);
      const step = document.querySelector(".survey-step");
      const labels = [...step.querySelectorAll("h1, h2, h3, legend, button, label, .habit-label")].map((n) => n.textContent);
      /* v7f brief: the hotel-style answer is worded "I just want the credit's value" */
      expect(labels.filter((t) => /\bcredits?\b/i.test(t) && t !== "I just want the credit's value"), id).toEqual([]);
    }
  });
});

describe("4.2 · one habit question per service", () => {
  it("services ask how often; subscriptions ask Already pay / Would start if free / No", () => {
    expect(FREQ_ANSWERS.map((a) => a.label)).toEqual(["Never", "A few times a year", "About monthly", "Weekly+"]);
    expect(SUB_ANSWERS.map((a) => a.label)).toEqual(["Already pay for it", "Would start if free", "No"]);
    expect(HABIT_BY_KEY.peacock.type).toBe("sub");
    expect(HABIT_BY_KEY.takeout.type).toBe("freq");
  });
  it("'Which app?' shows only once the service is used; 'Any' and named apps never sit together", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    const row = screen.getByTestId("habit-rideshare");
    expect(within(row).queryByText("Which app?")).toBeNull();
    fireEvent.click(within(row).getByRole("radio", { name: "About monthly" }));
    const any = within(row).getByRole("button", { name: /^Any, I'd switch to whichever my card covers/ });
    expect(any).toHaveAttribute("aria-pressed", "true");          // default
    fireEvent.click(within(row).getByRole("button", { name: "Lyft" }));
    expect(any).toHaveAttribute("aria-pressed", "false");
    expect(within(row).getByRole("button", { name: "Lyft" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(any);
    expect(within(row).getByRole("button", { name: "Lyft" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(row).getByRole("radio", { name: "Never" }));
    expect(within(row).queryByText("Which app?")).toBeNull();
  });
  it("each row says which cards pay for it, in grey: 'Amex Platinum · up to $300/yr'", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    expect(within(screen.getByTestId("habit-lululemon")).getByText(/Amex Platinum · up to \$300\/yr/)).toBeInTheDocument();
    expect(within(screen.getByTestId("habit-takeout")).getByText(/up to \$\d+\/yr/)).toBeInTheDocument();
  });
  it("shows the result in plain words and lets the person change the numbers (v7e: always visible)", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({ cardsHeld: ["amex-gold"] })} />);
    const row = screen.getByTestId("habit-dunkin");
    fireEvent.click(within(row).getByRole("radio", { name: "A few times a year" }));
    expect(within(row).getByTestId("habit-result-dunkin").textContent).toMatch(/Counts \$21 of the \$84 a year the Amex Gold gives/);
    fireEvent.change(within(row).getByLabelText(/Yearly spending: Dunkin'/), { target: { value: "12" } });
    expect(within(row).getByTestId("habit-result-dunkin").textContent).toMatch(/Counts \$12 of the \$84/);
  });
});

describe("4.2 · the engine turns habits into yearly dollars", () => {
  /* a $10-a-month DoorDash takeout credit (v7e: the Preferred's promo is non-restaurant now) */
  const doordash = { name: "DoorDash test credit", annual: 120, cadence: "monthly", draws: [{ habit: "takeout", app: "doordash" }] };
  it("the brief's example: 'About monthly' takeout ≈ $420 a year → a $120 ($10 a month) credit counts in full", () => {
    const pools = habitPools({ takeout: { answer: "monthly", apps: ["doordash"] } });
    expect(pools["takeout:doordash"].yearly).toBe(420);
    expect(habitCreditValue(doordash, pools).value).toBe(120);
  });
  it("'A few times a year' ≈ $105 a year, but only the months with orders: 3 × $10 = $30", () => {
    const pools = habitPools({ takeout: { answer: "few", apps: ["doordash"] } });
    expect(pools["takeout:doordash"].yearly).toBe(105);
    expect(habitCreditValue(doordash, pools).value).toBe(30);
  });
  it("a credit counts only for the apps picked; 'Any' counts all of them", () => {
    expect(valueOf("csr", /\$15 DoorDash/, { takeout: { answer: "monthly", apps: ["ubereats"] } })).toBe(0);
    expect(valueOf("csr", /\$15 DoorDash/, { takeout: { answer: "monthly", apps: ["any"] } })).toBe(180);
    expect(valueOf("csp", /DoorDash/, { takeout: { answer: "monthly", apps: ["any"] } })).toBe(0);            // v7e: groceries, not takeout
    expect(valueOf("csp", /DoorDash/, { ddgrocery: { answer: "monthly" } })).toBe(120);
    expect(valueOf("amex-gold", /Uber Cash/, { takeout: { answer: "monthly", apps: ["any"] } })).toBe(120);
  });
  it("subscriptions count up to their price; 'Would start if free', 'No' or 'Never' = $0", () => {
    expect(valueOf("amex-plat", /Walmart\+/, { walmartplus: { answer: "pay" } })).toBe(155);
    expect(valueOf("amex-plat", /Walmart\+/, { walmartplus: { answer: "free" } })).toBe(0);   // owner, 2026-11-23
    expect(valueOf("amex-plat", /Walmart\+/, { walmartplus: { answer: "no" } })).toBe(0);
    expect(valueOf("amex-plat", /digital entertainment/, { peacock: { answer: "pay" } })).toBe(132);    // one $132 subscription
    expect(valueOf("amex-plat", /digital entertainment/, { peacock: { answer: "pay" }, nyt: { answer: "pay" } })).toBe(300);
  });
  it("periods used: an annual credit needs one order; N separate purchases use N periods (v7e owner rule)", () => {
    expect(periodsUsed("annual", 3)).toBe(1);
    expect(periodsUsed("monthly", 3)).toBe(3);
    expect(periodsUsed("quarterly", 3)).toBe(3);
    expect(periodsUsed("quarterly", 2)).toBe(2);
    expect(periodsUsed("semiannual", 12)).toBe(2);
  });
  it("two cards share one pool: they can't pay back more than is spent there", () => {
    const habits = { rideshare: { answer: "few", apps: ["uber"] } };   // 3 rides × $25 = $75, 3 months
    const v = walletValue(["amex-gold", "amex-plat"], normalizeProfile({ brands: { habits } }));
    const uber = v.benefits.filter((b) => /Uber Cash/.test(b.label)).reduce((t, b) => t + b.value, 0);
    expect(uber).toBeLessThanOrEqual(75);
    const rows = allBenefits(v).filter((r) => /Uber Cash/.test(r.label));
    expect(rows.some((r) => r.flags.includes("Overlap"))).toBe(true);
  });
  it("the result line matches the engine", () => {
    const habits = { takeout: { answer: "few", apps: ["any"] } };
    const r = habitResult("takeout", habits, ["amex-gold"]);
    expect(r.cardId).toBe("amex-gold");
    expect(r.value).toBe(Math.round(habitCreditValue(BY_ID[r.cardId].credits.find((c) => c.annual === r.face && creditDraws(c).some((d) => d.habit === "takeout")), habitPools(habits)).value));
  });
});

describe("4.4 · generic credit chips are gone — worked out from other answers", () => {
  it("broad travel credit counts if they travel at all, with no question", () => {
    expect(valueOf("csr", /\$300 travel credit/, {}, { travel: { trips: 2 } })).toBeGreaterThan(0);
    expect(valueOf("csr", /\$300 travel credit/, {}, { travel: { trips: 0 } })).toBe(0);
  });
  it("airline incidental credit comes from the trips step", () => {
    expect(valueOf("amex-plat", /airline fee credit/, {}, { travel: { trips: 4 } })).toBeGreaterThan(0);
    expect(valueOf("amex-plat", /airline fee credit/, {}, { travel: { trips: 0 } })).toBe(0);
  });
  it("the Ritz-Carlton / St. Regis property credit counts only for those hotels marked 'I'd stay here' (v7f)", () => {
    const P = { travel: { trips: 4, hotelNights: 8, hotelChoice: "manual" } };
    expect(valueOf("ritz", /hotel credit on 2\+ night/, {}, { ...P, brands: { hotels: ["marriott"] } })).toBe(0);
    expect(valueOf("ritz", /hotel credit on 2\+ night/, {}, { ...P, brands: { hotels: ["hilton"] } })).toBe(0);
  });
  it("travel-site hotel credits: the formula decides, no yes/no (owner #10)", () => {
    const P = { travel: { hotelNights: 6, hotelBudget: 300, airports: [{ code: "JFK", trips: 4, destinations: [{ key: "hongkong", trips: 2 }, { key: "shanghai", trips: 2 }] }] } };
    for (const [id, re] of [["csp", /Chase Travel hotel/], ["delta-reserve", /Delta Stays/], ["amex-plat", /Fine Hotels/]]) expect(valueOf(id, re, {}, P), id).toBeGreaterThan(0);
    expect(valueOf("united-quest", /Renowned/, {}, P)).toBe(0);      // no price data for Renowned Hotels
  });
  it("the step has no travel-site question and no travel-credit chips", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    expect(screen.queryByTestId("portal-hotels")).toBeNull();
    expect(screen.queryByText(/Airline incidental|Hotel credit|Travel credit \(any/)).toBeNull();
  });
});

describe("4.7 · every credit and membership maps to a habit row the survey shows, or a derived rule", () => {
  it("no perk is dropped again", () => {
    const missing = [];
    for (const c of CARDS) for (const cr of c.credits || []) {
      const r = derivedRule(cr);
      if (r.asked) { if (!r.asked.every((k) => HABIT_BY_KEY[k]) || (c.cardType !== "business" && !r.asked.some((k) => shown.has(k)))) missing.push(`${c.id}: ${cr.name} (row not shown)`); }
      else if (!r.rule) missing.push(`${c.id}: ${cr.name} (no rule)`);
    }
    expect(missing).toEqual([]);
  });
  it("Travel services includes TSA PreCheck / Global Entry / NEXUS", () => {
    expect(HABIT_ROWS.find((g) => g.key === "travel").habits.map((h) => h.label)).toContain("TSA PreCheck / Global Entry / NEXUS");
  });
});

describe("4.3 · older answers migrate", () => {
  it("use now → About monthly / Already pay; would use → A few times a year / Would start if free", () => {
    expect(habitsFromChips(["doordash", "peacock"], ["lululemon", "nyt"])).toEqual({
      lululemon: { answer: "few" }, nyt: { answer: "free" },
      takeout: { answer: "monthly", apps: ["doordash"] }, peacock: { answer: "pay" },
    });
    const b = normalizeProfile({ brands: { perksUse: ["dunkin", "resy"], perksSpend: ["dunkin"] } }).brands;
    expect(b.habits.dunkin).toEqual({ answer: "monthly" });
    expect(b.habits.resy).toEqual({ answer: "few" });
    expect(normalizeProfile({ brands: { perks: ["hotel-portal"] } }).brands.portalHotels).toBe(true);
  });
});

describe("4.6 · TSA PreCheck / Global Entry / NEXUS", () => {
  const P = { travel: { trips: 4 }, brands: { habits: { globalentry: { answer: "pay" } } } };
  it("≈ $24 a year ($120 every five years, CBP / TSA pages read 2026-11-22)", () => {
    expect(TRUSTED_TRAVELER_YEARLY).toBe(24);
    expect(benefitBreakdown(BY_ID.csp, normalizeProfile(P)).items.find((i) => /Global Entry/.test(i.label)).value).toBe(24);
    expect(benefitBreakdown(BY_ID.csp, normalizeProfile({ travel: { trips: 4 } })).items.some((i) => /Global Entry/.test(i.label))).toBe(false);
  });
  it("counted once per wallet; the second card's is flagged Overlap", () => {
    const v = walletValue(["csp", "ihg-premier"], P);
    expect(v.benefits.filter((b) => b.dedupe === "globalEntry")).toHaveLength(1);
    const rows = allBenefits(v).filter((r) => /Global Entry/.test(r.label));
    expect(rows.filter((r) => r.value > 0)).toHaveLength(1);
    expect(rows.find((r) => r.value === 0).flags).toContain("Overlap");
  });
  it("'Already have PreCheck or Global Entry?' shows only when picked, and is saved", () => {
    render(<Survey initialMode="quick" initialStepId="brands" initialProfile={normalizeProfile({})} />);
    expect(screen.queryByTestId("precheck")).toBeNull();
    fireEvent.click(within(screen.getByTestId("habit-globalentry")).getByRole("radio", { name: "Have it or would get it" }));
    expect(screen.getByTestId("precheck")).toBeInTheDocument();
    expect(normalizeProfile({ brands: { precheck: { has: true, renewIn: 3 } } }).brands.precheck).toEqual({ has: true, renewIn: 3 });
  });
});

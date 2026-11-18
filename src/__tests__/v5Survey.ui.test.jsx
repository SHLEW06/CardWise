// @vitest-environment jsdom
/* Phase 4: landing (§9.8) + survey (§2) + flexible-points slider (§4). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Landing from "../components/v5/Landing.jsx";
import Survey, { searchCards, searchAirports } from "../components/v5/survey/Survey.jsx";
import { YouScreen } from "../components/v5/screens.jsx";
import { answersToProfile, stepComplete, EMPTY_ANSWERS, STEPS } from "../state/surveyAnswers.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { loadV5Record, saveV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const next = () => fireEvent.click(screen.getByRole("button", { name: /^(Start|Continue)$/ }));
const radio = (name) => fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));

describe("landing (§9.8)", () => {
  it("one headline ≤ 8 words, one button, the §15.4 privacy line", () => {
    const onStart = vi.fn();
    render(<Landing onStart={onStart} />);
    const h = screen.getByRole("heading", { level: 1 });
    expect(h.textContent.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Get started");
    fireEvent.click(buttons[0]);
    expect(onStart).toHaveBeenCalled();
    expect(screen.getByText(/Your bank login happens on your bank's own page\. CardWise stores only an encrypted session to read your offers — never your password or card numbers\./)).toBeInTheDocument();
    expect(screen.queryByText(/No bank logins stored/i)).toBeNull();
  });
});

describe("survey answers → profile", () => {
  it("never defaults an airport; 0 trips drops airport and lounges", () => {
    expect(answersToProfile(EMPTY_ANSWERS).travel.homeAirport).toBeNull();
    const p = normalizeProfile(answersToProfile({ ...EMPTY_ANSWERS, trips: "0", homeAirport: "ATL", lounges: "yes" }));
    expect(p.travel).toMatchObject({ trips: 0, homeAirport: null, lounges: "no" });
  });
  it("maps buckets through profileDefaults", () => {
    const p = normalizeProfile(answersToProfile({
      ...EMPTY_ANSWERS, wants: "travel", fee: "700", trips: "3-5", homeAirport: "SEA", lounges: "sometimes",
      score: "740-799", newCards: "5+", paysRent: true, rent: 2000, cardsHeld: ["csp"],
    }));
    expect(p).toMatchObject({ wants: "travel", feeBudget: 700, rent: 2000, cardsHeld: ["csp"] });
    expect(p.travel).toMatchObject({ trips: 4, homeAirport: "SEA", lounges: "sometimes" });
    expect(p.credit).toMatchObject({ score: 770, newCards24mo: 5 });
    expect(normalizeProfile(answersToProfile({ ...EMPTY_ANSWERS, fee: "any" })).feeBudget).toBe(Infinity);
  });
  it("Continue rules", () => {
    expect(stepComplete("cards", EMPTY_ANSWERS)).toBe(false);
    expect(stepComplete("cards", { ...EMPTY_ANSWERS, noCards: true })).toBe(true);
    expect(stepComplete("travel", { ...EMPTY_ANSWERS, trips: "0" })).toBe(true);
    expect(stepComplete("travel", { ...EMPTY_ANSWERS, trips: "3-5" })).toBe(false);
    expect(stepComplete("travel", { ...EMPTY_ANSWERS, trips: "3-5", homeAirport: "SEA", lounges: "no" })).toBe(true);
    expect(stepComplete("brands", EMPTY_ANSWERS)).toBe(true);
  });
  it("card search covers the whole catalog, closed cards included; airport search by code or city", () => {
    expect(searchCards("").length).toBe(24);
    expect(searchCards("attune").map((c) => c.id)).toContain("wf-attune");
    expect(searchCards("amex gold").map((c) => c.id)).toContain("amex-gold");
    expect(searchAirports("sea")[0].code).toBe("SEA");
    expect(searchAirports("atlanta")[0].code).toBe("ATL");
  });
});

describe("survey flow (§2)", () => {
  it("has 9 steps, a progress bar, and Back on step 1 leaves the survey", () => {
    const onExit = vi.fn();
    render(<Survey onExit={onExit} />);
    expect(STEPS).toHaveLength(9);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(onExit).toHaveBeenCalled();
  });

  it("Continue waits for an answer; the choice shows the selected state", () => {
    render(<Survey initialStep={2} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    radio("Travel");
    expect(screen.getByRole("radio", { name: /^Travel/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("saves answers after every step", () => {
    render(<Survey initialStep={2} />);
    radio("Cash back");
    next();
    expect(loadV5Record().answers.wants).toBe("cash");
    expect(loadV5Record().profile.wants).toBe("cash");
    expect(loadV5Record().completedAt).toBeNull();
  });

  it("'Skip for now' finishes with a generic profile", () => {
    const onDone = vi.fn();
    render(<Survey initialStep={3} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    const [profile] = onDone.mock.calls[0];
    expect(profile.travel.homeAirport).toBeNull();
    expect(profile.feeBudget).toBe(100);
    expect(loadV5Record().completedAt).toBeTruthy();
  });

  it("walks all nine steps and hands back the full profile", () => {
    const onDone = vi.fn();
    render(<Survey onDone={onDone} />);
    next();                                                     // 1 welcome
    fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "sapphire reserve" } });
    fireEvent.click(screen.getByRole("button", { name: /Sapphire Reserve/ }));
    expect(screen.getByText("Your cards (1)")).toBeInTheDocument();
    next();                                                     // 2 cards
    radio("Travel"); next();                                    // 3 wants
    radio("Up to \\$700"); next();                              // 4 fee
    radio("Heavy"); radio("No"); next();                        // 5 spend
    radio("3–5");
    fireEvent.change(screen.getByLabelText("Home airport"), { target: { value: "sea" } });
    fireEvent.click(screen.getByRole("option", { name: /SEA/ }));
    radio("Yes"); next();                                       // 6 travel
    fireEvent.click(screen.getByRole("button", { name: "Hyatt" }));
    fireEvent.click(screen.getByRole("button", { name: "Alaska" }));
    next();                                                     // 7 brands
    radio("740–799"); radio("1–2"); next();                     // 8 credit
    expect(screen.getByRole("heading", { name: "Here's what your points can do." })).toBeInTheDocument();
    expect(screen.getByText(/Your Chase points move 1:1 to Hyatt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /See my best wallet/ }));   // 9
    const [p] = onDone.mock.calls[0];
    expect(p).toMatchObject({ cardsHeld: ["csr"], wants: "travel", feeBudget: 700, rent: 0 });
    expect(p.travel).toMatchObject({ trips: 4, homeAirport: "SEA", lounges: "yes" });
    expect(p.brands.hotels).toEqual(["hyatt"]);
    expect(p.credit).toMatchObject({ score: 770, newCards24mo: 2 });
  });

  it("0 trips: no airport or lounge questions", () => {
    render(<Survey initialStep={5} />);
    radio("None");
    expect(screen.queryByLabelText("Home airport")).toBeNull();
    expect(screen.queryByText(/lounges matter/)).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("'I don't have any' clears picks and allows Continue", () => {
    render(<Survey initialStep={1} />);
    fireEvent.click(screen.getByRole("button", { name: "I don't have any" }));
    expect(screen.getByRole("button", { name: "I don't have any" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

describe("You — flexible points slider (§4)", () => {
  it("shows a slider only for flexible points you earn, and saves your value", () => {
    saveV5Profile({ cardsHeld: ["csp", "delta-gold"], wants: "travel" });
    render(<YouScreen onRestart={() => {}} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(1);
    expect(screen.getByText("Chase Ultimate Rewards")).toBeInTheDocument();
    fireEvent.change(sliders[0], { target: { value: "1.5" } });
    expect(loadV5Record().profile.pointValues).toEqual({ chase: 1.5 });
    expect(screen.getByText("100,000 points ≈ $1,500")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use the default" }));
    expect(loadV5Record().profile.pointValues).toEqual({});
  });
});

describe("typeable money sliders (v6 §16.4)", () => {
  it("the $ field uses the number keypad, syncs with the slider, and keeps values above max", async () => {
    const { default: MoneySlider } = await import("../components/v5/MoneySlider.jsx");
    function H() { const [v, setV] = React.useState(300); return <MoneySlider label="Dining" value={v} onChange={setV} max={2000} suffix="/mo" yearly />; }
    render(<H />);
    const field = screen.getByLabelText("Dining per month, in dollars");
    const range = screen.getByLabelText("Dining");
    expect(field).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(range, { target: { value: "500" } });
    expect(field).toHaveValue("500");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "$3,500" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("3,500");
    expect(range).toHaveValue("2000");                 // slider pins at max
    expect(screen.getByText("$42,000 a year")).toBeInTheDocument();   // typed value kept
  });
});

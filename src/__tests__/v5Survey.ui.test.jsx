// @vitest-environment jsdom
/* Phase 4: landing (§9.8) + survey (§2) + flexible-points slider (§4). */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import Landing from "../components/v5/Landing.jsx";
import Survey, { searchCards, searchAirports } from "../components/v5/survey/Survey.jsx";
import { YouScreen } from "../components/v5/screens.jsx";
import { answersToProfile, EMPTY_ANSWERS } from "../state/surveyAnswers.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { loadV5Record, saveV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });


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

describe("v5 saved answers still decode (answersToProfile)", () => {
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
  it("card search covers the whole catalog, closed cards included; airport search by code or city", () => {
    expect(searchCards("").length).toBe(24);
    expect(searchCards("attune").map((c) => c.id)).toContain("wf-attune");
    expect(searchCards("amex gold").map((c) => c.id)).toContain("amex-gold");
    expect(searchAirports("sea")[0].code).toBe("SEA");
    expect(searchAirports("atlanta")[0].code).toBe("ATL");
  });
});

/* The v5 nine-step flow tests moved to v6Survey.ui.test.jsx (§19 replaced §2). */

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

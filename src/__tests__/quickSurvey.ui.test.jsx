// @vitest-environment jsdom
/* The front-page Quick Survey: answers land in the same saved profile the full
   survey writes, answered fields leave assumedFields, skipped ones stay. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import QuickSurvey from "../components/v7/quick/QuickSurvey.jsx";
import App from "../App.jsx";
import { loadV5Record } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; window.history.replaceState(null, "", "/"); });

const next = () => fireEvent.click(screen.getByTestId("quick-next"));
const finish = () => fireEvent.click(screen.getByTestId("quick-finish"));
const radio = (group, name) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }));

describe("Quick Survey", () => {
  it("shows a placeholder before any answer and 8 steps with progress", () => {
    render(<QuickSurvey />);
    expect(screen.getByTestId("quick-progress")).toHaveTextContent("Step 1 of 8 · about 1 minute");
    expect(screen.getByTestId("quick-preview")).toHaveTextContent(/Answer a question/);
    expect(screen.queryByTestId("quick-preview-value")).toBeNull();
    expect(screen.getByTestId("quick-next")).toHaveTextContent("Skip");
  });

  it("completing all 8 steps saves a completed profile; answered keys leave assumedFields", async () => {
    let saved = null;
    render(<QuickSurvey onFinish={(p) => { saved = p; }} />);
    fireEvent.click(screen.getByRole("radio", { name: /^Always/ })); next();
    fireEvent.click(screen.getByTestId("quick-card-amex-gold")); fireEvent.click(screen.getByTestId("quick-card-csp")); next();
    fireEvent.click(screen.getByTestId("quick-preset-typical")); next();
    radio("Trips you fly each year", /^3–5 trips/); next();
    fireEvent.click(screen.getByRole("button", { name: "Costco" })); next();
    radio("Credit score", /^740–799/); next();
    fireEvent.click(screen.getByTestId("quick-sub-disney")); fireEvent.click(screen.getByTestId("quick-sub-uberone")); next();
    radio("What do you want your rewards to be?", /^Travel/);
    await waitFor(() => expect(screen.getByTestId("quick-preview-value")).toBeInTheDocument());
    finish();

    const rec = loadV5Record();
    expect(rec.completedAt).toBeTruthy();
    expect(saved).toBeTruthy();
    const p = rec.profile;
    expect(p.paymentBehavior).toBe("always");
    expect(p.cardsHeld).toEqual(["amex-gold", "csp"]);
    expect(p.travel.trips).toBe(4);
    expect(p.memberships).toEqual(["costco"]);
    expect(p.credit.score).toBe(SCORE_740);
    expect(p.brands.habits.disney).toEqual({ answer: "pay" });
    expect(p.brands.habits.uberone).toEqual({ answer: "pay" });
    const total = Object.values(p.spend).reduce((t, v) => t + v, 0);
    expect(Math.round(total)).toBe(350 + 500 + 120 + 250 + 690);
    for (const k of ["paymentBehavior", "spend", "memberships", "credit.score"]) expect(p.assumedFields).not.toContain(k);
    expect(p.wants).toBe("travel");
    expect(p.assumedFields).not.toContain("wants");
    // questions this survey never asks stay assumed
    expect(p.assumedFields).toContain("credit.newCards24mo");
  });

  it("skipping every step leaves the fields assumed", () => {
    render(<QuickSurvey onFinish={() => {}} />);
    for (let k = 0; k < 7; k++) next();
    finish();
    const p = loadV5Record().profile;
    expect(p.assumedFields).toContain("wants");
    for (const k of ["paymentBehavior", "spend", "memberships", "credit.score"]) expect(p.assumedFields).toContain(k);
    expect(p.cardsHeld).toEqual([]);
  });

  it("'Not sure' on credit keeps it assumed", () => {
    render(<QuickSurvey onFinish={() => {}} />);
    for (let k = 0; k < 5; k++) next();
    radio("Credit score", /^Not sure/);
    next(); next(); finish();
    expect(loadV5Record().profile.assumedFields).toContain("credit.score");
  });

  it("a balance carrier gets a pay-down first move in the live preview", async () => {
    render(<QuickSurvey onFinish={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /^Usually carry a balance/ }));
    const move = await screen.findByTestId("quick-preview-move", {}, { timeout: 8000 });
    expect(move).toHaveTextContent(/balance|interest/i);
  }, 20000);

  it("the live preview shows a yearly value after an answer", async () => {
    render(<QuickSurvey />);
    fireEvent.click(screen.getByRole("radio", { name: /^Always/ })); next();
    fireEvent.click(screen.getByTestId("quick-card-csp")); next();
    fireEvent.click(screen.getByTestId("quick-preset-typical"));
    const v = await screen.findByTestId("quick-preview-value", {}, { timeout: 8000 });
    expect(v.textContent).toMatch(/^\$[\d,]+$/);
  }, 20000);
});

describe("Quick Survey on the Welcome screen", () => {
  it("finishing opens Home with the plan", async () => {
    render(<App />);
    expect(await screen.findByTestId("quick-survey")).toBeInTheDocument();
    for (let k = 0; k < 7; k++) fireEvent.click(screen.getByTestId("quick-next"));
    fireEvent.click(screen.getByTestId("quick-finish"));
    await waitFor(() => expect(screen.queryByTestId("welcome")).toBeNull(), { timeout: 8000 });
    expect(loadV5Record().completedAt).toBeTruthy();
  }, 20000);
});
const SCORE_740 = 770;

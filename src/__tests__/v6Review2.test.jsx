// @vitest-environment jsdom
/* Review 2 (2026-11-18): credit tiers (fair → student cards, secured only
   below 580 or no history) and per-airport lounge practicality. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { BY_ID } from "../data/cards/index.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { eligibility, scoreNeeded, approvalOk } from "../engine/v5/methodology.js";
import { loungeCoverage } from "../engine/airportFit.js";
import { LOUNGE_SITES } from "../data/loungeLocations.js";
import CardDetail from "../components/v6/CardDetail.jsx";
import Survey from "../components/v5/survey/Survey.jsx";
import { loadV5Profile } from "../state/v5Profile.js";

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const at = (credit) => normalizeProfile({ credit, isStudent: true, canAffordDeposit: true });

describe("credit tiers", () => {
  it("fair (580–669): student cards yes; secured only until unsecured starters open at 600 (no 580–599 gap)", () => {
    for (const s of [580, 595, 600, 640, 669]) {
      expect(eligibility(BY_ID["discover-student"], at({ score: s })).ok, `${s}`).toBe(true);
      expect(eligibility(BY_ID["freedom-rise"], at({ score: s })).ok, `${s}`).toBe(s >= 600);
      // below 600 a secured card is the bridge; from 600 the unsecured starters take over
      if (s < 600) expect(eligibility(BY_ID["discover-it-secured"], at({ score: s })).ok, `${s}`).toBe(true);
      else expect(eligibility(BY_ID["discover-it-secured"], at({ score: s })).why, `${s}`).toBe("builder");
    }
  });
  it("poor (< 580): secured yes, student no", () => {
    expect(eligibility(BY_ID["discover-it-secured"], at({ score: 550 })).ok).toBe(true);
    expect(eligibility(BY_ID["discover-student"], at({ score: 550 })).why).toBe("credit");
    expect(scoreNeeded(BY_ID["discover-student"])).toBe(580);
  });
  it("no credit history: secured and student cards only", () => {
    const p = normalizeProfile({ credit: { noHistory: true }, isStudent: false, canAffordDeposit: true });
    expect(eligibility(BY_ID["discover-it-secured"], p).ok).toBe(true);
    expect(eligibility(BY_ID["discover-student"], p).why).toBe("student");
    expect(eligibility(BY_ID["discover-student"], { ...p, isStudent: true }).ok).toBe(true);
    expect(approvalOk(BY_ID["freedom-flex"], p)).toBe(false);
    expect(approvalOk(BY_ID.csr, p)).toBe(false);
  });
  it("good (670+): neither builder type", () => {
    expect(eligibility(BY_ID["discover-student"], at({ score: 705 })).why).toBe("builder");
    expect(eligibility(BY_ID["discover-it-secured"], at({ score: 705 })).why).toBe("builder");
  });
  it("survey: 'No credit yet' saves noHistory; '580–669' saves a fair score", () => {
    render(<Survey initialMode="thorough" initialStepId="credit" />);
    const g = screen.getByRole("radiogroup", { name: "Credit score" });
    fireEvent.click(within(g).getByRole("radio", { name: "No credit yet" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().credit).toMatchObject({ score: null, noHistory: true });
    cleanup();
    render(<Survey initialMode="thorough" initialStepId="credit" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Credit score" })).getByRole("radio", { name: "580–669" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadV5Profile().credit).toMatchObject({ score: 640, noHistory: false });
  });
});

describe("lounge practicality by concourse", () => {
  it("ATL: Priority Pass and Centurion are international-concourse only; Sky Clubs aren't listed (every concourse)", () => {
    expect(LOUNGE_SITES.ATL.networks.prioritypass.map((l) => l.concourse)).toEqual(["F", "F"]);
    expect(LOUNGE_SITES.ATL.networks.centurion[0].concourse).toBe("E");
    expect(loungeCoverage("Priority Pass", "ATL", 0)).toBeCloseTo(0.4, 9);
    expect(loungeCoverage("Centurion Lounge", "ATL", 0)).toBeCloseTo(0.4, 9);
    expect(loungeCoverage("Priority Pass", "ATL", 1)).toBe(1);
    expect(loungeCoverage("Delta Sky Club", "ATL", 0)).toBe(1);
  });
  it("airports without site data keep the size estimate", () => {
    expect(loungeCoverage("Priority Pass", "BDL", 0)).toBe(0.6);
  });
  it("intlShare is normalized, default 0 (domestic)", () => {
    expect(normalizeProfile({}).travel.intlShare).toBe(0);
    expect(normalizeProfile({ travel: { intlShare: 5 } }).travel.intlShare).toBe(1);
  });
  it("card detail names the lounges and their concourse", () => {
    render(<CardDetail cardId="venture-x" profile={{ travel: { trips: 8, homeAirport: "ATL", lounges: "yes" } }} onClose={() => {}} />);
    expect(within(screen.getByRole("dialog")).getByText(/The Club ATL, Poppin · Concourse F \(international\) — a detour from domestic gates/)).toBeInTheDocument();
  });
});

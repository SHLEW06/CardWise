// @vitest-environment jsdom
/* v7c Part 1 — hotels question: mode first, brand chips only for "I have
   brands I like", "Where do you usually stay?" as its own single choice,
   the pick as one sentence with "Why?"; the same pattern for airlines and
   lounges. */
import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Survey from "../components/v5/survey/Survey.jsx";
import { saveV5Profile, loadV5Profile } from "../state/v5Profile.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
import { STAY_STYLE_FACTOR } from "../data/benefitUsage.js";
import { HOTEL_BRANDS, STAY_STYLES } from "../data/surveyOptions.js";
import { benefitBreakdown, stayFactor } from "../engine/v5/value.js";
import { cppOf } from "../engine/v5/pointValues.js";
import { BY_ID } from "../data/cards/index.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const cont = () => fireEvent.click(screen.getByRole("button", { name: /Continue|Save/ }));
const FLYER = { travel: { airports: [{ code: "ATL", trips: 4, destinations: [{ key: "tokyo", trips: 1 }, { key: "shanghai", trips: 1 }] }], hotelNights: 12 } };

describe("1 · How do you pick hotels?", () => {
  it("is one radio question; 'Let CardWise pick the best program for me' is the default", () => {
    saveV5Profile(FLYER);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const g = screen.getByRole("radiogroup", { name: "How do you pick hotels?" });
    const radios = within(g).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Let CardWise pick the best program for me", "I have brands I like"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    /* No brand chips until "I have brands I like". */
    expect(screen.queryByRole("button", { name: "Marriott" })).toBeNull();
    expect(screen.queryByText(/whatever's cheapest|Not sure — help me choose|Best value: let CardWise decide/)).toBeNull();
    cont();
    expect(loadV5Profile().travel.hotelChoice).toBe("auto");
  });
  it("brand chips appear only after 'I have brands I like'; several are fine; switching back clears them", () => {
    saveV5Profile(FLYER);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    fireEvent.click(screen.getByRole("radio", { name: "I have brands I like" }));
    const chips = screen.getByRole("group", { name: "Hotel brands you like" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(HOTEL_BRANDS.map((h) => h.label));
    fireEvent.click(within(chips).getByRole("button", { name: "Hilton" }));
    fireEvent.click(within(chips).getByRole("button", { name: "IHG" }));
    expect(screen.queryByTestId("hotel-pick")).toBeNull();   // no "We'd pick" beside their own brands
    fireEvent.click(screen.getByRole("radio", { name: "Let CardWise pick the best program for me" }));
    expect(screen.queryByRole("group", { name: "Hotel brands you like" })).toBeNull();
    cont();
    const p = normalizeProfile(loadV5Profile());
    expect(p.travel.hotelChoice).toBe("auto");
    expect(p.brands.hotelsPicked).toEqual([]);
    expect(p.brands.hotels).toEqual([p.brands.hotelPick.program]);   // never both a pick and brands
  });
  it("brands I like → those brands are valued, nothing else", () => {
    const p = normalizeProfile({ ...FLYER, travel: { ...FLYER.travel, hotelChoice: "manual" }, brands: { hotelsPicked: ["hilton", "ihg"] } });
    expect(p.brands.hotels).toEqual(["hilton", "ihg"]);
    expect(p.brands.hotelPick).toBeNull();
  });
  it("the pick reads as one sentence, e.g. \"We'd pick Marriott: strong in 3 of your 3 destinations, incl. Shanghai and Tokyo\"", () => {
    const p = normalizeProfile(FLYER);
    expect(p.brands.hotelPick.sentence).toMatch(/^We'd pick (Marriott|Hilton|Hyatt|IHG): strong in \d of your 3 destinations(, incl\. .+)?$/);
    saveV5Profile(FLYER);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const pick = screen.getByTestId("hotel-pick");
    expect(pick).toHaveTextContent(p.brands.hotelPick.sentence);
    fireEvent.click(within(pick).getByRole("button", { name: "Why?" }));
    expect(within(pick).getByTestId("hotel-why").querySelectorAll("li").length).toBe(5);   // four programs + how it's judged
  });
});

describe("1.4 · Where do you usually stay?", () => {
  it("is its own single choice; it weighs hotel points and status, it isn't a brand", () => {
    saveV5Profile(FLYER);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const g = screen.getByRole("radiogroup", { name: "Where do you usually stay?" });
    expect(within(g).getAllByRole("radio").map((r) => r.textContent)).toEqual(STAY_STYLES.map((s) => s.label));
    fireEvent.click(within(g).getByRole("radio", { name: "Independent or boutique" }));
    fireEvent.click(within(g).getByRole("radio", { name: "A mix" }));
    expect(within(g).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    cont();
    expect(loadV5Profile().travel.stayStyle).toBe("mix");
    expect(loadV5Profile().brands.hotels).not.toContain("mix");
  });
  it("independent stayers get less from hotel points, status and free nights", () => {
    expect(STAY_STYLE_FACTOR).toEqual({ chains: 1, mix: 0.75, independent: 0.4 });
    const base = { travel: { trips: 4, hotelNights: 15, hotelChoice: "manual" }, brands: { hotels: ["hyatt"] } };
    const chains = normalizeProfile({ ...base, travel: { ...base.travel, stayStyle: "chains" } });
    const indie = normalizeProfile({ ...base, travel: { ...base.travel, stayStyle: "independent" } });
    expect(stayFactor(normalizeProfile(base))).toBe(1);   // not asked = chains
    expect(cppOf("hyatt", indie)).toBeLessThan(cppOf("hyatt", chains));
    const night = (p) => benefitBreakdown(BY_ID.hyatt, p).items.filter((i) => i.kind === "freeNight").reduce((t, i) => t + i.value, 0);
    expect(night(indie)).toBeCloseTo(night(chains) * 0.4, -1);
  });
});

describe("1.6 · the same pattern for airlines and lounges", () => {
  it("airlines: 'How do you pick airlines?' comes first; chips only for 'I'll choose'", () => {
    saveV5Profile(FLYER);
    render(<Survey initialMode="quick" initialStepId="travel" initialProfile={loadV5Profile()} />);
    const g = screen.getByRole("radiogroup", { name: "How do you pick airlines?" });
    expect(within(g).getByRole("radio", { name: "Let CardWise pick" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Star Alliance")).toBeNull();
    fireEvent.click(within(g).getByRole("radio", { name: "I'll choose" }));
    expect(screen.getByText("Star Alliance")).toBeInTheDocument();
  });
  it("lounges: 'Which lounges?' is a mode question; networks only for 'I'll choose'; auto ignores old networks", () => {
    expect(normalizeProfile({ travel: { trips: 4, lounges: "yes", loungeChoice: "auto", loungeNetworks: ["centurion"] } }).travel.loungeNetworks).toEqual([]);
    expect(normalizeProfile({ travel: { trips: 4, lounges: "yes", loungeNetworks: ["centurion"] } }).travel.loungeChoice).toBe("manual");
  });
});

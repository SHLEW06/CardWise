// @vitest-environment jsdom
/* Acceptance checks that are rules over the code and data (docs/
   CLAUDE_CODE_V7_ACCEPTANCE.md). Screen checks live in screenshots/acceptance. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import Profile from "../components/v6/Profile.jsx";
import { RedemptionCalc, priceRedemption } from "../components/v7/Tools.jsx";
import { saveV5Profile } from "../state/v5Profile.js";
import { DESTINATIONS as TABS } from "../components/v5/AppShell.jsx";

afterEach(cleanup);
const ROOT = process.cwd();
const walk = (dir, re) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : [];
});
const APP = ["src/components/v5", "src/components/v6", "src/components/v7", "src/styles/v5", "src/styles/v6", "src/styles/v7", "src/styles/fonts.css"]
  .flatMap((d) => (statSync(resolve(ROOT, d)).isDirectory() ? walk(resolve(ROOT, d), /\.(jsx?|css)$/) : [resolve(ROOT, d)]));

describe("A4 · no AI-template tropes", () => {
  it("fonts are Boska, Switzer and Archivo Expanded only (app sources + index.html)", () => {
    expect(readFileSync(resolve(ROOT, "index.html"), "utf8")).not.toMatch(/fonts\.googleapis|Geist|Instrument/);
    const banned = /\b(Inter|Geist|Instrument Serif|Playfair|Fraunces|Space Grotesk|DM Sans|DM Serif|Satoshi|Manrope|Cormorant|Poppins)\b/;
    const hits = APP.filter((f) => !/StyleTile\.jsx$/.test(f)).filter((f) => {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return /font-family|fontFamily|@font-face|--font/.test(src) && banned.test(src);
    });
    expect(hits).toEqual([]);
  });
  it("no emoji in the app's screens", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(APP.filter((f) => f.endsWith(".jsx") && emoji.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});

describe("B1 / B2 · navigation and old features", () => {
  it("the tabs (v7f adds Hotels); Profile behind the avatar", () => {
    expect(TABS.map((d) => d.label)).toEqual(["Home", "Checkout", "Offers", "Wallet Lab", "Explore", "Hotels"]);
  });
  it("Profile holds airport fit and price-a-redemption (restored)", () => {
    saveV5Profile({ cardsHeld: ["amex-gold"], travel: { airports: [{ code: "ATL", trips: 4 }] } });
    render(<Profile />);
    for (const h of ["Your answers", "Point values", "Airport fit", "Price a redemption", "Connected banks", "Saved setups", "Settings"]) expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    expect(screen.getByTestId("airport-fit")).toHaveTextContent(/Hub airlines: Delta/);
  });
  it("price a redemption: a booking's value per point against yours", () => {
    expect(priceRedemption({ cash: 600, points: 30000, taxes: 60, yourCpp: 1.2 })).toMatchObject({ verdict: "Good use of points" });
    expect(priceRedemption({ cash: 300, points: 40000, taxes: 0, yourCpp: 1.2 }).verdict).toBe("Pay cash and keep the points");
    render(<RedemptionCalc profile={{ cardsHeld: ["amex-gold"] }} />);
    expect(screen.getByTestId("redemption-calc")).toBeInTheDocument();
  });
});

describe("I1 · no jargon on consumer screens (outside 'See the math')", () => {
  it("no cpp / MR / UR / multiplier / breakage in visible strings", () => {
    const jargon = /["'`>][^"'`<]*\b(cpp|CPP|Membership Rewards|Ultimate Rewards|\bMR\b|\bUR\b|multiplier|breakage)\b[^"'`<]*["'`<]/;
    const offenders = APP.filter((f) => f.endsWith(".jsx") && !/StyleTile|Tools\.jsx$/.test(f)).filter((f) => {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/className="[^"]*"/g, "").replace(/import[^;]+;/g, "");
      /* Visible text only: drop JSX expressions ({…}) and identifiers. */
      const visible = src.replace(/\{[^{}]*\}/g, "").replace(/\b[a-zA-Z_.]*(?:cpp|Cpp|multiplier)[a-zA-Z_]*\b/g, "");
      return jargon.test(visible);
    });
    expect(offenders).toEqual([]);
  });
});

describe("I3 · secrets and art stay out of git", () => {
  it(".gitignore covers card art, fonts, backgrounds, screenshots", () => {
    const gi = readFileSync(resolve(ROOT, ".gitignore"), "utf8");
    for (const p of ["public/cards", "public/fonts", "public/backgrounds", "screenshots"]) expect(gi, p).toMatch(new RegExp(p.replace("/", "\\/")));
  });
  it("location never goes to a CardWise server: only OpenStreetMap is called", () => {
    const near = readFileSync(resolve(ROOT, "src/connector/locate.js"), "utf8") + readFileSync(resolve(ROOT, "src/connector/nearby.js"), "utf8");
    const hosts = [...near.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]);
    expect([...new Set(hosts)]).toEqual(["overpass-api.de"]);
    expect(existsSync(resolve(ROOT, "src/connector/locate.js"))).toBe(true);
  });
});

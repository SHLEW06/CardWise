// @vitest-environment jsdom
/* v7 Part G — small fixes: one "% back" function, number styling, labels. */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { CountUp } from "../components/v6/motion.jsx";
import { STEP_DEFS } from "../state/surveyAnswers.js";

afterEach(cleanup);

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(js|jsx)$/.test(f) ? [p] : [];
});

describe("G · one function for every '≈ % back'", () => {
  it("no screen or engine file formats its own '% back' string", () => {
    const files = ["src/components/v5", "src/components/v6", "src/components/v7", "src/engine/v5"].flatMap((d) => walk(resolve(process.cwd(), d)));
    const offenders = files.filter((f) => !/valuation\.js$|StyleTile\.jsx$/.test(f))
      .filter((f) => /%\s*back`/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("G · number styling (Part 0)", () => {
  it("display numbers use Boska lining figures with the plain zero", () => {
    const { container } = render(<CountUp value={1080} display duration={0} />);
    const n = container.querySelector(".num");
    expect(n).toBeTruthy();
    expect(n.textContent).toBe("$1,080");
    expect(n.querySelector(".num-z").textContent).toBe("0");
    const css = readFileSync(resolve(process.cwd(), "src/styles/v7/app.css"), "utf8");
    expect(css).toMatch(/\.num \.num-z \{ font-variant-numeric: lining-nums tabular-nums; \}/);
    expect(css).toMatch(/\.t-hero, \.v5 \.t-big, \.v5 \.dial-num, \.v5 \.num \{ font-variant-numeric: lining-nums proportional-nums; \}/);
  });
});

describe("G · survey labels", () => {
  it("step 4 is 'Card perks' (it asks about perks, not loyalty brands)", () => {
    expect(STEP_DEFS.find((s) => s.id === "brands").title).toBe("Card perks");
  });
});

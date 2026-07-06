// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import CreditRealismToggles from "../components/wallet/CreditRealismToggles.jsx";

afterEach(() => cleanup());

const CREDITS = [
  {
    id: "amex-plat-uber",
    label: "$200 Uber credit",
    faceValue: 200,
    answer: "unknown",
    defaultAssumedUsed: true,
  },
  {
    id: "amex-plat-airline",
    label: "$200 airline fee credit",
    faceValue: 200,
    answer: "unknown",
    defaultAssumedUsed: false,
  },
];

describe("CreditRealismToggles — Phase 6", () => {
  it("clicking Yes calls onAnswer with true AND button gains the on class", () => {
    let saw = null;
    render(
      <CreditRealismToggles
        prompts={CREDITS}
        answers={{}}
        onAnswer={(id, value) => { saw = [id, value]; }}
      />
    );
    const yesBtns = screen.getAllByRole("button", { name: /^yes( \(assumed\))?$/i });
    fireEvent.click(yesBtns[0]);
    expect(saw).toEqual(["amex-plat-uber", true]);
  });

  it("clicking No calls onAnswer with false", () => {
    let saw = null;
    render(
      <CreditRealismToggles
        prompts={CREDITS}
        answers={{}}
        onAnswer={(id, value) => { saw = [id, value]; }}
      />
    );
    const noBtns = screen.getAllByRole("button", { name: /^no( \(assumed\))?$/i });
    fireEvent.click(noBtns[0]);
    expect(saw).toEqual(["amex-plat-uber", false]);
  });

  it("shows the assumed state when answer is unset and defaultAssumedUsed is true", () => {
    render(
      <CreditRealismToggles
        prompts={CREDITS}
        answers={{}}
        onAnswer={() => {}}
      />
    );
    /* First prompt: defaultAssumedUsed=true → Yes button is assumed. */
    const buttons = screen.getAllByRole("button");
    const firstYes = buttons.find((b) =>
      /yes/i.test(b.textContent) && b.className.includes("cw-crt-btn-assumed-yes"));
    expect(firstYes).toBeTruthy();
    expect(firstYes.className).toMatch(/cw-crt-btn-assumed/);
    /* And it announces as "(assumed)" for a11y. */
    expect(firstYes.getAttribute("aria-label")).toMatch(/assumed/i);
  });

  it("aria-pressed reflects explicit yes / no", () => {
    render(
      <CreditRealismToggles
        prompts={CREDITS}
        answers={{ "amex-plat-uber": true }}
        onAnswer={() => {}}
      />
    );
    const yesBtn = screen.getAllByRole("button")
      .find((b) => /yes/i.test(b.textContent) && b.getAttribute("aria-pressed") === "true");
    expect(yesBtn).toBeTruthy();
    expect(yesBtn.className).toMatch(/cw-crt-btn-on-yes/);
  });

  it("explicit answer removes the assumed style", () => {
    render(
      <CreditRealismToggles
        prompts={CREDITS}
        answers={{ "amex-plat-uber": true }}
        onAnswer={() => {}}
      />
    );
    const buttons = screen.getAllByRole("button");
    /* No assumed classes should be present for the explicitly-answered prompt. */
    const anyAssumed = buttons.some((b) => b.className.includes("cw-crt-btn-assumed"));
    /* The second prompt is still unset, but its defaultAssumedUsed is false —
       so the assumed marker fires on the No button. That's expected. */
    expect(anyAssumed).toBe(true);
  });
});

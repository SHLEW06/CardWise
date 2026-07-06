// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import SlotDrawer from "../components/wallet/SlotDrawer.jsx";
import { BY_ID } from "../data/cards/index.js";
import { recommendCardsByRole } from "../engine/roleRecommendations.js";

const HEAVY_DINING_PROFILE = {
  spendAmounts: { Dining: 400, Groceries: 300, General: 400 },
  basics: { level: "mid", cardCount: "3-4" },
};

function buildDiningView() {
  const byRole = recommendCardsByRole(HEAVY_DINING_PROFILE, []);
  const rec = byRole.dining;
  const state = rec?.needed && rec?.topRecommendation ? "recommended" : "empty";
  const subtitle = rec?.topRecommendation
    ? `+$${Math.round(rec.topRecommendation.marginalValue)}/yr`
    : null;
  return {
    slot: { id: "dining", label: "Dining", role: "dining", icon: "food" },
    state,
    subtitle,
    held: [],
    recommended: rec?.topRecommendation || null,
    roleRec: rec,
    alsoCovers: [],
  };
}

function buildHotelKeeperView() {
  const profile = {
    hotelUsage: "often",
    hotelBrands: ["marriott"],
    spendAmounts: { Hotels: 200, General: 400 },
    basics: { level: "mid", cardCount: "3-4" },
  };
  const byRole = recommendCardsByRole(profile, []);
  const rec = byRole.hotelKeeper;
  return {
    profile,
    view: {
      slot: { id: "hotelKeeper", label: "Hotel keeper", role: "hotelKeeper", icon: "hotel" },
      state: rec?.needed ? "recommended" : "empty",
      subtitle: rec?.topRecommendation
        ? `+$${Math.round(rec.topRecommendation.marginalValue)}/yr` : null,
      held: [],
      recommended: rec?.topRecommendation || null,
      roleRec: rec,
      alsoCovers: [],
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe("SlotDrawer — top pick + reject + focus", () => {
  it("renders the top pick for the dining role", () => {
    const view = buildDiningView();
    render(
      <SlotDrawer
        view={view}
        profile={HEAVY_DINING_PROFILE}
        wallet={[]}
        onClose={() => {}}
        onToggleWallet={() => {}}
        onOpenCard={() => {}}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    /* The engine should recommend Amex Gold / Savor / Savor One / USB Altitude Go
       — as long as any dining card is present the "Top pick" section renders. */
    expect(screen.getByText(/top pick/i)).toBeInTheDocument();
  });

  it('"Not interested" swaps in the runner-up', () => {
    const view = buildDiningView();
    render(
      <SlotDrawer
        view={view}
        profile={HEAVY_DINING_PROFILE}
        wallet={[]}
        onClose={() => {}}
        onToggleWallet={() => {}}
        onOpenCard={() => {}}
      />
    );

    /* Read the top pick's card name (first hero-name element). */
    const heroBefore = screen.getByText(/top pick/i)
      .parentElement.querySelector(".cw-drawer-hero-name");
    const originalName = heroBefore?.textContent || "";

    const rejectBtn = screen.getByRole("button", { name: /not interested/i });
    fireEvent.click(rejectBtn);

    const heroAfter = screen.getByText(/top pick/i)
      .parentElement.querySelector(".cw-drawer-hero-name");
    expect(heroAfter?.textContent).not.toBe(originalName);
  });

  it("ritz never renders an Add button in the hotelKeeper drawer", () => {
    const { profile, view } = buildHotelKeeperView();
    render(
      <SlotDrawer
        view={view}
        profile={profile}
        wallet={[]}
        onClose={() => {}}
        onToggleWallet={() => {}}
        onOpenCard={() => {}}
      />
    );
    /* Ritz should never appear as a top-pick or alternative Add row because
       its availabilityStatus is productChangeOnly — it must live in the
       "Future path" section with no Add button. */
    const ritzMentions = screen.queryAllByText(BY_ID["ritz"].name);
    if (ritzMentions.length > 0) {
      /* If Ritz is displayed, it must NOT be inside a hero row — check for
         "Future path" heading nearby. */
      expect(screen.getByText(/future path/i)).toBeInTheDocument();
      /* And no button that says "Add" should be in its row. */
      const ritzRow = ritzMentions[0].closest(".cw-drawer-row");
      const addBtn = ritzRow?.querySelector("button");
      /* Only "Details" button should be present. */
      if (addBtn) expect(addBtn.textContent).toMatch(/details/i);
    }
  });

  it("Esc closes the drawer", () => {
    const view = buildDiningView();
    let closed = false;
    render(
      <SlotDrawer
        view={view}
        profile={HEAVY_DINING_PROFILE}
        wallet={[]}
        onClose={() => { closed = true; }}
        onToggleWallet={() => {}}
        onOpenCard={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });
});

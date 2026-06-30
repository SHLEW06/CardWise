import { describe, it, expect } from "vitest";

/* Pin the forward-facing engine import paths created in Prompt 1.
   When a later prompt moves the implementation, the wrappers continue
   re-exporting the same shape — this test guarantees that. */

describe("engine/approval.js wrapper", () => {
  it("re-exports approvalRealism functions", async () => {
    const mod = await import("../engine/approval.js");
    expect(typeof mod.approvalRealism).toBe("function");
    expect(typeof mod.categorizeRealism).toBe("function");
    expect(typeof mod.readCreditProfile).toBe("function");
  });

  it("approvalRealism returns the expected shape", async () => {
    const { approvalRealism } = await import("../engine/approval.js");
    const r = approvalRealism("active-cash", { creditProfile: { score: "740-799", income: 75000 } });
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("label");
    expect(r).toHaveProperty("reasons");
    expect(r).toHaveProperty("warnings");
  });
});

describe("engine/timelineBuilder.js wrapper", () => {
  it("re-exports buildTimeline", async () => {
    const mod = await import("../engine/timelineBuilder.js");
    expect(typeof mod.buildTimeline).toBe("function");
  });

  it("buildTimeline returns the expected shape", async () => {
    const { buildTimeline } = await import("../engine/timelineBuilder.js");
    const t = buildTimeline(
      {
        homeAirport: "ATL", goal: "travel", hotelUsage: "sometimes",
        lounge: "yes", checkedBags: "often", feeBudget: 500, cardCount: "3-4",
        spendSel: ["dining", "groceries", "travel"],
        creditProfile: { score: "740-799", income: 90000, appsLast24: 2 },
      },
      [],
    );
    for (const k of ["keep", "downgrade", "cancel", "laterCards", "avoidNow", "watchOuts", "schedule"]) {
      expect(t).toHaveProperty(k);
    }
    expect(t).toHaveProperty("nextCard"); // may be null but property must exist
  });
});

describe("engine/utils.js wrapper", () => {
  it("re-exports shared helpers", async () => {
    const mod = await import("../engine/utils.js");
    expect(typeof mod.fmtMoney).toBe("function");
    expect(typeof mod.clamp).toBe("function");
    expect(typeof mod.r0).toBe("function");
    expect(mod.F).toBeTruthy();
    expect(Array.isArray(mod.CATS)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { buildPlan } from "../engine/v5/plan.js";
import { normalizeProfile } from "../engine/profileDefaults.js";

describe("one trustworthy plan", () => {
  it("honors a one-card limit even when the held card could be complemented", () => {
    const p = buildPlan({ cardsHeld: ["robinhood-gold"], memberships: ["robinhood-gold"], maxCards: 1, credit: { score: 770 } });
    expect(p.wallet).toHaveLength(1);
    expect(p.nextMove?.kind).not.toBe("apply");
  });
  it("scores current annual net against the same recommended annual net", () => {
    const p = buildPlan({ cardsHeld: ["freedom-unlimited"], credit: { score: 770 } });
    expect(p.score).toBe(Math.max(0, Math.min(100, Math.round(100*p.current.net/p.best.value.net))));
    expect(p.scoreText).toContain(String(p.score));
    expect(buildPlan({}).score).toBeNull();
  });
  it("never silently omits a held fee card", () => {
    const p = buildPlan({ cardsHeld: ["amex-plat", "csp"], maxCards: 1, travel: { trips: 0 } });
    for (const id of ["amex-plat", "csp"].filter(id => !p.wallet.includes(id))) {
      expect(p.heldAdvice.find(x => x.cardId === id)?.action).toMatch(/cancel|downgrade|upgrade/);
    }
    expect(p.wallet.length).toBeLessThanOrEqual(normalizeProfile({ maxCards: 1 }).maxCards);
  });
});

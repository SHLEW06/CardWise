import { describe, it, expect } from "vitest";
import { CARDS, BY_ID } from "../data/cards/index.js";
import { ROLE_IDS } from "../engine/roleRecommendations.js";
import { EXTRA_ROLE_IDS } from "../data/cardRoles.js";

const VALID_ROLES = new Set([...ROLE_IDS, ...EXTRA_ROLE_IDS]);

describe("catalog role metadata", () => {
  it("every card has a primaryRole and a non-empty roles list including it", () => {
    const bad = [];
    for (const c of CARDS) {
      if (!c.primaryRole) {
        bad.push(`${c.id} missing primaryRole`);
        continue;
      }
      if (!Array.isArray(c.roles) || c.roles.length === 0) {
        bad.push(`${c.id} missing roles`);
        continue;
      }
      if (!c.roles.includes(c.primaryRole)) {
        bad.push(`${c.id} roles ${JSON.stringify(c.roles)} does not include primaryRole ${c.primaryRole}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every role id used is a valid engine role or an approved extra role", () => {
    const bad = [];
    for (const c of CARDS) {
      for (const r of c.roles || []) {
        if (!VALID_ROLES.has(r)) bad.push(`${c.id} has invalid role "${r}"`);
      }
      if (c.primaryRole && !VALID_ROLES.has(c.primaryRole)) {
        bad.push(`${c.id} primaryRole "${c.primaryRole}" invalid`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("targeted assignments — cards land in the correct primary role", () => {
    expect(BY_ID["robinhood-gold"].primaryRole).toBe("catchAll");
    expect(BY_ID["citi-double-cash"].primaryRole).toBe("catchAll");
    expect(BY_ID["venture-x"].primaryRole).toBe("premiumIfJustified");
    expect(BY_ID["bilt"].primaryRole).toBe("rent");
    expect(BY_ID["freedom-flex"].primaryRole).toBe("rotating");
    expect(BY_ID["amazon-prime"].primaryRole).toBe("online");
  });

  it("ritz roles include BOTH hotelKeeper and premiumIfJustified", () => {
    const roles = BY_ID["ritz"].roles;
    expect(roles).toContain("hotelKeeper");
    expect(roles).toContain("premiumIfJustified");
  });

  it("amex-plat roles include flights but not dining or groceries", () => {
    const roles = BY_ID["amex-plat"].roles;
    expect(roles).toContain("flights");
    expect(roles).not.toContain("dining");
    expect(roles).not.toContain("groceries");
  });

  it("amex-gold roles include dining and groceries", () => {
    const roles = BY_ID["amex-gold"].roles;
    expect(roles).toContain("dining");
    expect(roles).toContain("groceries");
  });
});

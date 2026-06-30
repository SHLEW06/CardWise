/* Shared seed-data helpers for the per-issuer card shards. */
export const SD = "2026-06";
export const cred = (name, annual, use) => ({ name, annual, use });
export const fnc  = (name, pointCap, use) => ({ name, pointCap, use });

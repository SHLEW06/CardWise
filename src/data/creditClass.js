/* ============================================================================
   creditClass.js — v7c Part 5: how realistic a credit is to get.
   ----------------------------------------------------------------------------
     automatic    posts by itself on spending they already do (a broad travel
                  credit, an anniversary credit)
     easy         a simple statement credit they enroll in or use at one
                  merchant / airline / hotel — counts only where they said
                  they'd use it (perk chips, airlines they fly)
     niche        niche or portal-tied: needs a booking through a card's
                  travel site or a niche merchant (Delta Stays, Renowned
                  Hotels via Chase Travel, The Edit, Fine Hotels + Resorts,
                  JSX …) — $0 unless they picked it
     spend-gated  earned only after a spending threshold on the card (Delta
                  Gold: $200 flight credit after $10,000 in a calendar year)
                  — $0 in every value and score; shown under "Unlocks with
                  spending"
   A credit's `cls` in the card data wins; otherwise it's derived here.
   ========================================================================== */
import { isNicheCredit } from "./creditBrands.js";

export const CREDIT_CLASSES = ["automatic", "easy", "niche", "spend-gated"];
const PORTAL_WORDS = /delta stays|the edit\b|fine hotels|hotel collection|renowned hotels|travel site|capital one travel|chase travel|citi travel|bilt travel|united hotels|\bjsx\b/i;

/** Yearly card spend that unlocks a credit, if it has one (else 0). */
export function spendThreshold(credit) {
  if (Number(credit?.requiresSpend) > 0) return Number(credit.requiresSpend);
  if (Number(credit?.spend) > 0) return Number(credit.spend);
  const n = String(credit?.name || "");
  const k = n.match(/w\/ \$(\d+)k spend/i) || n.match(/after \$(\d+)k\b/i);
  if (k) return Number(k[1]) * 1000;
  const d = n.match(/after (?:you spend )?\$([\d,]{5,})(?: in purchases| a year| on (?:this|the) card)/i);
  return d ? Number(d[1].replace(/,/g, "")) : 0;
}

export function creditClass(credit) {
  if (CREDIT_CLASSES.includes(credit?.cls)) return credit.cls;
  if (spendThreshold(credit) > 0) return "spend-gated";
  if (credit?.kind === "portal" || isNicheCredit(credit) || PORTAL_WORDS.test(String(credit?.name || ""))) return "niche";
  if (credit?.kind === "broad") return "automatic";
  return "easy";
}

export const CLASS_LABEL = { automatic: "Automatic", easy: "Easy", niche: "Niche or portal-tied", "spend-gated": "Unlocks with spending" };

// Run on the pre-fix engine. Frozen evidence; never consumes hidden facts as input.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { optimalWallet, walletValue } from "../src/engine/v5/methodology.js";
import { optimizeWallet } from "../src/engine/v5/optimizer.js";
import { applyTimeline } from "../src/engine/v5/lab.js";
import { normalizeProfile } from "../src/engine/profileDefaults.js";
import { BY_ID } from "../src/data/cards/index.js";
const personas = JSON.parse(readFileSync("cardwise_personas_200.json")).personas;
if (!execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).startsWith("07f63c4")) throw new Error("Baseline capture must run from archived commit 07f63c4, with this script and the unchanged persona input copied into that checkout. Use scripts/simulate.mjs for current results.");
const rows = personas.map(({ id, profile: raw }) => {
  const p = normalizeProfile(raw);
  const survey = optimalWallet(p);
  const home = optimizeWallet(p);
  const drops = [...home.skip, ...home.keep.filter(k => ["downgrade", "upgrade"].includes(k.action))]
    .map(k => ({ ...k, impact: Math.max(0, -(k.adds ?? 0)) })).sort((a,b) => b.impact-a.impact);
  const drop = drops[0], get = home.getNext[0];
  const homeAction = drop && drop.impact >= (get?.gain || 0) && drop.impact > 0
    ? `${drop.action}:${drop.downgradeTo || drop.upgradeTo || drop.cardId}` : get ? `${get.action}:${get.cardId}` : null;
  const action = r => { const t = applyTimeline(r.wallet, p)[0]; return t ? `${t.how}:${t.cardId}` : null; };
  const lab = p.cardsHeld.length ? optimalWallet(p, { mode: "wallet" }) : survey;
  const cautious = normalizeProfile({ ...p, travel: { ...p.travel,
    ...(raw.travel?.bags == null ? { bags: { perTrip: 0, share: 0 } } : {}),
    ...(raw.travel?.hotelNights == null && !(raw.travel?.tripRows || []).some(r => r.nights != null) ? { hotelNights: 0 } : {}),
    ...(raw.travel?.hotelChoice == null && !(raw.brands?.hotels || []).length ? { hotelChoice: "none" } : {}),
    ...(raw.travel?.lounges == null ? { lounges: "no" } : {}),
  } });
  const removed = optimalWallet(cautious);
  const out = { id, firstCard: home.getNext[0]?.cardId || null, wallet: home.wallet, net: walletValue(home.wallet,p).net,
    actions: { survey: action(survey), home: p.cardsHeld.length ? homeAction : null, lab: action(lab) },
    surveyWallet: survey.wallet, defaultsChanged: [...survey.wallet].sort().join() !== [...removed.wallet].sort().join(),
    waitlistedApply: [action(survey), homeAction, action(lab)].includes("apply:robinhood-gold"),
    studentCards: home.wallet.filter(id => BY_ID[id].cardType === "student"),
    annualFeeCards: home.wallet.filter(id => BY_ID[id].annualFee > 0) };
  console.log(id); return out;
});
writeFileSync("docs/audit-baseline.json", JSON.stringify({ commit: "07f63c4", rows }, null, 2)+"\n");

// The shared recommendation contract. Screens never choose their own wallet.
import { normalizeProfile } from "../profileDefaults.js";
import { CARDS, BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { optimizeWallet } from "./optimizer.js";
import { walletValue, scoreFrom, heldCardVerdicts, optimalWallet, eligibility, SECURED_BELOW } from "./methodology.js";
import { applyTimeline, timelineLabel, walletCards, useWhereRows, heldNotKept } from "./lab.js";
import { cardFee } from "./value.js";
import { assumptionsFor } from "./assumptions.js";
import { counterfactualFollowUps } from "./followUps.js";

export function bestNoDepositOption(profile, catalog = CARDS) {
  return catalog.filter(c=>c.cardType!=="secured" && !c.specialty && cardFee(c,profile)===0 && eligibility(c,profile).ok)
    .map(c=>({ cardId:c.id, name:cardDisplayName(c), net:walletValue([c.id],profile).net }))
    .sort((a,b)=>b.net-a.net || a.cardId.localeCompare(b.cardId))[0] || null;
}

function buildPlanCore(raw = {}, options = {}) {
  const profile = normalizeProfile(raw);
  const carries = ["sometimes", "usually"].includes(profile.paymentBehavior);
  const recommendation = optimizeWallet(profile, CARDS, { practical: options.practical });
  const wallet = recommendation.wallet;
  const current = walletValue(profile.cardsHeld, profile);
  const value = walletValue(wallet, profile);
  const best = { wallet, value, upgrades: Object.fromEntries(recommendation.getNext.filter(x => x.upgradeFrom).map(x => [x.cardId, x.upgradeFrom])) };
  const timeline = carries ? [] : applyTimeline(wallet, profile).map(t => {
    const down = recommendation.keep.find(k => k.action === "downgrade" && k.downgradeTo === t.cardId);
    return down ? { ...t, how: "downgrade", from: down.cardId, month: 0, notes: ["Product-change your existing account; no rewards application."] } : t;
  });
  const original = heldCardVerdicts(profile);
  const heldAdvice = original.map(v => {
    if (wallet.includes(v.cardId)) return { ...v, action: "keep" };
    const upgrade = timeline.find(t => t.how === "upgrade" && BY_ID[t.cardId]?.cardFamily === BY_ID[v.cardId]?.cardFamily);
    if (upgrade) return { ...v, action: "upgrade", to: upgrade.cardId };
    if (v.action === "downgrade" && wallet.includes(v.to)) return v;
    return { ...v, action: cardFee(BY_ID[v.cardId], profile) > 0 ? "cancel" : "left out" };
  });
  const drop = heldAdvice.filter(x => ["cancel", "downgrade", "upgrade"].includes(x.action))
    .sort((a,b) => (b.gain || -b.adds) - (a.gain || -a.adds))[0];
  const first = timeline[0];
  let nextMove = null;
  if (drop) {
    const name = cardDisplayName(BY_ID[drop.cardId]);
    nextMove = { kind: drop.action, cardId: drop.to || drop.cardId, title: drop.action === "cancel" ? `Cancel your ${name}` : `Switch your ${name} to the ${cardDisplayName(BY_ID[drop.to])}`,
      impact: Math.max(0, drop.gain || -drop.adds), sentence: `This account is left out of your recommended wallet${drop.fee ? ` and has a $${drop.fee} yearly fee` : ""}.` };
  } else if (first) {
    nextMove = { kind: first.how, cardId: first.cardId, title: `${first.how === "upgrade" ? "Upgrade to" : "Get"} the ${cardDisplayName(BY_ID[first.cardId])}`,
      impact: Math.max(0, value.N - walletValue(wallet.filter(id => id !== first.cardId), profile).N),
      sentence: recommendation.getNext.find(x => x.cardId === first.cardId)?.sentence || "The next card in your recommended wallet.",
      when: first.month ? `${timelineLabel(first)}. ${first.notes.join(" ")}` : null, context: wallet.filter(id => id !== first.cardId) };
  }
  const assumptions = assumptionsFor(profile), warnings = [];
  const interestCost = carries && profile.averageBalance != null && profile.apr != null ? Math.round(profile.averageBalance * profile.apr) : null;
  const needsDepositAnswer = !wallet.length && profile.newCardComfort > 0 && !carries && (profile.credit.noHistory || profile.credit.score != null && profile.credit.score < SECURED_BELOW) && profile.canAffordDeposit !== true;
  let deposit = null;
  if (needsDepositAnswer) {
    const bestNoDeposit = bestNoDepositOption(profile);
    deposit = { question:"Can you afford a refundable security deposit?", step:"credit", bestNoDeposit,
      reason:bestNoDeposit ? "An eligible no-deposit option is available at your stated credit level." : "There is no eligible no-deposit card in our catalog at the credit level you provided. A deposit answer is needed before considering a secured card." };
    const declined = profile.canAffordDeposit === false;
    warnings.push({ key: "deposit", message: declined ? "No eligible unsecured starter is on file at this credit level, and you said a deposit is unaffordable. No new card is recommended until an affordable option is confirmed." : "Before choosing a secured card, tell us whether you can afford its refundable deposit. We won't assume you can." });
    nextMove = { kind: declined ? "review-eligibility" : "confirm-deposit", cardId: null, title: declined ? "Review affordable ways to build credit" : "Can you afford a refundable security deposit?", impact: 0, sentence: warnings.at(-1).message, editStep: "credit" };
  }
  if (carries) {
    const message = interestCost == null ? "Interest can cost more than rewards. Enter your average balance and APR to estimate it; pause rewards applications and pay down the balance." : `Your balance costs about $${interestCost.toLocaleString("en-US")} a year in interest (average balance × APR). Pause rewards applications and pay down the balance.`;
    warnings.push({ key: "interest", message });
    nextMove = { kind: "pay-balance", cardId: null, title: interestCost == null ? "Pay down your balance before chasing rewards" : `Interest costs about $${interestCost.toLocaleString("en-US")} a year`, impact: 0, sentence: message };
  }
  const waitlist = CARDS.filter(c => c.availability === "waitlist" && !profile.cardsHeld.includes(c.id) && !profile.invitedCards.includes(c.id))
    .map(c => ({ cardId: c.id, action: "waitlist", label: "Join waitlist", url: c.availabilitySource || c.verifiedSource }));
  const score = profile.cardsHeld.length ? scoreFrom(current.net, value.net) : null;
  const scoreText = score == null ? "Add your first card to see a wallet score." : `You're getting ${score}% of your best annual net value: $${current.net.toLocaleString("en-US")} now ÷ $${value.net.toLocaleString("en-US")} with the recommended wallet, after fees.`;
  const result = { profile, current, best, wallet, nextMove, timeline, score, scoreText, assumptions, warnings, heldAdvice, interestCost, waitlist, deposit };
  if (options.summaryOnly) return result;
  const previewWallet = options.wallet || (options.mode === "scratch" ? optimalWallet(profile, { maxCards: Math.min(profile.maxCards, profile.cardsHeld.length + profile.newCardComfort) }).wallet : wallet);
  const previewValue = previewWallet === wallet ? value : walletValue(previewWallet, profile);
  const previewDrops = previewWallet === wallet ? heldAdvice.filter(x => x.action !== "keep").map(x => ({ ...x, effect: Math.max(0, x.gain || -x.adds), reason: x.action === "left out" ? "This no-fee card is not needed for earning; keeping the account open costs nothing." : `The recommended wallet leaves out this account${x.fee ? ` with its $${x.fee} yearly fee` : ""}.` })) : heldNotKept(previewWallet, profile);
  return { ...result,
    preview: { wallet: previewWallet, value: previewValue, tiles: walletCards(previewWallet, profile, previewValue), where: useWhereRows(previewValue, profile), dropped: previewDrops } };
}

const followUpCache = new Map();
export function buildPlan(raw = {}, options = {}) {
  const p = buildPlanCore(raw,options);
  if (options.followUps===false) return { ...p, followUps:[] };
  const key = JSON.stringify(p.profile);
  if (!followUpCache.has(key)) {
    const result = counterfactualFollowUps(p.profile,p,answered=>buildPlanCore(answered,{ summaryOnly:true }));
    if (followUpCache.size>=256) followUpCache.delete(followUpCache.keys().next().value);
    followUpCache.set(key,result);
  }
  return { ...p, followUps:followUpCache.get(key) };
}

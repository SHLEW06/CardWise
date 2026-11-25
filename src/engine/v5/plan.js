// The shared recommendation contract. Screens never choose their own wallet.
import { normalizeProfile } from "../profileDefaults.js";
import { CARDS, BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { optimizeWallet } from "./optimizer.js";
import { walletValue, scoreFrom, heldCardVerdicts, optimalWallet } from "./methodology.js";
import { applyTimeline, timelineLabel, walletCards, useWhereRows, heldNotKept } from "./lab.js";
import { cardFee } from "./value.js";

export function buildPlan(raw = {}, options = {}) {
  const profile = normalizeProfile(raw);
  const carries = ["sometimes", "usually"].includes(profile.paymentBehavior);
  const recommendation = optimizeWallet(profile);
  const wallet = recommendation.wallet;
  const current = walletValue(profile.cardsHeld, profile);
  const value = walletValue(wallet, profile);
  const best = { wallet, value, upgrades: Object.fromEntries(recommendation.getNext.filter(x => x.upgradeFrom).map(x => [x.cardId, x.upgradeFrom])) };
  const timeline = carries ? [] : applyTimeline(wallet, profile);
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
  const assumptions = [], warnings = [];
  const interestCost = carries && profile.averageBalance != null && profile.apr != null ? Math.round(profile.averageBalance * profile.apr) : null;
  if (profile.credit.score == null && !profile.credit.noHistory) assumptions.push({ key: "credit.score", step: "credit", label: "credit is unknown; only cards needing 670 or less are considered" });
  if (profile.isStudent == null) assumptions.push({ key: "isStudent", step: "credit", label: "student eligibility is unconfirmed; student cards are excluded" });
  if (profile.paymentBehavior == null) assumptions.push({ key: "paymentBehavior", step: "credit", label: "payment habits are unconfirmed; rewards shown before any interest" });
  if (profile.credit.noHistory && profile.isStudent !== true && profile.canAffordDeposit !== true) warnings.push({ key: "deposit", message: "Before choosing a secured card, tell us whether you can afford its refundable deposit." });
  if (carries) {
    const message = interestCost == null ? "Interest can cost more than rewards. Enter your average balance and APR to estimate it; pause rewards applications and pay down the balance." : `Your balance costs about $${interestCost.toLocaleString("en-US")} a year in interest (average balance × APR). Pause rewards applications and pay down the balance.`;
    warnings.push({ key: "interest", message });
    nextMove = { kind: "pay-balance", cardId: null, title: interestCost == null ? "Pay down your balance before chasing rewards" : `Interest costs about $${interestCost.toLocaleString("en-US")} a year`, impact: 0, sentence: message };
  }
  const waitlist = CARDS.filter(c => c.availability === "waitlist" && !profile.cardsHeld.includes(c.id) && !profile.invitedCards.includes(c.id))
    .map(c => ({ cardId: c.id, action: "waitlist", label: "Join waitlist", url: c.availabilitySource || c.verifiedSource }));
  const score = profile.cardsHeld.length ? scoreFrom(current.net, value.net) : null;
  const scoreText = score == null ? "Add your first card to see a wallet score." : `You're getting ${score}% of your best annual net value: $${current.net.toLocaleString("en-US")} now ÷ $${value.net.toLocaleString("en-US")} with the recommended wallet, after fees.`;
  const previewWallet = options.wallet || (options.mode === "scratch" ? optimalWallet(profile, { maxCards: Math.min(profile.maxCards, profile.cardsHeld.length + profile.newCardComfort) }).wallet : wallet);
  const previewValue = previewWallet === wallet ? value : walletValue(previewWallet, profile);
  return { profile, current, best, wallet, nextMove, timeline, score, scoreText, assumptions, warnings, heldAdvice, interestCost, waitlist,
    preview: { wallet: previewWallet, value: previewValue, tiles: walletCards(previewWallet, profile, previewValue), where: useWhereRows(previewValue, profile), dropped: heldNotKept(previewWallet, profile) } };
}

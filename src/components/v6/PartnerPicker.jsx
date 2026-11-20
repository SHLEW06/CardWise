/* Point values, partner-based (v6 §20, Part E; v7b Part 2). Used in Profile
   → Point values and the survey's points step.
     1. Programs you hold — every flexible currency the person's cards earn
        (a test checks Amex MR shows for an Amex Gold). Partners they'd use are
        toggled; value = mean of the picks, never below cash.
        LOCKED transfers (Freedom without a Sapphire): the header stays at the
        cash value, partners are dimmed with "Unlocks with Sapphire Preferred /
        Reserve" and the value each would have (Hyatt 4:3 ≈ 1.24¢ with
        Preferred, 1.65¢ with Reserve).
     2. Programs you could add — every other flexible currency, collapsed,
        with partners, ratios and values.
     3. Travel portals — every portal, with the person's cards' rates there.
   Partner picks default from the airlines and hotels inferred from where
   they fly (survey); a program they wouldn't use counts $0. */
import React from "react";
import Choice from "../v5/Choice.jsx";
import ChipList from "../v7/ChipList.jsx";
import { PROGRAMS, TRANSFER_RULES } from "../../data/programs.js";
import { BY_ID, CARDS } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { ratioText } from "../../engine/v5/pointsExplained.js";
import { currencyValue, partnerOptions, partnerPicksFor, partnerShortName, isUnlocked, convertsTo, FLEX_CURRENCIES, PARTNER_VALUATIONS_SOURCE } from "../../engine/v5/pointValues.js";
import { PORTAL_BY_ISSUER } from "../../engine/v5/breakeven.js";

const NAMES = { chase: "Chase points", amex: "Amex points", c1: "Capital One miles", citi: "Citi points", bilt: "Bilt points", wf: "Wells Fargo points" };
const ONE = { chase: "Chase point", amex: "Amex point", c1: "Capital One mile", citi: "Citi point", bilt: "Bilt point", wf: "Wells Fargo point" };
const cents = (n) => `${(Math.round(n * 100) / 100).toString().replace(/(\.\d)0$/, "$1")}¢`;

/** v7 B2: plain words for a partner whose transfer ratio isn't 1:1 — the
    partner's own point value, then what one of YOUR points is worth there.
    Chase → Hyatt: 4:3 with Preferred / Ink, 1:1 with the Reserve. */
export function ratioSentence(cur, p) {
  const name = partnerShortName(p.key);
  if (cur === "chase" && p.key === "hyatt") {
    return `${cents(p.partnerCpp)} is what a Hyatt point is worth. A Chase point moved at 4:3 (Sapphire Preferred or Ink Preferred) becomes 0.75 Hyatt points: ${cents(p.partnerCpp * 0.75)}. With the Sapphire Reserve it moves 1:1: the full ${cents(p.partnerCpp)}.`;
  }
  if (p.ratio === 1) return null;
  return `${cents(p.partnerCpp)} is what a ${name} point is worth. One ${ONE[cur] || "point"} becomes ${Math.round(p.ratio * 100) / 100} ${name} points (${ratioText(p.ratio)}): ${cents(p.effectiveCpp)}.`;
}

/** Every flexible currency the person holds (directly, or via a cash card that converts beside an unlock card). */
export function currenciesFor(profile, byId = BY_ID) {
  const held = profile.cardsHeld.map((id) => byId[id]).filter(Boolean);
  const out = new Set();
  for (const c of held) {
    if (FLEX_CURRENCIES.includes(c.pointCurrency)) out.add(c.pointCurrency);
    const conv = convertsTo(c, profile.cardsHeld);
    if (conv) out.add(conv);
  }
  return FLEX_CURRENCIES.filter((cur) => out.has(cur));
}

/* The cards that unlock transfers, named once each (Chase: Sapphire Preferred, Sapphire Reserve). */
const UNLOCK_NAMES = { chase: "Sapphire Preferred / Reserve", citi: "Strata Premier or Strata Elite", c1: "Venture or Venture X", wf: "Autograph or Autograph Journey" };
function unlockVariants(cur) {
  const ids = (TRANSFER_RULES[cur]?.unlockCards || []).filter((id) => BY_ID[id] && BY_ID[id].cardType !== "business");
  if (cur === "chase") return ["csp", "csr"].filter((id) => ids.includes(id));
  return ids.slice(0, 1);
}

/** Partner rows a currency reaches once unlocked, with the value at each unlock card. */
export function lockedPartners(cur, profile) {
  const variants = unlockVariants(cur);
  const rows = new Map();
  for (const v of variants) {
    for (const p of partnerOptions(cur, [...profile.cardsHeld, v], profile)) {
      if (p.partnerCpp == null) continue;
      const r = rows.get(p.key) || { key: p.key, ratios: [], values: [] };
      r.ratios.push(p.ratio); r.values.push({ cardId: v, cpp: p.effectiveCpp });
      rows.set(p.key, r);
    }
  }
  return [...rows.values()];
}

function HeldCurrency({ cur, profile, onToggle }) {
  const wallet = profile.cardsHeld;
  const unlocked = isUnlocked(cur, wallet);
  const v = currencyValue(cur, profile, wallet);
  const picks = partnerPicksFor(cur, profile);
  if (!unlocked) {
    const rows = lockedPartners(cur, profile);
    const unlockName = UNLOCK_NAMES[cur] || "a card that transfers";
    return (
      <section className="partner-block is-locked" aria-labelledby={`pp-${cur}`} data-testid={`held-${cur}`}>
        <header className="partner-head">
          <h3 id={`pp-${cur}`} className="partner-name">{NAMES[cur] || PROGRAMS[cur]?.name}</h3>
          <span className="t-value partner-value">≈ {cents(v.cpp)} a point today</span>
        </header>
        <p className="t-caption">Your cards can't move these points yet. <strong>Unlocks with {unlockName}</strong> — then they're worth what the partners below say.</p>
        <ChipList options={rows} label={`${NAMES[cur]} partners once unlocked`} isPicked={(p) => picks.includes(p.key)}
          render={(p) => (
            <Choice key={p.key} pill selected={picks.includes(p.key)} onSelect={() => onToggle(cur, p.key)}>
              {partnerShortName(p.key)} · {p.values.map((x) => `${cents(x.cpp)} with ${BY_ID[x.cardId].name.replace(/^Chase /, "")}`).join(" · ")}
            </Choice>
          )} />
      </section>
    );
  }
  const reach = partnerOptions(cur, wallet, profile).filter((p) => p.partnerCpp != null);
  return (
    <section className="partner-block" aria-labelledby={`pp-${cur}`} data-testid={`held-${cur}`}>
      <header className="partner-head">
        <h3 id={`pp-${cur}`} className="partner-name">{NAMES[cur] || PROGRAMS[cur]?.name}</h3>
        <span className="t-value partner-value">≈ {cents(v.cpp)} a point{v.upTo ? `, up to ${cents(v.upTo)}` : ""}</span>
      </header>
      <ChipList options={reach} label={`${NAMES[cur]} partners you'd use`} isPicked={(p) => picks.includes(p.key)}
        render={(p) => (
          <Choice key={p.key} pill selected={picks.includes(p.key)} onSelect={() => onToggle(cur, p.key)}>
            {partnerShortName(p.key)} · ≈ {cents(p.effectiveCpp)} a {ONE[cur] || "point"}
          </Choice>
        )} />
      {reach.filter((p) => picks.includes(p.key)).map((p) => ratioSentence(cur, p)).filter(Boolean).map((t) => <p key={t} className="t-caption partner-ratio">{t}</p>)}
    </section>
  );
}

/* v7b 2.3: other flexible currencies, collapsed. */
function CouldAdd({ cur, profile }) {
  const unlock = unlockVariants(cur)[0];
  const wallet = [...profile.cardsHeld, ...(unlock ? [unlock] : (CARDS.find((c) => c.pointCurrency === cur && c.availabilityStatus === "openToNewApplicants" && c.cardType !== "business") ? [CARDS.find((c) => c.pointCurrency === cur && c.availabilityStatus === "openToNewApplicants" && c.cardType !== "business").id] : []))];
  const rows = partnerOptions(cur, wallet, profile).filter((p) => p.partnerCpp != null).sort((a, b) => b.effectiveCpp - a.effectiveCpp);
  const earners = CARDS.filter((c) => c.pointCurrency === cur && c.availabilityStatus === "openToNewApplicants" && c.cardType !== "business").map(cardDisplayName);
  return (
    <details className="could-add" data-testid={`could-${cur}`}>
      <summary><span className="t-h3">{NAMES[cur] || PROGRAMS[cur]?.name}</span><span className="t-caption"> · {rows.length} partners · best ≈ {rows[0] ? cents(rows[0].effectiveCpp) : "—"} a point</span></summary>
      <p className="t-caption">Earned with: {earners.join(", ") || "—"}.{TRANSFER_RULES[cur]?.note ? ` ${TRANSFER_RULES[cur].note}` : ""}</p>
      <table className="v7-table could-table">
        <thead><tr><th scope="col">Partner</th><th scope="col">Ratio</th><th scope="col">One of your points</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.key}><td>{partnerShortName(p.key)}</td><td className="num-ui">{ratioText(p.ratio)}</td><td className="num-ui">≈ {cents(p.effectiveCpp)}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

/* v7b 2.5: every travel portal, tied to the person's cards. */
export function portalRows(profile) {
  const portals = ["Chase Travel", "Amex Travel", "Capital One Travel", "Citi Travel", "Bilt Travel", "US Bank Travel Center", "Robinhood Travel"];
  const rate = (c) => Object.entries(c.portalMultipliers || {}).map(([k, x]) => `${x}x ${k === "Car" ? "cars" : k.toLowerCase()}`).join(", ");
  return portals.map((portal) => {
    const issuerCards = CARDS.filter((c) => PORTAL_BY_ISSUER[c.issuer] === portal && Object.keys(c.portalMultipliers || {}).length && c.cardType !== "business");
    const yours = issuerCards.filter((c) => profile.cardsHeld.includes(c.id)).map((c) => ({ cardId: c.id, rate: rate(c) }));
    const best = [...issuerCards].filter((c) => c.availabilityStatus === "openToNewApplicants").sort((a, b) => Math.max(0, ...Object.values(b.portalMultipliers)) - Math.max(0, ...Object.values(a.portalMultipliers)))[0];
    return { portal, yours, best: best ? { cardId: best.id, rate: rate(best) } : null };
  });
}

export default function PartnerPicker({ profile, currencies, onChange }) {
  const held = currencies || currenciesFor(profile, BY_ID);
  const others = FLEX_CURRENCIES.filter((c) => !held.includes(c));
  const toggle = (cur, key) => {
    const now = partnerPicksFor(cur, profile);
    const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
    onChange?.({ ...profile.partnerPicks, [cur]: next });
  };
  return (
    <div className="partner-picker">
      {held.length ? held.map((cur) => <HeldCurrency key={cur} cur={cur} profile={profile} onToggle={toggle} />)
        : <p className="t-caption">None of your cards earn points that move to airlines or hotels.</p>}
      <section className="points-more">
        <h3 className="t-h3">Programs you could add</h3>
        <p className="t-caption">Other banks' points, what they move to, and what one point would be worth to you.</p>
        {others.map((cur) => <CouldAdd key={cur} cur={cur} profile={profile} />)}
      </section>
      <section className="points-more" data-testid="portals">
        <h3 className="t-h3">Travel portals</h3>
        <table className="v7-table portal-list">
          <thead><tr><th scope="col">Portal</th><th scope="col">Your cards there</th><th scope="col">Best card for it</th></tr></thead>
          <tbody>
            {portalRows(profile).map((r) => (
              <tr key={r.portal}>
                <td>{r.portal}</td>
                <td>{r.yours.length ? r.yours.map((y) => `${cardDisplayName(BY_ID[y.cardId])}: ${y.rate}`).join("; ") : <span className="t-caption">None of yours</span>}</td>
                <td>{r.best ? `${cardDisplayName(BY_ID[r.best.cardId])}: ${r.best.rate}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="t-caption">Partner values: {PARTNER_VALUATIONS_SOURCE.name}, {PARTNER_VALUATIONS_SOURCE.period}. Nothing picked means points count as cash (1¢); a program you wouldn't use counts $0.</p>
    </div>
  );
}

/* v7e Part 4 — "Your benefits" checklist.
   Every benefit is a row: a checkbox "I'd use this" (default = the survey result),
   "Worth to me: $___" (default = CardWise's value, editable), the face value in
   grey, and the reason line. Edits are saved per card in
   `profile.benefitOverrides` and feed the optimizer; "Reset to CardWise's
   estimate" on each row and for the whole card. */
import React, { useMemo } from "react";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { benefitBreakdown, cardFee } from "../../engine/v5/value.js";
import { walletValue, benefitsForCard } from "../../engine/v5/methodology.js";
import { creditDraws } from "../../data/perkHabits.js";
import { nightBudgetText } from "../../engine/v5/hotelCredits.js";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const signed = (n) => `${n < 0 ? "−" : ""}${money(n)}`;
const num = (raw) => { const n = parseInt(String(raw).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };

/** The benefit rows for one card: computed (no edits for this card) vs current. */
export function benefitRows(card, profile, wallet = null) {
  const ov = profile.benefitOverrides || {};
  const { [card.id]: mine = {}, ...others } = ov;
  const evaluate = (p) => wallet ? benefitsForCard(walletValue(wallet, p), card.id) : benefitBreakdown(card, p);
  const base = evaluate({ ...profile, benefitOverrides: others });
  const cur = evaluate(profile);
  const rows = new Map();
  for (const it of base.items) rows.set(it.id, { id: it.id, label: it.label, face: it.face, type: it.type, kind: it.kind, computed: it.value, reason: it.note || "Counted from your answers" });
  for (const u of base.unused) if (!rows.has(u.id)) rows.set(u.id, { id: u.id, label: u.label, face: u.face, type: u.type, kind: u.kind, computed: 0, reason: u.reason });
  for (const r of rows.values()) {
    const it = cur.items.find((x) => x.id === r.id);
    r.use = !!it;
    r.value = it ? it.value : 0;
    r.edited = !!mine[r.id];
  }
  return { rows: [...rows.values()], total: cur.total, extras: cur.extras || [], nightBudget: cur.nightBudget, edited: Object.keys(mine).length > 0 };
}

/** Patch one card's overrides in a profile. `patch` null = reset that row; whole = reset the card. */
export function withOverride(profile, cardId, id, patch) {
  const all = { ...(profile.benefitOverrides || {}) };
  const mine = { ...(all[cardId] || {}) };
  if (id == null) delete all[cardId];
  else {
    if (patch == null) delete mine[id];
    else mine[id] = { ...(mine[id] || {}), ...patch };
    if (Object.keys(mine).length) all[cardId] = mine; else delete all[cardId];
  }
  return { ...profile, benefitOverrides: all };
}

function Row({ card, r, onPatch }) {
  return (
    <li className="bc-row" data-testid={`bc-${r.id}`}>
      <label className="bc-use">
        <input type="checkbox" checked={r.use} aria-label={`I'd use this: ${r.label}`} onChange={(e) => onPatch(r.id, e.target.checked ? { use: true, ...(r.value || r.computed ? {} : { value: 0 }) } : { use: false })} />
        <span className="bc-name">{r.label}</span>
      </label>
      <label className="bc-worth t-caption">Worth to me: $
        <input inputMode="numeric" aria-label={`Worth to me: ${r.label}`} value={r.use ? r.value : 0} disabled={!r.use}
          onChange={(e) => onPatch(r.id, { use: true, value: num(e.target.value) ?? 0 })} />
      </label>
      {r.face > 0 && <span className="t-caption bc-face">Face {money(r.face)}</span>}
      <p className="t-caption bc-reason">{r.edited ? `Your number (CardWise: ${money(r.computed)})` : r.reason}
        {r.edited && <> · <button type="button" className="link" onClick={() => onPatch(r.id, null)}>Reset to CardWise's estimate</button></>}</p>
    </li>
  );
}

/** One card's checklist with live totals (card detail). */
export default function BenefitChecklist({ cardId, profile: raw, onProfileChange, wallet = null }) {
  const profile = useMemo(() => normalizeProfile(raw), [raw]);
  const card = BY_ID[cardId];
  const b = useMemo(() => benefitRows(card, profile, wallet), [card, profile, wallet]);
  const earns = useMemo(() => { const v = walletValue(wallet || [cardId], profile); return Math.round(v.earning.perCard[cardId]?.value || 0); }, [cardId, profile, wallet]);
  const fee = cardFee(card, profile);
  const patch = (id, p) => onProfileChange?.(withOverride(profile, cardId, id, p));
  if (!b.rows.length) return null;
  return (
    <div className="benefit-checklist" data-testid="benefit-checklist">
      <h2 className="t-h2">Your benefits</h2>
      <p className="t-caption">Untick what you wouldn't use, or type what it's worth to you. Your numbers re-rank your whole wallet.</p>
      <ul className="bc-rows">{b.rows.map((r) => <Row key={r.id} card={card} r={r} onPatch={patch} />)}</ul>
      {b.nightBudget && <p className="t-caption" data-testid="bc-night-budget">{nightBudgetText(b.nightBudget)}</p>}
      <dl className="bc-totals" data-testid="bc-totals">
        <div><dt>Benefits you'd use</dt><dd className="num-ui">{money(b.total)}</dd></div>
        <div><dt>Card earns you</dt><dd className="num-ui">{money(earns)}</dd></div>
        <div><dt>Fee</dt><dd className="num-ui">−{money(fee)}</dd></div>
        <div className="is-total"><dt>Net</dt><dd className="num-ui" data-testid="bc-net">{signed(b.total + earns - fee)}</dd></div>
      </dl>
      {b.edited && <button type="button" className="link" onClick={() => patch(null, null)}>Reset this card to CardWise's estimate</button>}
    </div>
  );
}

/* ── the wallet's combined checklist (Wallet Lab) ─────────────────────── */

const GROUPS = ["Dining & delivery", "Travel & hotels", "Tickets", "Shopping", "Subscriptions"];
function groupOf(card, r) {
  const cr = (card.credits || []).find((x) => x.name === r.label);
  if (cr && creditDraws(cr).some((d) => d.habit === "tickets")) return "Tickets";
  if (["lounge", "bags", "freeNight", "companion", "points"].includes(r.kind)) return "Travel & hotels";
  return ({ dining: "Dining & delivery", rides: "Dining & delivery", hotel: "Travel & hotels", airline: "Travel & hotels", travel: "Travel & hotels", travelService: "Travel & hotels", security: "Travel & hotels", shopping: "Shopping", streaming: "Subscriptions", lifestyle: "Subscriptions" })[r.type] || "Shopping";
}

export function WalletChecklist({ setup, value, profile, onProfileChange }) {
  const groups = useMemo(() => {
    const out = Object.fromEntries([...GROUPS, "Nice extras ($0)"].map((g) => [g, []]));
    for (const id of setup) {
      const card = BY_ID[id];
      if (!card) continue;
      const b = benefitRows(card, profile);
      for (const r of b.rows) {
        /* overlap: this card's benefit counted less in the wallet than on its own */
        const counted = value.benefits.find((x) => x.cardId === id && x.id === r.id)?.value ?? 0;
        let covered = null;
        if (r.use && counted < r.value) {
          const other = value.benefits.find((x) => x.cardId !== id && x.value > 0 && (x.label === r.label || (x.pools || []).some((p) => (value.perCard.find((pc) => pc.cardId === id)?.items.find((i) => i.id === r.id)?.pools || []).includes(p)) || (x.dedupedFrom || []).includes(id)));
          covered = other ? cardDisplayName(BY_ID[other.cardId]) : "another card";
        }
        const allocated = value.benefits.find((x) => x.cardId === id && x.id === r.id) || value.nightBudget?.items.find((x) => x.cardId === id && x.id === r.id);
        out[groupOf(card, r)].push({ card, r: { ...r, value: counted, reason: allocated?.note || allocated?.nightNote || r.reason }, covered });
      }
      for (const x of b.extras) out["Nice extras ($0)"].push({ card, extra: x });
    }
    return out;
  }, [setup, value, profile]);
  const patch = (cardId) => (id, p) => onProfileChange?.(withOverride(profile, cardId, id, p));
  return (
    <div className="wallet-checklist" data-testid="wallet-checklist">
      {value.nightBudget && <p className="t-caption" data-testid="wc-night-budget">{nightBudgetText(value.nightBudget)}</p>}
      {Object.entries(groups).filter(([, rows]) => rows.length).map(([g, rows]) => (
        <section key={g} className="wc-group" aria-label={g}>
          <h3 className="t-h3">{g}</h3>
          <ul className="bc-rows">
            {rows.map((x) => x.extra
              ? <li key={`${x.card.id}${x.extra.id}`} className="bc-row t-caption">{x.extra.label} · {cardDisplayName(x.card)}</li>
              : (
                <React.Fragment key={`${x.card.id}${x.r.id}`}>
                  <Row card={x.card} r={{ ...x.r, label: `${x.r.label} · ${cardDisplayName(x.card)}` }} onPatch={patch(x.card.id)} />
                  {x.covered && <li className="t-caption bc-covered" data-testid={`covered-${x.r.id}`}>Covered by the {x.covered} already</li>}
                </React.Fragment>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

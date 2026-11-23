/* ============================================================================
   Card detail (v6 §23) — replaces the dark CardModal. Benefit-first, short
   on the outside: a lit photo, "Worth ≈ $X a year to you" with one line of
   why, then benefits you'd use / wouldn't use (with reasons and the split
   credit opt-in), top-3 earning as ≈ % back, what it does in their wallet,
   the points chip, and "See the math".
   "See the math" is built on the same walletValue() as every other screen.
   (The v4 ValueBreakdown ran the legacy engine; bridging the profile still
   gave a second set of numbers for the same card, so it was replaced.)
   ========================================================================== */
import { formatPctBack } from "../../engine/v5/valuation.js";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Utensils, Plane, BedDouble, Armchair, Luggage, Car, ShieldCheck, Star, Gift, Ticket, Tv, ShoppingBag, Sparkles } from "lucide-react";
import CardFace from "../v5/CardFace.jsx";
import Choice from "../v5/Choice.jsx";
import Backdrop from "./Backdrop.jsx";
import { Reveal, CountUp } from "./motion.jsx";
import { cardDetail, approvalChip, availabilityOf } from "../../engine/v5/explore.js";
import { optimalWallet, walletValue } from "../../engine/v5/methodology.js";
import { explainCard } from "../../engine/v5/apply.js";
import { pointsChip, partnerShortName } from "../../engine/v5/pointValues.js";
import { directBase, cardBrand, HOTEL_CURRENCIES, AIRLINE_CURRENCIES } from "../../engine/v5/value.js";
import { loungeCoverage } from "../../engine/airportFit.js";
import { LOUNGE_SITES, networkKey } from "../../data/loungeLocations.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import WhyThisCard from "../v7/WhyThisCard.jsx";
import BenefitChecklist from "../v7/BenefitChecklist.jsx";
import { alternativesForSlot } from "../../engine/v5/lab.js";
import { SLOT_DEFS } from "../../engine/v5/methodology.js";
import { habitMathLines, creditDraws } from "../../data/perkHabits.js";
import { ticketComparison } from "../../engine/v5/tickets.js";
import { PROGRAM_LABEL, PROGRAM_SEARCH, nightBudgetText } from "../../engine/v5/hotelCredits.js";
import { PREMIUM_HOTELS } from "../../data/premiumHotels.generated.js";
const PROGRAM_SHORT = { edit: "The Edit", fhr: "FHR", thc: "THC" };

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (p) => formatPctBack(p);   // v7 G: one formatter
export const BUCKET_LABEL = {
  dining: "dining", groceries: "groceries", warehouse: "warehouse clubs", gas: "gas", gasCostco: "gas at Costco", ev: "EV charging",
  transit: "rides and transit", flights: "flights", hotels: "hotels", rentals: "vacation rentals", streaming: "streaming",
  drugstores: "drugstores", online: "online shopping", rent: "rent", phone: "phone and utilities", other: "everything else",
};

/* v7c 5b.4: one icon per benefit type, from the engine's `kind` / `type`
   (the old word match put a bed on every "cr-edit" — the dining credit). */
const KIND_ICON = { lounge: Armchair, bags: Luggage, freeNight: BedDouble, companion: Plane, protection: ShieldCheck, status: Star, points: Gift, tryFree: Sparkles };
const TYPE_ICON = { dining: Utensils, rides: Car, shopping: ShoppingBag, streaming: Tv, travelService: Ticket, security: ShieldCheck, hotel: BedDouble, airline: Plane, travel: Plane, lifestyle: Sparkles, other: Ticket };
export function iconFor(item) {
  return KIND_ICON[item.kind] || TYPE_ICON[item.type] || Ticket;
}

/* v7b 4.6: name the REAL biggest value drivers — what the card adds in
   their wallet, by dollars: each spend lane's gain over what had it, and
   each benefit counted (explainCard). */
export function whyLine(d, e) {
  const short = (label) => label.replace(/\s*\(.*$/, "").replace(/^\$[\d,]+\s+/, "");
  const drivers = [
    ...(e?.lanes || []).filter((l) => l.delta > 0).map((l) => ({ value: l.delta, text: `${pct(l.pct)} on ${BUCKET_LABEL[l.bucket]}`, lane: true })),
    ...(e?.benefits || []).filter((b) => b.kind !== "protection" && b.value > 0).map((b) => ({ value: b.value, text: `the ${short(b.label)}` })),
  ].sort((a, b) => b.value - a.value).slice(0, 2);
  if (!drivers.length) return "It earns about the same as a simple card for how you spend.";
  /* v7c 5f.5: a lane's number is what it ADDS over the card there now. */
  const amt = (x) => (x.lane ? `adds ${money(x.value)} over your current card` : money(x.value));
  return `Mostly ${drivers.map((x, i) => (i === 0 ? `its ${x.text} (${amt(x)})` : `${x.text} (${amt(x)})`)).join(" and ")}${d.fee ? `, after a ${money(d.fee)} fee` : ""}.`;
}

/** A held card in plain words: what it earns beyond their other cards,
    the benefits counted for it, and the fee (sums to the headline). */
export function heldLine(e) {
  const extra = Math.round(e.earned);
  const parts = `${extra >= 0 ? `${money(extra)} more` : `${money(-extra)} less`} in rewards than your other cards would earn on the same spending${e.benefitTotal ? ` and ${money(e.benefitTotal)} in benefits you use` : ""}`;
  if (!e.fee) return `No yearly fee — ${parts}.`;
  return `${parts.charAt(0).toUpperCase()}${parts.slice(1)}, against its ${money(e.fee)} fee.`;
}

/** One line on break-even for a card they hold. */
export function breakEvenLine(own) {
  const got = own.earn + own.benefits;
  if (!own.fee) return `No yearly fee — ${money(own.earn)} in rewards${own.benefits ? ` and ${money(own.benefits)} in benefits you use` : ""}.`;
  if (got >= own.fee) return `${money(own.earn)} in rewards and ${money(own.benefits)} in benefits you use cover its ${money(own.fee)} fee with ${money(got - own.fee)} to spare.`;
  return `It's ${money(own.fee - got)} short of breaking even: ${money(own.earn)} in rewards and ${money(own.benefits)} in benefits you use against a ${money(own.fee)} fee.`;
}

/* `wallet`: the setup the card is judged against (Wallet Lab passes its
   setup); default = the cards they hold. */
/** v7c 5.1: "$200 Delta flight credit after $10,000 a year on this card". */
export function gatedLine(g) {
  const base = String(g.label).replace(/\s*after \$[\d,]+.*$/i, "").replace(/\s*\(w\/ \$\d+k spend\)/i, "");
  return g.spend ? `${base} after $${g.spend.toLocaleString("en-US")} a year on this card` : base;
}

export default function CardDetail({ cardId, profile: raw, onClose, onToggleOwn, onProfileChange, wallet: context = null, slotKey = null, onOpenCard }) {
  const profile = normalizeProfile(raw);
  const [math, setMath] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  const [open, setOpen] = useState(null);
  const bestN = useMemo(() => optimalWallet(profile).value.N, [profile]);
  const d = useMemo(() => cardDetail(cardId, profile, bestN), [cardId, profile, bestN]);
  /* v7e Part 3.5: hotel credits — where they could be used, at their budget. */
  const hotelUses = useMemo(() => {
    const c = BY_ID[cardId];
    return [...(d.used || []), ...(d.unused || [])].filter((b) => b.hotelUse?.rows?.length).map((b) => {
      const cr = (c?.credits || []).find((x) => x.name === b.label);
      const prog = cr?.hotelProgram?.programs?.[0];
      return { id: b.id, label: b.label, rows: b.hotelUse.rows, chunk: cr?.hotelProgram?.chunk || b.face, program: PROGRAM_LABEL[prog] || "", search: PROGRAM_SEARCH[prog] || null };
    });
  }, [cardId, d]);
  /* v7e Part 2: where to buy tickets, on cards with a ticket credit or presales. */
  const ticketCmp = useMemo(() => {
    const c = BY_ID[cardId];
    const relevant = (c?.credits || []).some((cr) => creditDraws(cr).some((x) => x.habit === "tickets")) || (c?.niceExtras || []).some((x) => /ticket/i.test(x));
    return relevant ? ticketComparison(profile) : null;
  }, [cardId, profile]);
  const e = useMemo(() => explainCard(cardId, context || profile.cardsHeld, profile, walletValue), [cardId, context, profile]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!d.card) return null;
  const c = d.card;
  const ap = approvalChip(c, profile);
  const av = availabilityOf(c);
  const wallet = profile.cardsHeld;
  const togglePlan = (id) => {
    const planAround = profile.planAround.includes(id) ? profile.planAround.filter((x) => x !== id) : [...profile.planAround, id];
    onProfileChange?.({ ...profile, planAround });
  };
  /* v7c 5f.5: one number per idea — lead with the net after the application
     cost (the same figure as "Why this card?" and "Worth applying?"); the
     pre-cost gain is only inside "Show the math". */
  const value = d.inWallet.has ? d.inWallet.after.N - d.inWallet.before.N : e.net;
  const valueLabel = d.inWallet.has ? "It adds" : wallet.length ? "Would add" : "Worth";

  /* Portal to <body>: the detail must sit above the shell's sticky top bar. */
  const node = (
    <div className="v5 detail" role="dialog" aria-modal="true" aria-label={d.name}>
      <Backdrop slot="card" card={c} />
      <div className="detail-scroll">
        <button className="icon-btn detail-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <div className="detail-inner">
          <Reveal className="detail-hero"><CardFace card={c} tilt eager /></Reveal>
          <Reveal i={1} as="header" className="detail-head">
            <p className="t-eyebrow">{c.issuer} · {d.fee ? `${money(d.fee)} a year` : "No yearly fee"}</p>
            <h1 className="t-d2">{d.name}</h1>
            {d.inWallet.has ? (
              <>
                {/* Acceptance fix: a held card's headline is what it ADDS to their
                    wallet (the same number as "What it adds to your wallet"), not its
                    gross rewards — those would mostly be earned by their other cards. */}
                <p className="detail-value" data-testid="held-headline"><span className="t-big">{e.gain >= 0 ? "Worth" : "Costs you"} ≈ <CountUp value={Math.abs(e.gain)} display /></span><span className="detail-unit"> a year to you{d.own.fee ? ` after its ${money(d.own.fee)} fee` : ""}</span></p>
                <p className="t-lead">{heldLine(e)}</p>
              </>
            ) : (
              <>
                <p className="detail-value" data-testid="detail-headline"><span className="t-big">{valueLabel} ≈ <CountUp value={Math.max(0, value)} display /></span><span className="detail-unit"> a year to you{e.hurdle?.total ? " after the application cost" : ""}</span></p>
                <p className="t-lead" data-testid="why-line">{value > 0 ? whyLine(d, e) : "Doesn't add value for you — your other cards already earn this, or the fee outweighs what you'd use."}</p>
              </>
            )}
            <div className="detail-tags">
              <span className="tag">{pointsChip(c, profile, [...wallet, c.id])}</span>
              <span className={`tag ${ap.level === 0 ? "tag-good" : ap.level === 2 ? "tag-warn" : ""}`}>{ap.label} approval{ap.needs ? ` · ${ap.needs}` : ""}</span>
              {av.key !== "open" && <span className="tag tag-warn">{av.label}</span>}
            </div>
            {onToggleOwn && (
              <Choice selected={d.inWallet.has} onSelect={() => onToggleOwn(c.id)}>{d.inWallet.has ? "In my wallet" : "I have this card"}</Choice>
            )}
          </Reveal>

          {slotKey && context && <OtherForSlot cardId={c.id} slotKey={slotKey} setup={context} profile={profile} onOpenCard={onOpenCard} />}
          <Reveal i={2} className="panel detail-block detail-why">
            <WhyThisCard cardId={c.id} wallet={context || wallet} profile={profile} label={d.inWallet.has ? "What it adds to your wallet" : "Why this card?"} />
          </Reveal>

          {/* v7e Part 4: the editable checklist, with live totals */}
          {onProfileChange && (
            <Reveal i={2} className="panel detail-block">
              <BenefitChecklist cardId={c.id} profile={profile} onProfileChange={onProfileChange} />
            </Reveal>
          )}

          {/* v7e Part 3.5: where each hotel credit could be used, at their budget */}
          {hotelUses.length > 0 && (
            <Reveal i={2} className="panel detail-block" data-testid="hotel-use">
              <h2 className="t-h3">Where you could use this</h2>
              {hotelUses.map((h) => (
                <div key={h.id}>
                  <p className="t-caption"><strong>{h.label}</strong></p>
                  <ul className="hotel-use">
                    {h.rows.map((r) => (
                      <li key={r.dest} className="t-caption" data-testid={`hotel-use-${r.dest}`}>
                        {r.noData
                          ? `${r.name} · no price data — counts $0 unless you'd book one yourself`
                          : `${r.name} · ${r.hotel}${r.program !== "portal" ? ` (${PROGRAM_SHORT[r.program]})` : ""} · ~${money(r.rate)}/night · ${r.n} night${r.n === 1 ? "" : "s"} ${money(r.cost)} − ${money(h.chunk)} = ${money(r.after)} out of pocket · worth ${money(r.value)} to you (your ${money(r.budget)} a night${r.budgetBasis === "estimate" ? ", an estimate" : ""})`}
                      </li>
                    ))}
                  </ul>
                  {h.search && <p className="t-caption"><a className="link" href={h.search} target="_blank" rel="noreferrer">Search {h.program} hotels</a> · prices from {PREMIUM_HOTELS.checked} (nextcard city guides)</p>}
                </div>
              ))}
              {d.nightBudget && <p className="t-caption" data-testid="night-budget">{nightBudgetText(d.nightBudget)}</p>}
            </Reveal>
          )}

          {ticketCmp && (
            <Reveal i={2} className="panel detail-block" data-testid="ticket-compare">
              <h2 className="t-h3">Concert and event tickets</h2>
              <p>{ticketCmp.text}</p>
            </Reveal>
          )}

          <Reveal i={2} className="panel detail-block">
            <h2 className="t-h2">Benefits you'd use</h2>
            {!d.used.length && <p className="t-caption">None of its benefits match your answers.</p>}
            <ul className="rows">
              {d.used.map((b) => {
                const Icon = iconFor(b);
                const isOpen = open === b.id;
                return (
                  <li key={b.id}>
                    <button className="benefit-row" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen} data-testid="benefit-row">
                      <Icon size={18} aria-hidden="true" data-icon={b.kind === "credit" ? b.type : b.kind} />
                      <span className="benefit-name">{b.label}</span>
                      <span className="benefit-value"><span className="benefit-counted">Counted {money(b.value)}</span>{b.face > 0 && <span className="benefit-face t-caption">Face up to {money(b.face)}</span>}</span>
                    </button>
                    {b.note && <p className="benefit-note t-caption">{b.note}</p>}
                    {isOpen && (
                      <p className="benefit-more t-caption">
                        {b.face ? `Up to ${money(b.face)} a year on paper; we count ${money(b.value)} — only money it saves on things you'd pay for anyway.` : "Counted from your answers."}
                        {b.split && profile.planAround.includes(b.id) && <> <button className="link" onClick={() => togglePlan(b.id)}>Stop counting it</button></>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>

          {(d.extras || []).length > 0 && (
            <Reveal i={3} className="panel detail-block" data-testid="nice-extras">
              <h2 className="t-h2">Nice extras</h2>
              <p className="t-caption">Real perks, but they don't save money on things you'd pay for anyway, so they aren't counted.</p>
              <ul className="rows">
                {d.extras.map((x) => {
                  const Icon = iconFor(x);
                  return (
                    <li key={x.id} className="unused-row">
                      <Icon size={18} aria-hidden="true" />
                      <span className="benefit-name">{x.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          )}

          {(d.gated || []).length > 0 && (
            <Reveal i={3} className="panel detail-block" data-testid="unlocks-with-spending">
              <h2 className="t-h2">Unlocks with spending</h2>
              <p className="t-caption">Earned only after a spending threshold on this card, so they're never counted in its value or your score.</p>
              <ul className="rows">
                {d.gated.map((g) => (
                  <li key={g.id} className="unused-row">
                    <span className="benefit-name">{gatedLine(g)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {d.unused.length > 0 && (
            <Reveal i={3} className="panel detail-block">
              <button className="detail-collapse" onClick={() => setShowUnused(!showUnused)} aria-expanded={showUnused}>
                <h2 className="t-h2">Benefits you wouldn't use</h2>
                <span className="t-caption">{d.unused.length} · {money(d.unused.reduce((t, u) => t + (u.face || 0), 0))} on paper</span>
                <ChevronDown size={18} aria-hidden="true" className={showUnused ? "flip" : ""} />
              </button>
              {showUnused && (
                <ul className="rows">
                  {d.unused.map((u) => (
                    <li key={u.id} className="unused-row">
                      <span className="benefit-name">{u.label}</span>
                      <span className="t-caption">{u.reason}</span>
                      {u.split && (
                        <span className="unused-split">
                          <span className="t-caption">Split credits count $0 unless you'd plan trips around them — they come in pieces with minimum stays.</span>
                          {u.canPlan && <Choice pill selected={false} onSelect={() => togglePlan(u.id)}>I'd plan around this</Choice>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          )}

          <Reveal i={4} className="panel detail-block">
            <h2 className="t-h2">Earning, for how you spend</h2>
            <ul className="rows">
              {d.topEarning.map((e) => (
                <li key={e.bucket} className="earn-row">
                  <span>{BUCKET_LABEL[e.bucket][0].toUpperCase() + BUCKET_LABEL[e.bucket].slice(1)}</span>
                  <span className="t-value">{pct(e.pct)}</span>
                  <span className="t-caption">earns {money(e.value)} a year on {money(e.dollars)}</span>
                </li>
              ))}
            </ul>
            {(() => {
              /* v7c 5b.5: at the card's own brand, the full stacked return
                 (member points, earned with any card, + this card's), scoring
                 only the card's part. */
              const brand = cardBrand(c);
              const bucket = brand && (HOTEL_CURRENCIES.has(brand) ? "hotels" : AIRLINE_CURRENCIES.has(brand) ? "flights" : null);
              const base = bucket ? directBase(profile, bucket, [...wallet, c.id]) : null;
              if (!base || base.program !== brand) return null;
              const own = Math.max(0, ...(d.solo.earning.byBucket[bucket] || []).filter((r) => r.cardId === c.id).map((r) => r.pct));
              if (!own) return null;
              const one = (x) => `${Math.round(x * 10) / 10}%`;
              return <p className="t-caption" data-testid="stacked-return">≈{Math.round(base.pct + own)}% back at {partnerShortName(brand)} ({one(own)} from this card). Member points come with any card you pay with, so only the card's part is counted.</p>;
            })()}
          </Reveal>

          <Reveal i={5} className="panel detail-block">
            <h2 className="t-h2">In your wallet</h2>
            {d.inWallet.takes.length ? (
              <ul className="rows">
                {d.inWallet.takes.slice(0, 4).map((t) => (
                  <li key={t.bucket} className="earn-row">
                    <span>Takes {BUCKET_LABEL[t.bucket]}</span>
                    <span className="t-value">{pct(t.pct)}</span>
                    <span className="t-caption">{t.from ? `from ${cardDisplayName(BY_ID[t.from])}` : "nothing earned here before"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-caption">It wouldn't be your best card anywhere.</p>}
            {d.inWallet.scoreBefore != null && (
              <p className="t-caption">Wallet Score {d.inWallet.has ? `${d.inWallet.scoreAfter} with it, ${d.inWallet.scoreBefore} without` : `${d.inWallet.scoreBefore} → ${d.inWallet.scoreAfter} with it`}.</p>
            )}
          </Reveal>

          {c.loungeAccess && (
            <Reveal i={6} className="panel detail-block">
              <h2 className="t-h2">Lounges{profile.travel.homeAirport ? ` at ${profile.travel.homeAirport}` : ""}</h2>
              <ul className="rows">
                {(c.loungeAccess.networks || []).map((n) => {
                  const code = profile.travel.homeAirport;
                  const cov = loungeCoverage(n, code, profile.travel.intlShare);
                  const site = code ? LOUNGE_SITES[code] : null;
                  const known = site?.networks?.[networkKey(n)];
                  const where = known && `${known.map((l) => l.name).join(", ")} · Concourse ${[...new Set(known.map((l) => l.concourse))].join(", ")}${known.every((l) => site.intlConcourses.includes(l.concourse)) ? " (international) — a detour from domestic gates" : ""}`;
                  return (
                    <li key={n} className="earn-row">
                      <span>{n}</span>
                      <span className="t-caption">{!code ? "Add your home airport to check" : where || (cov >= 1 ? "Yes, where you fly from" : cov >= 0.5 ? "Some, depending on terminal" : cov > 0 ? "Few" : "None where you fly from")}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          )}

          <Reveal i={7} className="detail-block">
            <button className="link" onClick={() => setMath(!math)} aria-expanded={math}>See the math</button>
            {math && <TheMath d={d} habits={profile.brands?.habits} />}
          </Reveal>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

/** "See the math" — the card on its own, from walletValue (jargon allowed here). */
export function TheMath({ d, habits = {} }) {
  const v = d.solo;
  const rows = Object.entries(v.earning.byBucket).flatMap(([bucket, rs]) => rs.map((x, i) => ({ key: `${bucket}${i}`, bucket, ...x })));
  const possible = d.used.reduce((t, b) => t + (b.face || 0), 0) + d.unused.reduce((t, b) => t + (b.face || 0), 0);
  return (
    <div className="math-panel" data-testid="the-math">
      <h3 className="t-h3">On its own</h3>
      <dl className="math">
        {rows.map((x) => (
          <React.Fragment key={x.key}>
            <dt>{BUCKET_LABEL[x.bucket]}</dt>
            <dd>{money(x.dollars)} × {x.rate}x × {(Math.round(x.cpp * 100) / 100)}¢ = {money(x.value)}{x.capped ? " (capped)" : ""}{x.rotating ? " (rotating 5%)" : ""}</dd>
          </React.Fragment>
        ))}
        <dt>Earning E</dt><dd>{money(v.E)}</dd>
        {d.used.map((b) => <React.Fragment key={b.id}><dt>{b.label}</dt><dd>{money(b.face || b.value)} face → {money(b.value)} counted{habitMathLines(b.pools, habits).map((t) => <span key={t} className="t-caption" data-testid="habit-math"><br />{t}</span>)}</dd></React.Fragment>)}
        <dt>Benefits U</dt><dd>{money(v.U)} realistic · {money(possible)} possible max</dd>
        <dt>Fees F</dt><dd>{money(v.F)}</dd>
        <dt>Net E + U − F</dt><dd>{money(v.net)}</dd>
        <dt>vs a 2% card</dt><dd>{v.N >= 0 ? "+" : "−"}{money(v.N)} (baseline {money(v.base)})</dd>
      </dl>
      <p className="t-caption">Method: docs/METHODOLOGY.md. Point values from your partner picks.</p>
    </div>
  );
}

/* v7b 5.2: other cards that could fill the slot this card was opened from. */
function OtherForSlot({ cardId, slotKey, setup, profile, onOpenCard }) {
  const label = SLOT_DEFS.find((d) => d.key === slotKey)?.label || "this slot";
  const base = setup.includes(cardId) ? setup : [...setup, cardId];
  const r = useMemo(() => alternativesForSlot(base, slotKey, profile, { limit: 6 }), [base.join(), slotKey, profile]);
  if (!r.alternatives.length) return null;
  return (
    <Reveal i={2} className="panel detail-block" data-testid="other-for-slot">
      <h2 className="t-h2">Other cards that could fill {label.toLowerCase()}</h2>
      <ul className="rows">
        {r.alternatives.map((a) => (
          <li key={a.cardId} className="plan-row">
            <button className="link" onClick={() => onOpenCard?.(a.cardId)}>{cardDisplayName(BY_ID[a.cardId])}</button>
            <span className="t-caption">{a.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(a.delta)).toLocaleString("en-US")} a year for your wallet · {a.fee ? `$${a.fee} fee` : "no fee"}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

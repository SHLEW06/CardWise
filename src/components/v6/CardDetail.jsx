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
import { X, ChevronDown, Utensils, Plane, BedDouble, Armchair, Luggage, Car, ShieldCheck, Star, Gift, Ticket, Tv, ShoppingBag } from "lucide-react";
import CardFace from "../v5/CardFace.jsx";
import Choice from "../v5/Choice.jsx";
import Backdrop from "./Backdrop.jsx";
import { Reveal, CountUp } from "./motion.jsx";
import { cardDetail, approvalChip, availabilityOf } from "../../engine/v5/explore.js";
import { optimalWallet, walletValue } from "../../engine/v5/methodology.js";
import { explainCard } from "../../engine/v5/apply.js";
import { pointsChip } from "../../engine/v5/pointValues.js";
import { loungeCoverage } from "../../engine/airportFit.js";
import { LOUNGE_SITES, networkKey } from "../../data/loungeLocations.js";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";
import WhyThisCard from "../v7/WhyThisCard.jsx";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (p) => formatPctBack(p);   // v7 G: one formatter
export const BUCKET_LABEL = {
  dining: "dining", groceries: "groceries", warehouse: "warehouse clubs", gas: "gas", gasCostco: "gas at Costco", ev: "EV charging",
  transit: "rides and transit", flights: "flights", hotels: "hotels", rentals: "vacation rentals", streaming: "streaming",
  drugstores: "drugstores", online: "online shopping", rent: "rent", phone: "phone and utilities", other: "everything else",
};

function iconFor(item) {
  const l = item.label.toLowerCase();
  if (item.kind === "lounge") return Armchair;
  if (item.kind === "bags") return Luggage;
  if (item.kind === "freeNight" || /hotel|stay|resort|edit/.test(l)) return BedDouble;
  if (item.kind === "companion" || /airline|flight|delta|united/.test(l)) return Plane;
  if (item.kind === "protection" || /global entry|tsa|clear/.test(l)) return ShieldCheck;
  if (item.kind === "status") return Star;
  if (item.kind === "points") return Gift;
  if (/uber|lyft|rideshare|blacklane|avis|turo/.test(l)) return Car;
  if (/dining|resy|dunkin|grubhub|restaurant|table/.test(l)) return Utensils;
  if (/entertainment|disney|streaming|peacock/.test(l)) return Tv;
  if (/lululemon|walmart|oura|peloton/.test(l)) return ShoppingBag;
  return Ticket;
}

/* v7b 4.6: name the REAL biggest value drivers — what the card adds in
   their wallet, by dollars: each spend lane's gain over what had it, and
   each benefit counted (explainCard). */
export function whyLine(d, e) {
  const short = (label) => label.replace(/\s*\(.*$/, "").replace(/^\$[\d,]+\s+/, "");
  const drivers = [
    ...(e?.lanes || []).filter((l) => l.delta > 0).map((l) => ({ value: l.delta, text: `${pct(l.pct)} on ${BUCKET_LABEL[l.bucket]}` })),
    ...(e?.benefits || []).filter((b) => b.kind !== "protection" && b.value > 0).map((b) => ({ value: b.value, text: `the ${short(b.label)}` })),
  ].sort((a, b) => b.value - a.value).slice(0, 2);
  if (!drivers.length) return "It earns about the same as a simple card for how you spend.";
  return `Mostly ${drivers.map((x, i) => (i === 0 ? `its ${x.text} (${money(x.value)})` : `${x.text} (${money(x.value)})`)).join(" and ")}${d.fee ? `, after a ${money(d.fee)} fee` : ""}.`;
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
export default function CardDetail({ cardId, profile: raw, onClose, onToggleOwn, onProfileChange, wallet: context = null }) {
  const profile = normalizeProfile(raw);
  const [math, setMath] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  const [open, setOpen] = useState(null);
  const bestN = useMemo(() => optimalWallet(profile).value.N, [profile]);
  const d = useMemo(() => cardDetail(cardId, profile, bestN), [cardId, profile, bestN]);
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
  const value = d.inWallet.has || wallet.length ? d.inWallet.after.N - d.inWallet.before.N : d.solo.net;
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
                <p className="detail-value"><span className="t-big">{d.own.net >= 0 ? "Worth" : "Costs you"} ≈ <CountUp value={Math.abs(d.own.net)} display /></span><span className="detail-unit"> a year to you{d.own.fee ? ` after its ${money(d.own.fee)} fee` : ""}</span></p>
                <p className="t-lead">{breakEvenLine(d.own)}</p>
              </>
            ) : (
              <>
                <p className="detail-value"><span className="t-big">{valueLabel} ≈ <CountUp value={Math.max(0, value)} display /></span><span className="detail-unit"> a year to you</span></p>
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

          <Reveal i={2} className="panel detail-block detail-why">
            <WhyThisCard cardId={c.id} wallet={context || wallet} profile={profile} label={d.inWallet.has ? "What it adds to your wallet" : "Why this card?"} />
          </Reveal>

          <Reveal i={2} className="panel detail-block">
            <h2 className="t-h2">Benefits you'd use</h2>
            {!d.used.length && <p className="t-caption">None of its benefits match your answers.</p>}
            <ul className="rows">
              {d.used.map((b) => {
                const Icon = iconFor(b);
                const isOpen = open === b.id;
                return (
                  <li key={b.id}>
                    <button className="benefit-row" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                      <Icon size={18} aria-hidden="true" />
                      <span className="benefit-name">{b.label}</span>
                      <span className="benefit-value">{money(b.value)}</span>
                    </button>
                    {isOpen && (
                      <p className="benefit-more t-caption">
                        {b.face ? `Worth up to ${money(b.face)} a year on paper; we count ${money(b.value)} — what you'd realistically use from your answers.` : "Counted from your answers."}
                        {b.split && profile.planAround.includes(b.id) && <> <button className="link" onClick={() => togglePlan(b.id)}>Stop counting it</button></>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>

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
                  <span className="t-caption">{money(e.value)} a year on {money(e.dollars)}</span>
                </li>
              ))}
            </ul>
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
            {math && <TheMath d={d} />}
          </Reveal>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

/** "See the math" — the card on its own, from walletValue (jargon allowed here). */
export function TheMath({ d }) {
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
        {d.used.map((b) => <React.Fragment key={b.id}><dt>{b.label}</dt><dd>{money(b.face || b.value)} face → {money(b.value)} counted</dd></React.Fragment>)}
        <dt>Benefits U</dt><dd>{money(v.U)} realistic · {money(possible)} possible max</dd>
        <dt>Fees F</dt><dd>{money(v.F)}</dd>
        <dt>Net E + U − F</dt><dd>{money(v.net)}</dd>
        <dt>vs a 2% card</dt><dd>{v.N >= 0 ? "+" : "−"}{money(v.N)} (baseline {money(v.base)})</dd>
      </dl>
      <p className="t-caption">Method: docs/METHODOLOGY.md. Point values from your partner picks.</p>
    </div>
  );
}

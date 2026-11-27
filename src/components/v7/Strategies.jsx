/* v7f Part 3 — the "Strategies" tab: built-in card sets ranked by net value
   for this person, each with its earnings, credits, fees, value per point,
   transfers, new cards and time, what it keeps / adds / downgrades, and
   "which card for what". "Use this strategy" makes it the target in the
   Wallet Lab and the plan. Replaces the Lab's sample wallets. */
import React, { useMemo, useState } from "react";
import { BY_ID } from "../../data/cards/index.js";
import CardFace from "../v5/CardFace.jsx";
import { cardDisplayName } from "../../data/cardNames.js";
import { rankStrategies } from "../../engine/v5/strategies.js";
import { normalizeProfile, totalAnnualSpend } from "../../engine/profileDefaults.js";
import { EXAMPLE_PROFILE, EXAMPLE_MONTHLY } from "./Welcome.jsx";
import { walletValue } from "../../engine/v5/methodology.js";
import BenefitsStrip, { benefitRowsFromValue } from "./BenefitsStrip.jsx";

const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const signed = (n) => `${n >= 0 ? "+" : "−"}${money(n)}`;
const names = (ids) => ids.map((id) => cardDisplayName(BY_ID[id])).join(", ") || "—";

export default function Strategies({ profile: raw, onSaveProfile, onGo, onOpenCard }) {
  const own = useMemo(() => normalizeProfile(raw), [raw]);
  /* Before any spending is entered, value every set for the same stated
     example spender as the Welcome page instead of showing $0 earnings. */
  const example = totalAnnualSpend(own) === 0;
  const profile = useMemo(() => (example ? normalizeProfile({ ...EXAMPLE_PROFILE, cardsHeld: own.cardsHeld, targetStrategy: own.targetStrategy }) : own), [own, example]);
  /* Example mode shows each set's own yearly value (earning + credits − fees),
     the same figure as the Welcome page, ranked by it; a real profile keeps
     the planner's measure (gain over your cards, after the cost of applying). */
  const r = useMemo(() => {
    const ranked = rankStrategies(profile);
    if (!example) return ranked;
    const rows = ranked.rows.map((x) => ({ ...x, net: x.E + x.U - x.F, needsText: null })).sort((a, b) => b.net - a.net).map((x, i) => ({ ...x, best: i === 0 }));
    return { ...ranked, rows };
  }, [profile, example]);
  const [open, setOpen] = useState(null);
  const use = (key) => { onSaveProfile?.({ ...own, targetStrategy: key }); onGo?.("lab"); };
  return (
    <section className="page strategies" data-testid="strategies">
      <header className="hotels-head">
        <p className="t-eyebrow">Strategies</p>
        <h1 className="t-d2">{example ? "Card sets that work together." : "Card sets that work together, ranked for you."}</h1>
        {example && <p className="t-caption" data-testid="strategies-example">{`Example values for someone spending about $${EXAMPLE_MONTHLY.toLocaleString("en-US")} a month and flying 4 times a year. Answer the spending questions and these re-rank for you.`}</p>}
        <p className="t-caption">{example
          ? "Each set's yearly value: points at the value the set unlocks plus the credits a typical person would use, minus annual fees."
          : "Each one's yearly value: points at the value the set unlocks, the credits you'd use, minus fees and the cost of applying. Your current cards are kept where they still add something."}</p>
      </header>
      <ol className="strategy-list mo-stagger">
        {r.rows.map((s) => (
          <li key={s.key} className="panel strategy" data-testid={`strategy-${s.key}`}>
            <div className="strategy-head">
              <h2 className="t-h3">{s.label} {s.best && <span className="tag" data-testid="best-for-you">{example ? "Top example" : "Best for you"}</span>}{profile.targetStrategy === s.key && <span className="tag">Your target</span>}</h2>
              <span className="num-ui strategy-net">{signed(s.net)} a year</span>
            </div>
            <p className="t-caption">{s.recipe}</p>
            <div className="strategy-faces" data-testid={`strategy-faces-${s.key}`} style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 10, margin: "4px 0 8px" }}>
              {[...new Set([...s.keeps, ...s.adds])].filter((id) => BY_ID[id]).map((id) => (
                <div key={id} className="mo-lift" style={{ width: 104 }}><CardFace card={BY_ID[id]} label={cardDisplayName(BY_ID[id])} /></div>
              ))}
            </div>
            <StrategyBenefits s={s} profile={profile} />
            {s.note && <p className="t-caption">{s.note}</p>}
            {s.business && <p className="t-caption">Needs a business card.</p>}
            {s.needsText && <p className="t-caption" data-testid="needs-spending">{s.needsText}.</p>}
            <dl className="strategy-facts t-caption">
              <div><dt>Earnings</dt><dd>{money(s.E)}</dd></div>
              <div><dt>Credits you'd use</dt><dd>{money(s.U)}</dd></div>
              <div><dt>Fees</dt><dd>{s.F ? `−${money(s.F)}` : "$0"}</dd></div>
              <div><dt>Applying</dt><dd>{s.hurdle ? `−${money(s.hurdle)}` : "$0"}</dd></div>
              <div><dt>Value per point</dt><dd>{s.cpp.toFixed(2)}¢{s.transfers ? ` · opens ${s.transfers} transfer partners` : ""}</dd></div>
              <div><dt>New cards</dt><dd>{s.newCards ? `${s.newCards}, over ${s.months} months` : "none"}{s.blocked.length ? ` · ${names(s.blocked)} waits for 5/24` : ""}</dd></div>
            </dl>
            <p className="t-caption">Keeps: {names(s.keeps)} · Adds: {names(s.adds)}{s.drops.length ? ` · ${s.drops.map((d) => d.action === "downgrade" ? `downgrade ${cardDisplayName(BY_ID[d.cardId])} to ${cardDisplayName(BY_ID[d.to])}` : d.action === "cancel" ? `cancel ${cardDisplayName(BY_ID[d.cardId])}` : `keep ${cardDisplayName(BY_ID[d.cardId])} open (no fee)`).join(" · ")}` : ""}</p>
            <div className="strategy-actions">
              <button type="button" className="btn btn-ink btn-small" onClick={() => use(s.key)}>Use this strategy</button>
              <button type="button" className="link" aria-expanded={open === s.key} onClick={() => setOpen(open === s.key ? null : s.key)}>Which card for what</button>
            </div>
            {open === s.key && <div className="mo-fade">
              <table className="v7-math" data-testid={`where-${s.key}`}>
                <tbody>{s.where.map((w) => <tr key={w.key}><th scope="row">{w.label}</th><td><button type="button" className="link" onClick={() => onOpenCard?.(w.cardId)}>{cardDisplayName(BY_ID[w.cardId])}</button></td><td className="num-ui">{Math.round(w.pct * 10) / 10}%</td></tr>)}</tbody>
              </table>
            </div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* The wallet this strategy builds (kept + added cards), valued by the engine. */
function StrategyBenefits({ s, profile }) {
  const rows = useMemo(() => benefitRowsFromValue(walletValue([...new Set([...s.keeps, ...s.adds])].filter((id) => BY_ID[id]), profile)), [s, profile]);
  return <BenefitsStrip rows={rows} title="Top benefits in this set" limit={3} testId={`strategy-benefits-${s.key}`} />;
}

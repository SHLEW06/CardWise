import React, { useMemo, useState } from "react";
import { X, Plus, Check, Compass } from "lucide-react";
import CardArt from "../CardArt.jsx";
import CreditRealismToggles from "./CreditRealismToggles.jsx";
import { BY_ID } from "../../data/cards.js";
import { CATS, CAT_LABEL, buildSpend, rateFor, fmtMoney } from "../../engine/scoring.js";
import { effCpp } from "../../engine/transferValue.js";
import { calculateValueBreakdown } from "../../engine/valueBreakdown.js";
import { calculateMarginalCardValue } from "../../engine/marginalValue.js";

/* Premium detail panel: card face on top, multipliers as chips (annotated
   with $/yr from THIS user's spend), realistic-vs-max toggle, breakeven
   from the engine, credit-realism toggles. All numbers read from engine
   outputs; the panel itself never does value math. */
export default function CardDetail({
  cardId,
  profile,
  wallet,
  owned,
  onClose,
  onToggleOwn,
  onAnswerCredit,
}) {
  const [showMax, setShowMax] = useState(false);
  const card = cardId ? BY_ID[cardId] : null;

  const held = useMemo(
    () => (Array.isArray(wallet) ? wallet : []).filter((id) => id !== cardId),
    [wallet, cardId]
  );
  const breakdown = useMemo(
    () => (card ? calculateValueBreakdown(card, profile, held) : null),
    [card, profile, held]
  );
  const marginal = useMemo(
    () => (card ? calculateMarginalCardValue(card, profile, held) : null),
    [card, profile, held]
  );

  if (!card) return null;
  const spend = buildSpend(profile || {});
  const cpp = card.pointCurrency ? effCpp(card.pointCurrency, profile, held) : 1.0;

  /* Category chips: one per non-zero earn rate. Annualized $ uses this
     user's spend + the engine's cpp — no fresh math. */
  const chips = CATS
    .map((cat) => {
      const rate = rateFor(card, cat);
      const monthly = spend[cat] || 0;
      const annual = Math.round(monthly * 12 * rate * (cpp / 100));
      return { cat, rate, annual, monthly };
    })
    .filter((c) => c.rate >= 2 || (c.cat === "General" && c.rate >= 1));

  const beRows = (breakdown?.breakeven || []).filter((b) => b.breakevenAnnualSpend != null);

  return (
    <div className="cw-cd-scrim" role="dialog" aria-label={`${card.name} details`} onClick={onClose}>
      <div className="cw-cd" onClick={(e) => e.stopPropagation()}>
        <button className="cw-cd-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Header — the metal card + core numbers */}
        <div className="cw-cd-head">
          <div className="cw-cd-art">
            <CardArt id={card.id} size="md" variant="modal" selected />
          </div>
          <div className="cw-cd-headmeta">
            <div className="cw-eyebrow">{card.issuer}</div>
            <div className="cw-cd-name">{card.name}</div>
            <div className="cw-cd-nums">
              <div className="cw-cd-numbox">
                <div className="cw-cd-numlab">Realistic net</div>
                <div className="cw-cd-numval">{fmtMoney(breakdown?.realisticNetValue || 0)}/yr</div>
              </div>
              <div className="cw-cd-numbox cw-cd-numbox-muted">
                <div className="cw-cd-numlab">Possible max</div>
                <div className="cw-cd-numval">{fmtMoney(breakdown?.possibleMaxValue || 0)}/yr</div>
              </div>
              <div className="cw-cd-numbox">
                <div className="cw-cd-numlab">Marginal add</div>
                <div className="cw-cd-numval">
                  {marginal?.marginalValue >= 0 ? "+" : ""}
                  {fmtMoney(marginal?.marginalValue || 0)}/yr
                </div>
              </div>
            </div>
            <div className="cw-cd-actions">
              {owned ? (
                <button className="cw-btn cw-btn-ghost" onClick={() => onToggleOwn?.(card.id)}>
                  <Check size={14} /> In your wallet
                </button>
              ) : (
                <button className="cw-btn cw-btn-primary" onClick={() => onToggleOwn?.(card.id)}>
                  <Plus size={14} /> Add to wallet
                </button>
              )}
              <button
                className={"cw-toggle " + (showMax ? "cw-toggle-on" : "")}
                onClick={() => setShowMax(!showMax)}
                title="Realistic uses conservative utilization; Max uses face value"
              >
                {showMax ? "Showing max" : "Show max"}
              </button>
            </div>
          </div>
        </div>

        {/* Multiplier chips */}
        <section className="cw-cd-section">
          <div className="cw-cd-sec-title">Multipliers on your spend</div>
          <div className="cw-cd-chips">
            {chips.map((c) => (
              <div key={c.cat} className={"cw-cd-mchip " + (c.rate >= 3 ? "cw-cd-mchip-hot" : "")}>
                <span className="cw-cd-mchip-rate">{c.rate}x</span>
                <span className="cw-cd-mchip-cat">{CAT_LABEL[c.cat] || c.cat}</span>
                <span className="cw-cd-mchip-usd">{fmtMoney(c.annual)}/yr</span>
              </div>
            ))}
            {chips.length === 0 && (
              <div className="cw-cd-empty">No bonus categories fire on your current spend.</div>
            )}
          </div>
        </section>

        {/* Benefits: realistic vs max */}
        <section className="cw-cd-section">
          <div className="cw-cd-sec-title">Realized benefits</div>
          <div className="cw-cd-benefits">
            {_benefitRow("Credits you'd use",
              showMax ? breakdown?.creditsMaxValue : breakdown?.creditsUsedValue)}
            {_benefitRow("Free-night cert",
              showMax ? breakdown?.hotelCertificate?.possibleMax : breakdown?.certificateValue)}
            {_benefitRow("Companion cert",
              showMax ? breakdown?.companionCertificate?.possibleMax : breakdown?.companionCertificateValue)}
            {_benefitRow("Lounge access",
              showMax ? breakdown?.loungeMax : breakdown?.loungeValue)}
            {_benefitRow("Checked bags",
              showMax ? breakdown?.checkedBagMax : breakdown?.checkedBagValue)}
            {_benefitRow("Elite status", showMax ? breakdown?.statusMax : breakdown?.statusValue)}
            {_benefitRow("Travel protections", breakdown?.protectionValue)}
            <div className="cw-cd-benefit cw-cd-benefit-total">
              <span className="cw-cd-benefit-lab">Annual fee</span>
              <span className="cw-cd-benefit-usd">−{fmtMoney(breakdown?.annualFee || 0)}</span>
            </div>
          </div>
        </section>

        {/* Breakeven lines */}
        {beRows.length > 0 && (
          <section className="cw-cd-section">
            <div className="cw-cd-sec-title">Breakeven vs your catch-all</div>
            <ul className="cw-cd-be">
              {beRows.map((b) => (
                <li key={b.category} className={"cw-cd-be-row " + (b.clearsFee ? "cw-cd-be-good" : "cw-cd-be-bad")}>
                  <span className="cw-cd-be-cat">{b.category}</span>
                  <span className="cw-cd-be-txt">
                    beats your catch-all above <strong>{fmtMoney(b.breakevenAnnualSpend)}/yr</strong> — you're at <strong>{fmtMoney(b.userAnnualSpend)}/yr</strong>
                  </span>
                  <span className="cw-cd-be-tick">{b.clearsFee ? "✓" : "✗"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Credit-realism toggles */}
        {breakdown?.creditRealismPrompts?.length > 0 && (
          <section className="cw-cd-section">
            <CreditRealismToggles
              prompts={breakdown.creditRealismPrompts}
              answers={profile?.benefitUsage || {}}
              onAnswer={onAnswerCredit}
            />
          </section>
        )}

        {/* Deterministic engine explanation */}
        {marginal?.explanation && (
          <section className="cw-cd-section cw-cd-explain">
            <Compass size={14} aria-hidden="true" />
            <span>{marginal.explanation}</span>
          </section>
        )}
      </div>
    </div>
  );
}

function _benefitRow(label, usd) {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return (
    <div className="cw-cd-benefit">
      <span className="cw-cd-benefit-lab">{label}</span>
      <span className="cw-cd-benefit-usd">{fmtMoney(usd)}</span>
    </div>
  );
}

/* v7d Part 4: the optional total fee limit.
   No limit (the default) — the optimizer shows the best value.
   "Up to $___ a year" — a real constraint everywhere, and we always say what
   it costs: "Your $400 limit keeps out the Sapphire Reserve, which would add
   $X a year. [Remove limit]". */
import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Choice from "../v5/Choice.jsx";
import { feeLimitCost } from "../../engine/v5/methodology.js";
import { BY_ID } from "../../data/cards/index.js";
import { cardDisplayName } from "../../data/cardNames.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
export const DEFAULT_LIMIT = 400;

/** "No limit, show me the best value" / "Up to $___ a year". */
export function FeeLimitChoice({ value, onChange, id = "fee-limit" }) {
  const on = value != null;
  return (
    <div className="fee-limit" data-testid={id}>
      <div className="chip-wrap" role="radiogroup" aria-labelledby={`${id}-q`}>
        <Choice radio pill selected={!on} onSelect={() => onChange(null)}>No limit, show me the best value</Choice>
        <Choice radio pill selected={on} onSelect={() => onChange(on ? value : DEFAULT_LIMIT)}>Up to $___ a year</Choice>
      </div>
      {on && (
        <label className="fee-limit-input t-caption">
          Up to $
          <input inputMode="numeric" aria-label="Most you'd pay in yearly card fees" value={value}
            onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange(Number.isFinite(n) ? n : 0); }} />
          a year in card fees, in total
        </label>
      )}
    </div>
  );
}

/** The cost sentence, with a Remove limit button. Null without a limit. */
export function feeLimitText(cost) {
  if (!cost) return null;
  if (!cost.keptOut.length || cost.adds <= 0) return `Your ${money(cost.limit)} limit doesn't change your best wallet.`;
  const names = cost.keptOut.map((id) => cardDisplayName(BY_ID[id]));
  return `Your ${money(cost.limit)} limit keeps out the ${list(names)}, which would add ${money(cost.adds)} a year.`;
}

export function FeeLimitCost({ profile, mode = "scratch", onRemove }) {
  const cost = useMemo(() => feeLimitCost(profile, { mode }), [profile, mode]);
  const text = feeLimitText(cost);
  if (!text) return null;
  return (
    <p className="t-caption fee-limit-cost" data-testid="fee-limit-cost" role="status">
      {text}{" "}
      {onRemove && <button type="button" className="link" onClick={onRemove}>Remove limit</button>}
    </p>
  );
}

/** Wallet Lab quick-edit chip: "Fee limit: none ▾". */
export function FeeLimitChip({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fee-limit-chip">
      <button type="button" className="btn btn-quiet btn-small" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="fee-limit-chip">
        Fee limit: {value == null ? "none" : `${money(value)} a year`} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="fee-limit-pop panel" role="group" aria-label="Fee limit">
          <p className="t-caption" id="lab-fee-limit-q">Is there a most you'd pay in yearly card fees, in total?</p>
          <FeeLimitChoice value={value} onChange={onChange} id="lab-fee-limit" />
        </div>
      )}
    </div>
  );
}

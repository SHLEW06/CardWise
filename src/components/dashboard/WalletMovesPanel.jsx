import React from "react";
import { CheckCircle2, ArrowDownCircle, XCircle, Repeat, HelpCircle } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { BY_ID } from "../../data/cards.js";

const ICONS = {
  keep: CheckCircle2,
  downgrade: ArrowDownCircle,
  "product-change": Repeat,
  cancel: XCircle,
  reconsider: HelpCircle,
};

const LABELS = {
  keep: "Keep",
  downgrade: "Downgrade later",
  "product-change": "Product change",
  cancel: "Cancel",
  reconsider: "Reconsider later",
};

/* Cards to keep / downgrade / cancel — one row per held card, driven by
   walletOptimizer.recommendDowngradeOrCancelMoves. Empty wallets return null
   so we don't render a stub panel during onboarding. */
export default function WalletMovesPanel({ rows, onOpenCard }) {
  if (!rows || rows.length === 0) return null;

  const groups = { keep: [], downgrade: [], "product-change": [], cancel: [], reconsider: [] };
  for (const r of rows) {
    const bucket = groups[r.recommendation] || groups.reconsider;
    bucket.push(r);
  }

  const sections = [
    { key: "keep", title: "Keep" },
    { key: "downgrade", title: "Downgrade later" },
    { key: "product-change", title: "Product-change candidates" },
    { key: "cancel", title: "Consider canceling" },
    { key: "reconsider", title: "Reconsider later" },
  ].filter((s) => groups[s.key].length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="cw-panel" style={{ marginTop: 18 }}>
      <div className="cw-panel-title">
        <CheckCircle2 size={17} /> Your current wallet
      </div>
      <p className="cw-arch-line" style={{ marginTop: 6 }}>
        For each card you hold, whether the keeper math still clears — plus a
        specific move (keep, downgrade, product-change, or cancel) when it
        doesn't.
      </p>

      <div className="cw-mv-moves">
        {sections.map((sec) => (
          <div key={sec.key} className="cw-mv-move-group">
            <div className="cw-mv-move-heading">
              {React.createElement(ICONS[sec.key], { size: 14 })} {sec.title}
              <span className="cw-mv-move-count">{groups[sec.key].length}</span>
            </div>
            <div className="cw-mv-move-rows">
              {groups[sec.key].map((row) => {
                const card = BY_ID[row.cardId];
                if (!card) return null;
                return (
                  <div key={row.cardId} className="cw-mv-move-row">
                    <CardArt
                      id={row.cardId}
                      size="sm"
                      variant="tile"
                      onClick={onOpenCard ? () => onOpenCard(row.cardId) : undefined}
                    />
                    <div className="cw-mv-move-body">
                      <div className="cw-mv-move-name">{card.name}</div>
                      <div className="cw-mv-move-decision">
                        {LABELS[row.recommendation] || row.recommendation}
                        {row.target?.name && (
                          <span className="cw-mv-move-target"> → {row.target.name}</span>
                        )}
                      </div>
                      {row.warnings?.length > 0 && (
                        <div className="cw-mv-move-warn">{row.warnings[0]}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

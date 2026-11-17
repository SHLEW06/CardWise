import React, { useMemo, useState, useEffect, useRef } from "react";
import { Search, Zap, ExternalLink, ChevronRight, Store, Globe, AlertCircle, Check, Plus } from "lucide-react";
import CardArt from "../CardArt.jsx";
import { findRewards } from "../../engine/offers/findRewards.js";
import { matchBrands } from "../../engine/offers/brandMatch.js";
import { describeOffer, daysUntilExpiry } from "../../engine/offers/offerModel.js";

const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Number(n) || 0).toFixed(2).replace(/\.00$/, "");

const QUICK = ["Walmart", "Target", "Amazon", "Nike", "Apple", "Microsoft", "Costco", "Starbucks", "Delta", "Marriott"];

/**
 * Go — "I'm buying X for $Y: which card, and what do I activate first?"
 *
 * Props: wallet (ids), offers, profile, onOpenCard, onMarkAdded(offerId),
 *        onGoTab(tabId)
 */
export default function GoScreen({ wallet = [], offers = [], profile = {}, onOpenCard, onMarkAdded, onGoTab }) {
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("any");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const suggestions = useMemo(() => (query.trim().length >= 2 ? matchBrands(query, { limit: 5 }) : []), [query]);
  const result = useMemo(() => {
    if (!query.trim()) return null;
    return findRewards({ query, amount: Number(amount) || 0, channel }, wallet, offers, profile);
  }, [query, amount, channel, wallet, offers, profile]);

  const hasWallet = wallet.length > 0;
  const spend = Number(amount) || 0;

  return (
    <div className="go cw-rise">
      <header className="go-head">
        <p className="cw-eyebrow">Go</p>
        <h1 className="go-title">Where are you buying?</h1>
        <p className="go-sub">Type a store or brand. Every card in your wallet gets ranked, and any offer you still need to activate floats to the top.</p>
      </header>

      <div className="go-form">
        <div className="go-search">
          <Search size={18} className="go-search-icon" />
          <input
            ref={inputRef}
            className="cw-input"
            placeholder="Nike, Microsoft, Lenox Square, Walmart…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            aria-label="Merchant or place"
          />
          {focused && suggestions.length > 0 && suggestions[0].score < 1 && (
            <ul className="go-suggest" role="listbox">
              {suggestions.map((s) => (
                <li key={s.brand.key}>
                  <button type="button" onMouseDown={() => setQuery(s.brand.name)}>
                    <span>{s.brand.name}</span>
                    <span className="go-suggest-cat">{s.brand.category === "unbonused" ? "retail" : s.brand.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="go-amount">
          <span className="go-amount-sym">$</span>
          <input
            className="cw-input cw-input-plain"
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-label="Purchase amount"
          />
        </div>
        <div className="go-channel" role="radiogroup" aria-label="Where">
          {[["any", "Either", null], ["inStore", "In store", Store], ["online", "Online", Globe]].map(([id, label, Icon]) => (
            <button
              key={id} type="button"
              className={["cw-chip", "cw-chip-sm", channel === id && "cw-chip-on"].filter(Boolean).join(" ")}
              onClick={() => setChannel(id)} role="radio" aria-checked={channel === id}
            >
              {Icon && <Icon size={13} />} {label}
            </button>
          ))}
        </div>
      </div>

      {!query.trim() && (
        <div className="go-quick">
          {QUICK.map((q) => (
            <button key={q} type="button" className="cw-chip cw-chip-sm" onClick={() => setQuery(q)}>{q}</button>
          ))}
        </div>
      )}

      {!hasWallet && (
        <div className="cw-panel go-empty">
          <div className="cw-panel-title"><AlertCircle size={16} /> No cards in your wallet yet</div>
          <p>Add the cards you actually carry, then come back here.</p>
          <button className="cw-btn cw-btn-primary" onClick={() => onGoTab?.("board")}><Plus size={15} /> Add cards</button>
        </div>
      )}

      {result && hasWallet && (
        <>
          {result.activateFirst.length > 0 && (
            <section className="cw-panel go-activate">
              <div className="cw-panel-head">
                <div className="cw-panel-title"><Zap size={16} /> Activate before you pay</div>
                <span className="go-count">{result.activateFirst.length}</span>
              </div>
              <ul className="go-activate-list">
                {result.activateFirst.map(({ offer, card, math }) => {
                  const page = card ? result.cards.find((c) => c.cardId === card.id)?.issuerPage : null;
                  const days = daysUntilExpiry(offer);
                  return (
                    <li key={offer.id} className="go-activate-row">
                      <div className="go-activate-main">
                        <strong>{describeOffer(offer)}</strong>
                        <span className="go-activate-card">{card?.issuer} {card?.name}</span>
                        {math.note && <span className="go-note">{math.note}</span>}
                        {days != null && days <= 14 && <span className="go-note go-warn">Expires in {days}d</span>}
                      </div>
                      <div className="go-activate-actions">
                        {page && (
                          <a className="cw-btn cw-btn-accent" href={page.url} target="_blank" rel="noopener noreferrer">
                            Open {page.label} <ExternalLink size={13} />
                          </a>
                        )}
                        <button className="cw-btn cw-btn-ghost" onClick={() => onMarkAdded?.(offer.id)} title="I added it on the issuer site">
                          <Check size={14} /> Added
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="go-results">
            <div className="go-results-head">
              <h2 className="go-h2">
                {result.brand ? result.brand.name : result.merchant}
                <span className="go-cat">· earns as {labelFor(result.category)}</span>
              </h2>
              {spend > 0 && <span className="go-spend">{money(spend)}</span>}
            </div>

            {result.cards.map((row, i) => (
              <article key={row.cardId} className={["go-card", i === 0 && "go-card-best"].filter(Boolean).join(" ")}>
                <div className="go-card-art">
                  <CardArt card={row.card} size="sm" variant="tile" onClick={() => onOpenCard?.(row.cardId)} />
                </div>
                <div className="go-card-body">
                  <div className="go-card-top">
                    <div>
                      <div className="go-card-rank">{i === 0 ? "Best card" : `#${row.rank}`}</div>
                      <div className="go-card-name">{row.card.issuer} {row.card.name}</div>
                    </div>
                    <div className="go-card-total">
                      <span className="go-card-total-num">{spend > 0 ? money(row.total) : `${row.base.pct}%`}</span>
                      <span className="go-card-total-lab">{spend > 0 ? "back" : "effective"}</span>
                    </div>
                  </div>
                  <ul className="go-reasons">
                    {row.reasons.map((r, k) => <li key={k}>{r}</li>)}
                    {row.offer && row.needsActivation && row.offerMath.value > 0 && (
                      <li className="go-reason-act"><Zap size={12} /> Needs activation — see above</li>
                    )}
                  </ul>
                  {row.stackedOffers.length > 1 && (
                    <div className="go-more">+{row.stackedOffers.length - 1} other offer{row.stackedOffers.length > 2 ? "s" : ""} on this card for this merchant</div>
                  )}
                </div>
              </article>
            ))}

            {result.offersConsidered === 0 && (
              <p className="go-none">
                No card-linked offers for {result.merchant} on your cards right now.
                <button className="go-link" onClick={() => onGoTab?.("offers")}>Add one <ChevronRight size={13} /></button>
              </p>
            )}

            {result.rotatingHints.map((h) => (
              <p key={h.cardId} className="go-hint">{h.note}</p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function labelFor(cat) {
  const map = {
    unbonused: "everything else", onlineShopping: "online shopping", apparel: "retail", electronics: "electronics",
    dining: "dining", groceries: "groceries", gas: "gas", drugstores: "drugstores", streaming: "streaming",
    amazon: "Amazon", walmart: "Walmart", target: "Target", costco: "wholesale", flights: "flights", hotels: "hotels",
  };
  return map[cat] || cat;
}

/* ============================================================================
   /styletile — v7 "Ink & Stone" style tile (REDESIGN_SPEC §9.11). Dev only:
   main.jsx mounts it only under `import.meta.env.DEV`, so it never ships.
   Review artifact — nothing here is wired into the app yet. Numbers on this
   page are sample values, not engine output.
   ========================================================================== */
import React, { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import FocalImage, { focalSrc } from "./FocalImage.jsx";
import Dial from "./Dial.jsx";
import Num from "./Num.jsx";
import CardPhoto from "./CardPhoto.jsx";
import { BY_ID } from "../../data/cards/index.js";
import "../../styles/v7/tokens.css";
import "../../styles/v7/components.css";
import "../../styles/v7/styletile.css";

/* WCAG contrast, so the ratios shown are computed, not typed. */
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const GROUND = [
  { name: "Ink", token: "--bg", hex: "#070B16", role: "Page background" },
  { name: "Surface", token: "--surface", hex: "#0E1830", role: "Panels" },
  { name: "Raised", token: "--raised", hex: "#13213A", role: "Inputs, hover rows, menus" },
  { name: "Line", token: "--line", hex: "#1E2F50", role: "1px borders, dividers" },
];
const INKS = [
  { name: "Ivory", token: "--text", hex: "#F1EBDD", role: "Primary text" },
  { name: "Ivory 2", token: "--text-2", hex: "#B9B4A8", role: "Secondary text" },
  { name: "Ivory 3", token: "--text-3", hex: "#9A968C", role: "Captions, labels" },
  { name: "Bronze", token: "--bronze", hex: "#B08D57", role: "The one accent: dial, focus, hints" },
  { name: "Good", token: "--good", hex: "#8FB59B", role: "Better (muted)" },
  { name: "Worse", token: "--bad", hex: "#D59C86", role: "Worse (muted)" },
];

const ROUTES = [
  { what: "Dining", card: "amex-gold", pct: "6.4", note: "4 points per $1" },
  { what: "Groceries", card: "amex-gold", pct: "6.4", note: "4 points per $1, up to $25,000 a year" },
  { what: "Flights and hotels", card: "csr", pct: "6.0", note: "4 points per $1, booked direct" },
  { what: "Everything else", card: "csr", pct: "1.5", note: "1 point per $1" },
];

const fmtRatio = (r) => `${r.toFixed(1)}:1`;

function Section({ n, title, note, children, id }) {
  return (
    <section className="st-section" id={id} aria-labelledby={`${id}-h`}>
      <header className="st-section-head">
        <p className="is-label">{String(n).padStart(2, "0")}</p>
        <h2 className="is-d2" id={`${id}-h`}>{title}</h2>
        {note && <p className="is-small st-section-note">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function MissingHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="v7-hint">
      <div className="v7-hint-row">
        <div>
          <p className="is-label v7-hint-label">What you're missing</p>
          <p className="is-body">About <span className="num-ui">$294</span> a year. Your groceries go on Freedom Unlimited at 1.5% back. The Amex Gold you already have pays about 6.4% there.</p>
        </div>
        <button className="v7-btn-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide the math" : "Show the math"} <ChevronDown size={16} aria-hidden="true" className={open ? "is-flipped" : ""} />
        </button>
      </div>
      {open && (
        <table className="v7-math">
          <thead><tr><th scope="col">Groceries, $6,000 a year</th><th scope="col">Back</th><th scope="col">A year</th></tr></thead>
          <tbody>
            <tr><td>Freedom Unlimited, 1.5 points per $1 × 1.0¢</td><td className="num-ui">1.5%</td><td className="num-ui">$90</td></tr>
            <tr><td>Amex Gold, 4 points per $1 × 1.6¢</td><td className="num-ui">6.4%</td><td className="num-ui">$384</td></tr>
            <tr className="is-total"><td>Difference</td><td /><td className="num-ui v7-good">+$294</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Hero() {
  return (
    <div className="st-hero">
      <div className="st-hero-copy">
        <p className="is-label">Your wallet</p>
        <h1 className="is-hero">Your cards pay you <Num>$1,080</Num> a year.</h1>
        <p className="is-lead">That's after their yearly fees, counting only the perks you told us you'd use.</p>
        <div className="st-actions">
          <button className="v7-btn-primary">See your next move <ArrowRight size={18} aria-hidden="true" /></button>
          <button className="v7-btn-quiet">How we count this</button>
        </div>
        <div className="st-hero-score">
          <Dial score={82} size={120} caption="Score" />
          <p className="is-small">82 of 100: your <span className="num-ui">$1,080</span> against the best setup for your fee budget, <span className="num-ui">$1,320</span>.</p>
        </div>
        <MissingHint />
      </div>
      <FocalImage slot="home" className="st-hero-focal" />
    </div>
  );
}

export default function StyleTile() {
  const csr = BY_ID.csr;
  const gold = BY_ID["amex-gold"];
  const [chips, setChips] = useState(["Groceries", "Dining"]);
  const [period, setPeriod] = useState("Monthly");
  const toggleChip = (c) => setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <main className="ink-stone st">
      <div className="st-top">
        <p className="is-label">CardWise · style tile · dev only</p>
        <p className="is-label">v7 · Ink &amp; Stone · 2026-11-20</p>
      </div>

      <Section n={1} id="hero" title="Home, composed" note="One idea, one big serif line, calm UI around it. The focal image is the only texture on the page.">
        <Hero />
      </Section>

      <Section n={2} id="palette" title="Palette" note="Deep ink navy, lighter blue surfaces you can see, warm ivory text, one bronze accent used sparingly. Ratios are computed (WCAG).">
        <div className="st-ground">
          {GROUND.map((g) => (
            <div key={g.hex} className="st-ground-swatch" style={{ background: g.hex }}>
              <p className="is-label">{g.name}</p>
              <p className="st-hex num-ui">{g.hex}</p>
              <p className="is-caption">{g.role}</p>
              {g.token !== "--line" && (
                <p className="is-caption st-ratios num-ui">Ivory {fmtRatio(contrast("#F1EBDD", g.hex))} · Ivory 2 {fmtRatio(contrast("#B9B4A8", g.hex))} · Ivory 3 {fmtRatio(contrast("#9A968C", g.hex))}</p>
              )}
            </div>
          ))}
        </div>
        <div className="st-inks">
          {INKS.map((c) => (
            <div key={c.hex} className="st-ink">
              <span className="st-ink-chip" style={{ background: c.hex }} aria-hidden="true" />
              <div>
                <p className="is-body" style={{ color: c.hex }}>{c.name}</p>
                <p className="is-caption num-ui">{c.hex} · {c.role}</p>
              </div>
              <p className="is-caption st-ink-ratio num-ui">{fmtRatio(contrast(c.hex, "#070B16"))} on ink<br />{fmtRatio(contrast(c.hex, "#13213A"))} on raised</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} id="type" title="Type" note="Boska for display, Switzer for everything you read, Archivo Expanded for small labels. All free for commercial use, self-hosted.">
        <div className="st-faces">
          <div className="st-face">
            <p className="is-label">Display · Boska Light 300 / Regular 400</p>
            <p className="is-d1">Keep more of what you spend.</p>
            <p className="is-h1">Section and card titles, 26–36px</p>
          </div>
          <div className="st-face">
            <p className="is-label">UI + body · Switzer 400 / 500</p>
            <p className="is-h2">Where each purchase goes</p>
            <p className="is-body">Body at 17px. Plain words first: “yearly fee”, “≈ 3% back”, “airport lounges”. The detail is one click away for anyone who wants the points math.</p>
            <p className="is-caption">Caption at 13px, for sources and dates. Checked 2026-11-20.</p>
          </div>
          <div className="st-face">
            <p className="is-label">Labels · Archivo Expanded 400, 11px, +0.12em</p>
            <p className="is-label st-label-lg">Your wallet</p>
            <p className="is-label st-label-lg">Worth applying?</p>
            <p className="is-label st-label-lg">Welcome bonuses</p>
          </div>
        </div>

        <div className="st-numbers">
          <div><p className="st-bignum"><Num>$1,080</Num></p><p className="is-caption">a year, after fees</p></div>
          <div><p className="st-bignum"><Num>23</Num></p><p className="is-caption">lounge visits</p></div>
          <div><p className="st-bignum"><Num>4.8%</Num></p><p className="is-caption">back on dining</p></div>
          <p className="is-small st-numbers-note">Big numbers: Boska with proportional lining figures, so they sit on the line at capital height. Its zero is about 0.58 as wide as it is tall, a book-serif proportion, not a condensed one. Boska's default zero has a dot inside; we use its plain zero.</p>
        </div>

        <table className="v7-table">
          <caption className="is-label">Table figures · Switzer, tabular</caption>
          <thead><tr><th scope="col">Card</th><th scope="col">Yearly fee</th><th scope="col">Credits you'd use</th><th scope="col">Net a year</th></tr></thead>
          <tbody>
            <tr><td>Sapphire Reserve</td><td className="num-ui">$795</td><td className="num-ui">$611</td><td className="num-ui">$1,104</td></tr>
            <tr><td>Amex Gold</td><td className="num-ui">$325</td><td className="num-ui">$188</td><td className="num-ui">$711</td></tr>
            <tr><td>Freedom Unlimited</td><td className="num-ui">$0</td><td className="num-ui">$0</td><td className="num-ui">$41</td></tr>
          </tbody>
        </table>
      </Section>

      <Section n={4} id="focal" title="The focal image" note={focalSrc("home") ? "Showing the photo from public/backgrounds/focal-home." : "Stand-in drawn in SVG until a photo or render is dropped in public/backgrounds/focal-home.(avif|webp|jpg|png)."}>
        <div className="st-focal-row">
          <FocalImage slot="home" className="st-focal-big" />
          <div className="st-focal-notes">
            <p className="is-h1">One image per hero, and it carries all the texture.</p>
            <ul className="st-rules">
              <li>Tightly cropped navy card, bronze metal edge, on warm stone.</li>
              <li>Diagonal window light with soft mullion shadows; light from the upper right.</li>
              <li>No glows, lattices, sheen or blur on panels. Panels are flat fills with a 1px line.</li>
              <li>Corners 0–4px. Only primary buttons are pills.</li>
              <li>Brief for the photo or render: docs/BACKGROUNDS.md → “focal-home”.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section n={5} id="cards" title="Card pictures" note="Issuer photos for now, with each image's source URL on record. A setting will switch everything to our own rendered faces for public launch.">
        <div className="st-cards">
          <figure className="st-card-fig"><CardPhoto card={csr} eager /><figcaption className="is-caption">Issuer photo · Sapphire Reserve</figcaption></figure>
          <figure className="st-card-fig"><CardPhoto card={gold} eager /><figcaption className="is-caption">Issuer photo · Amex Gold</figcaption></figure>
          <figure className="st-card-fig"><CardPhoto card={csr} mode="rendered" /><figcaption className="is-caption">Our rendered face · Sapphire Reserve</figcaption></figure>
          <figure className="st-card-fig"><CardPhoto card={gold} mode="rendered" /><figcaption className="is-caption">Our rendered face · Amex Gold</figcaption></figure>
        </div>
      </Section>

      <Section n={6} id="components" title="Components" note="Calm, flat, legible. Selected is ivory; bronze marks focus, the dial and hints.">
        <div className="st-comp-grid">
          <div className="v7-panel st-comp-routes">
            <div className="v7-panel-head">
              <h3 className="is-h2">Where each purchase goes</h3>
              <p className="is-caption">Sample wallet</p>
            </div>
            <ul className="v7-rows">
              {ROUTES.map((r) => (
                <li key={r.what} className="v7-row">
                  <CardPhoto card={BY_ID[r.card]} className="v7-row-card" />
                  <div className="v7-row-main">
                    <p className="is-body">{r.what}</p>
                    <p className="is-caption">{BY_ID[r.card].name} · {r.note}</p>
                  </div>
                  <p className="v7-row-value"><span className="num-ui">≈ {r.pct}%</span> <span className="is-caption">back</span></p>
                </li>
              ))}
            </ul>
          </div>

          <div className="st-comp-side">
            <div className="v7-panel st-comp-block">
              <p className="is-label">Buttons</p>
              <div className="st-actions">
                <button className="v7-btn-primary">Save my answers <ArrowRight size={18} aria-hidden="true" /></button>
                <button className="v7-btn-secondary">Compare</button>
                <button className="v7-btn-quiet">Skip for now</button>
                <button className="v7-btn-secondary" disabled>Not available</button>
              </div>
            </div>

            <div className="v7-panel st-comp-block">
              <p className="is-label">Chips · pick what you spend on</p>
              <div className="v7-chips" role="group" aria-label="Spending">
                {["Dining", "Groceries", "Gas", "Flights", "Streaming"].map((c) => {
                  const on = chips.includes(c);
                  return (
                    <button key={c} className={`v7-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggleChip(c)}>
                      {on && <Check size={14} aria-hidden="true" />}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="v7-panel st-comp-block">
              <p className="is-label">Input</p>
              <label className="v7-field">
                <span className="is-small">Groceries</span>
                <span className="v7-field-row">
                  <span className="v7-input"><span aria-hidden="true">$</span><input inputMode="decimal" defaultValue="500" aria-label={`Groceries, ${period.toLowerCase()}`} /></span>
                  <span className="v7-seg" role="radiogroup" aria-label="Period">
                    {["Monthly", "Yearly"].map((p) => (
                      <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "is-on" : ""} onClick={() => setPeriod(p)}>{p}</button>
                    ))}
                  </span>
                </span>
                <span className="is-caption">Costs change month to month? Type a yearly total instead.</span>
              </label>
            </div>

            <div className="v7-panel st-comp-block st-comp-dial">
              <Dial score={82} size={148} caption="Wallet Score" />
              <div>
                <p className="is-label">Score dial</p>
                <p className="is-small">Hairline ring, thin bronze arc, the number in Boska.</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <footer className="st-foot">
        <p className="is-caption">Review only. Not applied to the app. Spec: docs/REDESIGN_SPEC.md §9.11.</p>
      </footer>
    </main>
  );
}

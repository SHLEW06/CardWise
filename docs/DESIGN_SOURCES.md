# Design sources — what to borrow so CardWise reads as crafted, not templated

Licenses and activity below were read from each repository's GitHub metadata on 2026-11-27.
Stack constraint: plain CSS + React, no Tailwind, **no new npm dependencies** (borrow values and ideas, not packages).

| Source | License | Last push | Borrow for CardWise | Avoid |
|---|---|---|---|---|
| [Radix Colors](https://github.com/radix-ui/colors) | MIT | 2025-12 | Warm neutral scales (`sand`, `olive`, `gold`, `bronze`) for the vignette, grain tint and hairlines; the 12-step logic (steps 3-5 = UI fills, 6-8 = borders, 11-12 = text) so contrast is designed, not guessed. Copy hex values into `tokens.css`. | Pure `slate`/`gray` on navy (the "default dark dashboard" look); mixing scales with different hue families. |
| [Open Props](https://github.com/argyleink/open-props) | MIT | 2026-10 | Easing curves (`--ease-out-3`, `--ease-spring-2`), layered shadow recipes (`--shadow-3`/`-4`, which stack 2-3 low-alpha shadows), noise/gradient ideas. Paste the few values you use as our own custom properties. | Importing the whole sheet (hundreds of unused vars); its default pastel gradients. |
| [Radix Primitives](https://github.com/radix-ui/primitives) | MIT | 2026-10 | Behavior reference only (Dialog focus trap, Tabs arrow-key roving, Popover collision handling) when auditing our own components. | Wrapping the app in it just to style on top; shadcn/ui's default theme (rounded-xl cards, zinc palette, tiny borders) is the most recognisable "AI template" look. |
| [React Aria](https://github.com/adobe/react-spectrum) (Apache-2.0) | Apache-2.0 | 2026-11 | Hooks-level accessibility patterns (combobox, listbox, date range) for the Explore filters and store search, if we ever replace a hand-rolled widget. | Adobe Spectrum's visual style; adding the package without a real gap to fill. |
| [Google Fonts](https://fonts.google.com) serif/grotesk families (OFL 1.1) | SIL OFL 1.1 | n/a | Free to self-host and redistribute. High-contrast display serifs (Fraunces, Instrument Serif, Newsreader) pair with a neutral grotesk; keep one serif for headlines only. | More than two families; variable-axis "wonk" settings on body copy. Fontshare fonts (Boska, Switzer) are free but under ITF's own license, **not OFL**, so they are fetched, not committed (see THIRD_PARTY.md). |
| [Carbon Design System](https://github.com/carbon-design-system/carbon) | Apache-2.0 | 2026-11 | Data-table density, number alignment, and the productive/expressive type scale for dense comparison screens. | Its blue-heavy IBM identity and 2px focus rings copied verbatim. |
| [GitHub Primer CSS](https://github.com/primer/css) | MIT | 2026-11 | Spacing scale discipline (4/8px steps) and the "subtle" vs "emphasis" fill pairs for badges and callouts. | Octicons and GitHub-specific branding. |
| [Shopify Polaris](https://github.com/Shopify/polaris) | NOASSERTION on GitHub (mixed; check files before copying) | 2026-09 | Content and empty-state writing guidance; card/banner anatomy. Inspiration only. | Copying code or tokens until the license is confirmed per file. |
| [Atlassian Design System](https://atlassian.design) | Proprietary tokens/assets | n/a | Reading only: its elevation and "surface/raised/overlay" naming for layered panels. | Reusing assets or tokens. |
| [awesome-design-systems](https://github.com/alexpate/awesome-design-systems) | Unlicense (a link list) | 2026-11 | Discovery list for further patterns. | n/a |

## Why these sources
Templates feel generated because of uniform radii, one-weight shadows, saturated gradients, flat pure-black or pure-slate backgrounds, and identical motion on everything.
The fixes are values, not libraries: warm (not blue-grey) neutrals, stacked low-alpha shadows, a single easing family, film grain that breaks gradient banding, and real photography used as quiet colour.

## Adopted now (this change)
**Film grain and a refined vignette on the page backdrop** (`src/styles/v6/backdrop.css`, pure CSS/SVG, no dependency):
- `.bd-vignette`: radial falloff to a warm near-black `rgb(12 10 8 / .55)` (Radix `sand`-family dark neutral instead of pure black), so corners hold the navy ground without going cold.
- `.bd-grain`: `feTurbulence` fractal noise, desaturated and warm-tinted through `feColorMatrix`, `mix-blend-mode: overlay` at 6%, tiled 220px with `stitchTiles`, so large blurred gradients and the background photos do not band and the page no longer looks like a flat CSS gradient.
- Photo layers are cross-faded in 400 ms (off under `prefers-reduced-motion`).

## Suggested next adoptions (not done; not in my files)
1. Replace the single panel shadow with an Open Props-style 3-layer stack and `--ease-out-3` on hover lifts.
2. Move text colours to Radix `sand` 11/12 equivalents and check each pairing at AA.
3. Audit modals/popovers against Radix focus-trap and Escape behavior.

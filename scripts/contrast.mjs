/* WCAG contrast for the v7b text tokens on the actual surfaces (v7b §1,
   acceptance A2). Composites translucent panels over the ground they sit on.
   Run: node scripts/contrast.mjs */
import { pathToFileURL } from "node:url";
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, alpha, bg) => fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i]));
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/* Grounds: gradient top / middle / bottom, plus the lightest point of the
   light pool (rgba(48,66,104,.55) over the top colour). */
const grounds = { "page top #18243F": hex("#18243F"), "page mid #101A30": hex("#101A30"), "page bottom #0B1222": hex("#0B1222") };
grounds["light pool peak"] = over(hex("#304268"), 0.3, hex("#18243F"));
/* Panels: #16213A @ 70% over each ground; chips #1A2742. */
const surfaces = { ...grounds };
for (const [k, g] of Object.entries(grounds)) surfaces[`panel over ${k}`] = over(hex("#16213A"), 0.7, g);
surfaces["chip / input #1A2742"] = hex("#1A2742");
const text = { heading: "#ECE6DA", body: "#C2BDB2", caption: "#9C988F", bronze: "#B8955E" };

export function report() {
  const rows = [];
  for (const [sname, s] of Object.entries(surfaces)) {
    for (const [tname, t] of Object.entries(text)) rows.push({ surface: `${sname} (${toHex(s)})`, text: `${tname} ${t}`, ratio: Math.round(ratio(hex(t), s) * 10) / 10 });
  }
  return rows;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = report();
  for (const r of rows) console.log(`${r.ratio.toFixed(1).padStart(5)}  ${r.text.padEnd(20)} on ${r.surface}`);
  console.log(`min ${Math.min(...rows.map((r) => r.ratio)).toFixed(1)}`);
}

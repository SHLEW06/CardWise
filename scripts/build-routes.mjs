#!/usr/bin/env node
/* ============================================================================
   build-routes.mjs — v7c Part 3.5: route data from US DOT BTS T-100 Segment
   (All Carriers), domestic + international.
   ----------------------------------------------------------------------------
   Downloads the latest 12 months from TranStats (the same form a person uses
   at transtats.bts.gov → T-100 Segment (All Carriers) → Download), keeps
   scheduled passenger service (CLASS F, seats > 0), and aggregates to
     origin → destination → carrier: yearly departures performed.
   Only routes that touch a US airport are kept, and only carriers with ≥ 12
   departures a year on the segment (about one a month), so charter one-offs
   drop out.

   Output: src/data/routes.generated.json
     { source, table, months: ["2025-09", …], generated,
       carriers: { "DL": "Delta Air Lines Inc." … },
       airports: { "ATL": { city, country } … },
       routes:   { "ATL": { "LAX": { "DL": 6012, "WN": 1460 } } } }

   Usage: node scripts/build-routes.mjs [--latest YYYY-MM] [--cache dir]
   Needs network access to www.transtats.bts.gov and the `unzip` command.
   Downloads are cached (default: .cache/bts, gitignored) so a re-run only
   fetches missing months.
   ========================================================================== */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FORM = "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FMG&QO_fu146_anzr=Nv4%20Pn44vr45";
const FIELDS = ["UNIQUE_CARRIER", "UNIQUE_CARRIER_NAME", "ORIGIN", "ORIGIN_CITY_NAME", "ORIGIN_COUNTRY", "DEST", "DEST_CITY_NAME", "DEST_COUNTRY", "DEPARTURES_PERFORMED", "SEATS", "PASSENGERS", "CLASS", "YEAR", "MONTH"];
const MIN_DEPARTURES = 12;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CACHE = resolve(ROOT, arg("--cache", ".cache/bts"));
mkdirSync(CACHE, { recursive: true });

const hidden = (html, name) => (html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) || html.match(new RegExp(`id="${name}"[^>]*value="([^"]*)"`)) || [])[1] || "";
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function getForm() {
  const res = await fetch(FORM);
  if (!res.ok) throw new Error(`BTS form: HTTP ${res.status}`);
  const html = await res.text();
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const latest = (html.match(/Latest Available Data:\s*([A-Za-z]+)\s+(\d{4})/) || []).slice(1);
  return { html, cookie, latest };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function download(form, year, month) {
  const file = resolve(CACHE, `t100_${year}_${String(month).padStart(2, "0")}.csv`);
  if (existsSync(file)) return file;
  const body = new URLSearchParams();
  for (const k of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) body.set(k, decode(hidden(form.html, k)));
  body.set("cboGeography", "All");
  body.set("cboYear", String(year));
  body.set("cboPeriod", String(month));
  body.set("btnDownload", "Download");
  for (const f of FIELDS) body.set(f, "on");
  const res = await fetch(FORM, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", cookie: form.cookie } });
  if (!res.ok) throw new Error(`BTS ${year}-${month}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = resolve(CACHE, `t100_${year}_${month}.zip`);
  if (buf.slice(0, 2).toString() === "PK") {
    writeFileSync(zip, buf);
    writeFileSync(file, execFileSync("unzip", ["-p", zip], { maxBuffer: 1 << 30 }));
  } else if (/UNIQUE_CARRIER/.test(buf.slice(0, 400).toString())) {
    writeFileSync(file, buf);
  } else {
    throw new Error(`BTS ${year}-${month}: not a data file (${buf.slice(0, 120).toString().replace(/\s+/g, " ")})`);
  }
  return file;
}

/* Minimal CSV line split (BTS quotes text fields; no embedded newlines). */
function splitCsv(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const form = await getForm();
  let [ly, lm] = arg("--latest", "").split("-").map(Number);
  if (!ly) { ly = Number(form.latest[1]); lm = MONTHS.indexOf(form.latest[0]) + 1; }
  if (!ly || !lm) throw new Error("Couldn't read 'Latest Available Data' from the BTS page; pass --latest YYYY-MM");
  const months = [];
  for (let k = 11; k >= 0; k--) { const d = new Date(Date.UTC(ly, lm - 1 - k, 1)); months.push([d.getUTCFullYear(), d.getUTCMonth() + 1]); }
  console.log(`T-100 Segment (All Carriers): ${months[0].join("-")} … ${months[11].join("-")}`);

  const dep = {};          // "O|D|C" → departures
  const carriers = {};
  const airports = {};
  for (const [y, m] of months) {
    const file = await download(form, y, m);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const head = splitCsv(lines[0]).map((h) => h.trim());
    const ix = Object.fromEntries(head.map((h, i) => [h, i]));
    let n = 0;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const r = splitCsv(lines[i]);
      if (r[ix.CLASS] !== "F") continue;                                 // scheduled passenger/cargo service
      if (!(Number(r[ix.SEATS]) > 0)) continue;                          // passenger aircraft only
      const o = r[ix.ORIGIN], dd = r[ix.DEST], c = r[ix.UNIQUE_CARRIER];
      if (r[ix.ORIGIN_COUNTRY] !== "US" && r[ix.DEST_COUNTRY] !== "US") continue;
      const k = `${o}|${dd}|${c}`;
      dep[k] = (dep[k] || 0) + (Number(r[ix.DEPARTURES_PERFORMED]) || 0);
      carriers[c] ||= r[ix.UNIQUE_CARRIER_NAME];
      airports[o] ||= { city: r[ix.ORIGIN_CITY_NAME], country: r[ix.ORIGIN_COUNTRY] };
      airports[dd] ||= { city: r[ix.DEST_CITY_NAME], country: r[ix.DEST_COUNTRY] };
      n++;
    }
    console.log(`  ${y}-${String(m).padStart(2, "0")}: ${n} segment rows`);
  }
  const routes = {};
  const used = new Set();
  for (const [k, v] of Object.entries(dep)) {
    if (v < MIN_DEPARTURES) continue;
    const [o, d, c] = k.split("|");
    ((routes[o] ||= {})[d] ||= {})[c] = Math.round(v);
    used.add(o); used.add(d); used.add(`c:${c}`);
  }
  const out = {
    source: "US DOT BTS, T-100 Segment (All Carriers), departures performed; transtats.bts.gov (table FMG)",
    table: "T_T100_SEGMENT_ALL_CARRIER",
    months: months.map(([y, m]) => `${y}-${String(m).padStart(2, "0")}`),
    generated: new Date().toISOString().slice(0, 10),
    filter: `CLASS F, seats > 0, touches a US airport, ≥ ${MIN_DEPARTURES} departures a year per carrier and segment`,
    carriers: Object.fromEntries(Object.entries(carriers).filter(([c]) => used.has(`c:${c}`)).sort()),
    airports: Object.fromEntries(Object.entries(airports).filter(([a]) => used.has(a)).sort()),
    routes,
  };
  const path = resolve(ROOT, "src/data/routes.generated.json");
  writeFileSync(path, JSON.stringify(out));
  console.log(`wrote ${path}: ${Object.keys(routes).length} origins, ${Object.values(routes).reduce((t, x) => t + Object.keys(x).length, 0)} airport pairs, ${Object.keys(out.carriers).length} carriers`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

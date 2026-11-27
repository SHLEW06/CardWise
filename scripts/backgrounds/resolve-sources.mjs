/* One-off: resolve Wikimedia Commons metadata for the chosen files and write
   sources.json. Generic client name, one request per 2 s, no personal data. */
import { writeFileSync } from "node:fs";
const UA = "cardwise-build/1.0 (static site backgrounds)";
const PICKS = {
  home: "Sunset at lake Constance.jpg",
  explore: "Lofoten, Norway (Unsplash).jpg",
  checkout: "Petit Champlain at night, Quebec city.jpg",
  offers: "Bokeh effect (Unsplash).jpg",
  lab: "Saint Peter's Basilica, Sant'Angelo bridge, by night, Rome, Italy.jpg",
  survey: "Lights (Unsplash).jpg",
  profile: "Clouds disappearing into a darkening blue sky over an airplane wing.jpg",
};
const strip = (s = "") => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
for (const [slot, title] of Object.entries(PICKS)) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", titles: "File:" + title, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1920", format: "json" }).forEach(([k, v]) => u.searchParams.set(k, v));
  let j;
  for (let t = 0; t < 4 && !j; t++) {
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    const txt = await r.text();
    try { j = JSON.parse(txt); } catch { console.error(r.status, txt.slice(0, 120)); await sleep(8000); }
  }
  const i = Object.values(j.query.pages)[0].imageinfo[0], m = i.extmetadata;
  out[slot] = {
    title: "File:" + title, photographer: strip(m.Artist?.value), license: strip(m.LicenseShortName?.value),
    licenseUrl: m.LicenseUrl?.value || "https://creativecommons.org/publicdomain/zero/1.0/",
    sourcePage: i.descriptionurl, originalUrl: i.url, downloadUrl: i.thumburl.replace(/\?.*$/, ""),
    upstream: strip(m.Credit?.value).slice(0, 160),
  };
  console.log(slot, out[slot].license, out[slot].photographer);
  await sleep(2500);
}
writeFileSync(new URL("./sources.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");

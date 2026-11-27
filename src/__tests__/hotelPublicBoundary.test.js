import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWED = ["id", "name", "city", "country", "region", "programs", "lat", "lng", "precision", "brand"];
const read = (p) => readFileSync(resolve(root, p), "utf8");

describe("public hotel directory data boundary", () => {
  const data = JSON.parse(read("src/data/hotels/programHotels.public.json"));
  it("has only facts: allowed keys on every hotel", () => {
    expect(data.hotels.length).toBeGreaterThan(0);
    for (const h of data.hotels) expect(Object.keys(h).filter((k) => !ALLOWED.includes(k))).toEqual([]);
  });
  it("carries no price, perk or link data anywhere in the file", () => {
    const text = JSON.stringify(data);
    for (const bad of ["averageNightly", "lowestSeen", "observations", "benefits", "americanexpress.com", "chase.com", "https://", "nightly"]) expect(text).not.toContain(bad);
  });
  it("only uses known programs and precisions", () => {
    for (const h of data.hotels) {
      expect(h.programs.length).toBeGreaterThan(0);
      for (const p of h.programs) expect(["edit", "fhr", "thc"]).toContain(p);
      expect([null, "property", "geocoded", "city"]).toContain(h.precision);
      if (h.precision) expect(Math.abs(h.lat) <= 90 && Math.abs(h.lng) <= 180 && !(h.lat === 0 && h.lng === 0)).toBe(true);
    }
    expect(data.metadata.attribution).toHaveLength(3);
  });
  it("the production hotel explorer never statically imports the workbook or the personal directory", () => {
    const seen = new Set();
    const walk = (rel) => {
      if (seen.has(rel)) return;
      seen.add(rel);
      const src = read(rel);
      // static imports only; `import("...")` dynamic calls are checked below
      for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)) {
        const spec = m[1] || m[2];
        if (!spec.startsWith(".")) continue;
        const target = resolve(dirname(resolve(root, rel)), spec).replace(root + "/", "");
        expect(target).not.toMatch(/workbook\.generated|properties\.local\.generated|HotelDiscovery/);
        if (/\.(jsx?|mjs)$/.test(target)) { try { walk(target); } catch (e) { if (e.code !== "ENOENT") throw e; } }
      }
    };
    walk("src/components/v7/HotelExplorer.jsx");
    expect(seen.size).toBeGreaterThan(3);
    const explorer = read("src/components/v7/HotelExplorer.jsx");
    expect(explorer).toMatch(/import\.meta\.env\.DEV \? lazy\(\(\) => import\("\.\/HotelDiscovery\.jsx"\)\)/);
    expect(explorer).toMatch(/import\("\.\.\/\.\.\/data\/hotels\/programHotels\.public\.json"\)/);
  });
});

describe("public hotel photo data boundary (Wikidata / Wikimedia Commons)", () => {
  const PHOTO_KEYS = ["src", "page", "author", "license", "licenseUrl", "match"];
  const photos = JSON.parse(read("src/data/hotels/programHotelPhotos.public.json"));
  const ids = new Set(JSON.parse(read("src/data/hotels/programHotels.public.json")).hotels.map((h) => h.id));
  const FREE = /^(CC0( 1\.0)?|Public domain|PD[ -].*|CC[ -]BY(-SA)?( \d(\.\d)?)?( [A-Za-z]+)?)$/i;
  it("has its own allowed keys and only known hotel ids", () => {
    expect(photos.metadata.source).toBe("Wikidata + Wikimedia Commons");
    for (const [id, p] of Object.entries(photos.photos)) {
      expect(ids.has(id)).toBe(true);
      expect(Object.keys(p).sort()).toEqual([...PHOTO_KEYS].sort());
      expect(["name", "coords"]).toContain(p.match);
      expect(p.src).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(p.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.author.length).toBeGreaterThan(0);
      expect(p.author).not.toMatch(/<[a-z/]/i);
    }
  });
  it("only keeps free licenses (CC0, public domain, CC BY, CC BY-SA)", () => {
    for (const p of Object.values(photos.photos)) {
      expect(p.license).toMatch(FREE);
      expect(p.license).not.toMatch(/\b(NC|ND)\b|GFDL|fair use|non-?free/i);
    }
  });
  it("the photo file stays out of the facts-only hotel file", () => {
    expect(read("src/data/hotels/programHotels.public.json")).not.toContain("wikimedia.org");
  });
});


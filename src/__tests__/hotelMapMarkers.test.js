import { describe, it, expect } from "vitest";
import { buildMarkers, validCoords, fitView, viewBox } from "../engine/v5/hotelWorld.js";
import { repairCoordinates } from "../../scripts/build-hotel-db.mjs";

const h = (id, city, lat, lng, country = "X") => ({ id, name: id, city, country, lat, lng });
describe("hotel map markers", () => {
  it("rejects missing, zero and out-of-range coordinates", () => {
    expect(validCoords(0, 0)).toBe(false);
    expect(validCoords(null, 5)).toBe(false);
    expect(validCoords(95, 5)).toBe(false);
    expect(validCoords(51.5, -0.1)).toBe(true);
  });
  it("groups by city+country at the mean, counts unlocated hotels in a located city, and splits same-name cities", () => {
    const { markers, unmapped } = buildMarkers([h("a", "London", 51.5, -0.1), h("b", "London", 51.6, -0.2), h("c", "London", null, null), h("d", "Nowhere", null, null), h("p1", "Portland", 43.6, -70.2), h("p2", "Portland", 45.5, -122.6)], (x) => [x.lat, x.lng]);
    const london = markers.find((m) => m.name === "London");
    expect(london.n).toBe(3);
    expect(london.lat).toBeCloseTo(51.55, 2);
    expect(markers.filter((m) => m.name === "Portland")).toHaveLength(2);
    expect(unmapped.map((x) => x.id)).toEqual(["d"]);
  });
  it("fits a view that contains the markers", () => {
    const v = fitView([{ lat: 22.3, lng: 114.2 }, { lat: 22.2, lng: 114.1 }], 0.42);
    const b = viewBox(v, 0.42);
    expect(114.2).toBeGreaterThan(b.x); expect(114.2).toBeLessThan(b.x + b.w);
    expect(-22.3).toBeGreaterThan(b.y); expect(-22.3).toBeLessThan(b.y + b.h);
  });
});
describe("coordinate repair (build script)", () => {
  it("fixes truncated exponents and flipped signs, leaves a real far hotel alone", () => {
    const base = [0.1, 0.12, 0.14].map((d, i) => ({ id: `l${i}`, city: "London", country: "UK", lat: 51.5, lng: -d }));
    const bad = { id: "x", city: "London", country: "UK", lat: 51.5, lng: -8.28 };
    const flip = { id: "y", city: "Palma", country: "ES", lat: 39.5, lng: -2.55 };
    const palma = [2.6, 2.7, 2.65].map((l, i) => ({ id: `p${i}`, city: "Palma", country: "ES", lat: 39.5, lng: l }));
    const far = { id: "z", city: "Portland", country: "US", lat: 45.5, lng: -122.6 };
    const portland = [-70.2, -70.3, -70.25].map((l, i) => ({ id: `q${i}`, city: "Portland", country: "US", lat: 43.6, lng: l }));
    const list = [...base, bad, flip, ...palma, far, ...portland];
    const r = repairCoordinates(list);
    expect(r.fixed.map((f) => f.id).sort()).toEqual(["x", "y"]);
    expect(bad.lng).toBeCloseTo(-0.0828, 3);
    expect(flip.lng).toBeCloseTo(2.55, 2);
    expect(far.lng).toBe(-122.6);
  });
});

import {it as vit,expect} from "vitest";
import { existsSync } from "node:fs";
/* The owner's workbook is local-only (git-ignored, docs/THIRD_PARTY.md): a
   fresh clone skips these dev-browser tests instead of failing. */
const HAS_WORKBOOK = existsSync(`${process.cwd()}/src/data/hotels/workbook.generated.json`);
const WORKBOOK = "../data/hotels/workbook.generated.json";
const catalog = HAS_WORKBOOK ? (await import(/* @vite-ignore */ WORKBOOK)).default : null;
const it = HAS_WORKBOOK ? vit : vit.skip;
import { filterStays, estimateStay, programAccess, creditHotel, discoveryMarksWith, discoveryMark } from "../engine/v5/hotelDiscovery.js";
import { normalizeProfile } from "../engine/profileDefaults.js";
it("imports every source row once, merging exact duplicate identities without making missing rates zero",()=>{
 expect(catalog.metadata.sourceRows).toBe(3750);
 expect(catalog.hotels).toHaveLength(3729);
 expect(new Set(catalog.hotels.map(h=>h.id)).size).toBe(3729);
 expect(catalog.metadata.under350SourceRows).toBe(999);
 expect(catalog.hotels.reduce((n,h)=>n+h.sourceRows.length,0)).toBe(3750);
 expect(catalog.hotels.some(h=>h.averageNightly===null)).toBe(true);
 expect(catalog.hotels.every(h=>h.averageNightly===null||h.averageNightly>0)).toBe(true);
});
it("combines program, country, price and saved filters, and keeps unpriced stays out of a price ceiling",()=>{
 const rows=filterStays(catalog.hotels,{query:"Singapore",programs:["fhr"],maxPrice:350});
 expect(rows.length).toBeGreaterThan(0);
 expect(rows.every(h=>h.programs.includes("fhr")&&h.averageNightly!=null&&h.averageNightly<350)).toBe(true);
 expect(filterStays(catalog.hotels,{savedOnly:true,marks:{}})).toEqual([]);
});
it("never grants a card credit based on a hotel program alone",()=>{
 const h=catalog.hotels.find(h=>h.programs.includes("fhr")&&h.averageNightly);
 const p=normalizeProfile({cardsHeld:[],travel:{hotelBudget:200}});
 expect(estimateStay(h,p,{nights:2,checkin:"2027-01-13"}).credit).toBe(0);
 expect(programAccess("fhr",p).held).toEqual([]);
});
it("uses dated minimum nights, estimates public-rate markup/tax, and refuses unknown budget or rate",()=>{
 const hotel={averageNightly:200,programs:["fhr"]};
 const p=normalizeProfile({cardsHeld:["amex-plat"],travel:{hotelBudget:200,hotelMarkup:.08,hotelTaxes:.15}});
 const one=estimateStay(hotel,p,{nights:1,checkin:"2027-01-13"});
 expect(one.credit).toBe(0);
 const two=estimateStay(hotel,p,{nights:2,checkin:"2027-01-13"});
 expect(two.programNightly).toBe(248);
 expect(two.credit).toBe(300);
 expect(two.savings).toBe(204);
 expect(estimateStay(hotel,normalizeProfile({cardsHeld:["amex-plat"]}),{nights:2}).savings).toBeNull();
 expect(estimateStay({...hotel,averageNightly:null},p,{nights:2}).programNightly).toBeNull();
});

it("shares hotel marks and saved portal prices with the annual credit database",()=>{
 const hotel={name:"Cordis Hong Kong",city:"Hong Kong",programs:["thc"],averageNightly:400};
 const canonical=creditHotel(hotel);
 expect(canonical).toBeTruthy();
 const p=normalizeProfile({cardsHeld:["amex-plat"],travel:{hotelBudget:200},hotelRates:[{hotelId:canonical.id,program:"thc",date:"2026-11-26",nightlyUsd:190}]});
 const marked={...p,hotelMarks:discoveryMarksWith(p,hotel,"stay")};
 expect(marked.hotelMarks[canonical.id]).toBe("stay");
 expect(discoveryMark(marked,hotel)).toBe("stay");
 const estimate=estimateStay(hotel,marked,{nights:2,checkin:"2026-12-08"});
 expect(estimate.programNightly).toBe(190);
 expect(estimate.savings).toBe(300);
 expect(estimate.priceLabel).toMatch(/saved/i);
 const excluded={...marked,hotelMarks:discoveryMarksWith(marked,hotel,"expensive")};
 expect(estimateStay(hotel,excluded,{nights:2}).savings).toBe(0);
});

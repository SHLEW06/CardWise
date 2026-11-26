// Discovery estimates stay separate from the recurring wallet ranking.
// A public, pre-tax workbook average is never saved as a portal quote.
import { BY_ID } from "../../data/cards/index.js";
import { PROGRAM_SEARCH, minimumNights, hotelCreditFormula } from "./hotelCredits.js";
import { HOTEL_PROPERTIES, hotelMarksWith, markOf, budgetFor, realisticRate, programPrice } from "./hotelDb.js";
const identity = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let indexSize = -1, index;
export function creditHotel(hotel) {
  if (indexSize !== HOTEL_PROPERTIES.length) {
    indexSize = HOTEL_PROPERTIES.length;
    index = new Map();
    for (const h of HOTEL_PROPERTIES) {
      const key = `${identity(h.name)}|${identity(h.city)}`;
      index.set(key, index.has(key) ? null : h); // Ambiguous names require review.
    }
  }
  return index.get(`${identity(hotel.name)}|${identity(hotel.city)}`) || null;
}
export const discoveryMark = (profile, hotel) => {
  const canonical = creditHotel(hotel);
  return canonical ? markOf(profile, canonical.id) : profile.hotelMarks?.[hotel.id];
};
export function discoveryMarksWith(profile, hotel, mark) {
  const canonical = creditHotel(hotel);
  return { ...(canonical ? hotelMarksWith(profile, canonical.id, mark) : profile.hotelMarks), [hotel.id]: mark };
}
export const PROGRAM_LABELS={edit:"The Edit",fhr:"Fine Hotels + Resorts",thc:"The Hotel Collection"};
export function programAccess(program,profile) {
  const held=profile.cardsHeld.filter(id=>BY_ID[id]?.credits.some(c=>c.hotelProgram?.programs?.includes(program)));
  return {held,bookingUrl:PROGRAM_SEARCH[program],label:held.length?"In your wallet":"Eligible card required"};
}
export function filterStays(hotels,{query="",programs=[],country="",maxPrice=Infinity,includeUnpriced=false,savedOnly=false,marks={},sort="price",heldOnly=false,profile}={}) {
  const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return hotels.filter(h=>(!query||norm(`${h.name} ${h.city} ${h.country} ${h.brand}`).includes(norm(query)))
    &&(!programs.length||h.programs.some(p=>programs.includes(p)))&&(!country||h.country===country)
    &&(h.averageNightly==null?includeUnpriced:h.averageNightly<maxPrice)
    &&(!savedOnly||marks[h.id]==="stay")&&(!heldOnly||profile&&h.programs.some(p=>programAccess(p,profile).held.length)))
    .sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="photos"?(Number(Boolean(b.photo))-Number(Boolean(a.photo))||(a.averageNightly??Infinity)-(b.averageNightly??Infinity)):(a.averageNightly??Infinity)-(b.averageNightly??Infinity)||a.name.localeCompare(b.name));
}
export function estimateStay(hotel,profile,{nights=2,checkin=new Date().toISOString().slice(0,10)}={}) {
 const canonical = creditHotel(hotel);
 let priceLabel = "Workbook public-rate estimate · collected Nov 24, 2026 · markup/taxes added";
 let programNightly=hotel.averageNightly==null?null:programPrice({rate:hotel.averageNightly,basis:"estimate"},profile.travel).rate;

 const credits=hotel.programs.flatMap(program=>profile.cardsHeld.flatMap(id=>(BY_ID[id]?.credits||[])
  .filter(c=>c.hotelProgram?.programs?.includes(program)&&!c.hotelProgram.onProperty&&!c.unverified&&(!c.endsAt||c.endsAt>=checkin)&&(!c.endsOn||c.endsOn>=checkin))
  .map(c=>({cardId:id,program,credit:c.hotelProgram.chunk,minNights:minimumNights(c.hotelProgram,program,new Date(checkin+"T12:00:00Z"))}))))
  .filter(c=>nights>=c.minNights).sort((a,b)=>b.credit-a.credit);
 const best=credits[0];
 if(canonical && best && canonical.programs.includes(best.program)) {
   const price = programPrice(realisticRate(canonical,best.program,profile),profile.travel);
   programNightly = price.rate;
   priceLabel = price.label;
 }
 const cost=programNightly==null?null:programNightly*nights;
 const credit=cost==null?0:Math.min(cost,best?.credit||0);
 const budget=profile.assumedFields?.includes("travel.hotelBudget")||!(profile.travel.hotelBudget>0)?null:canonical?budgetFor(canonical,profile.travel).value:profile.travel.hotelBudget;
 const isExcluded = ["expensive", "style"].includes(discoveryMark(profile,hotel));
 const savings=isExcluded?0:programNightly==null||budget==null?null:Math.round(hotelCreditFormula({C:credit,n:nights,P:programNightly,B:budget}));
 return {priceLabel,isExcluded,programNightly,cost,credit,cardId:best?.cardId||null,program:best?.program||null,budget,savings,after:cost==null?null:Math.max(0,cost-credit)};
}

/* ============================================================================
   routeProfiles.js — seed route profiles (demo data).
   ----------------------------------------------------------------------------
   A small, illustrative set of origin→destination profiles so routeFit.js has
   something to reason over. In production, replace/augment with BTS DB1B
   (carrier + fare share) and OAG/Cirium (schedules). OpenFlights can seed the
   nonstop-carrier graph but may be stale.

   Values are 0-1: how much an airline co-brand card, a transferable currency,
   or plain cash-back helps on this route.
   ========================================================================== */

const SD = "2026-06";

export const ROUTE_PROFILES = [
  {
    origin: "ATL", destination: "LHR", region: "europe",
    nonstopCarriers: ["Delta", "Virgin Atlantic", "British Airways"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam", "Oneworld"], airlineCardValue: 0.7, transferableCurrencyValue: 0.85, cashBackValue: 0.4,
    notes: "Delta + Virgin both fly it nonstop from ATL. Amex MR → Virgin can unlock business-class sweet spots; Delta miles work for simplicity.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "ATL", destination: "NRT", region: "asia",
    nonstopCarriers: ["Delta"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam", "Star Alliance (1-stop)"], airlineCardValue: 0.55, transferableCurrencyValue: 0.9, cashBackValue: 0.35,
    notes: "Delta flies ATL-Tokyo nonstop, but Amex MR → ANA (via partners) or Virgin opens far better premium value if you can find space.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "EWR", destination: "FRA", region: "europe",
    nonstopCarriers: ["United", "Lufthansa"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.75, transferableCurrencyValue: 0.85, cashBackValue: 0.4,
    notes: "Classic Star Alliance route. Chase UR → United or Aeroplan both work well; United co-brand helps with bags and boarding.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "SFO", destination: "SIN", region: "asia",
    nonstopCarriers: ["United", "Singapore Airlines"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.6, transferableCurrencyValue: 0.95, cashBackValue: 0.3,
    notes: "Singapore's own metal is bookable with Amex/Citi/Cap One → KrisFlyer; United works via Star Alliance. A transferable-points showcase.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "CLT", destination: "LHR", region: "europe",
    nonstopCarriers: ["American", "British Airways"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld"], airlineCardValue: 0.7, transferableCurrencyValue: 0.7, cashBackValue: 0.4,
    notes: "American flies CLT-London nonstop. AAdvantage is strong; watch BA's high surcharges if you go the Avios route.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "MIA", destination: "BOG", region: "latam",
    nonstopCarriers: ["American", "Avianca", "LATAM"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld", "Star Alliance"], airlineCardValue: 0.7, transferableCurrencyValue: 0.8, cashBackValue: 0.45,
    notes: "Latin America from Miami: AAdvantage or Avianca LifeMiles (via Cap One/Citi). LifeMiles often prices Latin America cheaply.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "LAX", destination: "SYD", region: "oceania",
    nonstopCarriers: ["Qantas", "United", "Delta", "American"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance", "Oneworld", "SkyTeam"], airlineCardValue: 0.5, transferableCurrencyValue: 0.9, cashBackValue: 0.3,
    notes: "Everyone flies LAX-Sydney. Transferable points win: Qantas (via Cap One/Citi) or United/Aeroplan for Star Alliance space.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "BDL", destination: "MCO", region: "domestic",
    nonstopCarriers: ["Southwest", "JetBlue", "Spirit", "Frontier"], likelyBestAirline: "southwest",
    allianceOptions: ["n/a"], airlineCardValue: 0.45, transferableCurrencyValue: 0.55, cashBackValue: 0.75,
    notes: "A leisure domestic hop with lots of low-cost competition. Cash back or a 2-3% card often beats fiddling with miles here.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "ORD", destination: "LHR", region: "europe",
    nonstopCarriers: ["United", "American", "British Airways"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance", "Oneworld"], airlineCardValue: 0.7, transferableCurrencyValue: 0.85, cashBackValue: 0.35,
    notes: "O'Hare is a Star Alliance fortress with United's main hub, but AA and BA also fly nonstop giving solid Oneworld coverage. Chase UR → United or Aeroplan for flat-rate business pricing; Avios can also work on BA metal if fuel surcharges are acceptable.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "ORD", destination: "NRT", region: "asia",
    nonstopCarriers: ["United", "ANA"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.6, transferableCurrencyValue: 0.9, cashBackValue: 0.3,
    notes: "Pure Star Alliance route from Chicago. Chase UR → United miles or Aeroplan are the go-to redemptions; transferable points also reach ANA directly via Virgin Atlantic miles (a hidden sweet spot for ANA business class).",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "DFW", destination: "CUN", region: "latam",
    nonstopCarriers: ["American", "Southwest"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld"], airlineCardValue: 0.65, transferableCurrencyValue: 0.6, cashBackValue: 0.6,
    notes: "Short leisure hop to Cancun from American's hub. Cash back and AAdvantage both compete here since fares are low; Southwest Rapid Rewards is viable if you have a Companion Pass. Transferable points add less incremental value at these price points.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "DFW", destination: "LHR", region: "europe",
    nonstopCarriers: ["American", "British Airways"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld"], airlineCardValue: 0.75, transferableCurrencyValue: 0.75, cashBackValue: 0.35,
    notes: "American's flagship transatlantic from its largest hub, operated jointly with BA. AAdvantage miles are ideal for off-peak business saver awards; Avios can work on AA metal avoiding BA's fuel surcharges. Strong case for an AA co-brand card here.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "SEA", destination: "ANC", region: "domestic",
    nonstopCarriers: ["Alaska"], likelyBestAirline: "alaska",
    allianceOptions: ["n/a"], airlineCardValue: 0.8, transferableCurrencyValue: 0.5, cashBackValue: 0.5,
    notes: "Alaska dominates the Pacific Northwest–Alaska corridor with near-monopoly nonstop service. The Alaska Airlines Visa co-brand is the clear winner: companion fare benefit and Mileage Plan miles that price this route affordably. Transferable currencies have few partner options here.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "SEA", destination: "NRT", region: "asia",
    nonstopCarriers: ["Delta", "ANA"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam", "Star Alliance"], airlineCardValue: 0.55, transferableCurrencyValue: 0.9, cashBackValue: 0.3,
    notes: "Delta and ANA both fly nonstop SEA-Tokyo, spanning two alliances. Transferable points shine: Amex MR → ANA via Virgin Atlantic miles often unlocks the best business-class rates; Delta SkyMiles are worth checking for flash sales. Avoid paying cash on long-haul transpacific.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "LAX", destination: "NRT", region: "asia",
    nonstopCarriers: ["United", "ANA", "JAL", "American", "Singapore Airlines"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance", "Oneworld"], airlineCardValue: 0.55, transferableCurrencyValue: 0.95, cashBackValue: 0.3,
    notes: "One of the most competitive transpacific routes with five carriers across two alliances. Transferable points are king: Amex MR → ANA (via Virgin miles) is a perennial sweet spot for business class; Chase UR → United or Aeroplan also open Star Alliance inventory. JAL via AA miles or Oneworld Avios rounds out the options.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "LAX", destination: "LHR", region: "europe",
    nonstopCarriers: ["American", "British Airways", "United", "Virgin Atlantic"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld", "Star Alliance"], airlineCardValue: 0.6, transferableCurrencyValue: 0.9, cashBackValue: 0.35,
    notes: "Heavy competition across Oneworld and Star Alliance. Amex MR → Virgin Atlantic offers outstanding value for Upper Class or partner award space; AAdvantage is strong on AA metal (no BA surcharges); Chase UR → United covers the Star Alliance angle. One of the best routes for premium-cabin award hunting.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "DEN", destination: "CUN", region: "latam",
    nonstopCarriers: ["United", "Southwest", "Frontier"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.5, transferableCurrencyValue: 0.6, cashBackValue: 0.6,
    notes: "Budget-carrier competition keeps fares low on this leisure route. United miles are the primary loyalty option; Southwest Rapid Rewards suits frequent travelers with the Companion Pass. Cash back is surprisingly competitive given how low cash fares run; transferable points rarely pencil out here.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "DEN", destination: "LAX", region: "domestic",
    nonstopCarriers: ["United", "Southwest", "Frontier"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance", "n/a"], airlineCardValue: 0.4, transferableCurrencyValue: 0.5, cashBackValue: 0.7,
    notes: "Short domestic hop with heavy low-cost carrier competition. Cash back is the pragmatic winner on this sub-$150 corridor; miles rarely offset the opportunity cost. United miles or Southwest Rapid Rewards are worth using if you already have a surplus, but don't optimize your card strategy around this route.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "IAH", destination: "GRU", region: "latam",
    nonstopCarriers: ["United"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.7, transferableCurrencyValue: 0.85, cashBackValue: 0.3,
    notes: "United is the sole nonstop operator on this key gateway to São Paulo, making Star Alliance loyalty the clear play. Chase UR → United or Aeroplan both price South America reasonably; transferable points via Avianca LifeMiles (Cap One/Citi) also reach this route at attractive rates.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "IAH", destination: "CUN", region: "latam",
    nonstopCarriers: ["United", "Southwest"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance"], airlineCardValue: 0.55, transferableCurrencyValue: 0.6, cashBackValue: 0.6,
    notes: "Leisure Mexico route from United's Houston hub. United miles are the natural fit but fares are competitive enough that cash back holds its own. Southwest is a solid option if you have Rapid Rewards points burning a hole in your account—no bag fees makes the total cost competitive.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "MIA", destination: "LHR", region: "europe",
    nonstopCarriers: ["American", "British Airways"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld"], airlineCardValue: 0.7, transferableCurrencyValue: 0.8, cashBackValue: 0.35,
    notes: "Strong Oneworld route co-operated by AA and BA. AAdvantage business saver awards are the top pick; book on AA metal to sidestep BA fuel surcharges. Amex MR or Chase UR can transfer to Avios as a backup but watch carrier-imposed fees carefully on this route.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "JFK", destination: "LHR", region: "europe",
    nonstopCarriers: ["American", "British Airways", "Delta", "Virgin Atlantic", "JetBlue", "United"], likelyBestAirline: "aa",
    allianceOptions: ["Star Alliance", "Oneworld", "SkyTeam"], airlineCardValue: 0.5, transferableCurrencyValue: 0.95, cashBackValue: 0.35,
    notes: "The world's busiest transatlantic route with all three alliances represented and JetBlue's Mint. Transferable points dominate: Amex MR → Virgin for Upper Class or Delta SkyMiles for flash sales; Chase UR → United for Star Alliance; AAdvantage or Avios for Oneworld. JetBlue TrueBlue points price Mint well if you value flat-bed at a lower points cost.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "JFK", destination: "CDG", region: "europe",
    nonstopCarriers: ["Delta", "Air France", "United"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam", "Star Alliance"], airlineCardValue: 0.55, transferableCurrencyValue: 0.9, cashBackValue: 0.35,
    notes: "Delta and Air France dominate JFK-Paris as joint venture partners. Amex MR → Air France/KLM Flying Blue often has monthly promo awards at steep discounts—one of the best transferable-points plays in the business. Delta SkyMiles work too but Flying Blue promos typically win on rates.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "JFK", destination: "NRT", region: "asia",
    nonstopCarriers: ["ANA", "JAL", "Delta", "United"], likelyBestAirline: "united",
    allianceOptions: ["Star Alliance", "SkyTeam", "Oneworld"], airlineCardValue: 0.5, transferableCurrencyValue: 0.95, cashBackValue: 0.3,
    notes: "All three alliances serve JFK-Tokyo nonstop, making this a transferable-points paradise. Virgin Atlantic miles for ANA business class remain a legendary sweet spot; JAL via AA miles is another classic; Chase UR → United or Aeroplan cover Star Alliance. The breadth of options means flexible currencies beat any single co-brand card.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "BOS", destination: "LHR", region: "europe",
    nonstopCarriers: ["Delta", "JetBlue", "British Airways", "American"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam", "Oneworld"], airlineCardValue: 0.55, transferableCurrencyValue: 0.85, cashBackValue: 0.4,
    notes: "BOS-London has four carriers across two alliances plus JetBlue Mint. Delta SkyMiles and Flying Blue (via Amex MR) are competitive; JetBlue TrueBlue prices Mint at reasonable rates for a premium flat-bed experience. AA/Avios round out Oneworld coverage. Slightly more cash-back friendly than typical transatlantic given LCC competition.",
    dataConfidence: "high", sourceDate: SD,
  },
  {
    origin: "MSP", destination: "CUN", region: "latam",
    nonstopCarriers: ["Delta", "Sun Country"], likelyBestAirline: "delta",
    allianceOptions: ["SkyTeam"], airlineCardValue: 0.6, transferableCurrencyValue: 0.55, cashBackValue: 0.6,
    notes: "Delta hub route to Cancun with Sun Country adding low-cost competition. Delta SkyMiles or a Delta co-brand card are the natural fits for frequent MSP flyers; Sun Country has no major transfer partners so cash back competes equally. Transferable points add less value given low cash fares on this leisure corridor.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "PHX", destination: "SJD", region: "latam",
    nonstopCarriers: ["American", "Southwest", "Alaska"], likelyBestAirline: "aa",
    allianceOptions: ["Oneworld"], airlineCardValue: 0.5, transferableCurrencyValue: 0.5, cashBackValue: 0.65,
    notes: "Short leisure hop to Los Cabos with strong low-cost competition keeping fares accessible. Cash back often wins here; AAdvantage is the loyalty default given American's PHX presence. Southwest Rapid Rewards and Alaska Mileage Plan are both viable if you already hold those currencies.",
    dataConfidence: "medium", sourceDate: SD,
  },
  {
    origin: "MCO", destination: "SJU", region: "domestic",
    nonstopCarriers: ["JetBlue", "Spirit", "Southwest"], likelyBestAirline: "jetblue",
    allianceOptions: ["n/a"], airlineCardValue: 0.4, transferableCurrencyValue: 0.45, cashBackValue: 0.7,
    notes: "Popular Florida–Puerto Rico route dominated by JetBlue and ultra-low-cost carriers. Fares are very competitive so cash back or a flat-rate rewards card wins most of the time. JetBlue TrueBlue is the only meaningful loyalty play; no alliance coverage means transferable points lose most of their leverage on this short Caribbean hop.",
    dataConfidence: "medium", sourceDate: SD,
  },
];

/* index by "ORIG-DEST" for quick lookup */
export const ROUTE_INDEX = Object.fromEntries(ROUTE_PROFILES.map((r) => [`${r.origin}-${r.destination}`, r]));
export default ROUTE_PROFILES;

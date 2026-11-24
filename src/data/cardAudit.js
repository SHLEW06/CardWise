/* ============================================================================
   cardAudit.js — v7c Part 6: the full card-data audit, card by card.
   ----------------------------------------------------------------------------
   Each audited card: the issuer page read (rendered in Chrome — Amex pages
   only show terms with JavaScript), the date, the audit group / batch, what
   changed (old → new), what the page doesn't confirm ("unverified", counted
   $0), and for EVERY credit on the card the issuer's own sentence (a test
   checks that each credit has one and that it states the credit's amount).
   `unverified` keys the engine reads: "tripProtection" · "rentalCar" ·
   "cellPhone" · "hotelStatus" · "airlineStatus" · "fx" (listed only — a fee,
   not a benefit) · "portal" (portal earn rates dropped).
   Groups (brief): 1 = the owner's cards; 2 = cards the optimizer recommends
   to the owner's profile; 3 = the 40 most popular; 4 = everything else.
   ========================================================================== */
const D = "2026-11-22";
const AMEX = "https://www.americanexpress.com/us/credit-cards/card/";

export const AUDIT = {
  /* ── Group 1 · the owner's cards ── */
  "amex-gold": {
    group: 1, batch: 1, checked: D, source: `${AMEX}gold-card/`,
    changed: [
      "Dining credit merchants: Grubhub, Five Guys, Cheesecake Factory… → Grubhub (incl. Seamless), Buffalo Wild Wings, Five Guys, The Cheesecake Factory, Wonder",
      "Portal earn: + 2x prepaid car rentals on AmexTravel.com",
      "Benefits: + Hertz Five Star status (enrollment)",
      "Credit classes: dining, Uber Cash, Resy, Dunkin' = easy",
    ],
    unverified: [{ key: "tripProtection", what: "Trip delay / baggage insurance (not on the product page)" }, { key: "fx", what: "No foreign transaction fee (not on the product page; in Rates and Fees)" }],
    quotes: {
      "$120 dining credit ($10 a month at Grubhub, Buffalo Wild Wings, Five Guys, The Cheesecake Factory, Wonder)": "Earn up to a total of $10 in statement credits monthly when you pay with the Gold Card at Grubhub (including Seamless), Buffalo Wild Wings, Five Guys, The Cheesecake Factory, and Wonder. This can be an annual savings of up to $120.",
      "$120 Uber Cash ($10 a month)": "$120 Uber Cash — Get $10 in Uber Cash each month when you add your Gold Card to your Uber account.",
      /* v7e Part 3 (read 2026-11-23) */
      "$100 Hotel Collection on-property credit (dining, spa; 2+ night bookings)": "Book two nights or more with The Hotel Collection through AmexTravel.com and receive a $100 credit",
      "$100 Resy credit ($50 per half-year)": "Get up to $100 in statement credits each calendar year at over 10,000 qualifying U.S. Resy restaurants … up to $50 in statement credits from January through June and up to $50 …",
      "$84 Dunkin' credit ($7 a month)": "Earn up to $7 in monthly statement credits after you pay with the American Express® Gold Card at U.S. Dunkin' locations. ($84 Dunkin' Credit)",
    },
  },
  "delta-gold": {
    group: 1, batch: 1, checked: D, source: `${AMEX}delta-skymiles-gold-american-express-card/`,
    changed: [
      "Resy credit ($100) → removed (the page lists Resy only on the Reserve, $240)",
      "$200 Delta flight credit → spend-gated: after $10,000 in a calendar year",
      "+ $120 rideshare credit ($10 a month after the first renewal, enrollment)",
      "+ $100 Delta Stays credit (portal-tied)",
      "Bags: first bag free → first bag free worldwide + second bag free on domestic Delta flights",
      "Benefits: 20% back on in-flight food and beverage, Zone 5 boarding, TakeOff 15",
      "Travel protections: none → baggage insurance, car rental loss and damage, purchase protection, extended warranty (All Benefits list; no trip delay or cancellation on this card)",
    ],
    unverified: [],
    quotes: {
      "$200 Delta flight credit after $10,000 a year on this card": "After you spend $10,000 in eligible purchases on your Card in a calendar year, you can receive a $200 Delta Flight Credit to use toward future travel.",
      "$120 rideshare credit ($10 a month, after your first renewal)": "After your first Card renewal, earn up to $10 in statement credits each month … on U.S. rideshare purchases with select providers. That’s up to $120 back each year. Enrollment required.",
      "$100 Delta Stays credit": "Get up to $100 back per year as a statement credit after using your Delta SkyMiles® Gold American Express Card to book prepaid hotels or vacation rentals through Delta Stays on delta.com.",
    },
  },
  "freedom-unlimited": {
    group: 1, batch: 1, checked: D, source: "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
    changed: [
      "Travel protections: \"Trip protections via portal bookings\" → trip cancellation / interruption ($1,500 per traveler), secondary rental car cover (U.S.), purchase protection (120 days, $500), extended warranty (+1 year)",
      "Benefits: + 2% total on Lyft through 09/30/2027",
    ],
    unverified: [{ key: "fx", what: "3% foreign transaction fee (not on the product page; in pricing & terms)" }],
    quotes: {},
  },
  "robinhood-gold": {
    group: 1, batch: 1, checked: D, source: "https://robinhood.com/creditcard/",
    changed: [
      "Portal earn: 5% on travel through Robinhood's portal → not on the page; dropped (unverified)",
      "Protections: none → trip interruption, purchase security, auto rental collision damage waiver, extended warranty, return protection",
    ],
    unverified: [{ key: "portal", what: "5% on travel booked through Robinhood (not on the card page)" }, { key: "fx", what: "No foreign transaction fee (not on the card page)" }],
    quotes: {},
  },

  /* ── Group 2 · recommended to the owner's profile (batch 1) ── */
  "amex-plat": {
    group: 2, batch: 1, checked: D, source: `${AMEX}platinum/`,
    creditSources: {
      "$600 Fine Hotels + Resorts / Hotel Collection credit ($300 per half-year)": { source: "https://www.americanexpress.com/en-us/travel/benefits/lodging-credit/", checked: "2026-11-24" },
    },
    changed: [
      "Earn cap: + 5x flights on up to $500,000 a year",
      "$600 hotel credit: The Hotel Collection needs 2+ nights; from Jan 1, 2027 Fine Hotels + Resorts too (noted)",
      "Credit classes: hotel credit = portal-tied (split, $0 unless planned around); Uber Cash, Uber One, airline fee, CLEAR+, Resy, digital entertainment, lululemon, Walmart+, Oura = easy",
      "+ Global Entry ($120 every 4 years) / TSA PreCheck (up to $85) fee credit — it was missing (All Benefits list, batch 2 re-read)",
      "Marriott Gold, Hilton Gold (enroll), trip delay, trip cancellation / interruption, car rental cover confirmed in the All Benefits list",
    ],
    unverified: [{ key: "fx", what: "No foreign transaction fee (not in the benefit list)" }],
    quotes: {
      "$600 Fine Hotels + Resorts / Hotel Collection credit ($300 per half-year)": "Get up to $300 in statement credits semi-annually on prepaid Fine Hotels + Resorts® program or The Hotel Collection bookings through American Express Travel using your Platinum Card®. ($600 Hotel Credit)",
      "$200 Uber Cash ($15 a month + $20 in December)": "Add your Platinum Card® to your Uber account to start receiving $15 in Uber Cash each month, plus a bonus $20 in December. ($200 Uber Cash)",
      "$120 Uber One membership credit": "You can get up to $120 in statement credits each calendar year after you purchase an auto-renewing Uber One membership with the Card.",
      "$200 airline fee credit (one airline you pick)": "Earn up to $200 per calendar year in statement credits after incidental fees, such as checked bags and in-flight refreshments, are charged by your one selected qualifying airline to your Card.",
      "$219 CLEAR+ credit": "You can receive up to $219 in statement credits per calendar year after you sign up and pay for a CLEAR+ Membership.",
      "$400 Resy credit ($100 a quarter)": "With the $400 Resy Credit, you can get up to $100 in statement credits each quarter …",
      "$300 digital entertainment credit ($25 a month)": "Get up to $25 in statement credits each month after you pay for eligible purchases with the Platinum Card® at participating partners. ($300 Digital Entertainment Credit)",
      "$300 lululemon credit ($75 a quarter)": "You can receive up to $75 in statement credits each quarter when you use the Card for eligible purchases at U.S. lululemon retail stores (excluding outlets) and lululemon.com. ($300 lululemon Credit)",
      "$155 Walmart+ membership credit": "Get up to a $12.95 statement credit back each month after you pay for a monthly Walmart+ membership. ($155 Walmart+ Credit)",
      "$200 Oura Ring credit (ouraring.com, once a year)": "You can receive up to $200 in statement credits when you use the Platinum Card® to purchase an Oura Ring at ouraring.com each calendar year.",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive either a statement credit every 4 years after you apply for Global Entry ($120) or a statement credit after you apply for a five-year membership for TSA PreCheck® (up to $85 …)",
    },
  },
  "boa-premium-elite": {
    group: 2, batch: 1, checked: D, source: "https://www.bankofamerica.com/credit-cards/products/premium-rewards-elite-credit-card/",
    changed: ["Benefits: + 20% off airfare paid with points; up to 4 Priority Pass Select memberships", "Credit classes: airline incidental, lifestyle, Global Entry / TSA = easy"],
    unverified: [{ key: "rentalCar", what: "Primary rental car cover (not on the product page)" }, { key: "tripProtection", what: "Trip delay / cancellation (not on the product page)" }],
    quotes: {
      "$300 airline incidental credit": "Receive up to $300 annually in Airline Incidental Statement Credits for qualifying purchases such as seat upgrades, baggage fees, airline lounge fees and in-flight services",
      "$150 lifestyle credit (streaming, food delivery, fitness, rideshare)": "Receive up to $150 annually for lifestyle conveniences including video streaming services, food delivery, fitness subscriptions and rideshare services",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive up to $120 in statement credits for Global Entry or TSA PreCheck® application fees, every four years",
    },
  },
  "citi-double-cash": {
    group: 2, batch: 1, checked: D, source: "https://www.citi.com/credit-cards/citi-double-cash-credit-card",
    changed: [],
    unverified: [{ key: "fx", what: "3% foreign transaction fee (not stated on the product page)" }],
    quotes: {},
  },
  "citi-strata": {
    group: 2, batch: 1, checked: D, source: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
    changed: [
      "Travel protections: trip delay, baggage → + trip cancellation / interruption, MasterRental car rental cover, extended warranty, purchase assurance",
      "$100 hotel benefit = portal-tied (taken off at booking on cititravel.com)",
    ],
    unverified: [],
    quotes: {
      "$100 hotel benefit ($500+ stay on Citi Travel)": "Once per calendar year, enjoy $100 off a single hotel stay of $500 or more (excluding taxes and fees) when booked through cititravel.com",
    },
  },
  "citi-strata-elite": {
    group: 2, batch: 1, checked: D, source: "https://www.citi.com/credit-cards/citi-strata-elite-credit-card",
    changed: [
      "Travel protections: none → trip delay, trip cancellation / interruption, lost or damaged luggage, MasterRental, extended warranty, purchase assurance",
      "Credit classes: hotel benefit = portal-tied; Blacklane = niche; Splurge, Global Entry / TSA = easy",
    ],
    unverified: [],
    quotes: {
      "$300 hotel benefit (2+ night stay on Citi Travel)": "Each calendar year, enjoy up to $300 off a hotel stay of 2 nights or more when booked through cititravel.com.",
      "$200 Splurge credit (pick 2: American Airlines, Best Buy, Live Nation, 1stDibs, Future)": "Every calendar year, earn up to $200 in statement credits on your choice of up to 2 of the following brands: 1stDibs, American Airlines (exclusions apply), Best Buy®, Future Personal Training, and Live Nation",
      "$200 Blacklane credit ($100 per half-year)": "Every calendar year, earn up to $200 in statement credits when you book with Blacklane … up to $100 on Blacklane purchases January through June and up to $100 July through December.",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive a statement credit, up to $120 every four years, as reimbursement for your application fee for Global Entry® or TSA PreCheck®.",
    },
  },
  "costco-citi": {
    group: 2, batch: 1, checked: D, source: "https://www.citi.com/credit-cards/citi-costco-anywhere-visa-credit-card",
    changed: ["Travel protections: \"Trip cancellation (limited)\" → not on the page, removed; + damage & theft purchase protection (120 days), worldwide car rental insurance"],
    unverified: [],
    quotes: {},
  },

  /* ── Group 2 · recommended to the owner's profile (batch 2) ── */
  "csr": {
    group: 2, batch: 2, checked: D, source: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
    creditSources: {
      "$500 The Edit hotel credit ($250 per prepaid 2+ night stay)": { source: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve", checked: "2026-11-24" },
      "$250 Select Hotels credit (2026 only; prepaid 2+ nights)": { source: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve", checked: "2026-11-24" },
    },
    changed: [
      "+ $120 DashPass membership (activate by 12/31/2029)",
      "DoorDash promos run through 12/31/2029 (was undated)",
      "Travel protections: + trip interruption, lost luggage; rental cover is primary up to $75,000",
      "Credit classes: travel credit = automatic; The Edit and StubHub = niche; dining, Lyft, Peloton, DoorDash, DashPass, Global Entry = easy",
    ],
    unverified: [],
    quotes: {
      "$300 travel credit": "up to $300 in statement credits for travel purchases each account anniversary year. ($300 annual travel credit)",
      "$500 The Edit hotel credit ($250 per prepaid 2+ night stay)": "Receive a statement credit of up to $250 for each prepaid booking with The Edit, up to $500 annually. Two-night minimum.",
      "$250 Select Hotels credit (2026 only; prepaid 2+ nights)": "Get up to $250 in statement credits through 12/31/26 on prepaid Chase Travel hotel bookings",
      "$300 dining credit at Sapphire Reserve Exclusive Tables ($150 per half-year)": "Get up to $150 in statement credits from January through June and again from July through December for a maximum of $300 annually when you dine at restaurants part of the Sapphire Reserve Exclusive Tables program on OpenTable.",
      "$300 StubHub / viagogo credit ($150 per half-year, through 2027)": "Get up to $150 in statement credits from January through June and again from July through December for a maximum of $300 annually for StubHub and viagogo purchases through 12/31/2027.",
      "Lyft credit ($10 a month, through Sep 2027)": "Get up to $10 in monthly in-app credits to use on rides through 9/30/2027. ($120 in Lyft ride credits)",
      "Peloton credit ($10 a month, through 2027)": "Get $10 in statement credits per month on eligible Peloton memberships through 12/31/2027, for a maximum of $120 annually.",
      /* v7e Part 5 (read 2026-11-23): split into the two promos the page lists */
      "$15 DoorDash promo a month (any order, through 2029)": "$15 monthly promo on any qualifying DoorDash order … Available through 12/31/29.",
      "Two $10 DoorDash promos a month (groceries, essentials, through 2029)": "two $10 promos each month to save on groceries, daily essentials … Available through 12/31/29.",
      "$120 DashPass membership (activate by 12/31/2029)": "Complimentary DashPass membership, a $120 value for 12 months. … Activate by 12/31/29.",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive one statement credit of up to $120 every four years as reimbursement for the application fee charged to your card. (Global Entry, TSA PreCheck®, or NEXUS fee credit)",
    },
  },
  "delta-reserve": {
    group: 2, batch: 2, checked: D, source: `${AMEX}delta-skymiles-reserve-american-express-card/`,
    changed: [
      "+ Global Entry ($120) / TSA PreCheck (up to $85) fee credit every 4 years",
      "Bags: first bag free → + second bag free on domestic Delta flights",
      "Travel protections: trip delay, baggage → + trip cancellation / interruption, car rental loss and damage, cell phone protection ($800)",
      "Benefits: Sky Club unlimited after $75k a year; MQD Headstart $2,500; TakeOff 15; 20% back in flight; Hertz President's Circle",
      "Credit classes: Resy, rideshare, Global Entry = easy; Delta Stays = portal-tied",
    ],
    unverified: [],
    quotes: {
      "$240 Resy credit ($20 a month)": "you can earn up to $20 per month in statement credits on eligible purchases at over 10,000 qualifying U.S. Resy restaurants. ($240 Resy Credit)",
      "$120 rideshare credit ($10 a month)": "Earn up to $10 in statement credits each month after using your Delta SkyMiles® Reserve American Express Card on U.S. rideshare purchases with select providers. That's up to $120 back each year.",
      "$200 Delta Stays credit": "an annual statement credit of up to $200 after using your Delta SkyMiles® Reserve American Express Card to book prepaid hotels or vacation rentals through Delta Stays on delta.com.",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive either a $120 statement credit for a Global Entry application fee or a statement credit up to $85 for a TSA PreCheck® … application fee every 4 years",
    },
  },
  "marriott-brilliant": {
    group: 2, batch: 2, checked: D, source: `${AMEX}marriott-bonvoy-brilliant/`,
    changed: [
      "+ $100 property credit at The Ritz-Carlton / St. Regis on 2+ night direct stays (niche)",
      "+ Global Entry ($120) / TSA PreCheck (up to $85) fee credit",
      "Dining credit class: automatic (any restaurant worldwide, $25 a month)",
      "Travel protections: + trip interruption, car rental loss and damage",
      "Benefits: Priority Pass with unlimited visits (enroll); Brilliant Earned Choice Award after $60k a year",
    ],
    unverified: [],
    quotes: {
      "$300 dining credit ($25/mo)": "Each calendar year, get up to $300 (up to $25 per month) in statement credits for eligible purchases made on the Marriott Bonvoy Brilliant® Card at restaurants worldwide.",
      "$100 property credit at Ritz-Carlton / St. Regis (2+ night direct stays)": "receive up to a $100 property credit for qualifying charges at The Ritz-Carlton® or St. Regis® when you book direct using a special rate for a 2 night minimum stay.",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive either a $120 statement credit for Global Entry or a statement credit for up to $85 for TSA PreCheck® … for a 5-year plan.",
    },
  },
  "discover-it": {
    group: 2, batch: 2, checked: D, source: "https://www.discover.com/credit-cards/cash-back/it-card.html",
    changed: ["Benefits: \"First-year cashback match\" → not on the page (the offer shown is a $200 bonus after $500); removed", "Rotating cap: \"$1,500 a quarter\" → \"up to the quarterly maximum\" (amount not stated; the model keeps $1,500)"],
    unverified: [{ key: "fx", what: "No foreign transaction fee (not on the product page)" }],
    quotes: {},
  },
  "freedom-flex": {
    group: 2, batch: 2, checked: D, source: "https://creditcards.chase.com/cash-back-credit-cards/freedom/flex",
    changed: [
      "Foreign transaction fee: 3% → none (\"No foreign transaction fees\")",
      "Travel protections: cell phone protection → not on the page, removed; + trip cancellation / interruption, secondary rental car cover, extended warranty",
      "Benefits: + 5% on Chase Travel",
    ],
    unverified: [{ key: "cellPhone", what: "Cell phone protection (not on the product page)" }],
    quotes: {},
  },
  "hyatt": {
    group: 2, batch: 2, checked: D, source: "https://creditcards.chase.com/travel-credit-cards/world-of-hyatt-credit-card",
    changed: ["Travel protections: trip delay, baggage → trip cancellation / interruption, lost luggage, baggage delay, secondary rental car cover (no trip delay on the page)"],
    unverified: [],
    quotes: {},
  },
  "ihg-premier": {
    group: 2, batch: 2, checked: D, source: "https://creditcards.chase.com/travel-credit-cards/ihg-rewards-club/premier",
    changed: [
      "Status: Platinum Elite → **Gold Elite** (Platinum only after $15,000 a year)",
      "+ $50 United TravelBank cash a year",
      "Benefits: 15 elite night credits a year; free night cap 50k (benefit text said 40k)",
      "Travel protections: trip delay, baggage → not on the page (unverified)",
    ],
    unverified: [{ key: "tripProtection", what: "Trip delay / baggage (not on the product page)" }],
    quotes: {
      "IHG food & beverage reward ($25 a quarter)": "Up to $100 in annual Food and Beverage Rewards at IHG Hotels — Enjoy a $25 Food and Beverage Reward voucher quarterly to redeem at IHG Hotels.",
      "$100 airline credit (after $250 airline spend)": "$100 Airline Statement Credit — When you spend at least $250 on flights purchased directly with the airline each calendar year through 12/31/27.",
      "$50 United TravelBank cash": "Up to $50 United® Airlines TravelBank Cash each year",
      "Global Entry / TSA PreCheck ($120 every 4 years)": "Receive a statement credit of up to $120 every four years for the application fee of Global Entry, TSA PreCheck® or NEXUS when charged to your card.",
    },
  },
  "marriott-boundless": {
    group: 2, batch: 2, checked: D, source: "https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/boundless",
    changed: [
      "Earn cap: 3x grocery, gas and dining only on the first $6,000 combined a year (then 2x)",
      "Travel protections: baggage delay, trip delay → not on the page, removed",
    ],
    unverified: [],
    quotes: {
      "Airline credit (2 × $50, through Jun 2027)": "Get up to $100 in statement credits after spending $500 on eligible airline purchases. That's $50 in statement credits semi-annually. (Special Offer through 6/30/2027)",
    },
  },
  "usb-altitude-connect": {
    group: 2, batch: 2, checked: D, source: "https://www.usbank.com/credit-cards/altitude-connect-visa-signature-credit-card.html",
    changed: ["Travel protections: trip cancellation, lost baggage → trip interruption / cancellation, trip delay reimbursement (SmartDelay); lost baggage not on the page"],
    unverified: [{ key: "amount", what: "Global Entry / TSA credit amount (the page doesn't state it; valued at $24 a year like the others)" }],
    quotes: {
      "Global Entry / TSA PreCheck application credit": "You must complete either the Global Entry® and/or TSA PreCheck® application(s) and pay the application fee(s) with your U.S. Bank Altitude Connect Visa Signature Card. You will receive a statement credit for your application fee within 1-2 billing cycles.",
    },
  },
  "venture-x": {
    group: 2, batch: 2, checked: D, source: "https://www.capitalone.com/credit-cards/venture-x/",
    changed: [
      "**$300 Capital One Travel credit → not on the product page: unverified, counted $0**",
      "**10,000 anniversary miles → not on the product page: unverified, counted $0**",
      "Lounges: Capital One Lounges + Priority Pass for the primary cardholder; authorized-user access not on the page (benefit text removed)",
      "Travel protections: primary rental cover, trip delay / cancellation → not on the page (unverified); + cell phone protection up to $800",
      "Benefits: + 5x Capital One Entertainment; Premier $100 / Lifestyle $50 experience credit per stay; Hertz Gold+ upgrade",
    ],
    unverified: [
      { key: "credit", what: "$300 Capital One Travel credit" },
      { key: "anniversary", what: "10,000 anniversary miles" },
      { key: "rentalCar", what: "Primary rental car cover" },
      { key: "tripProtection", what: "Trip delay / cancellation" },
    ],
    quotes: {},   // the $300 credit is not on the page: it's flagged `unverified` on the card and counted $0
  },
};

/** Unverified keys for a card ("tripProtection", "hotelStatus", …). */
export const unverifiedKeys = (id) => new Set((AUDIT[id]?.unverified || []).map((u) => u.key));

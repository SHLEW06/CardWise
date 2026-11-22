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
    changed: [
      "Earn cap: + 5x flights on up to $500,000 a year",
      "$600 hotel credit: The Hotel Collection needs 2+ nights; from Jan 1, 2027 Fine Hotels + Resorts too (noted)",
      "Credit classes: hotel credit = portal-tied (split, $0 unless planned around); Uber Cash, Uber One, airline fee, CLEAR+, Resy, digital entertainment, lululemon, Walmart+, Oura = easy",
    ],
    unverified: [
      { key: "hotelStatus", what: "Marriott Gold and Hilton Gold status (not on the product page)" },
      { key: "tripProtection", what: "Trip cancellation / delay, baggage (not on the product page)" },
      { key: "fx", what: "No foreign transaction fee (not on the product page)" },
    ],
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
};

/** Unverified keys for a card ("tripProtection", "hotelStatus", …). */
export const unverifiedKeys = (id) => new Set((AUDIT[id]?.unverified || []).map((u) => u.key));

# Card data verification log — November 2026

Source of truth for `verifiedAt` / `verifiedSource` in `src/data/cards/*`.
Each line records what an issuer's own page stated on the date read. A card
gets `verifiedAt` only when its fee AND credits were read on an issuer page;
anything read from a secondary source or a page that rendered blank keeps
`needsVerification: true`.

Method: pages fetched as text (no JavaScript). Long pages were truncated; facts
taken only from the verbatim portion unless marked [S] (model summary of the
unread tail — treated as unverified).

## 2026-11-18 — issuer listing pages

### Chase — creditcards.chase.com/all-credit-cards, /business-credit-cards
Verbatim: Sapphire Preferred $95 (5x Chase Travel, 2x other travel) · Sapphire
Reserve $795, AU $195 (8x Chase Travel, 4x flights/hotels direct) · Freedom
Unlimited $0 (5% Chase Travel, 3% dining & drugstores, 1.5% other) · Freedom
Flex $0 (5% rotating ≤$1,500/qtr, 5% Chase Travel, 3% dining & drugstores, 1%)
· Freedom Rise $0 (1.5%) · Slate $0 · United Explorer $0 first year then $150
(2 United Club passes/yr, free first bag) · United Quest $350 ($200 United
travel credit, 10k-mile award discount, 2 bags) · United Gateway $0 · United
Club $695 · Southwest Plus $99 (3,000 anniversary pts, first bag) · all
business cards: Ink Unlimited $0 (1.5%) · Ink Cash $0 (5% ≤$25k) · Ink Preferred
$95 (3x ≤$150k) · Ink Premier $195 (2.5% large purchases) · Sapphire Reserve for
Business $795 · United Business $150 · United Club Business $695 · Southwest
Performance Business $299 · Southwest Premier Business $149 · IHG Business $200
· Hyatt Business $199.
[S]: Southwest Priority $229 (7,500 anniv pts) · Southwest Premier $149 (6,000
anniv pts) · Bonvoy Boundless $95 · Bonvoy Bountiful $250 · Bonvoy Bold $0 · IHG
Premier Select $350 · IHG Premier $150 · IHG One Rewards $0 · World of Hyatt $95
· Disney Inspire $149 / Premier $49 / Visa $0 · Prime Visa $0 · Amazon Visa $0 ·
Aeroplan $195 · British Airways / Aer Lingus / Iberia $95 · DoorDash $0 ·
Instacart $0.
Not listed: Freedom Student, Ritz-Carlton (product change only), Slate Edge
(page shows "Slate").

### Chase Sapphire Reserve — creditcards.chase.com/rewards-credit-cards/sapphire/reserve
Verbatim: $795, AU $195. 8x Chase Travel; 4x flights & hotels direct; 3x dining;
1x other. $300 travel credit (anniversary year, automatic). $500 The Edit
credit ($250 per prepaid 2+ night stay, calendar year). $300 dining credit
($150 Jan–Jun + $150 Jul–Dec, select restaurants). $300 StubHub ($150/half,
activation, through 2027). Apple TV+ / Music (activate by 6/22/2027). Lyft
$10/mo through 9/30/2027. DashPass + DoorDash $35/mo promos through 2029.
Peloton $10/mo through 2027. Global Entry/TSA $120 every 4 yrs. IHG Platinum
Elite through 12/31/27. Lounges: Chase Sapphire Lounges + Priority Pass Select,
two guests free, extra guests $27.

### Amex — americanexpress.com/us/credit-cards/ (+ business)
Listing pages rendered no text (JavaScript). Platinum product page, verbatim
portion: 5x flights (≤$500k/yr) and prepaid Amex Travel hotels. Credits: $600
FHR/THC hotel ($300 per half), $200 Uber Cash ($15/mo + $20 Dec), $120 Uber One,
$200 airline fee, $219 CLEAR+, $400 Resy ($100/qtr, enroll), $300 digital
entertainment ($25/mo, enroll), $300 lululemon ($75/qtr, enroll), $155 Walmart+.
Lounges: Centurion, 10 Delta Sky Club visits, Priority Pass (enroll). Annual fee
NOT in text read.

### Capital One — capitalone.com/credit-cards/compare/, /small-business/credit-cards/
Verbatim, full list: Platinum $0 · Venture X $395 (2x; 10k anniversary miles;
$300 Capital One Travel credit; 1,300+ lounges) · Venture $95 (2x) · VentureOne
$0 (1.25x) · Quicksilver $0 (1.5%) · Savor $0 (3% grocery excl. superstores,
dining, entertainment; 1%) · SavorOne $39 (fair credit; same earn) ·
QuicksilverOne $39 (1.5%) · Savor/Quicksilver Students $0 · Quicksilver Secured
$0 · Platinum Secured $0 · Discover it Cash Back $0 (5% rotating; now listed on
Capital One) · Spark 2% Cash Plus $150 · Spark 2% Cash $95 ($0 first year) ·
Spark 1.5% Cash Select $0 · Venture X Business $395 ($300 Business Travel
credit) · Venture Business $95 · VentureOne Business $0 · T-Mobile, Kohl's, REI,
BJ's, Bass Pro and Key Rewards store cards.

### Citi — citi.com/credit-cards/compare/view-all-credit-cards, Strata Elite page
Verbatim: AAdvantage Platinum Select $99 ($0 first year; 2x restaurants & gas) ·
AAdvantage Business $99 · AAdvantage Globe (fee blank; 4 Admirals Club Globe
passes) · AAdvantage Executive (fee blank; Admirals Club) · Strata $0 · Strata
Premier (fee blank) · Strata Elite (fee blank) · Diamond Preferred $0 ·
Simplicity $0 · MileUp $0 (2x grocery) · Costco Anywhere $0 w/ membership ·
Costco Business $0 w/ membership · Secured $0.
Strata Elite earn: 12x hotels/cars/attractions on Citi Travel, 6x air on Citi
Travel, 6x restaurants Fri–Sat 6pm–6am ET (Citi Nights), 3x restaurants other
times, 1.5x other. Credits: $300 hotel (2+ nights, Citi Travel, calendar year),
$200 Splurge (up to 2 of 1stDibs / American Airlines / Best Buy / Future / Live
Nation), $200 Blacklane ($100 per half), $120 Global Entry/TSA every 4 yrs.
Lounges: Priority Pass Select + 4 Admirals Club passes / calendar year.
Not listed: Rewards+, Double Cash, Custom Cash (page said "25 cards", showed 24;
re-check individually before marking closed).

### Bank of America — bankofamerica.com/credit-cards/
Verbatim: Customized Cash $0 (3% choice, 2% grocery/wholesale, 1%) · Unlimited
Cash $0 (1.5%) · BankAmericard $0 · Travel Rewards $0 (1.5x; 3x BofA Travel) ·
Premium Rewards $95 (2x travel & dining, 1.5x; up to $200 airline incidental +
TSA/GE credits).
[S]: Premium Rewards Elite $550 (2x travel & dining, 1.5x; $570 combined
credits) · Atmos Rewards Ascent $95 (3x Alaska/Hawaiian; 2x gas, EV, cable,
streaming, transit; $99 Companion Fare) · Atmos Rewards Summit $395 (3x dining,
foreign, Alaska/Hawaiian; 25k Global Companion Award yearly; 8 Alaska Lounge
passes) · Air France KLM $89 · Royal ONE $0 / Plus $99 · Allways $59 · NCL $0.

### Wells Fargo — creditcards.wellsfargo.com
Verbatim: Active Cash $0 (2%) · Autograph $0 (3x restaurants, travel, gas,
transit, streaming, phone plans; 1x) · Autograph Journey $95 (5x hotels, 4x
airlines, 3x other travel & restaurants, 1x; $50 airline credit) · Reflect $0 ·
One Key $0 (3% Expedia/Hotels.com/Vrbo, 3% gas/grocery/dining, 1.5%) · Choice
Privileges $0 (5x Choice, 3x gas/grocery/home improvement/phone, 1x) · Choice
Privileges Select $95 (10x / 5x / 1x) · Signify Business Cash $0 (2%).
Not listed: Attune, Bilt.

### Bilt — bilt.com/card
Verbatim: issued by Column N.A.; Wells Fargo not mentioned. Blue $0 (≤4x Bilt
dining partners, 3x hotels & Lyft, 2x flights on Bilt Travel, 1x, ≤1.25x
rent/mortgage) · Obsidian $95 (≤6x partner dining, 3x other dining or grocery
≤$25k, 4x hotels, 3x flights/Lyft, 2x other travel, 1x; $100 hotel credit as
2×$50) · Palladium $495 (≤5x partner dining, 4x hotels/Lyft, 3x flights, 2x
other travel, 2x everyday; $400 hotel credit as 2×$200; $200 Bilt Cash yearly;
Priority Pass).

### Discover (now on Capital One) — discover.com/credit-cards/
Verbatim: it Cash Back $0 (5% rotating, 1%) · it Student Cash Back $0 · it
Secured $0 · it Balance Transfer $0 · it Chrome $0 (2% gas & restaurants
≤$1,000/qtr) · Student Chrome $0 · it Miles $0 (1.5x).

### U.S. Bank — usbank.com/credit-cards.html
Verbatim: Smartly $0 (2x, up to 4% with Smartly savings) · Shield · Cash+ (5%/5%/2%
choice) · Altitude Connect (5x prepaid hotels/cars on Travel Center, 4x travel,
4x gas/EV ≤$1,000/qtr, 2x dining/streaming/grocery) · Altitude Go (4x dining
≤$2,000/qtr, 2x grocery/gas/EV/streaming; $15 streaming credit). Fees rendered
blank except Smartly / Secured ($0). Altitude Reserve: not listed.

### Barclays — cards.barclaycardus.com
Partial render (2 cards): Emirates Skywards Premium, Wyndham Earner Plus. No
JetBlue / Aviator / Hawaiian on the rendered portion — inconclusive.

### Others
Robinhood Gold Card — robinhood.com/creditcard: $0, needs Robinhood Gold, 3%
everything, issued by Coastal Community Bank.
Apple Card — apple.com/apple-card: $0, issued by Goldman Sachs Bank USA; 3% Apple
& select merchants with Apple Pay, 2% Apple Pay, 1% card.
Target Circle Card — target.com/circlecard: $0, TD Bank; 5% off at Target; Target
Mastercard adds 2% dining & gas, 1% other.
Venmo — venmo.com/about/creditcard: $0, Synchrony; 3% dining & entertainment,
3% paying with Venmo, 1% other.
amazon.com/credit-cards: HTTP 503. PayPal Cashback Mastercard page: HTTP 403.

## 2026-11-18 — product pages and issuer-domain search

Product pages fetched as text, or `site:` searches limited to the issuer's own
domain (americanexpress.com, citi.com, bankofamerica.com, …). Search results
were used only where the snippet came from the issuer's domain.

### Chase product pages (verbatim)
Sapphire Preferred $95: 5x Chase Travel; 3x dining; 3x gas & EV, top streaming,
online grocery; 2x other travel; 1x. Credits: $100 Chase Travel hotel
(anniversary), Global Entry/TSA $120 / 4 yrs, DashPass + $10/mo DoorDash promo.
No lounges.
United Explorer $150 ($0 yr 1): 6x+3x United, 2x direct hotels, 2x dining, 1x.
$100 United travel credit (spend-gated), $100 United Hotels (2×$50), $60
rideshare ($5/mo, enroll), $50 Avis/Budget, $100 JSX; 2 United Club passes;
first bag free for 2.
United Quest $350: $200 United travel credit (automatic), $150 Renowned Hotels,
$100 rideshare, $80 Avis/Budget, $150 JSX; 2 bags free; 10k-mile award discount.
United Club $695: United Club membership (+1 guest); $200 Renowned Hotels,
$150 rideshare, $100 Avis/Budget, $200 JSX; 2 bags free.
Bonvoy Boundless $95: 6x Marriott, 3x grocery/gas/dining ≤$6k then 2x, 2x.
Anniversary free night ≤35k; $100 airline credit (2×$50, through 6/30/2027);
Silver Elite, 15 ENC.
Bonvoy Bountiful $250: 6x Marriott, 4x grocery & dining ≤$15k, 2x. Free night
≤50k after $15k calendar spend; Gold Elite.
World of Hyatt $95: 4x Hyatt, 2x restaurants / direct airline / transit / gyms,
1x. Anniversary free night Cat 1–4; extra Cat 1–4 night after $15k.
IHG Premier $150: 10x IHG, 5x direct airline / car rental / dining / grocery /
gas, 3x. Anniversary free night ≤50k; $100 F&B ($25/qtr); $100 airline credit
(after $250 airline spend); Global Entry $120 / 4 yrs.
IHG Premier Select $350: 12x IHG, 6x dining & other travel, 3x. Anniversary
free night ≤60k (+1 after $40k); $200 airline credit; $300 F&B ($75/qtr).
Southwest Plus $99 (3,000 anniv), Premier $149 (6,000 anniv), Priority $229
(7,500 anniv); first bag free on all three.
Aeroplan $195: 3x Air Canada, travel, grocery & dining (dining/grocery 2x from
2027), 2x gas, 1x; $100 Air Canada credit (2×$50); first bag free.

### Ritz-Carlton — marriott.chase.com/ritz-carlton (+ /benefits)
6x Marriott, 3x dining / car rental / airline, 2x other. $300 calendar-year
airline-incidental travel credit. $100 hotel credit (2-night stays). Free night
≤85k (+25k top-up). Priority Pass Select + Chase Sapphire Lounges, primary and
AUs, 2 guests free, $27 per extra guest; Priority Pass wording covers lounges
and "select airport experiences" — restaurants not mentioned. Fee not printed
on either page (keep $450, needsVerification). Product change only.

### Citi product pages (verbatim)
Strata Premier $95: 10x Citi Travel hotels/cars/attractions; 3x air & other
hotels, restaurants, supermarkets, gas & EV; 1x. $100 hotel benefit ($500+
stay on Citi Travel).
Strata $0: 5x Citi Travel; 3x supermarkets, gas/EV/transit, one self-select
category; 2x restaurants; 1x.
Double Cash $0: 2% (1% + 1%); 5% Citi Travel hotels/cars/attractions.
Custom Cash: "no longer accepting applications as of May 28, 2026".
Rewards+: URL now serves the Strata page → closed.
AAdvantage Executive (World Legend): fee $695 from 8/23/2026 (aa.com newsroom;
was $595). 4x AA, 12x AAdvantage Hotels/Cars, 1x. Admirals Club membership
(+2 guests). $500 AA Vacations, $200 inKind dining, $180 Lyft, $120 Avis/Budget,
$100 inflight/Admirals Club purchases, Global Entry $120 / 4 yrs.
AAdvantage Globe $350 (citi.com / aa.com search): 3x AA, 6x AAdvantage Hotels,
2x restaurants & transit, 1x. 4 Admirals Club Globe passes; $240 Turo, $100
Splurge, $100 inflight; companion certificate from year 2 ($99 + taxes).
Strata Elite $595, AU $75 (citi.com search).

### Capital One — venture-x page (verbatim)
$395. 10x hotels & rental cars / 5x flights & vacation rentals on Capital One
Travel; 2x. Capital One Lounges + Priority Pass (primary cardholder; guest
policy not stated). $300 travel credit + 10k anniversary miles from listing.

### Bank of America (verbatim)
Premium Rewards $95: 2x travel & dining, 1.5x; $100 airline incidental, $100
Global Entry/TSA / 4 yrs. (Listing said "up to $200" — product page wins.)
Premium Rewards Elite $550: 2x travel & dining, 1.5x; $300 airline incidental,
$150 lifestyle, $120 Global Entry / 4 yrs; Priority Pass Select (up to 4
memberships).
Atmos Rewards Summit $395: 3x dining, foreign transactions, Alaska/Hawaiian;
1x. 25k Global Companion Award each anniversary (+100k after $60k spend);
8 Alaska Lounge passes / calendar year; first bag free for up to 7.
Atmos Rewards Ascent $95: 3x Alaska/Hawaiian; 2x gas, EV, cable, streaming,
transit; 1x. $99 Companion Fare after $6k spend in the prior year.

### U.S. Bank (verbatim)
Altitude Connect: no annual fee; 5x/4x/4x (gas & EV ≤$1,000/qtr)/2x/1x;
12-month Priority Pass membership. Altitude Go: no annual fee; 4x dining
≤$2,000/qtr, 2x grocery/gas/EV/streaming, 1x; $15 streaming credit.
Altitude Reserve: listed under "no longer accepting new applications" on
usbank.com/credit-cards/benefits.html → closed.

### Amex (americanexpress.com via search; product pages render client-side)
Platinum $895 (credit-intel fee article; $695 → $895 at renewals from 1/2/2026);
Gold $325; Green $150 (corporate PDF only — needsVerification); Blue Cash
Preferred $95 ($0 yr 1); Blue Cash Everyday $0; Delta Blue $0, Gold $150 ($0 yr
1), Platinum $350, Reserve $650; Hilton Surpass $150 (free night after $15k),
Aspire $550 (annual free night; $400 resort, $200 flight ($50/qtr), $219 CLEAR);
Bevy $250 (≤50k night after $15k); Brilliant $650 (≤85k night yearly); Business
Platinum $895; Business Gold $375; Blue Business Plus $0 (2x ≤$50k).
Delta Reserve: 15 Sky Club visits / Medallion Year; annual companion
certificate (First / Comfort / Main); $240 Resy ($20/mo), $120 rideshare,
$200 Delta Stays.
Gold earn (product page verbatim): 4x restaurants ≤$50k, 4x U.S. supermarkets
≤$25k, 3x flights, 1x; $120 dining ($10/mo), $120 Uber Cash, $100 Resy
(2×$50), $84 Dunkin' ($7/mo).
EveryDay / EveryDay Preferred: not confirmed either way on amex.com — marked
closed per the redesign spec's legacy list.

### Others
JetBlue (Barclays): JetBlue $0, Plus $99, Premier $499 (barclaycardus.com).
PayPal Cashback Mastercard (paypal.com): $0, 3% via PayPal, 1.5% elsewhere,
Synchrony.
Amazon Store Card (amazon.com): $0, Synchrony, 5% at Amazon & Whole Foods with
Prime; no rewards without Prime.
Discover it Miles (discover.com, now Capital One): $0, 1.5x, first-year match.

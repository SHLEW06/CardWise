/* ============================================================================
   data/cards/index.js — canonical card catalog assembly.
   ----------------------------------------------------------------------------
   Per-issuer shards each export raw `ART` (id→art) and `CARDS` (raw card
   objects, pre-enrichment). This module merges them, runs every card through
   `enrichCard()` so all v3.1 schema fields are populated, and exports the
   unified `CARDS`, `BY_ID`, and `ART` that the rest of the app reads.

   Adding a new card = drop it into the matching shard. The shard's art belongs
   in that shard's local `ART` map. Business cards live in their issuer shards
   but the engines filter them from consumer recommendations via cardType.
   ========================================================================== */

import { enrichCard } from "../cardSchema.js";
import { ART as chase_ART, CARDS as chase_CARDS } from "./chase.js";
import { ART as amex_ART, CARDS as amex_CARDS } from "./amex.js";
import { ART as capitalOne_ART, CARDS as capitalOne_CARDS } from "./capitalOne.js";
import { ART as citi_ART, CARDS as citi_CARDS } from "./citi.js";
import { ART as wellsFargo_ART, CARDS as wellsFargo_CARDS } from "./wellsFargo.js";
import { ART as bankOfAmerica_ART, CARDS as bankOfAmerica_CARDS } from "./bankOfAmerica.js";
import { ART as discover_ART, CARDS as discover_CARDS } from "./discover.js";
import { ART as usBank_ART, CARDS as usBank_CARDS } from "./usBank.js";
import { ART as barclays_ART, CARDS as barclays_CARDS } from "./barclays.js";
import { ART as storeCards_ART, CARDS as storeCards_CARDS } from "./storeCards.js";
import { ART as niche_ART, CARDS as niche_CARDS } from "./niche.js";

export const ART = Object.assign({},
  chase_ART,
  amex_ART,
  capitalOne_ART,
  citi_ART,
  wellsFargo_ART,
  bankOfAmerica_ART,
  discover_ART,
  usBank_ART,
  barclays_ART,
  storeCards_ART,
  niche_ART,
);

const RAW_CARDS = [
  ...chase_CARDS,
  ...amex_CARDS,
  ...capitalOne_CARDS,
  ...citi_CARDS,
  ...wellsFargo_CARDS,
  ...bankOfAmerica_CARDS,
  ...discover_CARDS,
  ...usBank_CARDS,
  ...barclays_CARDS,
  ...storeCards_CARDS,
  ...niche_CARDS,
];

export const CARDS = RAW_CARDS.map((c) => enrichCard(c, ART));
export const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/* Active consumer catalog: everything the lineup / explorer should consider by
   default. Business cards stay in CARDS for historical compatibility and for
   wallet imports, but they are excluded here. */
export const CONSUMER_CARDS = CARDS.filter((c) => c.cardType !== "business");
export const BUSINESS_CARDS = CARDS.filter((c) => c.cardType === "business");

export default CARDS;

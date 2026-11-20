/* ============================================================================
   programBaseEarn.js — v7 Part B4: what a loyalty member earns from the
   program itself when booking DIRECT, on top of any card (points per $ of
   eligible spend, before elite bonuses). These come with every card, so
   they don't change which card wins a direct booking — they matter against
   travel portals, where the stay or ticket usually earns no program points,
   and they belong in the "% back" a person sees for that program.
   Modeling defaults from the programs' published member earning; NOT
   re-verified this session (listed in PROGRESS → Unverified).
   ========================================================================== */
export const PROGRAM_BASE_EARN = {
  hyatt: { perDollar: 5, what: "base points per $ at Hyatt hotels" },
  marriott: { perDollar: 10, what: "base points per $ at most Marriott hotels" },
  hilton: { perDollar: 10, what: "base points per $ at Hilton hotels" },
  ihg: { perDollar: 10, what: "base points per $ at IHG hotels" },
  delta: { perDollar: 5, what: "miles per $ on Delta tickets (General Member)" },
  united: { perDollar: 5, what: "miles per $ on United tickets (general member)" },
  aa: { perDollar: 5, what: "miles per $ on American tickets (base member)" },
};
export const BASE_EARN_VERIFIED = false;

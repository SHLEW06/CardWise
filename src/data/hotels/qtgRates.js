// Authorized QTG typical-rate observations belong here. No API key or export
// was supplied. An empty source deliberately falls through to Nextcard.
// Schema: { hotelId, program: "edit", date, nightlyUsd, nights: 2,
//           feesIncluded: true, source: "https://quicktravelguides.com/..." }
// Observations must describe the median nightly rate of a two-night stay,
// including fees. Never label a lowest rate or an estimate as QTG typical.
export const QTG_RATES = [];

/* One display name per card (v6 §16.5c). Card names sometimes already start
   with the issuer ("Robinhood Gold Card", "Capital One Venture X", "Amex
   Gold"), so "<issuer> <name>" doubled it ("Robinhood Robinhood Gold Card").
   The issuer is prefixed only when the name doesn't already say it. */
const ISSUER_WORDS = {
  "American Express": ["american express", "amex"],
  "Capital One": ["capital one"],
  "Bank of America": ["bank of america", "bankamericard"],
  "US Bank": ["u.s. bank", "us bank"],
  "Wells Fargo": ["wells fargo"],
  "Chase (Amazon)": ["amazon", "prime"],
  "Citi (Costco)": ["costco"],
  "Goldman Sachs (Apple)": ["apple"],
  "TD Bank (Target)": ["target"],
};
const SHORT_ISSUER = {
  "Chase (Amazon)": "Chase", "Citi (Costco)": "Citi", "Goldman Sachs (Apple)": "Apple",
  "TD Bank (Target)": "Target", "Synchrony (Amazon)": "Amazon", "Synchrony (PayPal)": "PayPal", "Synchrony (Venmo)": "Venmo",
};

export function issuerShort(card) {
  return SHORT_ISSUER[card?.issuer] || card?.issuer || "";
}

export function cardDisplayName(card) {
  if (!card) return "";
  const name = String(card.name || "");
  const issuer = issuerShort(card);
  const words = [...(ISSUER_WORDS[card.issuer] || []), issuer.toLowerCase(), String(card.issuer || "").toLowerCase()].filter(Boolean);
  const lower = name.toLowerCase();
  if (!issuer || words.some((w) => lower.startsWith(w) || lower.includes(` ${w}`))) return name;
  return `${issuer} ${name}`;
}

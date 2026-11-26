/* The three issuer hotel programs whose properties earn the hotel credits.
   A hotel that is not in one of these programs earns nothing, so every hotel
   menu in the app says which program (and which issuer) a property belongs to. */
export const CREDIT_PROGRAMS = ["edit", "thc", "fhr"];
export const PROGRAM_INFO = {
  edit: { short: "Edit", name: "The Edit", issuer: "Chase", card: "Chase Sapphire Reserve", label: "The Edit (Chase)", badge: "THE EDIT · CHASE", color: "#5cc4b4" },
  thc: { short: "THC", name: "The Hotel Collection", issuer: "Amex", card: "Amex Platinum or Gold", label: "The Hotel Collection (Amex)", badge: "THC · AMEX", color: "#b49cf0" },
  fhr: { short: "FHR", name: "Fine Hotels + Resorts", issuer: "Amex", card: "Amex Platinum", label: "Fine Hotels + Resorts (Amex)", badge: "FHR · AMEX", color: "#d9b36a" },
  selectHotels2026: { short: "Select", name: "Select Hotels", issuer: "Chase", card: "Chase Sapphire Reserve", label: "Select Hotels (Chase)", badge: "SELECT · CHASE", color: "#7aa7e8" },
};
export const PROGRAM_MENU_TITLE = "Card programs";
export const PROGRAM_MENU_LABEL = "Program: The Edit (Chase) · The Hotel Collection (Amex) · Fine Hotels + Resorts (Amex)";
export const PROGRAM_MENU_NOTE = "Only properties in these card programs earn the hotel credits. A hotel that is not in The Edit, The Hotel Collection or Fine Hotels + Resorts earns nothing here.";
export const programInfo = (p) => PROGRAM_INFO[p] || { short: p, name: p, issuer: "", card: "", label: p, badge: String(p).toUpperCase(), color: "#999" };
export const programBadge = (p) => programInfo(p).badge;
export const programLabel = (p) => programInfo(p).label;

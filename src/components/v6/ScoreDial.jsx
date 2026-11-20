/* Wallet Score dial 0–100. v7 (§9.11): the hairline ring with a thin bronze
   arc and a Boska lining number — the same component the style tile shows.
   Kept under this name so every screen picks it up. */
import React from "react";
import Dial from "../v7/Dial.jsx";

export default function ScoreDial({ score = 0, size = 148, label = "Wallet Score", caption }) {
  return <Dial score={score} size={size} label={label} caption={caption} />;
}

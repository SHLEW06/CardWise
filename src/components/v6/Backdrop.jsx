/* ============================================================================
   <Backdrop slot="home|checkout|offers|lab|explore|survey|card" />
   ----------------------------------------------------------------------------
   v7 "Ink & Stone" (REDESIGN_SPEC §9.11): the page is a flat ink-navy
   ground. No horizon, glow, bokeh, spotlight, shelves or grain — texture
   lives only in the one focal image per hero (<FocalImage>). The component
   stays so every screen keeps the same frame and slot name (handy for
   screenshots and tests); it draws only the solid ground.
   ========================================================================== */
import React from "react";

export const BACKDROP_SLOTS = ["home", "checkout", "offers", "lab", "explore", "survey", "card"];

export default function Backdrop({ slot = "home" }) {
  return <div className={`backdrop bd-${slot}`} aria-hidden="true" data-slot={slot} />;
}

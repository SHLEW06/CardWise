import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/fonts.css";
import "./styles/animations.css";
import "./styles/globals.css";
import "./styles/cardwise.css";
import "./styles/wallet.css";
import "./styles/simple.css";
import "./styles/go.css";
import "./styles/v5/tokens.css";
import "./styles/v5/primitives.css";
import "./styles/v5/shell.css";
import "./styles/v5/screens.css";
import "./styles/v5/survey.css";
import "./styles/v6/backdrop.css";
import "./styles/v6/screens.css";
import "./styles/v6/lab.css";
import "./styles/v6/explore.css";
import "./styles/v6/checkout.css";
import "./styles/v6/offers.css";
import "./styles/v6/home.css";
import "./styles/v7/components.css";
import "./styles/v7/app.css";

/* v7 Part 0: the "Ink & Stone" style tile lives at /styletile in dev only
   (REDESIGN_SPEC §9.11). In a production build the condition is false at
   compile time, so the tile and its CSS are never bundled. */
const isStyleTile = import.meta.env.DEV && window.location.pathname.replace(/\/+$/, "") === "/styletile";
const Root = isStyleTile ? React.lazy(() => import("./components/v7/StyleTile.jsx")) : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <Root />
    </React.Suspense>
  </React.StrictMode>
);

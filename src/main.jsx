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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

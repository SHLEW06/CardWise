import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

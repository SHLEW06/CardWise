import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/animations.css";
import "./styles/globals.css";
import "./styles/cardwise.css";
import "./styles/wallet.css";
import "./styles/simple.css";
import "./styles/go.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SeatServeProvider } from "./state/SeatServeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SeatServeProvider>
      <App />
    </SeatServeProvider>
  </StrictMode>,
);

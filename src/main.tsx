import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VelioApp } from "@/components/velio/VelioApp";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VelioApp />
  </StrictMode>,
);

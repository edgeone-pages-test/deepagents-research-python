import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "./hooks/useLanguage";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);

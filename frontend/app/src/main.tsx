import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Before App: reads the data the server embedded in the HTML into the useApi
// cache, so the first render already has it. See lib/bootstrap.ts.
import "./lib/bootstrap";
import App from "./App";
import "./styles/common/index.css";
import "./styles/base.css";
import "./styles/enhance.css";
import "./styles/service-detail.css";
import "./styles/services-page.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

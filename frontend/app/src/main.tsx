import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Before App: reads the data the server embedded in the HTML into the useApi
// cache, so the first render already has it. See lib/bootstrap.ts.
import "./lib/bootstrap";
// Side-effect import: listens for a lazy chunk that a redeploy has deleted
// out from under this tab and reloads into the current build. See the file.
import "./lib/chunkReload";
import App from "./App";
import "./styles/common/index.css";
import "./styles/base.css";
import "./styles/enhance.css";
import "./styles/service-detail.css";
import "./styles/services-page.css";
import "./styles/online-havan.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

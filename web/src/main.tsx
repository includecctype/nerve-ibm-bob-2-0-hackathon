import { createRoot } from "react-dom/client";
import "./styles/global.css";
import { WebApp } from "./web_app.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("missing #root element");
}

createRoot(container).render(<WebApp />);

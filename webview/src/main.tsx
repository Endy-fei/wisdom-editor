import React from "react";
import { createRoot } from "react-dom/client";
import { WisdomEditorApp } from "@wisdom/editor-ui";
import "@wisdom/editor-ui/styles.css";
import { createVsCodeBridge } from "./vscodeBridge";

const bridge = createVsCodeBridge();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WisdomEditorApp bridge={bridge} />
  </React.StrictMode>
);

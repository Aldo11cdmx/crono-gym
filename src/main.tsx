import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./lib/router";
import { ActiveSessionProvider } from "./context/ActiveSessionContext";
import { GymSettingsProvider } from "./context/GymSettingsContext";
// Before `./index.css` on purpose. The stylesheet reads `--cronos-*` custom properties, and
// a generated sheet that lands after it is a sheet that resolves to its fallback for a
// frame. Module scope, not an effect, so it is there before the first paint.
import "./design/installDesignTokens";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Outside the router because `AppShell` reads it, and the shell is a
        descendant of the router rather than an ancestor. */}
    <ActiveSessionProvider>
      {/* Also outside: the set logger needs the bar weight on first paint, and
          onboarding renders it before the router has anything to show. */}
      <GymSettingsProvider>
        <RouterProvider router={router} />
      </GymSettingsProvider>
    </ActiveSessionProvider>
  </React.StrictMode>
);
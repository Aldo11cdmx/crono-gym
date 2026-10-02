import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./lib/router";
import { ActiveSessionProvider } from "./context/ActiveSessionContext";
import { GymSettingsProvider } from "./context/GymSettingsContext";
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
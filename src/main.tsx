import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./lib/router";
import { ActiveSessionProvider } from "./context/ActiveSessionContext";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { GymSettingsProvider } from "./context/GymSettingsContext";
// Before `./index.css` on purpose. The stylesheet reads `--cronos-*` custom properties, and
// a generated sheet that lands after it is a sheet that resolves to its fallback for a
// frame. Module scope, not an effect, so it is there before the first paint.
import "./design/installDesignTokens";
import "./index.css";
import "./styles/text-scale.css";
import { registerServiceWorker } from "./lib/pwa/registerServiceWorker";

// The shell that starts without a connection. Not in development: a cached
// module is a module that does not hot-reload.
registerServiceWorker({ enabled: !import.meta.env.DEV });

// Browser extensions (and some embedded webviews) reject with this message when
// their content script cannot reach a background page. It is external noise the
// app cannot act on, so it is swallowed silently instead of surfacing as an
// unhandled rejection in the console. Rejections we caused still reach the
// error boundary and the logger untouched.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "";
    if (message.includes("Could not establish connection. Receiving end does not exist")) {
      event.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
    {/* Outside the router because `AppShell` reads it, and the shell is a
        descendant of the router rather than an ancestor. */}
    <ActiveSessionProvider>
      {/* Also outside: the set logger needs the bar weight on first paint, and
          onboarding renders it before the router has anything to show. */}
      <GymSettingsProvider>
        <RouterProvider router={router} />
      </GymSettingsProvider>
    </ActiveSessionProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./styles.css";
import { AppShell } from "./components/AppShell";
import { EquationProvider } from "./lib/equation";
import { NetWorthProvider } from "./lib/NetWorthProvider";
import { Toaster } from "sonner";

// Code-split secondary routes so each page only loads its own JS.
const Dashboard = lazy(() => import("./routes/Dashboard"));
const Subscriptions = lazy(() => import("./routes/Subscriptions"));
const Budget = lazy(() => import("./routes/Calculator"));
const Transactions = lazy(() => import("./routes/History"));
const Goals = lazy(() => import("./routes/Goals"));
const BusinessBuilder = lazy(() => import("./routes/BusinessBuilder"));
const Branding = lazy(() => import("./routes/Branding"));
const Invoices = lazy(() => import("./routes/Invoices"));
const Legal = lazy(() => import("./routes/Legal"));
const Contacts = lazy(() => import("./routes/Contacts"));

const routeFallback = (
  <div className="grid h-[60vh] place-items-center text-xs text-muted-foreground">Loading...</div>
);
const lazyEl = (node: React.ReactNode) => <Suspense fallback={routeFallback}>{node}</Suspense>;
const appShell = (
  <EquationProvider>
    <NetWorthProvider>
      <AppShell />
    </NetWorthProvider>
  </EquationProvider>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: appShell,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: lazyEl(<Dashboard />) },
      { path: "subscriptions", element: lazyEl(<Subscriptions />) },
      { path: "budget", element: lazyEl(<Budget />) },
      { path: "calculator", element: <Navigate to="/budget" replace /> },
      { path: "insights", element: <Navigate to="/goals" replace /> },
      { path: "scenarios", element: <Navigate to="/goals" replace /> },
      { path: "history", element: <Navigate to="/transactions" replace /> },
      { path: "transactions", element: lazyEl(<Transactions />) },
      { path: "goals", element: lazyEl(<Goals />) },
      { path: "business-builder", element: lazyEl(<BusinessBuilder />) },
      { path: "branding", element: lazyEl(<Branding />) },
      { path: "invoices", element: lazyEl(<Invoices />) },
      { path: "legal", element: lazyEl(<Legal />) },
      { path: "contacts", element: lazyEl(<Contacts />) },
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster richColors position="top-right" />
  </StrictMode>,
);

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Calculator,
  Clock,
  Target,
  Briefcase,
  HelpCircle,
  Sun,
  Moon,
  Share2,
  FileText,
  Wallet,
  Menu,
  X,
  Heart,
  Cloud,
  LogOut,
  UserPlus,
  Trash2,
  FileDown,
  Printer,
  ExternalLink,
  FileUp,
  CreditCard,
  BookOpen,
  Bot,
  ShieldCheck,
  BadgeDollarSign,
  Repeat,
  TrendingUp,
  Palette,
  ReceiptText,
  Lightbulb,
  Scale,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/openui/Button";
import { DashboardChat } from "@/components/DashboardChat";
import { QuickInsightsWidget } from "@/components/QuickInsightsWidget";
import {
  BUSINESS_TAX_ORGANIZATIONS,
  FREE_DASHBOARD_LIMIT,
  useEquation,
  fmtFiat,
  type DashboardType,
  type BusinessTaxOrganization,
  type EquationProfile,
} from "@/lib/equation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/openui/Select";
import { useNetWorthContext } from "@/lib/netWorthContext";
import {
  isStripeDonationConfigured,
  OPEN_SUPPORT_EVENT,
  openStripeDonation,
} from "@/lib/stripeDonation";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";

const THEME_KEY = "austin-equation:theme";
const AUTH_KEY = "austin-equation:auth-session";
const QUICK_INSIGHTS_KEY = "austin-equation:quick-insights-hidden";

const ImportDataDialog = lazy(() =>
  import("@/components/ImportDataDialog").then((module) => ({ default: module.ImportDataDialog })),
);

const TABS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/budget", label: "Budget" },
  { to: "/goals", label: "Goals" },
  { to: "/transactions", label: "Transactions" },
  { to: "/business-builder", label: "Business Builder" },
];

const SIDE = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/subscriptions", icon: CreditCard, label: "Subscriptions" },
  { to: "/budget", icon: Calculator, label: "Budget" },
  { to: "/goals", icon: Target, label: "Goals" },
  { to: "/transactions", icon: Clock, label: "Transactions" },
  { to: "/business-builder", icon: Briefcase, label: "Business Builder" },
];

const BUSINESS_SIDE = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/branding", icon: Palette, label: "Branding" },
  { to: "/invoices", icon: ReceiptText, label: "Invoices" },
  { to: "/legal", icon: Scale, label: "Legal" },
  { to: "/contacts", icon: UsersRound, label: "Contacts" },
  { to: "/subscriptions", icon: CreditCard, label: "Expenses" },
  { to: "/budget", icon: Calculator, label: "Budget" },
];

type AuthProvider = "Apple" | "Google";
type AuthSession = { provider: AuthProvider; connectedAt: string } | null;

function loadAuthSession(): AuthSession {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (parsed?.provider === "Apple" || parsed?.provider === "Google") {
      return {
        provider: parsed.provider,
        connectedAt:
          typeof parsed.connectedAt === "string" ? parsed.connectedAt : new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function AppShell() {
  const {
    state,
    computed,
    profiles,
    activeProfileId,
    activeProfile,
    canCreateProfile,
    createProfile,
    setActiveProfile,
    updateProfile,
    deleteProfile,
  } = useEquation();
  const { netWorth, count: netWorthSourceCount } = useNetWorthContext();
  const hasData = netWorthSourceCount > 0;
  const displayNetWorth = hasData ? netWorth : 0;
  const netWorthChipClass = !hasData
    ? "bg-muted text-muted-foreground"
    : displayNetWorth >= 0
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]";
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return "light";
  });
  const [authSession, setAuthSession] = useState<AuthSession>(() => loadAuthSession());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newProfileOpen, setNewProfileOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [quickInsightsHidden, setQuickInsightsHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(QUICK_INSIGHTS_KEY) === "true";
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(QUICK_INSIGHTS_KEY, quickInsightsHidden ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [quickInsightsHidden]);

  useEffect(() => {
    setMobileNavOpen(false);
    setShareOpen(false);
    setImportOpen(false);
    setNewProfileOpen(false);
    setHelpOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const businessOnly =
      location.pathname === "/branding" ||
      location.pathname === "/invoices" ||
      location.pathname === "/legal" ||
      location.pathname === "/contacts";
    if (
      (activeProfile.dashboardType === "business" && location.pathname === "/business-builder") ||
      (activeProfile.dashboardType === "business" && location.pathname === "/transactions") ||
      (activeProfile.dashboardType === "investments" && location.pathname !== "/dashboard") ||
      (activeProfile.dashboardType !== "business" && businessOnly)
    ) {
      navigate(
        activeProfile.dashboardType === "business" && location.pathname === "/transactions"
          ? "/subscriptions"
          : "/dashboard",
        { replace: true },
      );
    }
  }, [activeProfile.dashboardType, location.pathname, navigate]);

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem(AUTH_KEY, JSON.stringify(authSession));
      else localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }, [authSession]);

  useEffect(() => {
    const openSupport = () => {
      void openStripeDonation("paywall").catch(showStripeDonationError);
    };
    window.addEventListener(OPEN_SUPPORT_EVENT, openSupport);
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, openSupport);
  }, []);

  const signIn = (provider: AuthProvider) => {
    setAuthSession({ provider, connectedAt: new Date().toISOString() });
  };

  const exportReport = async (mode: "download" | "print") => {
    const { exportDashboardReport } = await import("@/lib/reportExport");
    exportDashboardReport({ state, computed, activeProfile }, mode);
    setShareOpen(false);
  };

  const navItems =
    activeProfile.dashboardType === "investments"
      ? SIDE.filter((item) => item.to === "/dashboard")
      : activeProfile.dashboardType === "business"
        ? BUSINESS_SIDE
        : SIDE;
  const isBusinessDashboard = activeProfile.dashboardType === "business";
  const helpLabel = isBusinessDashboard ? "Help Center" : "Help";

  const openNewDashboard = () => {
    if (!canCreateProfile) {
      setPaywallOpen(true);
      return;
    }
    setNewProfileOpen(true);
  };

  const createDashboard = (dashboardType: DashboardType) => {
    if (dashboardType === "investments") {
      return;
    }
    if (!canCreateProfile) {
      setNewProfileOpen(false);
      setPaywallOpen(true);
      return;
    }
    createProfile({
      info: {
        dashboardType,
        name: dashboardType === "business" ? "Business Dashboard" : "Personal Dashboard",
        role: dashboardType === "business" ? "Founder" : "",
      },
    });
    setNewProfileOpen(false);
  };
  const handleProfileImageChange = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2_000_000) {
      window.alert("Please choose an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateProfile(activeProfile.id, { imageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Left icon rail */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col items-stretch gap-1 overflow-y-auto sharp-divider-r bg-background px-3 py-4 md:flex">
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary shrink-0">
            FYI
          </div>
          <span className="truncate font-display text-xs font-semibold tracking-wide text-foreground">
            Find Your Income
          </span>
        </div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                "group relative flex h-10 w-full items-center gap-3 overflow-hidden rounded-md px-3 transition-all duration-200 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:opacity-0 before:transition-opacity hover:translate-x-0.5",
                isActive
                  ? "bg-primary/12 text-primary shadow-[0_0_24px_-16px_var(--primary)] before:opacity-100"
                  : "text-muted-foreground hover:bg-surface-2/80 hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className="truncate text-sm font-medium">{label}</span>
          </NavLink>
        ))}
        <div className="mt-auto flex w-full flex-col gap-1">
          {quickInsightsHidden && !isBusinessDashboard && (
            <button
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-muted-foreground transition-colors hover:bg-surface-2/80 hover:text-foreground"
              title="Insights"
              aria-label="Insights"
              onClick={() => setQuickInsightsHidden(false)}
            >
              <Lightbulb className="h-4 w-4 shrink-0" />
              <span className="text-sm">Insights</span>
            </button>
          )}
          <button
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-muted-foreground transition-colors hover:bg-surface-2/80 hover:text-foreground"
            title={helpLabel}
            aria-label={`Open ${helpLabel}`}
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{helpLabel}</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="relative z-40 flex flex-wrap items-center gap-x-3 gap-y-3 sharp-divider-b bg-surface/60 backdrop-blur px-4 md:gap-x-6 md:px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-base md:text-lg font-semibold tracking-tight">
              {activeProfile.name || "Dashboard"}
            </h1>
          </div>

          <div className="ml-auto order-2 md:order-3 flex items-center gap-2">
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sharp-edge",
                netWorthChipClass,
              )}
              title={
                hasData
                  ? `Live net worth from ${netWorthSourceCount} imported transaction${netWorthSourceCount === 1 ? "" : "s"}`
                  : "Import transactions or connect a bank to see live net worth"
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Net Worth {fmtFiat(displayNetWorth, state.fiat)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setImportOpen(true)}
            >
              <FileUp className="h-3.5 w-3.5" /> Import
            </Button>
            <div className="relative hidden sm:block">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={shareOpen}
                aria-controls="share-export-menu"
                onClick={() => setShareOpen((open) => !open)}
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              {shareOpen && (
                <div
                  id="share-export-menu"
                  className="absolute right-0 top-full z-[70] mt-2 w-56 rounded-lg bg-surface p-1.5 sharp-edge-card shadow-lg"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted"
                    onClick={() => exportReport("download")}
                  >
                    <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted"
                    onClick={() => exportReport("print")}
                  >
                    <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                    Print PDF
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <button
              className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold transition-colors hover:bg-muted/70 sharp-edge"
              aria-label="Open profile"
              title="Profile"
              onClick={() => setProfileOpen(true)}
            >
              <ProfileLogo profile={activeProfile} />
            </button>
          </div>

          {mobileNavOpen && (
            <nav className="order-4 flex w-full flex-col gap-1 rounded-lg bg-surface-2/70 p-1.5 sharp-edge md:hidden">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
              <button
                type="button"
                className="mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => {
                  setMobileNavOpen(false);
                  setHelpOpen(true);
                }}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{helpLabel}</span>
              </button>
              {quickInsightsHidden && !isBusinessDashboard && (
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  aria-label="Insights"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setQuickInsightsHidden(false);
                  }}
                >
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span className="truncate">Insights</span>
                </button>
              )}
            </nav>
          )}
        </header>

        <Suspense fallback={null}>
          {importOpen && <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />}
        </Suspense>

        <Dialog.Root open={profileOpen} onOpenChange={setProfileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
              <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
                <div>
                  <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                    Profile
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Manage Profile Details And Dashboard Silos.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close profile">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              </div>

              <div className="grid min-h-0 gap-0 overflow-y-auto md:grid-cols-[260px_minmax(0,1fr)]">
                <div className="sharp-divider-b p-4 md:sharp-divider-r">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Profiles
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={openNewDashboard}>
                      <UserPlus className="h-3.5 w-3.5" /> New
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => setActiveProfile(profile.id)}
                        className={cn(
                          "w-full rounded-lg p-3 text-left transition-colors sharp-edge",
                          profile.id === activeProfileId
                            ? "bg-primary/15 text-primary"
                            : "bg-surface-2/40 text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-[10px] font-semibold text-muted-foreground sharp-edge">
                            <ProfileLogo profile={profile} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {profile.name || "Untitled Dashboard"}
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                              {dashboardTypeLabel(profile.dashboardType)}
                              {profile.role || profile.location
                                ? ` · ${profile.role || profile.location}`
                                : ""}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 p-4">
                  <div className="rounded-xl bg-surface sharp-edge-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 sharp-divider-b px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Personalized Information
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {profiles.length}/{FREE_DASHBOARD_LIMIT} Free Dashboards
                      </span>
                    </div>

                    <div className="grid gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2/45 p-3 sharp-edge">
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-xs font-semibold text-muted-foreground sharp-edge">
                          <ProfileLogo profile={activeProfile} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground">
                            {activeProfile.dashboardType === "business"
                              ? "Business Logo"
                              : activeProfile.dashboardType === "investments"
                                ? "Investment Logo"
                                : "Profile Picture"}
                          </div>
                          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            This Image Appears In The Top-Right Profile Button For The Active
                            Dashboard.
                          </div>
                        </div>
                        <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md bg-transparent px-3 text-xs font-medium text-foreground transition-colors sharp-edge hover:bg-muted">
                          <FileUp className="h-3.5 w-3.5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) => {
                              handleProfileImageChange(event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {activeProfile.imageDataUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateProfile(activeProfile.id, { imageDataUrl: "" })}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <ProfileField label="Profile Name">
                        <input
                          value={activeProfile.name}
                          onChange={(event) =>
                            updateProfile(activeProfile.id, { name: event.target.value })
                          }
                          className="h-9 w-full rounded-md bg-input px-3 text-sm text-foreground sharp-edge focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </ProfileField>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2/45 p-3 text-xs sharp-edge">
                        <span className="text-muted-foreground">Dashboard Type</span>
                        <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary sharp-edge">
                          {dashboardTypeShortLabel(activeProfile.dashboardType)}
                        </span>
                      </div>
                      {activeProfile.dashboardType === "business" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2/45 p-3 text-xs sharp-edge">
                          <span className="text-muted-foreground">Business Tax Organization</span>
                          <Select
                            value={activeProfile.businessTaxOrganization}
                            onValueChange={(value) =>
                              updateProfile(activeProfile.id, {
                                businessTaxOrganization: value as BusinessTaxOrganization,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-52 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BUSINESS_TAX_ORGANIZATIONS.map((organization) => (
                                <SelectItem key={organization.value} value={organization.value}>
                                  {organization.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <ProfileField label="Work Role">
                        <input
                          value={activeProfile.role}
                          onChange={(event) =>
                            updateProfile(activeProfile.id, { role: event.target.value })
                          }
                          placeholder="Designer, Contractor, Founder..."
                          className="h-9 w-full rounded-md bg-input px-3 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </ProfileField>
                      <ProfileField label="Location">
                        <input
                          value={activeProfile.location}
                          onChange={(event) =>
                            updateProfile(activeProfile.id, { location: event.target.value })
                          }
                          placeholder="City, State, Market..."
                          className="h-9 w-full rounded-md bg-input px-3 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </ProfileField>
                      <ProfileField label="Notes">
                        <textarea
                          value={activeProfile.notes}
                          onChange={(event) =>
                            updateProfile(activeProfile.id, { notes: event.target.value })
                          }
                          placeholder="Context For This Income Dashboard..."
                          rows={4}
                          className="min-h-24 w-full resize-y rounded-md bg-input px-3 py-2 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </ProfileField>
                      <div className="rounded-lg bg-surface-2/45 p-3 sharp-edge">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 place-items-center rounded-md sharp-edge",
                              authSession
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Cloud className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">
                              {authSession
                                ? `Signed In With ${authSession.provider}`
                                : "Not Signed In"}
                            </div>
                            <div className="text-[11px] leading-relaxed text-muted-foreground">
                              Cloud Sync Requires OAuth Client IDs And A Cloud Data Store Before It
                              Can Save Across Devices.
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => signIn("Apple")}
                          >
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                              A
                            </span>
                            Sign In With Apple
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => signIn("Google")}
                          >
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              G
                            </span>
                            Sign In With Google
                          </Button>
                        </div>
                        {authSession && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full justify-center text-muted-foreground"
                            onClick={() => setAuthSession(null)}
                          >
                            <LogOut className="h-3.5 w-3.5" /> Sign Out
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 sharp-divider-t px-4 py-3">
                      <span className="text-[11px] text-muted-foreground">
                        Dashboard Inputs And Live Chart Values Follow The Active Profile.
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={profiles.length <= 1}
                        onClick={() => deleteProfile(activeProfile.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <HelpCenterDialog
          open={helpOpen}
          onOpenChange={setHelpOpen}
          onImport={() => {
            setHelpOpen(false);
            setImportOpen(true);
          }}
          onPrint={() => exportReport("print")}
          onSupport={() => {
            setHelpOpen(false);
            void openStripeDonation("help_center").catch(showStripeDonationError);
          }}
        />

        <NewDashboardDialog
          open={newProfileOpen}
          onOpenChange={setNewProfileOpen}
          onCreate={createDashboard}
          remaining={Math.max(0, FREE_DASHBOARD_LIMIT - profiles.length)}
        />

        <DashboardPaywallDialog
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          onDonate={() => {
            setPaywallOpen(false);
            void openStripeDonation("dashboard_limit_paywall").catch(showStripeDonationError);
          }}
        />

        {/* Route body */}
        <main key={location.pathname} className="flex-1 min-w-0">
          {(!quickInsightsHidden || isBusinessDashboard) && (
            <div className="px-4 pt-4 pb-2 md:px-6">
              <QuickInsightsWidget
                onClose={isBusinessDashboard ? undefined : () => setQuickInsightsHidden(true)}
              />
            </div>
          )}
          <Outlet />
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 sharp-divider-t bg-surface/40 px-4 py-4 text-[11px] text-muted-foreground md:px-6">
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Privacy first
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> Data stays on your device
              </span>
            </span>
          </div>
          <StripeDonationButton source="footer_support" />
        </footer>
        <DashboardChat />
      </div>
    </div>
  );
}

function NewDashboardDialog({
  open,
  onOpenChange,
  onCreate,
  remaining,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (type: DashboardType) => void;
  remaining: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                New Dashboard
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose The Dashboard Layout. Five Dashboards Are Included For Free.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close new dashboard">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => onCreate("personal")}
              className="rounded-xl bg-surface-2/45 p-4 text-left transition-colors sharp-edge hover:bg-muted"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary sharp-edge">
                <UserPlus className="h-4 w-4" />
              </span>
              <span className="mt-3 block text-sm font-semibold text-foreground">
                Personal Dashboard
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                The Default FYI Layout For Individual Income, Expenses, Goals, Transactions, And
                Subscriptions.
              </span>
            </button>

            <button
              type="button"
              onClick={() => onCreate("business")}
              className="rounded-xl bg-surface-2/45 p-4 text-left transition-colors sharp-edge hover:bg-muted"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary sharp-edge">
                <Briefcase className="h-4 w-4" />
              </span>
              <span className="mt-3 block text-sm font-semibold text-foreground">
                Business Dashboard
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Starts As The Same Dashboard Experience, With The Business Builder Tab Removed From
                The Layout.
              </span>
            </button>

            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Investments dashboards are coming in a future paywalled update"
              className="cursor-not-allowed rounded-xl bg-muted/40 p-4 text-left opacity-55 grayscale transition-colors sharp-edge"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground sharp-edge">
                <TrendingUp className="h-4 w-4" />
              </span>
              <span className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                Investments Dashboard
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sharp-edge">
                  Coming Soon
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Future Paywalled Template For Market Views, Watchlists, And Investment Data Sources.
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sharp-divider-t px-5 py-4">
            <span className="text-[11px] text-muted-foreground">
              {remaining} Free Dashboard Slot{remaining === 1 ? "" : "s"} Remaining.
            </span>
            <Dialog.Close asChild>
              <Button type="button" size="sm" variant="outline">
                Cancel
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DashboardPaywallDialog({
  open,
  onOpenChange,
  onDonate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDonate: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                Unlock Full App
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Five Dashboards Are Free For The Creator. Donate $99 To Unlock Additional Dashboards
                And Support Future Development.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close unlock prompt">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4">
            <div className="rounded-xl bg-primary/10 p-4 sharp-edge">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary sharp-edge">
                  <Heart className="h-4 w-4 fill-current" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">$99 Full App Unlock</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Adds Room For More Personal, Business, And Investments Dashboards Once Payment
                    Integration Is Connected.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sharp-divider-t px-5 py-4">
            <Dialog.Close asChild>
              <Button type="button" size="sm" variant="outline">
                Not Now
              </Button>
            </Dialog.Close>
            <Button type="button" size="sm" onClick={onDonate}>
              <Heart className="h-3.5 w-3.5 fill-current" /> Donate $99
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HelpCenterDialog({
  open,
  onOpenChange,
  onImport,
  onPrint,
  onSupport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: () => void;
  onPrint: () => void;
  onSupport: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                Help Center
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Learn how FYI turns income, expenses, subscriptions, and transactions into
                time-based decisions.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close help">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid gap-3 md:grid-cols-2">
                <HelpCard
                  icon={<BookOpen className="h-4 w-4" />}
                  title="Start here"
                  items={[
                    "Enter monthly expenses, wage, pay frequency, hours, and tax settings in Inputs.",
                    "Review Effective Hourly Wage first. It converts your pay into actual take-home value.",
                    "Use Income vs Expenses to test live changes before changing real spending.",
                  ]}
                />
                <HelpCard
                  icon={<BadgeDollarSign className="h-4 w-4" />}
                  title="Key metrics"
                  items={[
                    "Income / Expense Ratio compares take-home income against monthly expenses.",
                    "Break-Even Hours shows how many work hours are needed to cover monthly costs.",
                    "Time Remaining estimates weekly hours left after covering expenses.",
                  ]}
                />
                <HelpCard
                  icon={<Repeat className="h-4 w-4" />}
                  title="Subscriptions"
                  items={[
                    "Add recurring services from Subscriptions so they flow into Expenses (M).",
                    "Set importance to low, medium, or high so Quick Insights can prioritize what to review.",
                    "Use Expenses to review recurring costs, renewal timing, importance, and time cost.",
                  ]}
                />
                <HelpCard
                  icon={<CreditCard className="h-4 w-4" />}
                  title="Transactions and imports"
                  items={[
                    "Import receipts, images, PDFs, bank transactions, and crypto transaction files when available.",
                    "Imported expenses can be matched against bank transactions to reduce duplicates.",
                    "Net Worth widgets become more useful after importing or syncing transaction data.",
                  ]}
                />
                <HelpCard
                  icon={<Bot className="h-4 w-4" />}
                  title="Chat and insights"
                  items={[
                    "Use Chat to ask questions about your dashboard, subscriptions, and sustainability.",
                    "Quick Insights surfaces ratio, break-even, and subscription recommendations.",
                    "Treat AI output as decision support and verify numbers before making financial changes.",
                  ]}
                />
                <HelpCard
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Privacy and accounts"
                  items={[
                    "Local dashboard data is stored in your browser unless a connected service is configured.",
                    "Profile sign-in prepares the app for cloud-backed saving, but production OAuth still needs provider setup.",
                    "Never paste bank passwords, API keys, or private recovery phrases into Chat.",
                  ]}
                />
              </div>

              <aside className="flex flex-col gap-3">
                <div className="rounded-xl bg-surface-2/45 p-4 sharp-edge">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Common actions
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={onImport}
                    >
                      <FileUp className="h-3.5 w-3.5" /> Import data
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={onPrint}
                    >
                      <Printer className="h-3.5 w-3.5" /> Print report
                    </Button>
                    <Button type="button" size="sm" className="justify-start" onClick={onSupport}>
                      <Heart className="h-3.5 w-3.5 fill-current" /> Support FYI
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-2/45 p-4 sharp-edge">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Troubleshooting
                  </div>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">Numbers look wrong:</span> check
                      time unit, pay frequency, tax estimate, and subscription totals.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Imports fail:</span> try a
                      clearer receipt image or a smaller PDF first.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Dashboard feels crowded:</span>{" "}
                      collapse Inputs or Paycheck on mobile and tablet.
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl bg-primary/10 p-4 sharp-edge">
                  <div className="text-sm font-semibold text-foreground">Need a fast answer?</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Open Chat from the bottom corner and ask about a specific metric, subscription,
                    or goal on your current dashboard.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HelpCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <section className="rounded-xl bg-surface-2/45 p-4 sharp-edge">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary sharp-edge">
          {icon}
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileLogo({ profile }: { profile: EquationProfile }) {
  if (profile.imageDataUrl) {
    return <img src={profile.imageDataUrl} alt="" className="h-full w-full object-cover" />;
  }

  const name =
    profile.name?.trim() ||
    (profile.dashboardType === "business"
      ? "Business"
      : profile.dashboardType === "investments"
        ? "Investments"
        : "FYI");
  const fallback =
    profile.dashboardType === "business" || profile.dashboardType === "investments"
      ? name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      : "FYI";

  return <span>{fallback || "FYI"}</span>;
}

function dashboardTypeLabel(type: DashboardType) {
  if (type === "business") return "Business Dashboard";
  if (type === "investments") return "Investments Dashboard";
  return "Personal Dashboard";
}

function dashboardTypeShortLabel(type: DashboardType) {
  if (type === "business") return "Business";
  if (type === "investments") return "Investments";
  return "Personal";
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StripeDonationButton({ source }: { source: string }) {
  const configured = isStripeDonationConfigured();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      await openStripeDonation(source);
    } catch (error) {
      showStripeDonationError(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!configured && (
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Support checkout unavailable
        </span>
      )}
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-r from-pink-500 to-rose-500 px-3 text-xs font-medium text-white shadow-md shadow-rose-500/20 transition-colors hover:from-pink-500/90 hover:to-rose-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={
          configured ? "Open Stripe pay-what-you-want donation checkout" : "Open support payments"
        }
      >
        <Heart className="h-3.5 w-3.5 fill-current" />
        {loading ? "Opening..." : "Support"}
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}

function showStripeDonationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout.";
  console.error("[Stripe donation]", message);
  window.alert("Support payments are not available right now. Please try again in a moment.");
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SUBSCRIPTIONS_CHANGED_EVENT,
  getSubscriptionSummary,
  isSubscriptionsStorageKey,
  type SubscriptionSummary,
} from "@/lib/subscriptions";
import { DEFAULT_TAX_LOCATION, getTaxLocation, type TaxLocationCode } from "@/lib/taxLocations";

// ---- Types ----
export type FiatCode = "USD" | "EUR" | "GBP" | "JPY" | "CAD";
export type CryptoCode = "NONE" | "BTC" | "ETH" | "SOL" | "USDC";
export type PayFreq = "hourly" | "daily" | "weekly" | "biweekly" | "monthly";
export type TimeUnit = "day" | "week" | "month";
export type Status = "sustainable" | "thin" | "deficit";
export type DashboardType = "personal" | "business" | "investments";
export type BusinessTaxOrganization =
  | "sole-proprietor"
  | "single-member-llc"
  | "partnership"
  | "s-corp"
  | "c-corp"
  | "nonprofit";

export type ExpenseKey =
  | "rent"
  | "groceries"
  | "utilities"
  | "transportation"
  | "healthInsurance"
  | "contingency"
  | "savings"
  | "recreational";
export type ExpenseItems = Record<ExpenseKey, number>;

export const EXPENSE_FIELDS: Array<{ key: ExpenseKey; label: string; icon: string }> = [
  { key: "rent", label: "Rent", icon: "home" },
  { key: "groceries", label: "Groceries", icon: "shopping-cart" },
  { key: "utilities", label: "Utilities", icon: "zap" },
  { key: "transportation", label: "Transportation", icon: "car" },
  { key: "healthInsurance", label: "Health Insurance", icon: "shield" },
  { key: "contingency", label: "Contingency", icon: "alert-circle" },
  { key: "savings", label: "Savings", icon: "piggy-bank" },
  { key: "recreational", label: "Recreational", icon: "music" },
];

export const FIAT_PER_USD: Record<FiatCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 156.4,
  CAD: 1.37,
};
export const USD_PER_CRYPTO: Record<Exclude<CryptoCode, "NONE">, number> = {
  BTC: 67000,
  ETH: 3400,
  SOL: 165,
  USDC: 1,
};
export const FIAT_SYMBOL: Record<FiatCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
};

export const BUSINESS_TAX_ORGANIZATIONS: Array<{
  value: BusinessTaxOrganization;
  label: string;
  estimatedRate: number;
}> = [
  { value: "sole-proprietor", label: "Sole Proprietor", estimatedRate: 0.285 },
  { value: "single-member-llc", label: "Single-Member LLC", estimatedRate: 0.285 },
  { value: "partnership", label: "Partnership", estimatedRate: 0.27 },
  { value: "s-corp", label: "S-Corp", estimatedRate: 0.235 },
  { value: "c-corp", label: "C-Corp", estimatedRate: 0.21 },
  { value: "nonprofit", label: "Nonprofit", estimatedRate: 0.05 },
];

export function getBusinessTaxOrganization(value: unknown) {
  return (
    BUSINESS_TAX_ORGANIZATIONS.find((organization) => organization.value === value) ||
    BUSINESS_TAX_ORGANIZATIONS[0]
  );
}

const HOURS_PER_UNIT: Record<TimeUnit, number> = { day: 8, week: 40, month: 160 };
const UNIT_TO_MONTH: Record<TimeUnit, number> = {
  day: (30 / 7) * 5,
  week: 4.33,
  month: 1,
};

export type TaxConfig = { federal: number; state: number; fica: number; other: number };
const DEFAULT_TAX: TaxConfig = { federal: 12, state: 5, fica: 7.65, other: 0 };

const DEFAULT_EXPENSE_ITEMS: ExpenseItems = {
  rent: 3200,
  groceries: 450,
  utilities: 250,
  transportation: 250,
  healthInsurance: 350,
  contingency: 200,
  savings: 300,
  recreational: 150,
};

function toHourly(amount: number, freq: PayFreq, hoursPerWeek: number): number {
  if (amount <= 0 || hoursPerWeek <= 0) return 0;
  switch (freq) {
    case "hourly":
      return amount;
    case "daily":
      return amount / (hoursPerWeek / 5);
    case "weekly":
      return amount / hoursPerWeek;
    case "biweekly":
      return amount / (hoursPerWeek * 2);
    case "monthly":
      return amount / (hoursPerWeek * 4.33);
  }
}

export const fmtFiat = (n: number, code: FiatCode, opts?: { compact?: boolean }) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: code,
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 0,
  });

export const fmtRatio = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}×` : "No expenses");

// ---- State ----
export type EquationState = {
  fiat: FiatCode;
  crypto: CryptoCode;
  expenseItems: ExpenseItems;
  wageAmount: number;
  payFreq: PayFreq;
  timeUnit: TimeUnit;
  hoursPerUnit: number;
  effort: number;
  taxEnabled: boolean;
  taxLocation: TaxLocationCode;
  tax: TaxConfig;
};

export const DEFAULT_STATE: EquationState = {
  fiat: "USD",
  crypto: "NONE",
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  wageAmount: 1120,
  payFreq: "weekly",
  timeUnit: "week",
  hoursPerUnit: 40,
  effort: 1,
  taxEnabled: true,
  taxLocation: DEFAULT_TAX_LOCATION,
  tax: DEFAULT_TAX,
};

const STORAGE_KEY = "austin-equation:v4";
const PROFILE_STORAGE_KEY = "fyi:profiles:v1";
export const FREE_DASHBOARD_LIMIT = 5;

export type ProfileInfo = {
  name: string;
  role: string;
  location: string;
  notes: string;
  dashboardType: DashboardType;
  businessTaxOrganization: BusinessTaxOrganization;
  imageDataUrl: string;
};

export type EquationProfile = ProfileInfo & {
  id: string;
  state: EquationState;
  createdAt: string;
  updatedAt: string;
};

type ProfileStore = {
  activeProfileId: string;
  profiles: EquationProfile[];
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneState(state: EquationState): EquationState {
  return {
    ...state,
    expenseItems: { ...state.expenseItems },
    tax: { ...state.tax },
  };
}

function sanitizeState(value: Partial<EquationState> | null | undefined): EquationState {
  return {
    ...DEFAULT_STATE,
    ...(value || {}),
    taxLocation: getTaxLocation(value?.taxLocation).code,
    expenseItems: { ...DEFAULT_EXPENSE_ITEMS, ...(value?.expenseItems || {}) },
    tax: { ...DEFAULT_TAX, ...(value?.tax || {}) },
  };
}

function makeProfile(state: EquationState, patch?: Partial<ProfileInfo>): EquationProfile {
  const now = new Date().toISOString();
  const dashboardType = patch?.dashboardType || "personal";
  const fallbackName =
    dashboardType === "business"
      ? "Business Dashboard"
      : dashboardType === "investments"
        ? "Investments Dashboard"
        : "Personal Dashboard";
  return {
    id: uid("profile"),
    name: patch?.name?.trim() || fallbackName,
    role: patch?.role || "",
    location: patch?.location || "",
    notes: patch?.notes || "",
    dashboardType,
    businessTaxOrganization: patch?.businessTaxOrganization || "single-member-llc",
    imageDataUrl: patch?.imageDataUrl || "",
    state: cloneState(state),
    createdAt: now,
    updatedAt: now,
  };
}

function load(): EquationState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return sanitizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

function sanitizeProfile(value: unknown, index: number): EquationProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<EquationProfile>;
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === "string" ? raw.id : uid("profile"),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : `Dashboard ${index + 1}`,
    role: typeof raw.role === "string" ? raw.role : "",
    location: typeof raw.location === "string" ? raw.location : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    dashboardType:
      raw.dashboardType === "business" || raw.dashboardType === "investments"
        ? raw.dashboardType
        : "personal",
    businessTaxOrganization: getBusinessTaxOrganization(raw.businessTaxOrganization).value,
    imageDataUrl: typeof raw.imageDataUrl === "string" ? raw.imageDataUrl : "",
    state: sanitizeState(raw.state),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

function loadProfileStore(): ProfileStore {
  if (typeof window === "undefined") {
    const profile = makeProfile(DEFAULT_STATE);
    return { activeProfileId: profile.id, profiles: [profile] };
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    const profiles = Array.isArray(parsed?.profiles)
      ? (parsed.profiles
          .map((profile: unknown, index: number) => sanitizeProfile(profile, index))
          .filter(Boolean) as EquationProfile[])
      : [];
    if (profiles.length) {
      const activeProfileId = profiles.some((profile) => profile.id === parsed?.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0].id;
      return { activeProfileId, profiles };
    }
  } catch {
    // Fall through to legacy migration.
  }

  const profile = makeProfile(load());
  return { activeProfileId: profile.id, profiles: [profile] };
}

function withActiveProfile(
  store: ProfileStore,
  update: (profile: EquationProfile) => EquationProfile,
): ProfileStore {
  const activeId = store.profiles.some((profile) => profile.id === store.activeProfileId)
    ? store.activeProfileId
    : store.profiles[0]?.id;
  if (!activeId) return store;
  return {
    activeProfileId: activeId,
    profiles: store.profiles.map((profile) =>
      profile.id === activeId ? update(profile) : profile,
    ),
  };
}

// ---- Computed ----
export type Computed = {
  baseExpenses: number;
  subscriptionExpenses: number;
  expenses: number;
  hourlyWage: number;
  netHourlyWage: number;
  monthlyHours: number;
  gross: number;
  income: number;
  surplus: number;
  breakEvenHrs: number;
  ratio: number;
  status: Status;
  taxRate: number;
  cryptoEquivalent: number;
  /** rolling 12-month series for charts */
  series: Array<{ month: string; income: number; expenses: number; net: number }>;
};

export function computeAll(s: EquationState, subscriptionExpenses = 0): Computed {
  const baseExpenses = (Object.keys(s.expenseItems) as ExpenseKey[]).reduce(
    (t, k) => t + (Number(s.expenseItems[k]) || 0),
    0,
  );
  const expenses = baseExpenses + subscriptionExpenses;

  const hoursPerWeekEquiv =
    s.timeUnit === "day"
      ? s.hoursPerUnit * 5
      : s.timeUnit === "week"
        ? s.hoursPerUnit
        : s.hoursPerUnit / 4.33;

  const hourlyWage = toHourly(s.wageAmount, s.payFreq, hoursPerWeekEquiv);
  const monthlyHours = s.hoursPerUnit * UNIT_TO_MONTH[s.timeUnit];
  const taxRate = s.taxEnabled
    ? Math.max(0, Math.min(100, s.tax.federal + s.tax.state + s.tax.fica + s.tax.other)) / 100
    : 0;
  const gross = s.effort * monthlyHours * hourlyWage;
  const income = gross * (1 - taxRate);
  const netHourlyWage = hourlyWage * (1 - taxRate);
  const surplus = income - expenses;
  const breakEvenHrs = netHourlyWage > 0 ? expenses / (netHourlyWage * s.effort) : 0;
  const ratio = expenses > 0 ? income / expenses : income > 0 ? Number.POSITIVE_INFINITY : 0;
  const status: Status =
    expenses <= 0 && income > 0
      ? "sustainable"
      : ratio >= 1.2
        ? "sustainable"
        : ratio >= 1
          ? "thin"
          : "deficit";

  const usdRate = FIAT_PER_USD[s.fiat];
  const incomeUSD = income / usdRate;
  const cryptoEquivalent = s.crypto === "NONE" ? 0 : incomeUSD / USD_PER_CRYPTO[s.crypto];

  // Synthetic 12-month series — deterministic gentle wave around current values
  const months = [
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
  ];
  const series = months.map((m, i) => {
    const wave = Math.sin((i / 12) * Math.PI * 2);
    const jitter = Math.cos(i * 1.3) * 0.04;
    const inc = income * (1 + wave * 0.08 + jitter);
    const exp = expenses * (1 + Math.sin(((i + 3) / 12) * Math.PI * 2) * 0.05);
    return { month: m, income: inc, expenses: exp, net: inc - exp };
  });

  return {
    baseExpenses,
    subscriptionExpenses,
    expenses,
    hourlyWage,
    netHourlyWage,
    monthlyHours,
    gross,
    income,
    surplus,
    breakEvenHrs,
    ratio,
    status,
    taxRate,
    cryptoEquivalent,
    series,
  };
}

// ---- Context ----
type Ctx = {
  state: EquationState;
  computed: Computed;
  profiles: EquationProfile[];
  activeProfileId: string;
  activeProfile: EquationProfile;
  subscriptionSummary: SubscriptionSummary;
  canCreateProfile: boolean;
  set: <K extends keyof EquationState>(key: K, value: EquationState[K]) => void;
  setExpense: (key: ExpenseKey, value: number) => void;
  createProfile: (opts?: { info?: Partial<ProfileInfo>; state?: Partial<EquationState> }) => string;
  setActiveProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<ProfileInfo>) => void;
  deleteProfile: (id: string) => void;
  reset: () => void;
};

const EquationContext = createContext<Ctx | null>(null);

export function EquationProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ProfileStore>(() => loadProfileStore());
  const activeProfile = useMemo(
    () =>
      store.profiles.find((profile) => profile.id === store.activeProfileId) || store.profiles[0],
    [store],
  );
  const state = activeProfile?.state || DEFAULT_STATE;
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary>(() =>
    getSubscriptionSummary(activeProfile.id),
  );

  useEffect(() => {
    const refreshSubscriptions = () =>
      setSubscriptionSummary(getSubscriptionSummary(activeProfile.id));
    const onSubscriptionsChanged = (event: Event) => {
      const changedProfileId = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (!changedProfileId || changedProfileId === activeProfile.id) refreshSubscriptions();
    };
    const onStorage = (event: StorageEvent) => {
      if (isSubscriptionsStorageKey(event.key)) refreshSubscriptions();
    };
    refreshSubscriptions();
    window.addEventListener(SUBSCRIPTIONS_CHANGED_EVENT, onSubscriptionsChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SUBSCRIPTIONS_CHANGED_EVENT, onSubscriptionsChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [activeProfile.id]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }, [store]);

  const computed = useMemo(
    () => computeAll(state, subscriptionSummary.monthlyTotal),
    [state, subscriptionSummary.monthlyTotal],
  );

  const value = useMemo<Ctx>(
    () => ({
      state,
      computed,
      profiles: store.profiles,
      activeProfileId: activeProfile.id,
      activeProfile,
      subscriptionSummary,
      canCreateProfile: store.profiles.length < FREE_DASHBOARD_LIMIT,
      set: (key, val) =>
        setStore((current) =>
          withActiveProfile(current, (profile) => ({
            ...profile,
            state: { ...profile.state, [key]: val },
            updatedAt: new Date().toISOString(),
          })),
        ),
      setExpense: (key, val) =>
        setStore((current) =>
          withActiveProfile(current, (profile) => ({
            ...profile,
            state: {
              ...profile.state,
              expenseItems: { ...profile.state.expenseItems, [key]: Math.max(0, val) },
            },
            updatedAt: new Date().toISOString(),
          })),
        ),
      createProfile: (opts) => {
        const baseState = opts?.state
          ? sanitizeState({
              ...state,
              ...opts.state,
              expenseItems: { ...state.expenseItems, ...(opts.state.expenseItems || {}) },
            })
          : state;
        const type = opts?.info?.dashboardType || "personal";
        const profile = makeProfile(baseState, {
          name:
            type === "business"
              ? `Business Dashboard ${store.profiles.length + 1}`
              : type === "investments"
                ? `Investments Dashboard ${store.profiles.length + 1}`
                : `Personal Dashboard ${store.profiles.length + 1}`,
          ...(opts?.info || {}),
        });
        setStore((current) => ({
          activeProfileId: profile.id,
          profiles: [...current.profiles, profile],
        }));
        return profile.id;
      },
      setActiveProfile: (id) =>
        setStore((current) =>
          current.profiles.some((profile) => profile.id === id)
            ? { ...current, activeProfileId: id }
            : current,
        ),
      updateProfile: (id, patch) =>
        setStore((current) => ({
          ...current,
          profiles: current.profiles.map((profile) =>
            profile.id === id
              ? {
                  ...profile,
                  ...patch,
                  name: patch.name !== undefined ? patch.name : profile.name,
                  dashboardType:
                    patch.dashboardType !== undefined ? patch.dashboardType : profile.dashboardType,
                  updatedAt: new Date().toISOString(),
                }
              : profile,
          ),
        })),
      deleteProfile: (id) =>
        setStore((current) => {
          if (current.profiles.length <= 1) return current;
          const profiles = current.profiles.filter((profile) => profile.id !== id);
          return {
            activeProfileId:
              current.activeProfileId === id ? profiles[0].id : current.activeProfileId,
            profiles,
          };
        }),
      reset: () =>
        setStore((current) =>
          withActiveProfile(current, (profile) => ({
            ...profile,
            state: cloneState(DEFAULT_STATE),
            updatedAt: new Date().toISOString(),
          })),
        ),
    }),
    [state, computed, store.profiles, activeProfile, subscriptionSummary],
  );

  return <EquationContext.Provider value={value}>{children}</EquationContext.Provider>;
}

export function useEquation() {
  const ctx = useContext(EquationContext);
  if (!ctx) throw new Error("useEquation must be used inside EquationProvider");
  return ctx;
}

export const STATUS_META: Record<Status, { label: string; color: string; chip: string }> = {
  sustainable: {
    label: "Sustainable",
    color: "text-[color:var(--success)]",
    chip: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  },
  thin: {
    label: "Tight",
    color: "text-[color:var(--warning)]",
    chip: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  },
  deficit: {
    label: "Deficit",
    color: "text-[color:var(--destructive)]",
    chip: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]",
  },
};

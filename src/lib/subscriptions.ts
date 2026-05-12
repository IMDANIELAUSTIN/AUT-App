import type { FiatCode } from "@/lib/equation";

export const SUBSCRIPTIONS_KEY = "fyi:subscriptions:v1";
export const SUBSCRIPTION_SETTINGS_KEY = "fyi:subscription-settings:v1";
export const SUBSCRIPTIONS_CHANGED_EVENT = "fyi:subscriptions-changed";
const SUBSCRIPTIONS_MIGRATION_KEY = `${SUBSCRIPTIONS_KEY}:profile-migration`;
const SUBSCRIPTION_SETTINGS_MIGRATION_KEY = `${SUBSCRIPTION_SETTINGS_KEY}:profile-migration`;

export const CATEGORIES = [
  "Entertainment",
  "Productivity",
  "Finance",
  "Utilities",
  "Health",
  "Housing",
  "Other",
] as const;
export const BILLING_CYCLES = ["Monthly", "Annual", "Weekly", "Quarterly", "Daily"] as const;
export const REMINDERS = ["None", "1 day", "3 days", "1 week"] as const;
export const ICONS = ["blue", "green", "yellow", "red", "purple", "slate"] as const;
export const IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;

export type Category = (typeof CATEGORIES)[number];
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type Reminder = (typeof REMINDERS)[number];
export type ServiceIcon = (typeof ICONS)[number];
export type SubscriptionImportance = (typeof IMPORTANCE_LEVELS)[number];

export type Subscription = {
  id: string;
  name: string;
  category: Category;
  icon: ServiceIcon;
  importance: SubscriptionImportance;
  price: number;
  currency: FiatCode;
  billingCycle: BillingCycle;
  nextPaymentDate: string;
  paymentTime: string;
  useSettingsTime: boolean;
  active: boolean;
  reminder: Reminder;
};

export type TrackerSettings = {
  monthlyBudget: number;
  currency: FiatCode;
  notificationTime: string;
};

export type SubscriptionRecommendation = {
  id: string;
  name: string;
  monthly: number;
  importance: SubscriptionImportance;
  category: Category;
};

export type SubscriptionSummary = {
  subscriptions: Subscription[];
  active: Subscription[];
  monthlyTotal: number;
  activeCount: number;
  lowImportanceTotal: number;
  recommendations: SubscriptionRecommendation[];
};

export const DEFAULT_SETTINGS: TrackerSettings = {
  monthlyBudget: 3690,
  currency: "USD",
  notificationTime: "05:00",
};

export function uid(prefix = "sub") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function money(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function makeSubscription(patch?: Partial<Subscription>): Subscription {
  return {
    id: uid(),
    name: "",
    category: "Entertainment",
    icon: "blue",
    importance: "medium",
    price: 0,
    currency: "USD",
    billingCycle: "Monthly",
    nextPaymentDate: new Date().toISOString().slice(0, 10),
    paymentTime: "05:00",
    useSettingsTime: true,
    active: true,
    reminder: "1 day",
    ...patch,
  };
}

export const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  makeSubscription({
    name: "ChatGPT Plus",
    category: "Productivity",
    price: 20,
    icon: "green",
    importance: "high",
    nextPaymentDate: "2026-05-20",
  }),
  makeSubscription({
    name: "Amazon Prime",
    category: "Entertainment",
    price: 7.49,
    icon: "blue",
    importance: "medium",
    nextPaymentDate: "2026-05-14",
  }),
  makeSubscription({
    name: "Apple Music",
    category: "Entertainment",
    price: 5.99,
    icon: "red",
    importance: "medium",
    nextPaymentDate: "2026-05-16",
  }),
  makeSubscription({
    name: "Google One (2TB)",
    category: "Utilities",
    price: 30,
    icon: "yellow",
    importance: "high",
    nextPaymentDate: "2026-05-23",
  }),
  makeSubscription({
    name: "Coinbase One",
    category: "Finance",
    price: 4.99,
    icon: "purple",
    importance: "low",
    nextPaymentDate: "2026-05-29",
  }),
  makeSubscription({
    name: "Spectrum Mobile",
    category: "Utilities",
    price: 120,
    icon: "slate",
    importance: "high",
    nextPaymentDate: "2026-06-01",
  }),
];

function scopedSubscriptionsKey(profileId?: string) {
  return profileId ? `${SUBSCRIPTIONS_KEY}:profile:${profileId}` : SUBSCRIPTIONS_KEY;
}

function scopedSettingsKey(profileId?: string) {
  return profileId
    ? `${SUBSCRIPTION_SETTINGS_KEY}:profile:${profileId}`
    : SUBSCRIPTION_SETTINGS_KEY;
}

export function isSubscriptionsStorageKey(key: string | null) {
  return Boolean(
    key &&
    (key === SUBSCRIPTIONS_KEY ||
      key.startsWith(`${SUBSCRIPTIONS_KEY}:profile:`) ||
      key === SUBSCRIPTION_SETTINGS_KEY ||
      key.startsWith(`${SUBSCRIPTION_SETTINGS_KEY}:profile:`)),
  );
}

export function monthlyAmount(subscription: Subscription) {
  if (!subscription.active) return 0;
  switch (subscription.billingCycle) {
    case "Daily":
      return subscription.price * 30.44;
    case "Weekly":
      return (subscription.price * 52) / 12;
    case "Monthly":
      return subscription.price;
    case "Quarterly":
      return subscription.price / 3;
    case "Annual":
      return subscription.price / 12;
  }
}

export function nextSubscriptionDays(date: string) {
  const due = new Date(`${date}T00:00:00`);
  const now = new Date();
  const diff = due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil(diff / 86_400_000);
}

export function formatSubscriptionDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sanitizeSubscription(value: unknown): Subscription | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Subscription>;
  return makeSubscription({
    id: typeof raw.id === "string" ? raw.id : uid(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled subscription",
    category: CATEGORIES.includes(raw.category as Category) ? raw.category : "Other",
    icon: ICONS.includes(raw.icon as ServiceIcon) ? raw.icon : "blue",
    importance: IMPORTANCE_LEVELS.includes(raw.importance as SubscriptionImportance)
      ? raw.importance
      : "medium",
    price: money(raw.price),
    currency: (["USD", "EUR", "GBP", "JPY", "CAD"] as FiatCode[]).includes(raw.currency as FiatCode)
      ? raw.currency
      : "USD",
    billingCycle: BILLING_CYCLES.includes(raw.billingCycle as BillingCycle)
      ? raw.billingCycle
      : "Monthly",
    nextPaymentDate:
      typeof raw.nextPaymentDate === "string"
        ? raw.nextPaymentDate
        : new Date().toISOString().slice(0, 10),
    paymentTime: typeof raw.paymentTime === "string" ? raw.paymentTime : "05:00",
    useSettingsTime: Boolean(raw.useSettingsTime),
    active: raw.active !== false,
    reminder: REMINDERS.includes(raw.reminder as Reminder) ? raw.reminder : "1 day",
  });
}

function readSubscriptionsFromStorage(key: string): Subscription[] | null {
  const parsed = JSON.parse(localStorage.getItem(key) || "null");
  if (!Array.isArray(parsed)) return null;
  return parsed.map(sanitizeSubscription).filter(Boolean) as Subscription[];
}

function readSettingsFromStorage(key: string): TrackerSettings | null {
  const parsed = JSON.parse(localStorage.getItem(key) || "null");
  if (!parsed || typeof parsed !== "object") return null;
  return {
    monthlyBudget: money(parsed.monthlyBudget, DEFAULT_SETTINGS.monthlyBudget),
    currency: (["USD", "EUR", "GBP", "JPY", "CAD"] as FiatCode[]).includes(parsed.currency)
      ? parsed.currency
      : "USD",
    notificationTime:
      typeof parsed.notificationTime === "string"
        ? parsed.notificationTime
        : DEFAULT_SETTINGS.notificationTime,
  };
}

export function loadSubscriptions(profileId?: string) {
  if (typeof window === "undefined") return DEFAULT_SUBSCRIPTIONS;
  try {
    const key = scopedSubscriptionsKey(profileId);
    const saved = readSubscriptionsFromStorage(key);
    if (saved) return saved.length ? saved : DEFAULT_SUBSCRIPTIONS;

    if (profileId && !localStorage.getItem(SUBSCRIPTIONS_MIGRATION_KEY)) {
      const legacy = readSubscriptionsFromStorage(SUBSCRIPTIONS_KEY);
      if (legacy) {
        localStorage.setItem(key, JSON.stringify(legacy));
        localStorage.setItem(SUBSCRIPTIONS_MIGRATION_KEY, profileId);
        return legacy.length ? legacy : DEFAULT_SUBSCRIPTIONS;
      }
    }

    return DEFAULT_SUBSCRIPTIONS;
  } catch {
    return DEFAULT_SUBSCRIPTIONS;
  }
}

export function loadSubscriptionSettings(profileId?: string) {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const key = scopedSettingsKey(profileId);
    const saved = readSettingsFromStorage(key);
    if (saved) return saved;

    if (profileId && !localStorage.getItem(SUBSCRIPTION_SETTINGS_MIGRATION_KEY)) {
      const legacy = readSettingsFromStorage(SUBSCRIPTION_SETTINGS_KEY);
      if (legacy) {
        localStorage.setItem(key, JSON.stringify(legacy));
        localStorage.setItem(SUBSCRIPTION_SETTINGS_MIGRATION_KEY, profileId);
        return legacy;
      }
    }

    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSubscriptions(subscriptions: Subscription[], profileId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedSubscriptionsKey(profileId), JSON.stringify(subscriptions));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_CHANGED_EVENT, { detail: { profileId } }));
}

export function saveSubscriptionSettings(settings: TrackerSettings, profileId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedSettingsKey(profileId), JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function getSubscriptionSummary(
  subscriptionsOrProfileId?: Subscription[] | string,
): SubscriptionSummary {
  const subscriptions = Array.isArray(subscriptionsOrProfileId)
    ? subscriptionsOrProfileId
    : loadSubscriptions(subscriptionsOrProfileId);
  const active = subscriptions.filter((sub) => sub.active);
  const recommendations = active
    .filter((sub) => sub.importance !== "high")
    .map((sub) => ({
      id: sub.id,
      name: sub.name,
      monthly: monthlyAmount(sub),
      importance: sub.importance,
      category: sub.category,
    }))
    .sort((a, b) => {
      const priority = { low: 0, medium: 1, high: 2 } satisfies Record<
        SubscriptionImportance,
        number
      >;
      return priority[a.importance] - priority[b.importance] || b.monthly - a.monthly;
    });

  return {
    subscriptions,
    active,
    monthlyTotal: active.reduce((sum, sub) => sum + monthlyAmount(sub), 0),
    activeCount: active.length,
    lowImportanceTotal: active
      .filter((sub) => sub.importance === "low")
      .reduce((sum, sub) => sum + monthlyAmount(sub), 0),
    recommendations,
  };
}

export function recommendedSubscriptionSavings(
  recommendations: SubscriptionRecommendation[],
  target: number,
) {
  let total = 0;
  const selected: SubscriptionRecommendation[] = [];
  for (const recommendation of recommendations) {
    if (total >= target) break;
    total += recommendation.monthly;
    selected.push(recommendation);
  }
  return { total, selected };
}

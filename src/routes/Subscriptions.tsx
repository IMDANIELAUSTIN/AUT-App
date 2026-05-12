import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  CalendarDays,
  Clock3,
  CreditCard,
  DollarSign,
  ImageIcon,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Button } from "@/components/openui/Button";
import { Input } from "@/components/openui/Input";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { BankTransactionsWidget } from "@/components/BankTransactionsWidget";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/openui/Select";
import { Switch } from "@/components/openui/Switch";
import { cn } from "@/lib/utils";
import { fmtFiat, useEquation, type FiatCode } from "@/lib/equation";
import {
  BILLING_CYCLES,
  CATEGORIES,
  ICONS,
  IMPORTANCE_LEVELS,
  REMINDERS,
  formatSubscriptionDate,
  loadSubscriptionSettings,
  loadSubscriptions,
  makeSubscription,
  money,
  monthlyAmount,
  nextSubscriptionDays,
  saveSubscriptionSettings,
  saveSubscriptions,
  type BillingCycle,
  type Category,
  type Reminder,
  type ServiceIcon,
  type Subscription,
  type SubscriptionImportance,
  type TrackerSettings,
} from "@/lib/subscriptions";

const ICON_META: Record<ServiceIcon, string> = {
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
  purple: "bg-violet-500",
  slate: "bg-slate-400",
};

export default function Subscriptions() {
  const { state, computed, activeProfile, activeProfileId } = useEquation();
  const [storageProfileId, setStorageProfileId] = useState(activeProfileId);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() =>
    loadSubscriptions(activeProfileId),
  );
  const [settings, setSettings] = useState<TrackerSettings>(() =>
    loadSubscriptionSettings(activeProfileId),
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Subscription | null>(null);

  useEffect(() => {
    setSubscriptions(loadSubscriptions(activeProfileId));
    setSettings(loadSubscriptionSettings(activeProfileId));
    setStorageProfileId(activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    if (storageProfileId !== activeProfileId) return;
    saveSubscriptions(subscriptions, activeProfileId);
  }, [activeProfileId, storageProfileId, subscriptions]);

  useEffect(() => {
    if (storageProfileId !== activeProfileId) return;
    saveSubscriptionSettings(settings, activeProfileId);
  }, [activeProfileId, storageProfileId, settings]);

  const active = subscriptions.filter((sub) => sub.active);
  const monthlyTotal = active.reduce((sum, sub) => sum + monthlyAmount(sub), 0);
  const annualTotal = monthlyTotal * 12;
  const filtered = subscriptions.filter((sub) =>
    `${sub.name} ${sub.category} ${sub.importance}`.toLowerCase().includes(query.toLowerCase()),
  );
  const upcoming = active
    .slice()
    .sort(
      (a, b) => nextSubscriptionDays(a.nextPaymentDate) - nextSubscriptionDays(b.nextPaymentDate),
    )
    .slice(0, 4);
  const effectiveHourlyWage = Math.max(0, computed.netHourlyWage);
  const isBusinessDashboard = activeProfile.dashboardType === "business";

  const saveSubscription = (next: Subscription) => {
    const clean = { ...next, name: next.name.trim() || "Untitled subscription" };
    setSubscriptions((current) =>
      current.some((sub) => sub.id === clean.id)
        ? current.map((sub) => (sub.id === clean.id ? clean : sub))
        : [clean, ...current],
    );
    setEditing(null);
  };

  const removeSubscription = (id: string) => {
    setSubscriptions((current) => current.filter((sub) => sub.id !== id));
  };

  const toggleActive = (id: string, activeState: boolean) => {
    setSubscriptions((current) =>
      current.map((sub) => (sub.id === id ? { ...sub, active: activeState } : sub)),
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {isBusinessDashboard ? "Expenses" : "Subscription Tracker"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isBusinessDashboard
              ? "Track recurring expenses, imported transactions, renewal dates, and monthly pressure."
              : "Track recurring bills, renewal dates, reminders, and monthly subscription pressure."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            setEditing(
              makeSubscription({
                currency: settings.currency,
                paymentTime: settings.notificationTime,
              }),
            )
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add Subscription
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Monthly spend"
              value={fmtFiat(monthlyTotal, settings.currency)}
              sub={`${active.length} active subscriptions`}
            />
            <MetricCard
              label="Annualized"
              value={fmtFiat(annualTotal, settings.currency)}
              sub="Projected recurring cost"
            />
            <MetricCard
              label="Budget usage"
              value={`${settings.monthlyBudget > 0 ? Math.round((monthlyTotal / settings.monthlyBudget) * 100) : 0}%`}
              sub={`${fmtFiat(settings.monthlyBudget, settings.currency)} monthly budget`}
            />
            <MetricCard
              label="Next payment"
              value={upcoming[0] ? upcoming[0].name : "None"}
              sub={
                upcoming[0]
                  ? formatSubscriptionDate(upcoming[0].nextPaymentDate)
                  : "No active renewals"
              }
            />
          </div>

          <Card>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <CardTitle>Subscriptions</CardTitle>
              <label className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search subscriptions"
                  className="pl-9"
                />
              </label>
            </CardHeader>
            <CardBody>
              <div className="grid gap-2">
                {filtered.map((subscription) => (
                  <SubscriptionRow
                    key={subscription.id}
                    subscription={subscription}
                    monthly={monthlyAmount(subscription)}
                    currency={settings.currency}
                    hourlyWage={effectiveHourlyWage}
                    onEdit={() => setEditing(subscription)}
                    onDelete={() => removeSubscription(subscription.id)}
                    onToggle={(checked) => toggleActive(subscription.id, checked)}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Payments</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {upcoming.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/35 p-3 sharp-edge"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{subscription.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatSubscriptionDate(subscription.nextPaymentDate)} at{" "}
                      {subscription.useSettingsTime
                        ? settings.notificationTime
                        : subscription.paymentTime}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary sharp-edge">
                    {nextSubscriptionDays(subscription.nextPaymentDate)}d
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <TrackerSettingsCard
            settings={settings}
            monthlyTotal={monthlyTotal}
            onApplyDefaultTime={() =>
              setSubscriptions((current) =>
                current.map((subscription) => ({
                  ...subscription,
                  paymentTime: settings.notificationTime,
                  useSettingsTime: true,
                })),
              )
            }
            onChange={setSettings}
          />
        </div>
      </div>

      <SubscriptionDialog
        open={Boolean(editing)}
        subscription={editing}
        settingsTime={settings.notificationTime}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={saveSubscription}
      />

      {isBusinessDashboard && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ProjectedTransactionsTable />
          <BankTransactionsWidget limit={20} />
        </div>
      )}
    </div>
  );
}

function ProjectedTransactionsTable() {
  const { state, computed } = useEquation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projected Month Over Month</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Month</th>
                <th className="text-right">Income</th>
                <th className="text-right">Expenses</th>
                <th className="text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {computed.series.map((item) => (
                <tr key={item.month} className="sharp-divider-t">
                  <td className="py-2">{item.month} 2026</td>
                  <td className="text-right tabular">{fmtFiat(item.income, state.fiat)}</td>
                  <td className="text-right tabular">{fmtFiat(item.expenses, state.fiat)}</td>
                  <td
                    className={cn(
                      "text-right tabular",
                      item.net >= 0
                        ? "text-[color:var(--success)]"
                        : "text-[color:var(--destructive)]",
                    )}
                  >
                    {fmtFiat(item.net, state.fiat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 truncate font-display text-2xl font-semibold tabular text-foreground">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>
      </CardBody>
    </Card>
  );
}

function SubscriptionRow({
  subscription,
  monthly,
  currency,
  hourlyWage,
  onEdit,
  onDelete,
  onToggle,
}: {
  subscription: Subscription;
  monthly: number;
  currency: FiatCode;
  hourlyWage: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (checked: boolean) => void;
}) {
  const days = nextSubscriptionDays(subscription.nextPaymentDate);
  return (
    <div className="grid gap-3 rounded-lg bg-surface-2/35 p-3 sharp-edge md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-bold text-white sharp-edge",
            ICON_META[subscription.icon],
          )}
        >
          <SubscriptionLogo name={subscription.name} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {subscription.name}
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sharp-edge">
              {subscription.category}
            </span>
            <ImportanceBadge importance={subscription.importance} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {fmtFiat(subscription.price, subscription.currency)} /{" "}
              {subscription.billingCycle.toLowerCase()}
            </span>
            <span>{fmtFiat(monthly, currency)} / mo</span>
            <span>{formatWorkTime(monthly, hourlyWage)} / mo</span>
            <span>{days >= 0 ? `${days} days left` : `${Math.abs(days)} days overdue`}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Active <Switch checked={subscription.active} onCheckedChange={onToggle} />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Edit subscription"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete subscription"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ImportanceBadge({ importance }: { importance: SubscriptionImportance }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize sharp-edge",
        importance === "low" && "bg-[color:var(--success)]/15 text-[color:var(--success)]",
        importance === "medium" && "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
        importance === "high" && "bg-primary/15 text-primary",
      )}
    >
      {importance}
    </span>
  );
}

function TrackerSettingsCard({
  settings,
  monthlyTotal,
  onApplyDefaultTime,
  onChange,
}: {
  settings: TrackerSettings;
  monthlyTotal: number;
  onApplyDefaultTime: () => void;
  onChange: (settings: TrackerSettings) => void;
}) {
  const budgetPct = settings.monthlyBudget > 0 ? (monthlyTotal / settings.monthlyBudget) * 100 : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracker Settings</CardTitle>
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardBody className="space-y-3">
        <SettingRow
          icon={<DollarSign className="h-4 w-4" />}
          label="Monthly Budget"
          sub={`Current spending: ${fmtFiat(monthlyTotal, settings.currency)}`}
        >
          <div className="text-right">
            <Input
              type="number"
              min="0"
              value={settings.monthlyBudget}
              onChange={(event) =>
                onChange({ ...settings, monthlyBudget: money(event.target.value) })
              }
              className="w-32 text-right"
            />
            <div
              className={cn(
                "mt-1 text-[11px]",
                budgetPct > 90 ? "text-[color:var(--destructive)]" : "text-[color:var(--warning)]",
              )}
            >
              {budgetPct.toFixed(0)}%
            </div>
          </div>
        </SettingRow>
        <SettingRow
          icon={<CreditCard className="h-4 w-4" />}
          label="Currency"
          sub="Preferred tracker currency"
        >
          <Select
            value={settings.currency}
            onValueChange={(value) => onChange({ ...settings, currency: value as FiatCode })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["USD", "EUR", "GBP", "JPY", "CAD"] as FiatCode[]).map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          icon={<Bell className="h-4 w-4" />}
          label="Notification Time"
          sub="Default reminder time"
        >
          <Input
            type="time"
            value={settings.notificationTime}
            onChange={(event) => onChange({ ...settings, notificationTime: event.target.value })}
            className="w-32"
          />
        </SettingRow>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onApplyDefaultTime}
        >
          Apply default time to subscriptions
        </Button>
      </CardBody>
    </Card>
  );
}

function SettingRow({
  icon,
  label,
  sub,
  children,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-2/35 p-3 sharp-edge">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {children}
    </div>
  );
}

function SubscriptionDialog({
  open,
  subscription,
  settingsTime,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  subscription: Subscription | null;
  settingsTime: string;
  onOpenChange: (open: boolean) => void;
  onSave: (subscription: Subscription) => void;
}) {
  const [draft, setDraft] = useState<Subscription>(() => subscription || makeSubscription());

  useEffect(() => {
    if (subscription) setDraft(subscription);
  }, [subscription]);

  if (!subscription) return null;

  const update = <K extends keyof Subscription>(key: K, value: Subscription[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                {subscription.name ? "Edit Subscription" : "Add Subscription"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Recurring service details, billing cadence, payment timing, and reminders.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close subscription editor">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-4">
            <div className="grid gap-5">
              <FormSection title="Basic Information">
                <FormField icon={<Tag />} label="Subscription Name">
                  <Input
                    value={draft.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="e.g., Netflix, Dropbox"
                  />
                </FormField>
                <FormField icon={<CreditCard />} label="Category">
                  <Select
                    value={draft.category}
                    onValueChange={(value) => update("category", value as Category)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField icon={<Bell />} label="Subscription Importance">
                  <Select
                    value={draft.importance}
                    onValueChange={(value) => update("importance", value as SubscriptionImportance)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORTANCE_LEVELS.map((importance) => (
                        <SelectItem key={importance} value={importance}>
                          {importance[0].toUpperCase() + importance.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField icon={<ImageIcon />} label="Service Icon">
                  <div className="grid grid-cols-6 gap-2">
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => update("icon", icon)}
                        className={cn(
                          "h-9 rounded-md sharp-edge",
                          ICON_META[icon],
                          draft.icon === icon && "ring-2 ring-ring",
                        )}
                        aria-label={`${icon} icon`}
                      />
                    ))}
                  </div>
                </FormField>
              </FormSection>

              <FormSection title="Financial Details">
                <div className="grid gap-3 md:grid-cols-3">
                  <FormField icon={<DollarSign />} label="Price">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(event) => update("price", money(event.target.value))}
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField icon={<CreditCard />} label="Currency">
                    <Select
                      value={draft.currency}
                      onValueChange={(value) => update("currency", value as FiatCode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["USD", "EUR", "GBP", "JPY", "CAD"] as FiatCode[]).map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField icon={<CalendarDays />} label="Billing Cycle">
                    <Select
                      value={draft.billingCycle}
                      onValueChange={(value) => update("billingCycle", value as BillingCycle)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_CYCLES.map((cycle) => (
                          <SelectItem key={cycle} value={cycle}>
                            {cycle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Payment Details">
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField icon={<CalendarDays />} label="Next Payment Date">
                    <Input
                      type="date"
                      value={draft.nextPaymentDate}
                      onChange={(event) => update("nextPaymentDate", event.target.value)}
                    />
                  </FormField>
                  <FormField icon={<Clock3 />} label="Payment Time">
                    <Input
                      type="time"
                      value={draft.useSettingsTime ? settingsTime : draft.paymentTime}
                      disabled={draft.useSettingsTime}
                      onChange={(event) => update("paymentTime", event.target.value)}
                    />
                  </FormField>
                </div>
                <ToggleRow
                  label="Use settings time for this subscription"
                  checked={draft.useSettingsTime}
                  onCheckedChange={(checked) => update("useSettingsTime", checked)}
                />
                <ToggleRow
                  label="Active Subscription"
                  checked={draft.active}
                  onCheckedChange={(checked) => update("active", checked)}
                />
              </FormSection>

              <FormSection title="Reminder Settings">
                <FormField icon={<Bell />} label="Payment Reminders">
                  <Select
                    value={draft.reminder}
                    onValueChange={(value) => update("reminder", value as Reminder)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDERS.map((reminder) => (
                        <SelectItem key={reminder} value={reminder}>
                          {reminder}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormSection>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sharp-divider-t px-5 py-4">
            <span className="text-xs text-muted-foreground">
              Monthly impact:{" "}
              <span className="font-semibold text-foreground">
                {fmtFiat(monthlyAmount(draft), draft.currency)}
              </span>
            </span>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button size="sm" onClick={() => onSave(draft)}>
                Save
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function FormField({
  icon,
  label,
  children,
}: {
  icon: ReactElement<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2 font-semibold text-foreground">
        {cloneElement(icon, { className: "h-3.5 w-3.5 text-muted-foreground" })}
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/35 p-3 text-sm font-semibold sharp-edge">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function formatWorkTime(amount: number, hourlyWage: number) {
  if (hourlyWage <= 0) return "No wage";
  const hours = amount / hourlyWage;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)} hrs`;
}

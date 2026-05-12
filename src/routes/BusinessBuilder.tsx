import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  Briefcase,
  Save,
  Plus,
  Trash2,
  Lightbulb,
  Target,
  DollarSign,
  Users,
  Wand2,
  Heart,
  X,
} from "lucide-react";
import { Button } from "@/components/openui/Button";
import { FREE_DASHBOARD_LIMIT, useEquation, fmtFiat } from "@/lib/equation";
import { OPEN_SUPPORT_EVENT } from "@/lib/stripeDonation";

type Offer = { id: string; name: string; price: number; hours: number };

type Plan = {
  businessName: string;
  tagline: string;
  problem: string;
  audience: string;
  channels: string;
  monthlyCustomers: number;
  offers: Offer[];
};

const STORAGE_KEY = "fyi:business-plan:v1";

const DEFAULT_PLAN: Plan = {
  businessName: "",
  tagline: "",
  problem: "",
  audience: "",
  channels: "",
  monthlyCustomers: 10,
  offers: [{ id: "o1", name: "Core service", price: 250, hours: 4 }],
};

function loadPlan(): Plan {
  if (typeof window === "undefined") return DEFAULT_PLAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN;
    return { ...DEFAULT_PLAN, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PLAN;
  }
}

export default function BusinessBuilder() {
  const {
    state,
    computed,
    canCreateProfile,
    createProfile,
    profiles,
    activeProfileId,
    setActiveProfile,
  } = useEquation();
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [paywallOpen, setPaywallOpen] = useState(false);

  const save = (next: Plan) => {
    setPlan(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const totals = useMemo(() => {
    const perCustomer = plan.offers.reduce((s, o) => s + (Number(o.price) || 0), 0);
    const hoursPerCustomer = plan.offers.reduce((s, o) => s + (Number(o.hours) || 0), 0);
    const projectedRevenue = perCustomer * plan.monthlyCustomers;
    const projectedHours = hoursPerCustomer * plan.monthlyCustomers;
    const gap = computed.expenses - projectedRevenue;
    return { perCustomer, hoursPerCustomer, projectedRevenue, projectedHours, gap };
  }, [plan, computed.expenses]);

  const updateOffer = (id: string, patch: Partial<Offer>) => {
    save({ ...plan, offers: plan.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };

  const addOffer = () => {
    save({
      ...plan,
      offers: [
        ...plan.offers,
        { id: `o${Date.now().toString(36)}`, name: "New offer", price: 0, hours: 1 },
      ],
    });
  };

  const removeOffer = (id: string) => {
    save({ ...plan, offers: plan.offers.filter((o) => o.id !== id) });
  };

  const convertToProfile = () => {
    if (!canCreateProfile) {
      setPaywallOpen(true);
      return;
    }
    const name = plan.businessName.trim() || "Business plan";
    // Derive monthly wage equivalent from projected revenue
    const monthlyHours = Math.max(totals.projectedHours || 1, 1);
    const id = createProfile({
      info: {
        dashboardType: "business",
        name,
        role: plan.tagline || "Founder",
        location: plan.audience,
        notes: `${plan.problem}\n\nChannels: ${plan.channels}\nProjected monthly revenue: ${fmtFiat(totals.projectedRevenue, state.fiat)}`,
      },
      state: {
        wageAmount: totals.projectedRevenue,
        payFreq: "monthly",
        timeUnit: "month",
        hoursPerUnit: monthlyHours,
      },
    });
    toast.success("Profile saved", {
      description: `${name} is now active.`,
      action: {
        label: "View saved profile",
        onClick: () => {
          setActiveProfile(id);
          window.location.assign("/budget");
        },
      },
    });
  };

  const applyProfileToBudget = (id: string) => {
    setActiveProfile(id);
    const p = profiles.find((x) => x.id === id);
    toast.success(`Switched to ${p?.name || "profile"}`, {
      description: "Budget and metrics now use this profile's wage, hours, and expenses.",
      action: { label: "Open Budget", onClick: () => window.location.assign("/budget") },
    });
  };

  return (
    <div className="space-y-6 px-4 py-5 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Business builder
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Design a service that closes your gap
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sketch a service or business idea. Compare projected revenue against your current
            expenses ({fmtFiat(computed.expenses, state.fiat)}) and convert the plan into a saved
            profile when it's ready.
          </p>
        </div>
        <Button onClick={convertToProfile} size="md">
          <Save className="h-4 w-4" /> Save business dashboard
        </Button>
      </header>

      <BusinessBuilderPaywall open={paywallOpen} onOpenChange={setPaywallOpen} />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface sharp-edge-card p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Lightbulb className="inline h-3.5 w-3.5 mr-1" /> Concept
          </h2>
          <Field label="Business name">
            <input
              value={plan.businessName}
              onChange={(e) => save({ ...plan, businessName: e.target.value })}
              className={inp}
              placeholder="Acme Studio"
            />
          </Field>
          <Field label="Tagline / role">
            <input
              value={plan.tagline}
              onChange={(e) => save({ ...plan, tagline: e.target.value })}
              className={inp}
              placeholder="Independent product designer"
            />
          </Field>
          <Field label="Problem you solve">
            <textarea
              value={plan.problem}
              onChange={(e) => save({ ...plan, problem: e.target.value })}
              rows={3}
              className={`${inp} min-h-20 py-2`}
              placeholder="Founders need landing pages fast..."
            />
          </Field>
          <Field label="Audience">
            <input
              value={plan.audience}
              onChange={(e) => save({ ...plan, audience: e.target.value })}
              className={inp}
              placeholder="Pre-seed SaaS founders"
            />
          </Field>
          <Field label="Channels">
            <input
              value={plan.channels}
              onChange={(e) => save({ ...plan, channels: e.target.value })}
              className={inp}
              placeholder="LinkedIn, referrals, cold email"
            />
          </Field>
        </div>

        <div className="rounded-xl bg-surface sharp-edge-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <DollarSign className="inline h-3.5 w-3.5 mr-1" /> Offers
            </h2>
            <Button size="sm" variant="outline" onClick={addOffer}>
              <Plus className="h-3.5 w-3.5" /> Add offer
            </Button>
          </div>
          <div className="space-y-2">
            {plan.offers.map((o) => (
              <div key={o.id} className="rounded-lg bg-surface-2/50 p-3 sharp-edge space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={o.name}
                    onChange={(e) => updateOffer(o.id, { name: e.target.value })}
                    className={`${inp} flex-1`}
                    placeholder="Offer name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOffer(o.id)}
                    aria-label="Remove offer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Price">
                    <input
                      type="number"
                      value={o.price}
                      onChange={(e) => updateOffer(o.id, { price: Number(e.target.value) })}
                      className={inp}
                    />
                  </Field>
                  <Field label="Hours / customer">
                    <input
                      type="number"
                      value={o.hours}
                      onChange={(e) => updateOffer(o.id, { hours: Number(e.target.value) })}
                      className={inp}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <Field label="Customers per month">
            <input
              type="number"
              value={plan.monthlyCustomers}
              onChange={(e) => save({ ...plan, monthlyCustomers: Number(e.target.value) })}
              className={inp}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Revenue / customer" value={fmtFiat(totals.perCustomer, state.fiat)} />
        <Stat
          label="Projected monthly revenue"
          value={fmtFiat(totals.projectedRevenue, state.fiat)}
        />
        <Stat label="Projected monthly hours" value={`${totals.projectedHours.toFixed(0)} hrs`} />
        <Stat
          label="Gap vs expenses"
          value={fmtFiat(totals.gap, state.fiat)}
          tone={totals.gap <= 0 ? "good" : "bad"}
        />
      </section>

      <section className="rounded-xl bg-surface sharp-edge-card p-5">
        <div className="flex items-start gap-3">
          <Target className="h-4 w-4 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            {totals.gap <= 0
              ? `This plan covers your current expenses with ${fmtFiat(Math.abs(totals.gap), state.fiat)} surplus.`
              : `You'd still need ${fmtFiat(totals.gap, state.fiat)} more in monthly revenue to fully cover expenses. Try raising prices or adding customers.`}
          </div>
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          {profiles.length}/{FREE_DASHBOARD_LIMIT} free dashboards saved. Use "Save business
          dashboard" to snapshot this plan.
        </div>
      </section>

      <section className="rounded-xl bg-surface sharp-edge-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Users className="inline h-3.5 w-3.5 mr-1" /> Apply a saved profile
          </h2>
          <Link to="/budget" className="text-[11px] text-primary hover:underline">
            Open Budget →
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a saved profile to instantly update the budget and metrics with its wage, hours, and
          expenses.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyProfileToBudget(p.id)}
                className={`flex items-start justify-between gap-3 rounded-lg p-3 text-left transition-colors sharp-edge ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-surface-2/40 hover:bg-muted text-foreground"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name || "Untitled"}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {p.dashboardType === "business"
                      ? "Business"
                      : p.dashboardType === "investments"
                        ? "Investments"
                        : "Personal"}{" "}
                    • {fmtFiat(p.state.wageAmount, p.state.fiat)} / {p.state.payFreq} •{" "}
                    {p.state.hoursPerUnit}h / {p.state.timeUnit}
                  </div>
                </div>
                <Wand2 className="h-4 w-4 shrink-0 opacity-70" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BusinessBuilderPaywall({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                Unlock full app
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Five dashboards are free for the creator. Donate $99 to unlock additional dashboards
                and keep building.
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
                  <div className="text-sm font-semibold text-foreground">$99 full app unlock</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Additional Personal, Business, and Investments dashboards are paywalled for
                    future development revenue.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sharp-divider-t px-5 py-4">
            <Dialog.Close asChild>
              <Button type="button" size="sm" variant="outline">
                Not now
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT));
              }}
            >
              <Heart className="h-3.5 w-3.5 fill-current" /> Donate $99
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const inp =
  "h-9 w-full rounded-md bg-input px-3 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-surface sharp-edge-card p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-display text-xl font-semibold tabular ${
          tone === "good"
            ? "text-[color:var(--success)]"
            : tone === "bad"
              ? "text-[color:var(--destructive)]"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

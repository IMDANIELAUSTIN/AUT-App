import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import {
  fmtFiat,
  fmtRatio,
  getBusinessTaxOrganization,
  STATUS_META,
  useEquation,
} from "@/lib/equation";
import { recommendedSubscriptionSavings, type SubscriptionSummary } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, CircleDot, X, XCircle } from "lucide-react";

type Insight = { text: string; tone: "good" | "warning" | "danger" | "neutral" };

export function QuickInsightsWidget({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const { computed, state, subscriptionSummary, activeProfile } = useEquation();
  const status = STATUS_META[computed.status];
  const insights = buildInsights(computed, subscriptionSummary, state.fiat, activeProfile);

  return (
    <Card className={cn("group relative", className)}>
      <CardHeader className="flex-wrap">
        <CardTitle>Quick Insights</CardTitle>
        <div className="flex items-center gap-2">
          <span
            className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium sharp-edge", status.chip)}
          >
            {activeProfile.dashboardType === "investments" ? "Market" : status.label}
          </span>
          {onClose && (
            <button
              type="button"
              aria-label="Close Quick Insights"
              onClick={onClose}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <ul className="grid gap-3 text-xs md:grid-cols-3">
          {insights.map((insight) => (
            <li
              key={insight.text}
              className={cn(
                "flex gap-3 rounded-lg bg-surface-2/45 p-3 leading-relaxed sharp-edge",
                insight.tone === "danger" && "bg-[color:var(--destructive)]/10",
                insight.tone === "warning" && "bg-[color:var(--warning)]/10",
                insight.tone === "good" && "bg-[color:var(--success)]/10",
              )}
            >
              <InsightIcon tone={insight.tone} />
              <span className="text-foreground/90">{insight.text}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function InsightIcon({ tone }: { tone: Insight["tone"] }) {
  const Icon =
    tone === "danger"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : tone === "good"
          ? CheckCircle2
          : CircleDot;
  return (
    <Icon
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0",
        tone === "danger" && "text-[color:var(--destructive)]",
        tone === "warning" && "text-[color:var(--warning)]",
        tone === "good" && "text-[color:var(--success)]",
        tone === "neutral" && "text-muted-foreground",
      )}
    />
  );
}

function buildInsights(
  c: ReturnType<typeof useEquation>["computed"],
  subscriptions: SubscriptionSummary,
  fiat: ReturnType<typeof useEquation>["state"]["fiat"],
  activeProfile: ReturnType<typeof useEquation>["activeProfile"],
): Insight[] {
  if (activeProfile.dashboardType === "investments") {
    return [
      {
        text: `${activeProfile.name || "Investments Dashboard"} is focused on market movement, data source quality, and watchlist monitoring.`,
        tone: "neutral",
      },
      {
        text: "Use Data Source to confirm whether prices are live from Yahoo Finance or running on local fallback data.",
        tone: "warning",
      },
      {
        text: "Keep watchlists focused by theme, risk, or time horizon so future investment metrics stay easier to scan.",
        tone: "good",
      },
    ];
  }

  const out: Insight[] = [];
  if (activeProfile.dashboardType === "business") {
    const organization = getBusinessTaxOrganization(activeProfile.businessTaxOrganization);
    const role = activeProfile.role.trim() || "Business Owner";
    const roleModifier = businessRoleTaxModifier(role);
    const estimatedRate = organization.estimatedRate * roleModifier;
    const businessIncome = c.gross || c.income;
    const estimatedMonthlyTax = Math.max(0, businessIncome * estimatedRate);

    out.push({
      text: `${activeProfile.name || "Business Dashboard"} is using your active profile details${activeProfile.role ? ` for ${activeProfile.role}` : ""}.`,
      tone: "neutral",
    });
    out.push({
      text: `${organization.label} tax planning for ${role} estimates ${fmtFiat(estimatedMonthlyTax, fiat)} / mo at ${(estimatedRate * 100).toFixed(1)}% of business income.`,
      tone: estimatedRate >= 0.25 ? "warning" : "neutral",
    });
  }

  if (c.ratio < 1)
    out.push({
      text: "Your income ratio is below 1.0x. Expenses exceed take-home pay.",
      tone: "danger",
    });
  else if (c.ratio < 1.2)
    out.push({ text: "Your income ratio is below the ideal 1.2x buffer.", tone: "warning" });
  else
    out.push({ text: `Income comfortably covers expenses (${fmtRatio(c.ratio)}).`, tone: "good" });

  const gap = c.breakEvenHrs - c.monthlyHours;
  if (gap > 1)
    out.push({ text: `Work ${gap.toFixed(1)} more hours / mo to break even.`, tone: "warning" });
  else
    out.push({ text: `You are ${Math.abs(gap).toFixed(1)} hrs above break-even.`, tone: "good" });

  if (subscriptions.monthlyTotal > 0) {
    const deficit = Math.max(0, c.expenses - c.income);
    const reviewTarget = deficit || Math.max(0, c.expenses - c.income / 1.2);
    const recommendation = subscriptions.recommendations[0];
    if (recommendation && reviewTarget > 0) {
      const savings = recommendedSubscriptionSavings(subscriptions.recommendations, reviewTarget);
      const names = savings.selected
        .map((sub) => sub.name)
        .slice(0, 2)
        .join(", ");
      out.push({
        text: `Subscriptions add ${fmtFiat(subscriptions.monthlyTotal, fiat)} to Expenses (M). Review ${names || recommendation.name} first to improve sustainability.`,
        tone: deficit > 0 ? "danger" : "warning",
      });
    } else if (recommendation) {
      out.push({
        text: `${recommendation.name} is the first optional subscription to review at ${fmtFiat(recommendation.monthly, fiat)} / mo.`,
        tone: "neutral",
      });
    } else {
      out.push({
        text: `Subscriptions add ${fmtFiat(subscriptions.monthlyTotal, fiat)} / mo; all active items are marked high importance.`,
        tone: "neutral",
      });
    }
  } else {
    out.push({
      text: "Add subscriptions to include recurring costs in Expenses (M).",
      tone: "neutral",
    });
  }
  return out.slice(0, 3);
}

function businessRoleTaxModifier(role: string) {
  if (/contractor|freelance|consultant|creator|owner|founder|partner/i.test(role)) return 1.05;
  if (/employee|staff|associate|assistant/i.test(role)) return 0.9;
  return 1;
}

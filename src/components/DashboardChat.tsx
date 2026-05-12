import { Bot, ChevronDown, Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/openui/Button";
import { EXPENSE_FIELDS, STATUS_META, fmtFiat, fmtRatio, useEquation } from "@/lib/equation";
import { recommendedSubscriptionSavings } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

const CHAT_ENDPOINT_KEY = "fyi:chat-endpoint";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type DashboardContext = ReturnType<typeof useDashboardContext>;

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DashboardChat() {
  const context = useDashboardContext();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid("assistant"),
      role: "assistant",
      content: "Ask me about your income, expenses, break-even hours, or what to adjust next. I use the live dashboard values from the active profile.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, collapsed]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;

    const userMessage: ChatMessage = { id: uid("user"), role: "user", content: prompt };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusy(true);

    const previousMessages = [...messages, userMessage];
    const modelReply = await requestModelReply(previousMessages, context);
    const reply = modelReply || buildLocalDashboardReply(prompt, context);
    setMessages((current) => [...current, { id: uid("assistant"), role: "assistant", content: reply }]);
    setBusy(false);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setCollapsed(false);
        }}
        className="fixed bottom-24 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring md:bottom-20"
        aria-label="Open dashboard chat"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Chat</span>
      </button>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed inset-x-3 bottom-20 z-30 flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-left sharp-edge-card md:left-auto md:right-5 md:bottom-20 md:w-96"
        aria-label="Expand dashboard chat"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary sharp-edge">
            <Bot className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Dashboard chat</span>
            <span className="block truncate text-[11px] text-muted-foreground">Collapsed. Tap to continue.</span>
          </span>
        </span>
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden" aria-hidden="true" />
      <section
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-surface sharp-edge-card",
          "inset-0 md:inset-auto md:bottom-5 md:right-5 md:h-[540px] md:w-[390px] md:rounded-xl",
        )}
        aria-label="Dashboard chat"
      >
        <div className="flex items-start justify-between gap-3 sharp-divider-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary sharp-edge">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">Dashboard chat</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {context.profileName} | {STATUS_META[context.status].label}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse dashboard chat">
              <Minimize2 className="hidden h-4 w-4 md:block" />
              <ChevronDown className="h-4 w-4 md:hidden" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close dashboard chat">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-surface-2/30 px-4 py-3 text-[11px] sharp-divider-b">
          <ChatMetric label="Income" value={fmtFiat(context.income, context.fiat, { compact: true })} />
          <ChatMetric label="Expenses" value={fmtFiat(context.expenses, context.fiat, { compact: true })} />
          <ChatMetric label="Ratio" value={fmtRatio(context.ratio)} />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed sharp-edge",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-surface-2/60 text-foreground",
              )}
            >
              {message.content}
            </div>
          ))}
          {busy && (
            <div className="inline-flex rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-muted-foreground sharp-edge">
              Reading dashboard context...
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={send} className="sharp-divider-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              rows={2}
              placeholder="Ask about your dashboard..."
              className="min-h-11 flex-1 resize-none rounded-lg bg-input px-3 py-2 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send chat message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Uses live dashboard context. Set {CHAT_ENDPOINT_KEY} in localStorage to route messages to a secure LLM endpoint.
          </div>
        </form>
      </section>
    </>
  );
}

function ChatMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="truncate font-semibold tabular text-foreground">{value}</div>
    </div>
  );
}

function useDashboardContext() {
  const { state, computed, activeProfile, subscriptionSummary } = useEquation();
  return useMemo(() => {
    const fixedExpenseItems = EXPENSE_FIELDS
      .map((field) => ({ label: field.label, value: Number(state.expenseItems[field.key]) || 0 }))
      .sort((a, b) => b.value - a.value);
    const topExpense = [
      ...fixedExpenseItems,
      { label: "Subscriptions", value: subscriptionSummary.monthlyTotal },
    ].sort((a, b) => b.value - a.value)[0];

    return {
      profileName: activeProfile.name || "Current dashboard",
      role: activeProfile.role,
      location: activeProfile.location,
      notes: activeProfile.notes,
      fiat: state.fiat,
      payFreq: state.payFreq,
      wageAmount: state.wageAmount,
      hoursPerUnit: state.hoursPerUnit,
      timeUnit: state.timeUnit,
      effort: state.effort,
      income: computed.income,
      gross: computed.gross,
      expenses: computed.expenses,
      surplus: computed.surplus,
      ratio: computed.ratio,
      status: computed.status,
      monthlyHours: computed.monthlyHours,
      breakEvenHrs: computed.breakEvenHrs,
      netHourlyWage: computed.netHourlyWage,
      topExpense,
      baseExpenses: computed.baseExpenses,
      subscriptionExpenses: computed.subscriptionExpenses,
      activeSubscriptions: subscriptionSummary.activeCount,
      subscriptionRecommendations: subscriptionSummary.recommendations,
    };
  }, [activeProfile, computed, state, subscriptionSummary]);
}

async function requestModelReply(messages: ChatMessage[], context: DashboardContext) {
  if (typeof window === "undefined") return null;
  const endpoint = localStorage.getItem(CHAT_ENDPOINT_KEY);
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dashboard-assistant",
        dashboard: context,
        messages: [
          {
            role: "system",
            content: "You are a concise financial dashboard assistant. Use only the provided dashboard context unless the user asks a general conceptual question.",
          },
          ...messages.map(({ role, content }) => ({ role, content })),
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (
      data.reply ||
      data.content ||
      data.message?.content ||
      data.choices?.[0]?.message?.content ||
      null
    );
  } catch {
    return null;
  }
}

function buildLocalDashboardReply(prompt: string, c: DashboardContext) {
  const q = prompt.toLowerCase();
  const surplusLabel = c.surplus >= 0 ? "surplus" : "deficit";
  const surplusAmount = fmtFiat(Math.abs(c.surplus), c.fiat);

  if (q.includes("expense") || q.includes("spend") || q.includes("cost")) {
    return `Your monthly expenses are ${fmtFiat(c.expenses, c.fiat)}, including ${fmtFiat(c.subscriptionExpenses, c.fiat)} from ${c.activeSubscriptions} active subscriptions. The largest line item is ${c.topExpense.label} at ${fmtFiat(c.topExpense.value, c.fiat)}. If you want immediate leverage, start there or review low/medium importance subscriptions.`;
  }

  if (q.includes("subscription") || q.includes("cancel") || q.includes("remove")) {
    const target = Math.max(0, c.expenses - c.income) || Math.max(0, c.expenses - (c.income / 1.2));
    const savings = recommendedSubscriptionSavings(c.subscriptionRecommendations, target);
    if (!c.activeSubscriptions) return "You do not have active subscriptions in the tracker yet. Add them and they will automatically flow into Expenses (M).";
    if (!c.subscriptionRecommendations.length) return `Subscriptions add ${fmtFiat(c.subscriptionExpenses, c.fiat)} / mo, but every active subscription is marked high importance. Mark optional subscriptions as low or medium so I can curate better cuts.`;
    const names = savings.selected.map((sub) => `${sub.name} (${fmtFiat(sub.monthly, c.fiat)})`).join(", ");
    return `Subscriptions add ${fmtFiat(c.subscriptionExpenses, c.fiat)} / mo to Expenses (M). Based on importance, review ${names || c.subscriptionRecommendations[0].name} first${target > 0 ? `; the current target is about ${fmtFiat(target, c.fiat)} / mo to improve sustainability.` : "."}`;
  }

  if (q.includes("income") || q.includes("take home") || q.includes("pay") || q.includes("wage")) {
    return `Your current take-home income is ${fmtFiat(c.income, c.fiat)} from ${fmtFiat(c.gross, c.fiat)} gross. The active wage input is ${fmtFiat(c.wageAmount, c.fiat)} / ${c.payFreq}, with ${c.hoursPerUnit} hours / ${c.timeUnit}.`;
  }

  if (q.includes("ratio") || q.includes("sustainable") || q.includes("status") || q.includes("safe")) {
    return `Your status is ${STATUS_META[c.status].label}. The income / expense ratio is ${fmtRatio(c.ratio)}, and the dashboard shows a ${surplusLabel} of ${surplusAmount}. A 1.2x ratio is the first practical buffer target.`;
  }

  if (q.includes("hour") || q.includes("time") || q.includes("break")) {
    const gap = c.breakEvenHrs - c.monthlyHours;
    const direction = gap > 0
      ? `${gap.toFixed(1)} more hours this month to break even`
      : `${Math.abs(gap).toFixed(1)} hours above break-even this month`;
    return `You are working ${c.monthlyHours.toFixed(1)} hours / month. Break-even is ${c.breakEvenHrs.toFixed(1)} hours, so you are ${direction}. Net hourly value is ${fmtFiat(c.netHourlyWage, c.fiat)}.`;
  }

  if (q.includes("what should") || q.includes("recommend") || q.includes("next") || q.includes("improve")) {
    if (c.ratio < 1) {
      const first = c.subscriptionRecommendations[0];
      return `Priority: close the ${surplusAmount} monthly deficit. ${first ? `Start by reviewing ${first.name}, marked ${first.importance} importance at ${fmtFiat(first.monthly, c.fiat)} / mo, then test income changes in the live chart.` : "Test one income increase and one expense reduction in the live chart, then compare which one moves the ratio closest to 1.0x first."}`;
    }
    if (c.ratio < 1.2) {
      return `Priority: build margin. You are above break-even but below a 1.2x buffer. Try nudging income up or expenses down until the ratio clears 1.2x.`;
    }
    return `Priority: optimize time. Income covers expenses at ${fmtRatio(c.ratio)}, so compare scenarios that reduce hours while preserving your target surplus.`;
  }

  return `For ${c.profileName}, take-home income is ${fmtFiat(c.income, c.fiat)}, expenses are ${fmtFiat(c.expenses, c.fiat)}, and the dashboard is showing a ${surplusLabel} of ${surplusAmount}. Ask about income, expenses, ratio, or break-even hours for a sharper answer.`;
}

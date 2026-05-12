import { jsPDF } from "jspdf";
import {
  EXPENSE_FIELDS,
  STATUS_META,
  fmtFiat,
  fmtRatio,
  type Computed,
  type EquationProfile,
  type EquationState,
} from "@/lib/equation";
import { loadGoalSnapshots, loadGoalTargets, type GoalTargets } from "@/lib/goalsStorage";

type ReportMode = "download" | "print";

type ReportInput = {
  state: EquationState;
  computed: Computed;
  activeProfile: EquationProfile;
};

const moneyOptions = { compact: false };

function defaultTargets(state: EquationState, computed: Computed): GoalTargets {
  return {
    wage: Math.round(computed.income),
    expenses: Math.round(computed.expenses),
    savings: Math.round(state.expenseItems.savings || 500),
    hours: Math.round(computed.monthlyHours),
    surplus: Math.max(500, Math.round(computed.surplus)),
  };
}

function percent(current: number, target: number, higherIsBetter = true) {
  if (target <= 0) return "0%";
  const raw = higherIsBetter ? (current / target) * 100 : (target / Math.max(current, 1)) * 100;
  return `${Math.max(0, Math.min(999, raw)).toFixed(0)}%`;
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 26, 24);
  doc.text(title, 18, y);
  doc.setDrawColor(225, 231, 228);
  doc.line(18, y + 3, 192, y + 3);
}

function addRows(doc: jsPDF, rows: Array<[string, string]>, startY: number) {
  let y = startY;
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(97, 107, 103);
    doc.text(label, 18, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 26, 24);
    doc.text(value, 192, y, { align: "right" });
    y += 7;
  });
  return y;
}

function ensurePage(doc: jsPDF, y: number) {
  if (y <= 270) return y;
  doc.addPage();
  return 22;
}

function buildReportPdf({ state, computed, activeProfile }: ReportInput) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const targets = loadGoalTargets(defaultTargets(state, computed), activeProfile.id);
  const snapshots = loadGoalSnapshots(activeProfile.id).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const status = STATUS_META[computed.status];
  const reportDate = new Date();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 26, 24);
  doc.text("FYI | Find Your Income", 18, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(97, 107, 103);
  doc.text(`Profile: ${activeProfile.name || "Current dashboard"}`, 18, 27);
  doc.text(`Generated: ${reportDate.toLocaleString()}`, 192, 27, { align: "right" });

  let y = 40;

  addSectionTitle(doc, "Goals", y);
  y = addRows(
    doc,
    [
      ["Net income target", fmtFiat(targets.wage, state.fiat, moneyOptions)],
      ["Expense target", fmtFiat(targets.expenses, state.fiat, moneyOptions)],
      ["Savings allocation target", fmtFiat(targets.savings, state.fiat, moneyOptions)],
      ["Work hours target", `${targets.hours.toFixed(0)} h / mo`],
      ["Surplus target", fmtFiat(targets.surplus, state.fiat, moneyOptions)],
      ["Annual surplus target", fmtFiat(targets.surplus * 12, state.fiat, moneyOptions)],
    ],
    y + 12,
  );

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 26, 24);
  doc.text("Current progress", 18, y);
  y += 8;
  y = addRows(
    doc,
    [
      [
        "Net income",
        `${fmtFiat(computed.income, state.fiat, moneyOptions)} / ${fmtFiat(targets.wage, state.fiat, moneyOptions)} (${percent(computed.income, targets.wage)})`,
      ],
      [
        "Expenses",
        `${fmtFiat(computed.expenses, state.fiat, moneyOptions)} / ${fmtFiat(targets.expenses, state.fiat, moneyOptions)} (${percent(computed.expenses, targets.expenses, false)})`,
      ],
      [
        "Savings allocation",
        `${fmtFiat(state.expenseItems.savings, state.fiat, moneyOptions)} / ${fmtFiat(targets.savings, state.fiat, moneyOptions)} (${percent(state.expenseItems.savings, targets.savings)})`,
      ],
      [
        "Work hours",
        `${computed.monthlyHours.toFixed(0)} h / ${targets.hours.toFixed(0)} h (${percent(computed.monthlyHours, targets.hours, false)})`,
      ],
      [
        "Surplus",
        `${fmtFiat(computed.surplus, state.fiat, moneyOptions)} / ${fmtFiat(targets.surplus, state.fiat, moneyOptions)} (${percent(computed.surplus, targets.surplus)})`,
      ],
    ],
    y,
  );

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 26, 24);
  doc.text("Recent snapshots", 18, y);
  y += 8;
  if (snapshots.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(97, 107, 103);
    doc.text("No goal snapshots logged yet.", 18, y);
    y += 8;
  } else {
    snapshots.slice(0, 6).forEach((snapshot) => {
      y = ensurePage(doc, y);
      const date = new Date(snapshot.date).toLocaleDateString();
      y = addRows(
        doc,
        [
          [
            date,
            `${fmtFiat(snapshot.surplus, state.fiat, moneyOptions)} surplus | ${snapshot.hours.toFixed(0)} h`,
          ],
        ],
        y,
      );
    });
  }

  y = ensurePage(doc, y + 8);
  addSectionTitle(doc, "Budget Results", y);
  y = addRows(
    doc,
    [
      ["Status", status.label],
      ["Monthly income potential", fmtFiat(computed.income, state.fiat, moneyOptions)],
      ["Gross monthly income", fmtFiat(computed.gross, state.fiat, moneyOptions)],
      ["Monthly expenses", fmtFiat(computed.expenses, state.fiat, moneyOptions)],
      [
        computed.surplus >= 0 ? "Net surplus" : "Net deficit",
        fmtFiat(computed.surplus, state.fiat, moneyOptions),
      ],
      ["Income / expense ratio", fmtRatio(computed.ratio)],
      ["Effective hourly wage", fmtFiat(computed.netHourlyWage, state.fiat, moneyOptions)],
      ["Pre-tax hourly wage", fmtFiat(computed.hourlyWage, state.fiat, moneyOptions)],
      ["Break-even hours", `${computed.breakEvenHrs.toFixed(1)} h / mo`],
      ["Monthly hours worked", `${computed.monthlyHours.toFixed(1)} h`],
      ["Tax estimate", `${(computed.taxRate * 100).toFixed(1)}%`],
      [
        "Pay setup",
        `${fmtFiat(state.wageAmount, state.fiat, moneyOptions)} / ${state.payFreq}; ${state.hoursPerUnit} h / ${state.timeUnit}; ${state.effort}x effort`,
      ],
    ],
    y + 12,
  );

  y = ensurePage(doc, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 26, 24);
  doc.text("Expense inputs", 18, y);
  y += 8;
  EXPENSE_FIELDS.forEach((field) => {
    y = ensurePage(doc, y);
    y = addRows(
      doc,
      [[field.label, fmtFiat(state.expenseItems[field.key], state.fiat, moneyOptions)]],
      y,
    );
  });

  return doc;
}

export function exportDashboardReport(input: ReportInput, mode: ReportMode) {
  const doc = buildReportPdf(input);
  const filename = `FYI-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (mode === "print") {
    doc.autoPrint();
    const url = doc.output("bloburl");
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) doc.save(filename);
    return;
  }

  doc.save(filename);
}

import { describe, expect, it } from "vitest";
import { computeAll, DEFAULT_STATE, type EquationState } from "@/lib/equation";

function stateWith(patch: Partial<EquationState>): EquationState {
  return {
    ...DEFAULT_STATE,
    ...patch,
    expenseItems: { ...DEFAULT_STATE.expenseItems, ...(patch.expenseItems || {}) },
    tax: { ...DEFAULT_STATE.tax, ...(patch.tax || {}) },
  };
}

describe("computeAll", () => {
  it("classifies positive income with zero expenses as sustainable", () => {
    const computed = computeAll(
      stateWith({
        expenseItems: {
          rent: 0,
          groceries: 0,
          utilities: 0,
          transportation: 0,
          healthInsurance: 0,
          contingency: 0,
          savings: 0,
          recreational: 0,
        },
        wageAmount: 1_000,
        payFreq: "weekly",
        taxEnabled: false,
      }),
    );

    expect(computed.expenses).toBe(0);
    expect(computed.income).toBeGreaterThan(0);
    expect(computed.ratio).toBe(Number.POSITIVE_INFINITY);
    expect(computed.status).toBe("sustainable");
  });
});

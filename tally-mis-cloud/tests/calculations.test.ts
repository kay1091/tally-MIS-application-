import { describe, expect, it } from "vitest";
import { calculateMetrics, getTrialBalanceValue } from "../src/lib/calculations";
import { sampleState } from "../src/lib/sampleData";

describe("financial calculations", () => {
  it("extracts exact trial balance ledger values", () => {
    expect(getTrialBalanceValue(sampleState, "Product Sales - Software")).toBe(-35500000);
    expect(getTrialBalanceValue(sampleState, "Missing Ledger")).toBe(0);
  });

  it("calculates core MIS metrics without render-scope dependencies", () => {
    const metrics = calculateMetrics(sampleState);

    expect(metrics.totalRevenue).toBe(49700000);
    expect(metrics.totalCOGS).toBe(25700000);
    expect(metrics.grossProfit).toBe(24000000);
    expect(metrics.pbt).toBe(6500000);
    expect(metrics.taxProvision).toBe(1625000);
    expect(metrics.pat).toBe(4875000);
  });

  it("calculates working capital and GST metrics", () => {
    const metrics = calculateMetrics(sampleState);

    expect(metrics.workingCapital).toBeGreaterThan(0);
    expect(metrics.gstCollected).toBe(907200);
    expect(metrics.gstClaimed).toBe(522000);
    expect(metrics.gstNetPayable).toBe(385200);
  });
});

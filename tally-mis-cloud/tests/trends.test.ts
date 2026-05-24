import { describe, expect, it } from "vitest";
import { sampleState } from "../src/lib/sampleData";
import { replaceGeneratedTrendRow, reportingPeriodLabel } from "../src/lib/trends";

describe("monthly trend generation", () => {
  it("labels the uploaded reporting period by the period end month", () => {
    expect(reportingPeriodLabel("1-Apr-26 to 30-Apr-26")).toBe("Apr-26");
  });

  it("replaces demo trend rows with one generated current-period row", () => {
    const nextState = replaceGeneratedTrendRow({
      ...sampleState,
      reportingPeriod: "1-Apr-26 to 30-Apr-26"
    });

    expect(nextState.monthlyTrends).toHaveLength(2);
    expect(nextState.monthlyTrends[1][0]).toBe("Apr-26");
    expect(nextState.monthlyTrends[1][1]).toBe(49700000);
  });
});

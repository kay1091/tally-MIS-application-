import { describe, expect, it } from "vitest";
import { parseTallyWorkbook } from "../src/lib/uploadParser";
import { sampleState } from "../src/lib/sampleData";

class TestFile extends File {
  constructor(content: string, name: string) {
    super([content], name, { type: "text/csv" });
  }
}

describe("Tally upload parser", () => {
  it("drops Tally trial balance title rows and merges balance headers", async () => {
    const csv = [
      "Macro Automation Solutions India Pvt Ltd FY 2025-2026,,,,",
      "Trial Balance,,,,",
      "1-Apr-26 to 30-Dec-26,,,,",
      ",Macro Automation Solutions India Pvt Ltd FY 2025-2026,Macro Automation Solutions India Pvt Ltd FY 2025-2026,Macro Automation Solutions India Pvt Ltd FY 2025-2026,Macro Automation Solutions India Pvt Ltd FY 2025-2026",
      "Particulars,1-Apr-26 to 30-Dec-26,1-Apr-26 to 30-Dec-26,1-Apr-26 to 30-Dec-26,1-Apr-26 to 30-Dec-26",
      ",Opening,Transactions,Transactions,Closing",
      ",Balance,Debit,Credit,Balance",
      "Capital Account,29342697.8,,,29342697.8"
    ].join("\n");

    const result = await parseTallyWorkbook(new TestFile(csv, "Trial Balance.csv"), sampleState);

    expect(result.accepted).toBe(true);
    expect(result.nextState.companyName).toBe("Macro Automation Solutions India Pvt Ltd");
    expect(result.nextState.financialYear).toBe("FY 2025-26");
    expect(result.nextState.reportingPeriod).toBe("1-Apr-26 to 30-Dec-26");
    expect(result.nextState.rawTrialBalance[0]).toEqual([
      "Particulars",
      "Opening Balance",
      "Transactions Debit",
      "Transactions Credit",
      "Closing Balance"
    ]);
    expect(result.nextState.rawTrialBalance[1][0]).toBe("Capital Account");
  });

  it("drops Tally daybook address rows and keeps register headers", async () => {
    const csv = [
      "Macro Automation Solutions India Pvt Ltd FY 2025-2026,,,,",
      "No:109,Aishwaryam Nagar,,,,",
      "Sales Register,,,,",
      "1-Apr-26 to 30-Apr-26,,,,",
      "Date,Particulars,Voucher Type,Voucher No.,Value,Gross Total,Output CGST 9%,Output SGST 9%",
      "2026-04-13T00:00:00.000Z,Brakes India Pvt Ltd,Sales,GST001/26-27,3500000,4130000,315000,315000"
    ].join("\n");

    const result = await parseTallyWorkbook(new TestFile(csv, "Sales Register.csv"), sampleState);

    expect(result.accepted).toBe(true);
    expect(result.nextState.rawSales[0][0]).toBe("Date");
    expect(result.nextState.rawSales[0][1]).toBe("Particulars");
    expect(result.nextState.rawSales[1][1]).toBe("Brakes India Pvt Ltd");
  });

  it("maps purchase registers to purchases instead of sales", async () => {
    const csv = [
      "Macro Automation Solutions India Pvt Ltd FY 2025-2026,,,,",
      "Purchase Register,,,,",
      "1-Apr-26 to 30-Apr-26,,,,",
      "Date,Particulars,Voucher Type,Voucher No.,Value,Gross Total,Input CGST 9%,Input SGST 9%",
      "2026-04-01T00:00:00.000Z,BHARATH OXYGEN LICENSEE,Purchase,111,375,443,33.75,33.75"
    ].join("\n");

    const result = await parseTallyWorkbook(new TestFile(csv, "Purchase Register.csv"), sampleState);

    expect(result.accepted).toBe(true);
    expect(result.mappedSheets).toEqual(["rawPurchases"]);
    expect(result.nextState.rawPurchases[1][1]).toBe("BHARATH OXYGEN LICENSEE");
  });
});

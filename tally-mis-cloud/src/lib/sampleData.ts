import type { AppState } from "./types";

export const sampleState: AppState = {
  companyName: "Apex Technologies Pvt Ltd",
  financialYear: "FY 2025-26",
  reportingPeriod: "March 2026",
  currency: "INR",
  rawTrialBalance: [
    ["Ledger Name", "Parent Group", "Opening Balance", "Debit", "Credit", "Closing Balance"],
    ["Share Capital", "Capital Account", -5000000, 0, 0, -5000000],
    ["Retained Earnings", "Reserves & Surplus", -4215000, 0, 850000, -5065000],
    ["HDFC Bank Term Loan", "Secured Loans", -3000000, 500000, 0, -2500000],
    ["Director's Unsecured Loan", "Unsecured Loans", -1500000, 0, 200000, -1700000],
    ["Office Premises (Owned)", "Fixed Assets", 8500000, 0, 0, 8500000],
    ["Computers & IT Equipment", "Fixed Assets", 1200000, 150000, 0, 1350000],
    ["Office Furniture", "Fixed Assets", 600000, 50000, 0, 650000],
    ["Accumulated Depreciation", "Fixed Assets", -1800000, 0, 320000, -2120000],
    ["Inventory (Finished Goods)", "Current Assets", 2450000, 4800000, 4350000, 2900000],
    ["Sundry Debtors (Receivables)", "Current Assets", 3450000, 6844000, 6420000, 3874000],
    ["Cash in Hand", "Current Assets", 125000, 450000, 420000, 155000],
    ["HDFC Bank Current A/c", "Current Assets", 1850000, 12450000, 11620000, 2680000],
    ["ICICI Corporate A/c", "Current Assets", 950000, 8200000, 8050000, 1100000],
    ["GST Input Tax Credit (ITC)", "Current Assets", 180000, 1084200, 1150000, 114200],
    ["Sundry Creditors (Payables)", "Current Liabilities", -2100000, 4850000, 5320000, -2570000],
    ["GST Output CGST Payable", "Current Liabilities", -85000, 540000, 612000, -157000],
    ["GST Output SGST Payable", "Current Liabilities", -85000, 540000, 612000, -157000],
    ["GST Output IGST Payable", "Current Liabilities", -120000, 820000, 940000, -240000],
    ["TDS Payable (Contractors/Rent)", "Current Liabilities", -45000, 280000, 310000, -75000],
    ["Salary Payable", "Current Liabilities", -480000, 5800000, 5920000, -600000],
    ["Product Sales - Software", "Sales Accounts", 0, 0, 35500000, -35500000],
    ["Consulting Service Revenue", "Sales Accounts", 0, 0, 14200000, -14200000],
    ["Purchase of Software Stock", "Purchase Accounts", 0, 21500000, 0, 21500000],
    ["Direct Subcontracting Costs", "Direct Expenses", 0, 4200000, 0, 4200000],
    ["Employee Salaries & Benefits", "Indirect Expenses", 0, 11200000, 0, 11200000],
    ["Office Rent & Maintenance", "Indirect Expenses", 0, 2400000, 0, 2400000],
    ["Professional & CA Fees", "Indirect Expenses", 0, 650000, 0, 650000],
    ["Travel & Conveyance Expenses", "Indirect Expenses", 0, 820000, 0, 820000],
    ["Sales & Marketing Expenses", "Indirect Expenses", 0, 1450000, 0, 1450000],
    ["Power, Fuel & Internet", "Indirect Expenses", 0, 380000, 0, 380000],
    ["Finance Interest Charges", "Indirect Expenses", 0, 280000, 0, 280000],
    ["Depreciation & Amortization", "Indirect Expenses", 0, 320000, 0, 320000]
  ],
  rawSales: [
    ["Date", "Invoice No", "Customer Name", "State", "Product/Service", "Quantity", "Taxable Value", "GST", "Invoice Value"],
    ["2026-03-02", "INV-2526-891", "Tech Mahindra Ltd", "Maharashtra", "Enterprise License V3", 10, 1200000, 216000, 1416000],
    ["2026-03-05", "INV-2526-892", "HDFC Bank Corporate", "Maharashtra", "Consulting & Cloud Migration", 1, 850000, 153000, 1003000],
    ["2026-03-09", "INV-2526-893", "Reliance Retail Ltd", "Gujarat", "Enterprise License V3", 5, 600000, 108000, 708000],
    ["2026-03-18", "INV-2526-896", "Airtel Digital", "Delhi", "Enterprise License V3", 12, 1440000, 259200, 1699200],
    ["2026-03-22", "INV-2526-897", "TCS Global", "Tamil Nadu", "Custom Module Build", 1, 950000, 171000, 1121000]
  ],
  rawPurchases: [
    ["Date", "Vendor Name", "Bill No", "Expense Category", "Taxable Value", "GST", "Total Amount"],
    ["2026-03-01", "Amazon Web Services", "AWS-MAR-902", "Direct Subcontracting Costs", 850000, 153000, 1003000],
    ["2026-03-04", "Microsoft Cloud India", "MS-90132", "Purchase of Software Stock", 1200000, 216000, 1416000],
    ["2026-03-10", "Red Hat Enterprise", "RH-893", "Purchase of Software Stock", 650000, 117000, 767000],
    ["2026-03-14", "Prestige Corporate Space", "RENT-26-03", "Office Rent & Maintenance", 200000, 36000, 236000]
  ],
  rawReceivables: [
    ["Customer", "Outstanding", "0-30 Days", "31-60 Days", "61-90 Days", "Above 90 Days"],
    ["Tech Mahindra Ltd", 1416000, 1416000, 0, 0, 0],
    ["HDFC Bank Corporate", 1003000, 1003000, 0, 0, 0],
    ["Reliance Retail Ltd", 708000, 708000, 0, 0, 0],
    ["TCS Global", 240000, 0, 0, 240000, 0]
  ],
  rawPayables: [
    ["Vendor", "Outstanding", "0-30 Days", "31-60 Days", "61-90 Days", "Above 90 Days"],
    ["Amazon Web Services", 1003000, 1003000, 0, 0, 0],
    ["Microsoft Cloud India", 767000, 767000, 0, 0, 0],
    ["Red Hat Enterprise", 450000, 0, 450000, 0, 0],
    ["Prestige Corporate Space", 236000, 236000, 0, 0, 0]
  ],
  rawStockSummary: [
    ["Item Name", "Category", "Opening Qty", "Purchase Qty", "Sales Qty", "Closing Qty", "Closing Value"],
    ["Enterprise License V3", "Software", 45, 120, 112, 53, 1060000],
    ["Developer Toolkits Pack", "Software", 80, 240, 210, 110, 880000],
    ["API Fintech Suite Keys", "Software", 35, 90, 85, 40, 480000],
    ["Cloud Integration Modules", "Software", 15, 60, 55, 20, 480000]
  ],
  monthlyTrends: [
    ["Month", "Revenue", "COGS", "Gross Profit", "Indirect Expenses", "EBITDA", "Net Profit", "Receivables", "Payables", "Closing Stock", "Cash Balance"],
    ["Oct-25", 4000000, 2100000, 1900000, 1280000, 620000, 440000, 3200000, 1980000, 2600000, 2900000],
    ["Nov-25", 4350000, 2300000, 2050000, 1340000, 710000, 510000, 3450000, 2180000, 2480000, 3200000],
    ["Dec-25", 4600000, 2420000, 2180000, 1360000, 820000, 590000, 3700000, 2300000, 2700000, 3350000],
    ["Jan-26", 4500000, 2380000, 2120000, 1350000, 770000, 550000, 3600000, 2150000, 2750000, 3500000],
    ["Feb-26", 4800000, 2550000, 2250000, 1400000, 850000, 610000, 3850000, 2400000, 2650000, 3650000],
    ["Mar-26", 4970000, 2570000, 2400000, 1420000, 980000, 715000, 3874000, 2570000, 2900000, 3780000]
  ]
};

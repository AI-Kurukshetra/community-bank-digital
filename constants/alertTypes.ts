export const ALERT_TYPES = {
  large_transaction: {
    label: "Large transaction",
    defaultThresholdPence: 100_000
  },
  low_balance: {
    label: "Low balance",
    defaultThresholdPence: 2_500
  },
  salary_received: {
    label: "Salary received",
    defaultThresholdPence: 0
  },
  unusual_activity: {
    label: "Unusual activity",
    defaultThresholdPence: 0
  },
  bill_due: {
    label: "Bill due",
    defaultThresholdPence: 5_000
  }
} as const;

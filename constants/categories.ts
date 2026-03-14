export const CATEGORIES = [
  "food_drink",
  "shopping",
  "transport",
  "bills",
  "entertainment",
  "health",
  "salary",
  "transfer",
  "other"
] as const;

export type Category = typeof CATEGORIES[number];

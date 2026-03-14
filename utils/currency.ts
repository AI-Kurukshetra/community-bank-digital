export const formatGBP = (pence: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);

export const poundsToPence = (pounds: number): number =>
  Math.round(pounds * 100);

export const penceToPounds = (pence: number): number =>
  pence / 100;

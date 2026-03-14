export const maskAccountNumber = (n: string): string =>
  `**** ${n.slice(-4)}`;

export const maskSortCode = (s: string): string => {
  const parts = s.split("-");

  if (parts.length !== 3) {
    return s;
  }

  return `${parts[0]}-**-${parts[2]}`;
};

export const maskCardNumber = (c: string): string => {
  const digits = c.replace(/\s/g, "");

  return `**** **** **** ${digits.slice(-4)}`;
};

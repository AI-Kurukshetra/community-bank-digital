export const validateUKSortCode = (s: string): boolean =>
  /^\d{2}-\d{2}-\d{2}$/.test(s.trim());

export const validateUKAccountNumber = (s: string): boolean =>
  /^\d{8}$/.test(s.trim());

export const validateIBAN = (s: string): boolean =>
  /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(
    s.trim().replace(/\s/g, "").toUpperCase()
  );

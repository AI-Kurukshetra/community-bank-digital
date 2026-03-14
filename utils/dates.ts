import {
  formatDistanceToNow,
  isToday as fnsIsToday,
  isYesterday
} from "date-fns";

export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat("en-GB").format(new Date(date));

export const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));

export const formatRelative = (date: string | Date): string => {
  const d = new Date(date);

  if (fnsIsToday(d)) {
    return "Today";
  }

  if (isYesterday(d)) {
    return "Yesterday";
  }

  return formatDistanceToNow(d, { addSuffix: true });
};

export const isToday = (date: string | Date): boolean =>
  fnsIsToday(new Date(date));

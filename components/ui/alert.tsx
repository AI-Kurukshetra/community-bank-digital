import * as React from "react";

import { cn } from "@/lib/utils";

export const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950",
      className
    )}
    ref={ref}
    {...props}
  />
));

Alert.displayName = "Alert";

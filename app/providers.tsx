"use client";

import { Suspense } from "react";

import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationProgressProvider } from "@/contexts/NavigationProgressContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AuthProvider>{children}</AuthProvider>}>
      <NavigationProgressProvider>
        <AuthProvider>{children}</AuthProvider>
      </NavigationProgressProvider>
    </Suspense>
  );
}

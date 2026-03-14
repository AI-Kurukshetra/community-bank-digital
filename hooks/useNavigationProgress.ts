"use client";

import { useContext } from "react";

import { NavigationProgressContext } from "@/contexts/NavigationProgressContext";

const fallbackNavigationProgress = {
  isNavigating: false,
  startNavigation: () => {},
  stopNavigation: () => {}
};

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);

  return context ?? fallbackNavigationProgress;
}

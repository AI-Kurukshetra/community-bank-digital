"use client";

import {
  createContext,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type NavigationProgressContextValue = {
  isNavigating: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
};

export const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

const STALE_TIMEOUT_MS = 10_000;

export function NavigationProgressProvider({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const currentSearch = searchParams.toString();

  function clearTimer() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function stopNavigation() {
    clearTimer();
    setIsNavigating(false);
  }

  function startNavigation() {
    clearTimer();
    setIsNavigating(true);
    timeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      timeoutRef.current = null;
    }, STALE_TIMEOUT_MS);
  }

  useEffect(() => {
    stopNavigation();
  }, [pathname, currentSearch]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? (event.target.closest("a[href]") as HTMLAnchorElement | null)
          : null;

      if (!target || target.target === "_blank" || target.hasAttribute("download")) {
        return;
      }

      const href = target.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const nextUrl = new URL(target.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.origin !== currentUrl.origin ||
        (nextUrl.pathname === currentUrl.pathname &&
          nextUrl.search === currentUrl.search)
      ) {
        return;
      }

      startNavigation();
    }

    function handlePopState() {
      startNavigation();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      clearTimer();
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <NavigationProgressContext.Provider
      value={{
        isNavigating,
        startNavigation,
        stopNavigation
      }}
    >
      {children}
      {isNavigating ? (
        <div className="pointer-events-none fixed inset-0 z-[120]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2440a8_0%,#4b66e8_45%,#f17ab1_100%)] shadow-[0_0_25px_rgba(79,102,232,0.55)]" />
          <div className="absolute right-4 top-4 rounded-full border border-white/70 bg-white/85 p-3 text-[#2440a8] shadow-[0_18px_40px_rgba(32,56,128,0.22)] backdrop-blur sm:right-6 sm:top-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </div>
      ) : null}
    </NavigationProgressContext.Provider>
  );
}

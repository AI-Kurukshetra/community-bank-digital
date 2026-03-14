"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { useNavigationProgress } from "@/hooks/useNavigationProgress";
import { Button, type ButtonProps } from "@/components/ui/button";

function hasInternalReferrer() {
  try {
    if (!document.referrer) {
      return false;
    }

    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function BackButton({
  fallbackHref,
  label,
  size = "default",
  variant = "outline",
  className
}: {
  fallbackHref: string;
  label: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();

  function handleClick() {
    startNavigation();

    if (hasInternalReferrer()) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button
      className={className}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}

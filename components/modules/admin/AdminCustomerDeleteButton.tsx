"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useNavigationProgress } from "@/hooks/useNavigationProgress";

export function AdminCustomerDeleteButton({
  customerId,
  customerName,
  onDeleted,
  redirectTo,
  triggerClassName,
  triggerLabel = "Delete",
  triggerVariant = "outline"
}: {
  customerId: string;
  customerName: string;
  onDeleted?: () => void;
  redirectTo?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/admin/customers/${customerId}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to delete customer.");
      }

      setOpen(false);
      onDeleted?.();

      if (redirectTo) {
        startNavigation();
        router.push(redirectTo);
        router.refresh();
        return;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete customer."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className={triggerClassName}
        onClick={() => setOpen(true)}
        type="button"
        variant={triggerVariant}
      >
        {triggerLabel}
      </Button>

      <Dialog
        description={`Delete ${customerName} permanently? This only works when no linked banking or audit records remain.`}
        onOpenChange={setOpen}
        open={open}
        title="Delete customer"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            If this customer already has accounts, payments, fraud alerts, or audit
            history, the delete will be blocked and you should suspend the profile
            instead.
          </p>

          {errorMessage ? (
            <Alert className="border-red-200 bg-red-50 text-red-900">
              {errorMessage}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
              onClick={() => void handleDelete()}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete customer"
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

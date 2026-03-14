"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const statusSchema = z.enum(["active", "suspended"]);

const createCustomerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  full_name: z.string().trim().min(2, "Enter the customer's full name."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/\d/, "Password must contain at least one number."),
  phone: z.string().trim().max(30, "Phone number is too long."),
  status: statusSchema
});

const updateCustomerSchema = createCustomerSchema.omit({ password: true });

type CustomerStatus = z.infer<typeof statusSchema>;

type EditableCustomer = {
  email: string | null;
  full_name: string;
  id: string;
  phone: string | null;
  status: string;
};

type FormValues = {
  email: string;
  full_name: string;
  password: string;
  phone: string;
  status: CustomerStatus;
};

function getInitialValues(customer?: EditableCustomer): FormValues {
  return {
    email: customer?.email ?? "",
    full_name: customer?.full_name ?? "",
    password: "",
    phone: customer?.phone ?? "",
    status: customer?.status === "suspended" ? "suspended" : "active"
  };
}

export function AdminCustomerFormDialog({
  customer,
  mode,
  onSuccess,
  triggerClassName,
  triggerLabel,
  triggerVariant = "outline"
}: {
  customer?: EditableCustomer;
  mode: "create" | "edit";
  onSuccess?: (payload: { id?: string; success: boolean }) => void;
  triggerClassName?: string;
  triggerLabel: string;
  triggerVariant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(getInitialValues(customer));

  useEffect(() => {
    if (open) {
      setFormValues(getInitialValues(customer));
      setErrorMessage(null);
    }
  }, [customer, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const schema = mode === "create" ? createCustomerSchema : updateCustomerSchema;
    const parsed = schema.safeParse(formValues);

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Invalid request.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/v1/admin/customers" : `/api/v1/admin/customers/${customer?.id}`,
        {
          body: JSON.stringify(parsed.data),
          headers: {
            "Content-Type": "application/json"
          },
          method: mode === "create" ? "POST" : "PATCH"
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to save customer.");
      }

      setOpen(false);
      router.refresh();
      onSuccess?.({
        id: payload.id,
        success: true
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save customer."
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
        description={
          mode === "create"
            ? "Create a customer login and profile together."
            : "Update the customer's profile and authentication details."
        }
        onOpenChange={setOpen}
        open={open}
        title={mode === "create" ? "Create customer" : "Edit customer"}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-customer-full-name`}>Full name</Label>
            <Input
              id={`${mode}-customer-full-name`}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  full_name: event.target.value
                }))
              }
              value={formValues.full_name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-customer-email`}>Email</Label>
            <Input
              id={`${mode}-customer-email`}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              type="email"
              value={formValues.email}
            />
          </div>

          {mode === "create" ? (
            <div className="space-y-2">
              <Label htmlFor={`${mode}-customer-password`}>Password</Label>
              <Input
                id={`${mode}-customer-password`}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    password: event.target.value
                  }))
                }
                type="password"
                value={formValues.password}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`${mode}-customer-phone`}>Phone</Label>
            <Input
              id={`${mode}-customer-phone`}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  phone: event.target.value
                }))
              }
              value={formValues.phone}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-customer-status`}>Status</Label>
            <Select
              id={`${mode}-customer-status`}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  status: event.target.value === "suspended" ? "suspended" : "active"
                }))
              }
              value={formValues.status}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          {errorMessage ? <Alert className="border-red-200 bg-red-50 text-red-900">{errorMessage}</Alert> : null}

          <div className="flex justify-end gap-3">
            <Button
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "create" ? "Creating" : "Saving"}
                </>
              ) : mode === "create" ? (
                "Create customer"
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

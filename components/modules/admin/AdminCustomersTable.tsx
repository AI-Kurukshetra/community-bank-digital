"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminCustomerDeleteButton } from "@/components/modules/admin/AdminCustomerDeleteButton";
import { AdminCustomerFormDialog } from "@/components/modules/admin/AdminCustomerFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatAdminStatusLabel,
  getProfileStatusBadgeClass
} from "@/lib/admin";
import { formatDate } from "@/utils/dates";

type CustomerRow = {
  accountsCount: number;
  created_at: string;
  email: string | null;
  full_name: string;
  id: string;
  phone: string | null;
  status: string;
};

export function AdminCustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) => {
      const name = customer.full_name.toLowerCase();
      const email = (customer.email ?? "").toLowerCase();

      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  }, [customers, normalizedQuery]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Search the loaded customer list by name or email.
          </CardDescription>
        </div>
        <AdminCustomerFormDialog
          mode="create"
          triggerClassName="bg-[#0A2540] text-white hover:bg-[#0A2540]/90"
          triggerLabel="Create customer"
          triggerVariant="default"
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customers"
          value={query}
        />

        <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
          <div className="hidden grid-cols-[1.2fr_1.6fr_100px_120px_120px_240px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
            <span>Name</span>
            <span>Email</span>
            <span>Accounts</span>
            <span>Status</span>
            <span>Joined</span>
            <span>Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <div
                  className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_1.6fr_100px_120px_120px_240px] md:items-center"
                  key={customer.id}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Name
                    </p>
                    <p className="font-medium text-slate-950">{customer.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Email
                    </p>
                    <p className="text-sm text-slate-600">
                      {customer.email ?? "No email"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Accounts
                    </p>
                    <p className="text-sm text-slate-600">{customer.accountsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Status
                    </p>
                    <Badge className={getProfileStatusBadgeClass(customer.status)}>
                      {formatAdminStatusLabel(customer.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Joined
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button asChild type="button" variant="outline">
                        <Link href={`/admin/customers/${customer.id}`}>View</Link>
                      </Button>
                      <AdminCustomerFormDialog
                        customer={{
                          email: customer.email,
                          full_name: customer.full_name,
                          id: customer.id,
                          phone: customer.phone,
                          status: customer.status
                        }}
                        mode="edit"
                        triggerLabel="Edit"
                      />
                      <AdminCustomerDeleteButton
                        customerId={customer.id}
                        customerName={customer.full_name}
                        triggerClassName="border-red-300 text-red-700 hover:bg-red-50"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No customers match this search.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

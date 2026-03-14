import { AdminShellClient } from "@/components/layout/AdminShellClient";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { getAdminServerContext } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin, profile } = context;
  const [{ count: flaggedFraudCount }, { count: pendingChequeCount }] =
    await Promise.all([
      admin
        .from("fraud_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "flagged"),
      admin
        .from("check_images")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    ]);

  return (
    <RoleGuard allowedRoles={["staff", "admin"]}>
      <AdminShellClient
        initialCounts={{
          cheques: pendingChequeCount ?? 0,
          fraud: flaggedFraudCount ?? 0
        }}
        initialFullName={profile.full_name}
        initialRole={profile.role}
      >
        {children}
      </AdminShellClient>
    </RoleGuard>
  );
}

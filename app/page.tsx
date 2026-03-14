import { redirect } from "next/navigation";

import { DashboardPreview } from "@/components/layout/dashboard-preview";
import { getServerAuthState } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authState = await getServerAuthState();

  if (authState.session) {
    redirect(authState.homePath);
  }

  return <DashboardPreview />;
}

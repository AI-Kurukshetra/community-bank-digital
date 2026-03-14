import { BankingLayoutClient } from "@/components/layout/BankingLayoutClient";

export const dynamic = "force-dynamic";

export default function BankingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <BankingLayoutClient>{children}</BankingLayoutClient>;
}

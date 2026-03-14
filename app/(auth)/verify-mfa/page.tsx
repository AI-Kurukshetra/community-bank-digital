import { redirect } from "next/navigation";

export default async function VerifyMfaPage() {
  redirect("/login");
}

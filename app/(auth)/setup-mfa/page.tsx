import { redirect } from "next/navigation";

export default async function SetupMfaPage() {
  redirect("/login");
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import AuditoriaClient from "./AuditoriaClient";

export default async function AuditoriaPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <AuditoriaClient session={session} />
    </AppShell>
  );
}

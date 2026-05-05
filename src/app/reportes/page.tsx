import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ReportesClient from "./ReportesClient";

export default async function ReportesPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ReportesClient session={session} />
    </AppShell>
  );
}

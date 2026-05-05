import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import ReportesDepartamentoClient from "./ReportesDepartamentoClient";

export default async function ReportesDepartamentoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.esDirector && !session.user.esJefe && !session.user.esRrhh && !session.user.esAdmin) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ReportesDepartamentoClient session={session} />
    </AppShell>
  );
}

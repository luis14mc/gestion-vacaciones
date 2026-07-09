import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import ReportesDepartamentoClient from "./ReportesDepartamentoClient";
import { getSession } from "@/lib/auth";
import { puedeVerReporteDepartamento } from "@/lib/domain/reportes/access";

export default async function ReportesDepartamentoPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Política Fase 1 — Seguridad de jefes: los reportes departamentales
  // están restringidos a Admin/RRHH. Jefe/Director son redirigidos a
  // /dashboard (su vista operativa).
  const sessionUser = await getSession();
  if (!sessionUser || !puedeVerReporteDepartamento(sessionUser)) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ReportesDepartamentoClient session={session} />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ReportesDepartamentoClient from "./ReportesDepartamentoClient";

export default async function ReportesDepartamentoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Solo jefes, RRHH y admins pueden acceder
  if (!session.user.esJefe && !session.user.esRrhh && !session.user.esAdmin) {
    redirect("/dashboard");
  }

  return <ReportesDepartamentoClient />;
}

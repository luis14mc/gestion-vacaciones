import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AsignacionDiasClient from "./AsignacionDiasClient";

export default async function AsignacionDiasPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Solo Admin y RRHH pueden asignar días
  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return <AsignacionDiasClient session={session} />;
}

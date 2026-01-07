import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuditoriaClient from "./AuditoriaClient";

export default async function AuditoriaPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Solo Admin y RRHH pueden acceder a auditoría
  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return <AuditoriaClient session={session} />;
}

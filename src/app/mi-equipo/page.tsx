import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MiEquipoClient from "./MiEquipoClient";

export default async function MiEquipoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Solo jefes, RRHH y admins pueden acceder
  if (!session.user.esJefe && !session.user.esRrhh && !session.user.esAdmin) {
    redirect("/dashboard");
  }

  return <MiEquipoClient />;
}

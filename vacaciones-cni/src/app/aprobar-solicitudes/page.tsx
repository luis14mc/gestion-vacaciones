import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AprobarSolicitudesClient from "./AprobarSolicitudesClient";

export default async function AprobarSolicitudesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Solo jefes, RRHH y admins pueden acceder
  if (!session.user.esJefe && !session.user.esRrhh && !session.user.esAdmin) {
    redirect("/dashboard");
  }

  return <AprobarSolicitudesClient />;
}

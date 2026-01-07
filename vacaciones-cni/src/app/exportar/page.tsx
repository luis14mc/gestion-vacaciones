import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ExportarClient from "./ExportarClient";

export default async function ExportarPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Solo Admin y RRHH pueden acceder a exportación
  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return <ExportarClient session={session} />;
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return <UsuariosClient session={session} />;
}

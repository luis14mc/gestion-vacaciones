import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ConfiguracionClient from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin) {
    redirect("/dashboard");
  }

  return <ConfiguracionClient session={session} />;
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import ExportarClient from "./ExportarClient";

export default async function ExportarPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ExportarClient session={session} />
    </AppShell>
  );
}

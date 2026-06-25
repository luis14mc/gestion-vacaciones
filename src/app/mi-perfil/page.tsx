import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import MiPerfilClient from "./MiPerfilClient";

export default async function MiPerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell session={session}>
      <MiPerfilClient session={session} />
    </AppShell>
  );
}

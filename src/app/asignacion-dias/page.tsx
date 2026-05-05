import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import AsignacionDiasClient from "./AsignacionDiasClient";

export default async function AsignacionDiasPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  let esAdmin = session.user.esAdmin;
  let esRrhh = session.user.esRrhh;

  if (!esAdmin && !esRrhh) {
    try {
      const rawId = session.user.id;
      const userId = typeof rawId === 'number' ? rawId : Number(rawId);
      if (!Number.isNaN(userId)) {
        const [dbUser] = await db
          .select({ esAdmin: usuarios.esAdmin, esRrhh: usuarios.esRrhh })
          .from(usuarios)
          .where(eq(usuarios.id, userId))
          .limit(1);
        if (dbUser) {
          esAdmin = dbUser.esAdmin ?? false;
          esRrhh = dbUser.esRrhh ?? false;
          session.user.esAdmin = esAdmin;
          session.user.esRrhh = esRrhh;
        }
      }
    } catch (e) {
      console.error('Error fetching user flags from DB:', e);
    }
  }

  if (!esAdmin && !esRrhh) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <AsignacionDiasClient session={session} />
    </AppShell>
  );
}

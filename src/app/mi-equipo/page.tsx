import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import MiEquipoClient from "./MiEquipoClient";

export default async function MiEquipoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let { esDirector, esJefe, esRrhh, esAdmin } = session.user;

  if (!esDirector && !esJefe && !esRrhh && !esAdmin) {
    try {
      const rawId = session.user.id;
      const userId = typeof rawId === 'number' ? rawId : Number(rawId);
      if (!Number.isNaN(userId)) {
        const [dbUser] = await db
          .select({ esAdmin: usuarios.esAdmin, esRrhh: usuarios.esRrhh, esDirector: usuarios.esDirector, esJefe: usuarios.esJefe })
          .from(usuarios)
          .where(eq(usuarios.id, userId))
          .limit(1);
        if (dbUser) {
          esAdmin = dbUser.esAdmin ?? false;
          esRrhh = dbUser.esRrhh ?? false;
          esDirector = dbUser.esDirector ?? false;
          esJefe = dbUser.esJefe ?? false;
          session.user.esAdmin = esAdmin;
          session.user.esRrhh = esRrhh;
          session.user.esDirector = esDirector;
          session.user.esJefe = esJefe;
        }
      }
    } catch (e) {
      console.error('Error fetching user flags from DB:', e);
    }
  }

  if (!esDirector && !esJefe && !esRrhh && !esAdmin) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <MiEquipoClient session={session} />
    </AppShell>
  );
}

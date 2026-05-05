import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Enriquecer sesión con flags de BD para soportar JWT stale
  try {
    const rawId = session.user.id;
    const userId = typeof rawId === 'number' ? rawId : Number(rawId);
    if (userId > 0) {
      const [row] = await db
        .select({ esAdmin: usuarios.esAdmin, esRrhh: usuarios.esRrhh, esDirector: usuarios.esDirector, esJefe: usuarios.esJefe })
        .from(usuarios)
        .where(eq(usuarios.id, userId))
        .limit(1);
      if (row) {
        session.user.esAdmin = session.user.esAdmin || row.esAdmin;
        session.user.esRrhh = session.user.esRrhh || row.esRrhh;
        session.user.esDirector = session.user.esDirector || row.esDirector;
        session.user.esJefe = session.user.esJefe || row.esJefe;
      }
    }
  } catch (_) {
    // fallback silencioso
  }

  return (
    <AppShell session={session}>
      <DashboardClient session={session} />
    </AppShell>
  );
}

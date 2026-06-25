import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Leer flags desde BD para soportar tokens JWT stale
  let esAdmin = session.user.esAdmin || false;
  let esRrhh = session.user.esRrhh || false;

  if (!esAdmin && !esRrhh) {
    try {
      const rawId = session.user.id;
      const userId = typeof rawId === 'number' ? rawId : Number(rawId);
      if (userId > 0) {
        const [row] = await db
          .select({ esAdmin: usuarios.esAdmin, esRrhh: usuarios.esRrhh })
          .from(usuarios)
          .where(eq(usuarios.id, userId))
          .limit(1);
        if (row) {
          esAdmin = row.esAdmin;
          esRrhh = row.esRrhh;
        }
      }
    } catch (_) {
      // fallback silencioso
    }
  }

  if (!esAdmin && !esRrhh) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <UsuariosClient session={session} />
    </AppShell>
  );
}

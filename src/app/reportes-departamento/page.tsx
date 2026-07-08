import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import ReportesDepartamentoClient from "./ReportesDepartamentoClient";

export default async function ReportesDepartamentoPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let { esDirector, esJefe, esRrhh, esAdmin } = session.user;

  try {
    const rawId = session.user.id;
    const userId = typeof rawId === "number" ? rawId : Number(rawId);
    if (userId > 0) {
      const [dbUser] = await db
        .select({
          esAdmin: usuarios.esAdmin,
          esRrhh: usuarios.esRrhh,
          esDirector: usuarios.esDirector,
          esJefe: usuarios.esJefe,
          departamentoId: usuarios.departamentoId,
        })
        .from(usuarios)
        .where(eq(usuarios.id, userId))
        .limit(1);

      if (dbUser) {
        esAdmin = session.user.esAdmin || dbUser.esAdmin;
        esRrhh = session.user.esRrhh || dbUser.esRrhh;
        esDirector = session.user.esDirector || dbUser.esDirector;
        esJefe = session.user.esJefe || dbUser.esJefe;
        session.user.esAdmin = esAdmin;
        session.user.esRrhh = esRrhh;
        session.user.esDirector = esDirector;
        session.user.esJefe = esJefe;
        session.user.departamentoId = dbUser.departamentoId ?? session.user.departamentoId;
      }
    }
  } catch (error) {
    console.error("Error fetching reportes-departamento user flags from DB:", error);
  }

  if (!esDirector && !esJefe && !esRrhh && !esAdmin) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ReportesDepartamentoClient session={session} />
    </AppShell>
  );
}

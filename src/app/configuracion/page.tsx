import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/layout/AppShell";
import ConfiguracionClient from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  let esAdmin = session.user.esAdmin;

  if (!esAdmin) {
    try {
      const rawId = session.user.id;
      const userId = typeof rawId === 'number' ? rawId : Number(rawId);
      if (!Number.isNaN(userId)) {
        const [dbUser] = await db
          .select({ esAdmin: usuarios.esAdmin })
          .from(usuarios)
          .where(eq(usuarios.id, userId))
          .limit(1);
        if (dbUser) {
          esAdmin = dbUser.esAdmin ?? false;
          session.user.esAdmin = esAdmin;
        }
      }
    } catch (e) {
      console.error('Error fetching user flags from DB:', e);
    }
  }

  if (!esAdmin) {
    redirect("/dashboard");
  }

  return (
    <AppShell session={session}>
      <ConfiguracionClient session={session} />
    </AppShell>
  );
}

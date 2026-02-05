import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ReportesClient from "./ReportesClient";

export default async function ReportesPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect("/dashboard");
  }

  return <ReportesClient session={session} />;
}

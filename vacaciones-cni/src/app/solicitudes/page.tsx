import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SolicitudesClient from "./SolicitudesClient";

export default async function SolicitudesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  return <SolicitudesClient />;
}

import { Metadata } from "next";
import MiPerfilClient from "./MiPerfilClient";

export const metadata: Metadata = {
  title: "Mi Perfil - Sistema de Vacaciones",
  description: "Información y configuración de mi perfil de usuario",
};

export default function MiPerfilPage() {
  return <MiPerfilClient />;
}

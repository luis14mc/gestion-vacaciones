'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TablaSolicitudes from '@/components/TablaSolicitudes';

export default function SolicitudesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!session?.user) {
    router.push('/login');
    return null;
  }

  const usuarioActual = session.user;

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header/Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a href="/dashboard" className="btn btn-ghost text-xl"><i className="lni lni-sun"></i> CNI Vacaciones</a>
        </div>
        <div className="flex-none gap-2">
          <a href="/solicitudes/nueva" className="btn btn-primary">
            <i className="lni lni-plus"></i> Nueva Solicitud
          </a>
          <a href="/dashboard" className="btn btn-ghost btn-sm">← Volver</a>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-10 flex items-center justify-center">
                <i className="lni lni-user text-xl"></i>
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li className="menu-title">
                <span>{usuarioActual.nombre} {usuarioActual.apellido}</span>
              </li>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/solicitudes">Mis Solicitudes</a></li>
              <li><a href="/login">Cerrar Sesión</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        {/* Breadcrumbs */}
        <div className="text-sm breadcrumbs mb-4">
          <ul>
            <li><a href="/dashboard">Inicio</a></li>
            <li>Solicitudes</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content flex items-center gap-2"><i className="lni lni-clipboard"></i> Gestión de Solicitudes</h1>
          <p className="text-base-content/60">
            {usuarioActual.esRrhh 
              ? 'Visualiza y gestiona todas las solicitudes del sistema' 
              : usuarioActual.esJefe
              ? 'Aprueba las solicitudes de tu departamento'
              : 'Visualiza el estado de tus solicitudes'}
          </p>
        </div>

        {/* Componente de Tabla con Funcionalidad Completa */}
        <TablaSolicitudes
          usuarioId={!usuarioActual.esRrhh && !usuarioActual.esJefe ? usuarioActual.id : undefined}
          esJefe={usuarioActual.esJefe}
          esRrhh={usuarioActual.esRrhh}
        />
      </div>
    </div>
  );
}

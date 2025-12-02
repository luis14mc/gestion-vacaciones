'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import FormularioSolicitud from '@/components/FormularioSolicitud';

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

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
          <button 
            onClick={() => router.back()} 
            className="btn btn-ghost btn-sm"
          >
            ← Volver
          </button>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-10 flex items-center justify-center">
                <i className="lni lni-user text-xl"></i>
              </div>
            </label>
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
            <li><a href="/solicitudes">Solicitudes</a></li>
            <li>Nueva Solicitud</li>
          </ul>
        </div>

        {/* Formulario Modernizado */}
        <FormularioSolicitud
          usuarioId={usuarioActual.id}
          onSuccess={() => {
            router.push('/solicitudes');
          }}
          onCancel={() => {
            router.back();
          }}
        />
      </div>
    </div>
  );
}

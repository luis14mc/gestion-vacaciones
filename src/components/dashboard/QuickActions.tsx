'use client';

import Link from 'next/link';
import {
  FileText, Users, Calendar, Settings, BarChart3,
  PenLine, Plus, User, CheckSquare, Zap,
} from 'lucide-react';
import type { Session } from 'next-auth';

interface QuickActionsProps {
  session: Session;
}

interface ActionLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

export function QuickActions({ session }: QuickActionsProps) {
  const { esAdmin, esRrhh, esDirector, esJefe } = session.user;

  let actions: ActionLink[] = [];

  if (esAdmin) {
    actions = [
      { href: '/aprobar-solicitudes', label: 'Aprobar', icon: CheckSquare },
      { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
      { href: '/usuarios', label: 'Usuarios', icon: Users },
      { href: '/asignacion-dias', label: 'Asignar Días', icon: Calendar },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
    ];
  } else if (esRrhh) {
    actions = [
      { href: '/aprobar-solicitudes', label: 'Aprobar', icon: CheckSquare },
      { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
      { href: '/usuarios', label: 'Usuarios', icon: Users },
      { href: '/asignacion-dias', label: 'Asignar Días', icon: Calendar },
      { href: '/solicitudes/nueva', label: 'Nueva Solicitud', icon: Plus },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
    ];
  } else if (esDirector || esJefe) {
    actions = [
      { href: '/aprobar-solicitudes', label: 'Aprobar', icon: CheckSquare },
      { href: '/solicitudes/nueva', label: 'Nueva Solicitud', icon: PenLine },
      { href: '/solicitudes', label: 'Mis Solicitudes', icon: FileText },
      { href: '/mi-equipo', label: 'Mi Equipo', icon: Users },
      { href: '/reportes-departamento', label: 'Reportes', icon: BarChart3 },
    ];
  } else {
    actions = [
      { href: '/solicitudes/nueva', label: 'Nueva Solicitud', icon: PenLine },
      { href: '/solicitudes', label: 'Mis Solicitudes', icon: FileText },
      { href: '/mi-perfil', label: 'Mi Perfil', icon: User },
    ];
  }

  return (
    <div className="bg-card border text-card-foreground shadow-sm rounded-xl">
      <div className="px-5 py-3.5 border-b">
        <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          Acciones Rápidas
        </h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium
                  text-card-foreground bg-muted/50 hover:bg-muted
                  border hover:border-primary/50
                  transition-all duration-200"
              >
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

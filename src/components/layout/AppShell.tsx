'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  CheckSquare,
  Users,
  BarChart3,
  Calendar,
  Settings,
  Download,
  ClipboardList,
  UserCircle,
  UsersRound,
  Shield,
  Briefcase,
  Building2,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
} from 'lucide-react';
import type { Session } from 'next-auth';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ─── Types ────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[]; // si vacío, visible para todos
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AppShellProps {
  children: React.ReactNode;
  session: Session;
}

// ─── Navigation Config ────────────────────────────────
function getNavGroups(session: Session): NavGroup[] {
  const { esAdmin, esRrhh, esDirector, esJefe } = session.user;

  const groups: NavGroup[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
  ];

  if (!esAdmin || esRrhh || esDirector || esJefe) {
    groups.push({
      title: 'Solicitudes',
      items: [
        { label: 'Mis Solicitudes', href: '/solicitudes', icon: FileText },
        { label: 'Nueva Solicitud', href: '/solicitudes/nueva', icon: FilePlus },
        ...(esDirector || esJefe || esRrhh
          ? [{ label: 'Aprobar Solicitudes', href: '/aprobar-solicitudes', icon: CheckSquare }]
          : []),
      ],
    });
  }

  if ((esDirector || esJefe || esRrhh) && !esAdmin) {
    groups.push({
      title: 'Gestión',
      items: [
        { label: 'Mi Equipo', href: '/mi-equipo', icon: UsersRound },
        { label: 'Reportes Depto.', href: '/reportes-departamento', icon: BarChart3 },
      ],
    });
  }

  // Administración (RRHH / Admin)
  if (esRrhh || esAdmin) {
    groups.push({
      title: 'Administración',
      items: [
        { label: 'Usuarios', href: '/usuarios', icon: Users },
        { label: 'Departamentos', href: '/departamentos', icon: Building2 },
        { label: 'Asignación Días', href: '/asignacion-dias', icon: Calendar },
        { label: 'Reportes', href: '/reportes', icon: BarChart3 },
        { label: 'Exportar', href: '/exportar', icon: Download },
      ],
    });
  }

  // Solo Admin
  if (esAdmin) {
    groups.push({
      title: 'Sistema',
      items: [
        { label: 'Configuración', href: '/configuracion', icon: Settings },
        { label: 'Auditoría', href: '/auditoria', icon: ClipboardList },
      ],
    });
  }

  // Personal (todos)
  groups.push({
    title: 'Personal',
    items: [
      { label: 'Mi Perfil', href: '/mi-perfil', icon: UserCircle },
    ],
  });

  return groups;
}

// ─── Role Helpers ─────────────────────────────────────
function getRoleMeta(session: Session) {
  if (session.user.esAdmin) return { icon: Shield, label: 'Administrador', color: 'text-primary' };
  if (session.user.esRrhh) return { icon: UsersRound, label: 'RRHH', color: 'text-secondary' };
  if (session.user.esDirector) return { icon: Briefcase, label: 'Director', color: 'text-purple-500' };
  if (session.user.esJefe) return { icon: Briefcase, label: 'Jefe', color: 'text-blue-500' };
  return { icon: User, label: 'Empleado', color: 'text-muted-foreground' };
}

// ─── Component ────────────────────────────────────────
export default function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navGroups = getNavGroups(session);
  const role = getRoleMeta(session);

  const initials = `${session.user.nombre?.[0] ?? ''}${session.user.apellido?.[0] ?? ''}`;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="min-h-screen">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/10 z-40 lg:hidden backdrop-blur-md"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px]
          bg-white/70 backdrop-blur-2xl backdrop-saturate-[1.8]
          border-r border-white/60
          shadow-[4px_0_24px_oklch(0%_0_0/0.06)]
          transform transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/assets/logo/logo.png"
              alt="CNI Logo"
              width={36}
              height={36}
              className="object-contain rounded-lg"
            />
            <div className="leading-tight">
              <span className="font-semibold text-foreground text-sm tracking-tight">Vacaciones</span>
              <span className="block text-[10px] text-muted-foreground font-medium">CNI Honduras</span>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-xl"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3" style={{ height: 'calc(100vh - 64px - 72px)' }}>
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
                {group.title}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium
                          transition-all duration-200
                          ${active
                            ? 'bg-primary/10 text-primary backdrop-blur-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }
                        `}
                      >
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span>{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-auto text-[10px] bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-semibold">{item.badge}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer - User */}
        <div className="h-[72px] border-t border-white/20 px-4 flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground/90 truncate">
              {session.user.nombre} {session.user.apellido}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{role.label}</p>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-14 bg-white/65 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-white/50 shadow-[0_1px_8px_oklch(0%_0_0/0.04)] flex items-center justify-between px-4 lg:px-6">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4 text-muted-foreground" />
            </Button>
            <div className="hidden sm:block">
              <Breadcrumbs pathname={pathname} />
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl"
              title="Notificaciones"
              aria-label="Notificaciones"
            >
              <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-xl px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {session.user.nombre} {session.user.apellido}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">{session.user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/mi-perfil" className="flex cursor-pointer items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-4 px-6">
          <p className="text-[11px] text-muted-foreground/70 text-center">
            CNI Honduras &copy; {new Date().getFullYear()} &mdash; Gestión de Vacaciones
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  solicitudes: 'Solicitudes',
  nueva: 'Nueva Solicitud',
  'aprobar-solicitudes': 'Aprobar Solicitudes',
  usuarios: 'Usuarios',
  reportes: 'Reportes',
  'reportes-departamento': 'Reportes Departamento',
  configuracion: 'Configuración',
  auditoria: 'Auditoría',
  'mi-equipo': 'Mi Equipo',
  'mi-perfil': 'Mi Perfil',
  exportar: 'Exportar',
  'asignacion-dias': 'Asignación de Días',
};

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
        Inicio
      </Link>
      {segments.map((seg, i) => {
        const label = ROUTE_LABELS[seg] || seg;
        const href = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;

        return (
          <React.Fragment key={href}>
            <span className="text-muted-foreground/50">/</span>
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

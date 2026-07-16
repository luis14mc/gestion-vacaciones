'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date-format';

interface NotificacionItem {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

export function NotificacionesDropdown() {
  const [items, setItems] = useState<NotificacionItem[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones?limite=15', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setItems(json.data.notificaciones ?? []);
        setNoLeidas(json.data.noLeidas ?? 0);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => void cargar(), 60_000);
    return () => window.clearInterval(id);
  }, [cargar]);

  const marcarLeida = async (id: number) => {
    await fetch(`/api/notificaciones/${id}/leer`, { method: 'PATCH' });
    void cargar();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-xl"
          title="Notificaciones"
          aria-label="Notificaciones"
        >
          <Bell className="w-[18px] h-[18px] text-muted-foreground" />
          {noLeidas > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {noLeidas > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {noLeidas} nueva(s)
            </Badge>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Sin notificaciones.</p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex cursor-default flex-col items-start gap-1 py-2"
              onClick={() => {
                if (!n.leida) void marcarLeida(n.id);
              }}
            >
              <span className={`text-sm ${n.leida ? 'text-muted-foreground' : 'font-medium'}`}>
                {n.titulo}
              </span>
              <span className="text-xs text-muted-foreground line-clamp-2">{n.mensaje}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(n.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/mi-balance" className="w-full cursor-pointer text-center text-xs">
            Ver balance y asignaciones
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import { Clock, Check, User, Bell, Hourglass } from 'lucide-react';

interface Actividad {
  id: string;
  tipo: 'aprobada' | 'nueva_solicitud' | 'nuevo_usuario';
  titulo: string;
  descripcion: string;
  fecha: string;
}

interface ActivityFeedProps {
  actividades: Actividad[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  if (hrs > 0) return `Hace ${hrs} hora${hrs > 1 ? 's' : ''}`;
  if (mins > 0) return `Hace ${mins} min`;
  return 'Hace un momento';
}

const TIPO_CONFIG = {
  aprobada: { icon: Check, bg: 'bg-green-500/10', text: 'text-green-500' },
  nueva_solicitud: { icon: Hourglass, bg: 'bg-orange-500/10', text: 'text-orange-500' },
  nuevo_usuario: { icon: User, bg: 'bg-blue-500/10', text: 'text-blue-500' },
} as const;

export function ActivityFeed({ actividades }: ActivityFeedProps) {
  return (
    <div className="bg-card border text-card-foreground shadow-sm rounded-xl">
      <div className="px-5 py-3.5 border-b">
        <h2 className="text-[13px] font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          Actividad Reciente
        </h2>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {actividades.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Sin actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y">
            {actividades.map((act) => {
              const config = TIPO_CONFIG[act.tipo] || { icon: Bell, bg: 'bg-muted', text: 'text-foreground' };
              const Icon = config.icon;
              return (
                <div key={act.id} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${config.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{act.titulo}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground sm:truncate">{act.descripcion}</p>
                  </div>
                  <span className="mt-0.5 hidden shrink-0 text-[10px] text-muted-foreground min-[420px]:inline">{timeAgo(act.fecha)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

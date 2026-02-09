'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';

/**
 * Panel de acciones rápidas para RRHH.
 * Integrable en cualquier dashboard.
 */
export function RrhhQuickActions() {
  const toast = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleExportExcel(tipo: 'balances' | 'solicitudes') {
    setExporting(tipo);
    try {
      const res = await fetch(`/api/reportes/exportar/excel?tipo=${tipo}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Error exportando');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${tipo}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Reporte de ${tipo} descargado`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setExporting(null);
    }
  }

  return (
    <Card title="Acciones Rápidas" subtitle="Herramientas de RRHH">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <Button
          variant="primary"
          outline
          size="sm"
          loading={exporting === 'balances'}
          onClick={() => handleExportExcel('balances')}
        >
          📊 Exportar Balances
        </Button>
        <Button
          variant="secondary"
          outline
          size="sm"
          loading={exporting === 'solicitudes'}
          onClick={() => handleExportExcel('solicitudes')}
        >
          📋 Exportar Solicitudes
        </Button>
      </div>
    </Card>
  );
}

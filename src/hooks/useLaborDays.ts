import { useState, useEffect } from 'react';

export function useLaborDays(fechaInicio?: string, fechaFin?: string) {
    const [diasLaborables, setDiasLaborables] = useState(0);

    useEffect(() => {
        if (!fechaInicio || !fechaFin) {
            setDiasLaborables(0);
            return;
        }

        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        // Normalizar horas
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(0, 0, 0, 0);

        // Si fin es antes de inicio, 0 días
        if (fin < inicio) {
            setDiasLaborables(0);
            return;
        }

        let laborables = 0;
        const fechaActual = new Date(inicio);

        while (fechaActual <= fin) {
            const diaSemana = fechaActual.getDay();
            // 0 = Domingo, 6 = Sábado
            if (diaSemana !== 0 && diaSemana !== 6) {
                laborables++;
            }
            fechaActual.setDate(fechaActual.getDate() + 1);
        }

        setDiasLaborables(laborables);
    }, [fechaInicio, fechaFin]);

    return { diasLaborables };
}

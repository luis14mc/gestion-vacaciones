import { useQuery } from '@tanstack/react-query';

export function useTiposAusencia() {
    return useQuery({
        queryKey: ['tiposAusencia'],
        queryFn: async () => {
            const response = await fetch('/api/tipos-ausencia');
            if (!response.ok) {
                throw new Error('Error al cargar tipos de ausencia');
            }
            const data = await response.json();
            return data.success ? data.data : [];
        },
    });
}

import { useQuery } from '@tanstack/react-query';

export function useBalances(usuarioId: number) {
    return useQuery({
        queryKey: ['balances', usuarioId],
        queryFn: async () => {
            const response = await fetch(`/api/balances?usuarioId=${usuarioId}`);
            if (!response.ok) {
                throw new Error('Error al cargar los balances');
            }
            const data = await response.json();
            return data.success ? data.data : [];
        },
        enabled: !!usuarioId,
    });
}

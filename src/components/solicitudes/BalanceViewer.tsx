import { Info, XCircle } from 'lucide-react';

interface Props {
    diasDisponibles: number;
    diasSolicitados: number;
    diasRestantes: number;
}

export function BalanceViewer({ diasDisponibles, diasSolicitados, diasRestantes }: Props) {
    return (
        <div className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-4">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-6">
                <div className="flex flex-col items-center justify-center py-2 border-r-2 dark:border-white/10">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 font-medium">Días Disponibles</p>
                    <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">{diasDisponibles}</p>
                </div>
                <div className="flex flex-col items-center justify-center py-2 border-r-2 dark:border-white/10">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 font-medium">Días Solicitados</p>
                    <p className="text-xl font-semibold text-orange-600 dark:text-orange-400">{diasSolicitados}</p>
                </div>
                <div className="flex flex-col items-center justify-center py-2">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 font-medium">Días Restantes</p>
                    <p className={`text-xl font-semibold ${diasRestantes < 0 ? 'text-red-500' : 'text-foreground'}`}>
                        {diasRestantes}
                    </p>
                </div>
            </div>

            {diasSolicitados > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 text-[13px] mt-3 sm:mt-4">
                    <Info className="w-5 h-5 flex-shrink-0 text-blue-500" />
                    <span className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                        Solo se contabilizan días laborables (Lunes a Viernes). Sábados y domingos no se descuentan de tu balance.
                    </span>
                </div>
            )}

            {diasRestantes < 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 text-[13px] mt-3 sm:mt-4">
                    <XCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                    <span className="text-sm text-red-700 dark:text-red-400">
                        No tienes suficientes días disponibles.
                    </span>
                </div>
            )}
        </div>
    );
}

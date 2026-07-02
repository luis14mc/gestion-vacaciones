import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton estático para `loading.tsx` de rutas del App Router. */
export function PageLoading({ title = "Cargando…" }: { title?: string }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{title}</span>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

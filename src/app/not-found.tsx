import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Página no encontrada</h2>
        <p className="text-muted-foreground">La página que buscas no existe.</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md inline-block"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

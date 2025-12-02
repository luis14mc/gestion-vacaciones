'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton({ className = '' }: { className?: string }) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <button onClick={handleLogout} className={`${className} flex items-center gap-2`}>
      <i className="lni lni-exit"></i>
      <span>Cerrar Sesión</span>
    </button>
  );
}

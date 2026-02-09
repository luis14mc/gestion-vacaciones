'use client';

import { useState, useEffect } from 'react';

/**
 * Debounce de un valor para evitar actualizaciones frecuentes.
 * Útil para filtros de búsqueda.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

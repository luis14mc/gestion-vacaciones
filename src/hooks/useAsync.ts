'use client';

import { useState, useCallback } from 'react';

type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

/**
 * Hook genérico para operaciones async con estado.
 * Evita useState/try-catch repetitivo.
 *
 * @example
 * const { execute, status, data, error } = useAsync(fetchSolicitudes);
 * <Button onClick={execute} loading={status === 'loading'}>Cargar</Button>
 */
export function useAsync<T, Args extends any[] = []>(
  asyncFn: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const data = await asyncFn(...args);
        setState({ status: 'success', data, error: null });
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setState({ status: 'error', data: null, error: message });
        throw err;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null });
  }, []);

  return {
    execute,
    reset,
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    isIdle: state.status === 'idle',
  };
}

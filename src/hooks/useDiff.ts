import { useEffect, useRef, useState } from 'react';
import type { DiffOptions, DiffResult } from '../types';
import { computeDiff } from '../utils/diffEngine';
import type { DiffRequest, DiffResponse } from '../workers/diff.worker';

interface UseDiffState {
  result: DiffResult | null;
  loading: boolean;
  error: string | null;
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Calcula el diff en un Web Worker para no bloquear la interfaz.
 *
 *  - Si llega una petición nueva mientras otra sigue en curso, se *termina* el
 *    worker (cancelación real) y se lanza uno nuevo.
 *  - Sin soporte de Worker, se calcula en el hilo principal (setTimeout).
 *  - `textA`/`textB` a `null` significa "no hay nada que comparar".
 */
export function useDiff(
  textA: string | null,
  textB: string | null,
  options: DiffOptions,
  debounceMs = 0,
): UseDiffState {
  const [state, setState] = useState<UseDiffState>({ result: null, loading: false, error: null });
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = ++seqRef.current;

    if (textA === null || textB === null) {
      workerRef.current?.terminate();
      workerRef.current = null;
      setState({ result: null, loading: false, error: null });
      return;
    }

    setState((s) => (s.loading ? s : { ...s, loading: true, error: null }));

    const timer = setTimeout(() => {
      // Cancelar un cálculo anterior que siga en marcha.
      workerRef.current?.terminate();
      workerRef.current = createWorker();
      const worker = workerRef.current;

      if (!worker) {
        try {
          const result = computeDiff(textA, textB, options);
          if (id === seqRef.current) setState({ result, loading: false, error: null });
        } catch (e) {
          if (id === seqRef.current) {
            setState({ result: null, loading: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return;
      }

      worker.onmessage = (e: MessageEvent<DiffResponse>) => {
        if (e.data.id !== id || id !== seqRef.current) return;
        if ('error' in e.data) setState({ result: null, loading: false, error: e.data.error });
        else setState({ result: e.data.result, loading: false, error: null });
      };
      worker.onerror = (e) => {
        if (id === seqRef.current) setState({ result: null, loading: false, error: e.message });
      };
      const req: DiffRequest = { id, textA, textB, options };
      worker.postMessage(req);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [textA, textB, options, debounceMs]);

  return state;
}

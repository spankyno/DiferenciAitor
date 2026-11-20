import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'diferenciaitor:';

/** Mezcla un objeto guardado con los valores por defecto, conservando solo claves conocidas del mismo tipo. */
export function mergeDefaults<T extends object>(defaults: T) {
  return (raw: unknown): T => {
    if (!raw || typeof raw !== 'object') return defaults;
    const out = { ...defaults } as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === typeof (defaults as Record<string, unknown>)[key]) out[key] = v;
    }
    return out as T;
  };
}

/** useState respaldado por localStorage. Tolera almacenamiento bloqueado o datos corruptos. */
export function usePersistentState<T>(
  key: string,
  initial: T,
  parse?: (raw: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        return parse ? parse(parsed) : (parsed as T);
      }
    } catch {
      /* almacenamiento no disponible o JSON corrupto */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* modo privado / cuota */
    }
  }, [key, value]);

  return [value, setValue];
}

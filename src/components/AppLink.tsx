import type { ReactNode } from 'react';
import { hrefFor, navigate } from '../router';
import type { DiffMode } from '../types';

/**
 * Enlace real (href rastreable, abrible en pestaña nueva) que, con un clic normal,
 * navega sin recargar para no perder lo que el usuario tenga en las herramientas.
 */
export function AppLink({
  mode,
  className,
  children,
}: {
  mode: DiffMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={hrefFor(mode)}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(mode);
      }}
    >
      {children}
    </a>
  );
}

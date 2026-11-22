import type { DiffMode } from './types';

/**
 * Enrutado mínimo con la History API.
 *  - /acerca-de y /privacidad son páginas reales (indexables, con su HTML estático).
 *  - Las tres herramientas viven en "/" y se distinguen con el hash (#files, #folders).
 */
export const ROUTE_PATHS = { about: '/acerca-de', privacy: '/privacidad' } as const;

const normalizePath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

type Loc = { pathname: string; hash: string };

export function routeFromLocation(loc: Loc = window.location): DiffMode {
  const path = normalizePath(loc.pathname);
  if (path === ROUTE_PATHS.about) return 'about';
  if (path === ROUTE_PATHS.privacy) return 'privacy';
  const hash = loc.hash.replace(/^#/, '');
  if (hash === 'files' || hash === 'folders' || hash === 'text') return hash;
  // Enlaces antiguos (#about, #privacy): siguen funcionando.
  if (hash === 'about' || hash === 'privacy') return hash;
  return 'text';
}

export function hrefFor(mode: DiffMode): string {
  switch (mode) {
    case 'about':
      return ROUTE_PATHS.about;
    case 'privacy':
      return ROUTE_PATHS.privacy;
    case 'files':
      return '/#files';
    case 'folders':
      return '/#folders';
    default:
      return '/';
  }
}

/** Si la URL usa un enlace antiguo (/#about), devuelve la ruta real que debe mostrarse. */
export function legacyRedirect(loc: Loc = window.location): string | null {
  if (normalizePath(loc.pathname) !== '/') return null;
  const hash = loc.hash.replace(/^#/, '');
  if (hash === 'about') return ROUTE_PATHS.about;
  if (hash === 'privacy') return ROUTE_PATHS.privacy;
  return null;
}

/** Navega sin recargar (conserva el estado de las herramientas) y avisa a la app. */
export function navigate(mode: DiffMode, options: { replace?: boolean } = {}): void {
  const href = hrefFor(mode);
  const current = window.location.pathname + window.location.hash;
  if (current !== href) {
    window.history[options.replace ? 'replaceState' : 'pushState'](null, '', href);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

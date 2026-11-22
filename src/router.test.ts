import { describe, expect, it } from 'vitest';
import { hrefFor, legacyRedirect, navigate, routeFromLocation } from './router';

const loc = (pathname: string, hash = '') => ({ pathname, hash });

describe('routeFromLocation', () => {
  it('reconoce las páginas reales, con o sin barra final', () => {
    expect(routeFromLocation(loc('/acerca-de'))).toBe('about');
    expect(routeFromLocation(loc('/acerca-de/'))).toBe('about');
    expect(routeFromLocation(loc('/privacidad'))).toBe('privacy');
    expect(routeFromLocation(loc('/privacidad/'))).toBe('privacy');
  });
  it('en la portada usa el hash para elegir herramienta', () => {
    expect(routeFromLocation(loc('/'))).toBe('text');
    expect(routeFromLocation(loc('/', '#files'))).toBe('files');
    expect(routeFromLocation(loc('/', '#folders'))).toBe('folders');
    expect(routeFromLocation(loc('/', '#text'))).toBe('text');
    expect(routeFromLocation(loc('/', '#inventado'))).toBe('text');
  });
  it('acepta los enlaces antiguos #about y #privacy', () => {
    expect(routeFromLocation(loc('/', '#about'))).toBe('about');
    expect(routeFromLocation(loc('/', '#privacy'))).toBe('privacy');
  });
  it('la ruta manda sobre el hash', () => {
    expect(routeFromLocation(loc('/acerca-de', '#files'))).toBe('about');
  });
});

describe('hrefFor', () => {
  it('devuelve la URL de cada modo', () => {
    expect(hrefFor('text')).toBe('/');
    expect(hrefFor('files')).toBe('/#files');
    expect(hrefFor('folders')).toBe('/#folders');
    expect(hrefFor('about')).toBe('/acerca-de');
    expect(hrefFor('privacy')).toBe('/privacidad');
  });
  it('es coherente con routeFromLocation (ida y vuelta)', () => {
    for (const m of ['text', 'files', 'folders', 'about', 'privacy'] as const) {
      const url = new URL(hrefFor(m), 'https://x.test');
      expect(routeFromLocation(url)).toBe(m);
    }
  });
});

describe('legacyRedirect', () => {
  it('convierte /#about y /#privacy en su ruta real', () => {
    expect(legacyRedirect(loc('/', '#about'))).toBe('/acerca-de');
    expect(legacyRedirect(loc('/', '#privacy'))).toBe('/privacidad');
  });
  it('no toca el resto', () => {
    expect(legacyRedirect(loc('/', '#files'))).toBeNull();
    expect(legacyRedirect(loc('/'))).toBeNull();
    expect(legacyRedirect(loc('/acerca-de', '#about'))).toBeNull();
  });
});

describe('navigate', () => {
  it('cambia la URL y avisa con popstate', () => {
    let fired = 0;
    const on = () => fired++;
    window.addEventListener('popstate', on);
    navigate('about');
    expect(window.location.pathname).toBe('/acerca-de');
    navigate('files');
    expect(window.location.pathname + window.location.hash).toBe('/#files');
    navigate('text');
    expect(window.location.pathname + window.location.hash).toBe('/');
    window.removeEventListener('popstate', on);
    expect(fired).toBe(3);
  });
  it('no añade entradas duplicadas al historial si ya estás en esa URL', () => {
    navigate('about');
    const len = window.history.length;
    navigate('about');
    expect(window.history.length).toBe(len);
  });
  it('con replace no crece el historial', () => {
    const len = window.history.length;
    navigate('privacy', { replace: true });
    expect(window.history.length).toBe(len);
    expect(window.location.pathname).toBe('/privacidad');
  });
});

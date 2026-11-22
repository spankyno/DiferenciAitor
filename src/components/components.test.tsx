import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { I18nProvider } from '../i18n';
import { DEFAULT_DIFF_OPTIONS, DEFAULT_VIEW_SETTINGS } from '../types';
import { computeDiff } from '../utils/diffEngine';
import { DiffViewer } from './DiffViewer';
import { PAGE_META } from '../../seo/meta';

const renderApp = () =>
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );

function renderViewer(a: string, b: string, settings = DEFAULT_VIEW_SETTINGS) {
  const result = computeDiff(a, b, DEFAULT_DIFF_OPTIONS);
  return render(
    <I18nProvider>
      <DiffViewer
        result={result}
        settings={settings}
        onSettingsChange={() => undefined}
        labelA="A"
        labelB="B"
      />
    </I18nProvider>,
  );
}

describe('App', () => {
  it('muestra el modo texto con las opciones y estado vacío', () => {
    renderApp();
    expect(screen.getByLabelText('Texto original (A)')).toBeInTheDocument();
    expect(screen.getByLabelText('Ignorar espacios')).toBeInTheDocument();
    expect(screen.getByText(/Escribe o pega texto/)).toBeInTheDocument();
  });

  it('compara dos textos y muestra estadísticas (sin Worker: respaldo en hilo principal)', async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText('Texto original (A)'), { target: { value: 'a\nb\nc' } });
    fireEvent.change(screen.getByLabelText('Texto modificado (B)'), { target: { value: 'a\nX\nc' } });
    await waitFor(() => expect(screen.getByText(/Similitud/)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/~1 modificadas|−1 eliminadas/)).toBeInTheDocument();
  });

  it('CRLF y LF se muestran como idénticos', async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText('Texto original (A)'), { target: { value: 'a\r\nb' } });
    fireEvent.change(screen.getByLabelText('Texto modificado (B)'), { target: { value: 'a\nb\n' } });
    await waitFor(() => expect(screen.getByText('¡Textos idénticos!')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('el botón de copiar de cada panel tiene su propio estado', async () => {
    Object.assign(navigator, { clipboard: { writeText: async () => undefined } });
    renderApp();
    fireEvent.change(screen.getByLabelText('Texto original (A)'), { target: { value: 'x' } });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Copiar texto A' }));
    await waitFor(() => expect(screen.getAllByText('Copiado').length).toBe(1));
  });

  it('cambia de idioma y lo recuerda', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Load example' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('diferenciaitor:lang')).toBe('"en"');
  });

  it('alterna el tema y lo persiste', async () => {
    const user = userEvent.setup();
    renderApp();
    const wasDark = document.documentElement.classList.contains('dark');
    await user.click(screen.getByRole('button', { name: /Cambiar a modo (claro|oscuro)/ }));
    expect(document.documentElement.classList.contains('dark')).toBe(!wasDark);
    expect(localStorage.getItem('diferenciaitor:theme')).toBe(wasDark ? '"light"' : '"dark"');
  });

  it('las opciones se guardan y se restauran', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await user.click(screen.getByLabelText('Ignorar mayúsculas'));
    first.unmount();
    renderApp();
    expect(screen.getByLabelText('Ignorar mayúsculas')).toBeChecked();
  });

  it('datos corruptos en localStorage no rompen la app', () => {
    localStorage.setItem('diferenciaitor:options', '{no es json');
    localStorage.setItem('diferenciaitor:view', '{"viewMode":"inventado"}');
    renderApp();
    expect(screen.getByLabelText('Texto original (A)')).toBeInTheDocument();
  });

  it('navega entre módulos y conserva el texto', async () => {
    const user = userEvent.setup();
    renderApp();
    fireEvent.change(screen.getByLabelText('Texto original (A)'), { target: { value: 'conservado' } });
    await user.click(screen.getByRole('button', { name: /Archivos/ }));
    expect(await screen.findByText('Comparación de archivos')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^Texto/ }));
    expect(screen.getByLabelText('Texto original (A)')).toHaveValue('conservado');
  });

  it('muestra "Acerca de" desde el pie', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Acerca de' }));
    expect(await screen.findByText('Acerca de DiferenciAItor')).toBeInTheDocument();
  });

  it('"Acerca de" muestra og-image.png escalada y con texto alternativo', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Acerca de' }));
    const img = (await screen.findByAltText(/comparación de dos documentos/)) as HTMLImageElement;
    expect(img).toHaveAttribute('src', '/og-image.png');
    // Dimensiones reales declaradas (evita saltos de maquetación) y escalado fluido por CSS.
    expect(img).toHaveAttribute('width', '1248');
    expect(img).toHaveAttribute('height', '832');
    expect(img.className).toMatch(/w-full/);
    expect(img.className).toMatch(/h-auto/);
  });
});

describe('Pie de página', () => {
  it('enlaza a Blog, Aitor Hub y Contacto en pestaña nueva y de forma segura', () => {
    renderApp();
    const expected: [string, string][] = [
      ['Blog', 'https://aitorsanchez.pages.dev/'],
      ['Aitor Hub', 'https://aitorhub.vercel.app/'],
      ['Contacto', 'https://aitorsanchez.pages.dev/contacto/'],
    ];
    for (const [name, href] of expected) {
      const a = screen.getByRole('link', { name: new RegExp(`^${name}`) });
      expect(a).toHaveAttribute('href', href);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
      expect(a.getAttribute('rel')).toContain('noreferrer');
    }
  });

  it('enlaza internamente a Acerca de y a Privacidad', () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'Acerca de' })).toHaveAttribute('href', '/acerca-de');
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacidad');
  });

  it('muestra el texto de copyright exacto', () => {
    renderApp();
    expect(
      screen.getByText('Autor: Aitor Sánchez Gutiérrez. © 2026 - Todos los derechos reservados.'),
    ).toBeInTheDocument();
  });

  it('es compacto: sin texto de privacidad, sin eslogan y sin títulos de columna', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByText(/se procesan en tu navegador/)).not.toBeInTheDocument();
    expect(within(footer).queryByText(/sin que salgan de tu dispositivo/)).not.toBeInTheDocument();
    expect(within(footer).queryByRole('heading')).not.toBeInTheDocument();
    expect(within(footer).queryByText(/^(Aplicación|Autor)$/i)).not.toBeInTheDocument();
    expect(within(footer).getAllByRole('link')).toHaveLength(5);
  });

  it('se traduce al inglés', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Author: Aitor Sánchez Gutiérrez. © 2026 - All rights reserved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact (opens in a new tab)' })).toBeInTheDocument();
  });
});

describe('Política de privacidad', () => {
  it('se abre desde el pie con las 11 secciones y sin selector de modos', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Privacidad' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Política de Privacidad' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).filter((h) => /^\d+\. /.test(h.textContent ?? ''))).toHaveLength(11);
    expect(screen.getByText(/20\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Modo de comparación' })).not.toBeInTheDocument();
    expect(document.title).toContain('Política de privacidad');
  });

  it('muestra el responsable, el correo y la AEPD como enlaces', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Privacidad' }));
    await screen.findByRole('heading', { level: 1, name: 'Política de Privacidad' });
    const mails = screen.getAllByRole('link', { name: 'blog.cottage627@passinbox.com' });
    expect(mails.length).toBeGreaterThanOrEqual(2);
    expect(mails[0]).toHaveAttribute('href', 'mailto:blog.cottage627@passinbox.com');
    expect(screen.getByRole('link', { name: 'www.aepd.es' })).toHaveAttribute('href', 'https://www.aepd.es/');
    expect(screen.getByText('Aitor Sánchez Gutiérrez')).toBeInTheDocument();
  });

  it('marca el texto legal como español aunque la interfaz esté en inglés', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(await screen.findByText('The legal text is provided in Spanish only.')).toBeInTheDocument();
    expect(document.querySelector('article')).toHaveAttribute('lang', 'es');
  });

  it('el botón de volver regresa a la aplicación', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Privacidad' }));
    await user.click(await screen.findByRole('button', { name: 'Volver a la aplicación' }));
    expect(await screen.findByLabelText('Texto original (A)')).toBeVisible();
  });
});

describe('DiffViewer', () => {
  const lines = (n: number, change?: number) =>
    Array.from({ length: n }, (_, i) => (i === change ? `CAMBIO ${i}` : `linea ${i}`)).join('\n');

  it('pliega los bloques largos sin cambios y los expande al pulsar', async () => {
    const user = userEvent.setup();
    renderViewer(lines(60, 30), lines(60));
    const fold = screen.getAllByRole('button', { name: /líneas sin cambios/ });
    expect(fold.length).toBe(2);
    await user.click(fold[0]!);
    expect(screen.getAllByRole('button', { name: /líneas sin cambios/ }).length).toBe(1);
  });

  it('no pliega nada con la opción desactivada', () => {
    renderViewer(lines(60, 30), lines(60), { ...DEFAULT_VIEW_SETTINGS, collapseEqual: false });
    expect(screen.queryByRole('button', { name: /líneas sin cambios/ })).not.toBeInTheDocument();
  });

  it('navega entre cambios con los botones y con las teclas n/p', async () => {
    const user = userEvent.setup();
    const a = 'x\n' + 'igual\n'.repeat(20) + 'y\n' + 'igual\n'.repeat(20) + 'z';
    const b = 'X\n' + 'igual\n'.repeat(20) + 'Y\n' + 'igual\n'.repeat(20) + 'Z';
    renderViewer(a, b);
    expect(screen.getByText('Cambio – de 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente cambio/ }));
    expect(screen.getByText('Cambio 1 de 3')).toBeInTheDocument();
    await user.keyboard('n');
    expect(screen.getByText('Cambio 2 de 3')).toBeInTheDocument();
    await user.keyboard('p');
    expect(screen.getByText('Cambio 1 de 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cambio anterior/ }));
    expect(screen.getByText('Cambio 3 de 3')).toBeInTheDocument(); // da la vuelta
  });

  it('las teclas n/p no actúan mientras se escribe en el buscador', async () => {
    const user = userEvent.setup();
    renderViewer('a\nb', 'a\nB');
    const search = screen.getByLabelText('Buscar en las diferencias');
    await user.click(search);
    await user.keyboard('n');
    expect(search).toHaveValue('n');
    expect(screen.getByText('Cambio – de 1')).toBeInTheDocument();
  });

  it('el buscador cuenta coincidencias', async () => {
    const user = userEvent.setup();
    renderViewer('foo\nbar', 'foo\nbaz');
    await user.type(screen.getByLabelText('Buscar en las diferencias'), 'ba');
    // 'bar' y 'baz' forman una sola fila modificada: 1 coincidencia (se cuentan filas).
    expect(screen.getByText('– de 1')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar en las diferencias'));
    await user.type(screen.getByLabelText('Buscar en las diferencias'), 'zzz');
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('en vista unificada muestra líneas eliminadas y añadidas por separado', () => {
    renderViewer('uno', 'dos', { ...DEFAULT_VIEW_SETTINGS, viewMode: 'unified' });
    const region = screen.getByRole('region', { name: 'Diferencias línea a línea' });
    expect(within(region).getByText('Línea eliminada.')).toBeInTheDocument();
    expect(within(region).getByText('Línea añadida.')).toBeInTheDocument();
  });

  it('avisa cuando el resultado es aproximado y cuando se normalizó JSON', () => {
    const result = { ...computeDiff('a', 'b', DEFAULT_DIFF_OPTIONS), approximate: true, jsonNormalized: true };
    render(
      <I18nProvider>
        <DiffViewer result={result} settings={DEFAULT_VIEW_SETTINGS} onSettingsChange={() => undefined} labelA="A" labelB="B" />
      </I18nProvider>,
    );
    expect(screen.getByText(/aproximación/)).toBeInTheDocument();
    expect(screen.getByText(/JSON formateado/)).toBeInTheDocument();
  });

  it('virtualiza listas enormes: no renderiza decenas de miles de filas', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 5000 }, (_, i) => `b${i}`).join('\n');
    const { container } = renderViewer(a, b);
    expect(container.querySelectorAll('[data-entry]').length).toBeLessThan(200);
  });

  it('mantiene el rendimiento de render con un diff mediano sin virtualizar', async () => {
    await act(async () => {
      renderViewer(lines(300, 150), lines(300));
    });
    expect(screen.getByText(/Similitud/)).toBeInTheDocument();
  });
});

/** Simula las etiquetas del <head> de index.html (en los tests no hay HTML cargado). */
function addHeadTags() {
  const add = (html: string) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    const el = t.content.firstElementChild!;
    el.setAttribute('data-test-meta', '');
    document.head.appendChild(el);
  };
  add('<meta name="description" content="">');
  add('<meta property="og:title" content="">');
  add('<meta property="og:description" content="">');
  add('<meta property="og:url" content="">');
  add('<meta name="twitter:title" content="">');
  add('<meta name="twitter:description" content="">');
  add('<link rel="canonical" href="">');
}
const head = (sel: string, attr: string) => document.head.querySelector(sel)?.getAttribute(attr);

describe('Rutas reales', () => {
  it('abre /acerca-de directamente y muestra "Acerca de" con su título', async () => {
    window.history.replaceState(null, '', '/acerca-de');
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: 'Acerca de DiferenciAItor' })).toBeInTheDocument();
    expect(document.title).toBe(PAGE_META.about.title.es);
  });

  it('abre /privacidad directamente, también con barra final', async () => {
    window.history.replaceState(null, '', '/privacidad/');
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: 'Política de Privacidad' })).toBeInTheDocument();
  });

  it('los enlaces antiguos /#about y /#privacy se convierten en la URL real', async () => {
    window.history.replaceState(null, '', '/#about');
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: 'Acerca de DiferenciAItor' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/acerca-de'));
    expect(window.location.hash).toBe('');
  });

  it('un enlace antiguo (#about) que llega con la app ya abierta también se convierte en la URL real', async () => {
    renderApp();
    window.history.pushState(null, '', '/#about');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Acerca de DiferenciAItor' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/acerca-de');
    expect(window.location.hash).toBe('');
  });

  it('un clic normal navega sin recargar y actualiza la URL; Atrás vuelve a la portada', async () => {
    const user = userEvent.setup();
    renderApp();
    fireEvent.change(screen.getByLabelText('Texto original (A)'), { target: { value: 'no se pierde' } });
    await user.click(screen.getByRole('link', { name: 'Acerca de' }));
    await screen.findByRole('heading', { level: 1, name: 'Acerca de DiferenciAItor' });
    expect(window.location.pathname).toBe('/acerca-de');

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    // El estado de la herramienta se conserva porque no hubo recarga.
    expect(await screen.findByLabelText('Texto original (A)')).toHaveValue('no se pierde');
  });

  it('el clic en un enlace interno evita la recarga (preventDefault)', () => {
    renderApp();
    const notPrevented = fireEvent.click(screen.getByRole('link', { name: 'Privacidad' }));
    expect(notPrevented).toBe(false);
    expect(window.location.pathname).toBe('/privacidad');
  });

  it('la marca de la barra superior es un enlace real a la portada', async () => {
    window.history.replaceState(null, '', '/acerca-de');
    renderApp();
    const brand = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/')!;
    expect(brand).toBeDefined();
    fireEvent.click(brand);
    expect(await screen.findByLabelText('Texto original (A)')).toBeVisible();
    expect(window.location.pathname).toBe('/');
  });

  it('las herramientas siguen usando el hash (#files, #folders)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Archivos/ }));
    expect(window.location.pathname + window.location.hash).toBe('/#files');
  });
});

describe('Metadatos al navegar', () => {
  it('actualiza título, descripción, canonical y Open Graph en cada página', async () => {
    addHeadTags();
    const user = userEvent.setup();
    renderApp();
    expect(document.title).toBe(PAGE_META.home.title.es);
    expect(head('link[rel="canonical"]', 'href')).toBe('https://diferenciaitor.vercel.app/');

    await user.click(screen.getByRole('link', { name: 'Privacidad' }));
    await screen.findByRole('heading', { level: 1, name: 'Política de Privacidad' });
    expect(document.title).toBe(PAGE_META.privacy.title.es);
    expect(head('meta[name="description"]', 'content')).toBe(PAGE_META.privacy.description.es);
    expect(head('link[rel="canonical"]', 'href')).toBe('https://diferenciaitor.vercel.app/privacidad');
    expect(head('meta[property="og:url"]', 'content')).toBe('https://diferenciaitor.vercel.app/privacidad');
    expect(head('meta[property="og:title"]', 'content')).toBe(PAGE_META.privacy.title.es);
    expect(head('meta[name="twitter:description"]', 'content')).toBe(PAGE_META.privacy.description.es);
  });

  it('las tres herramientas comparten el título y el canonical de la portada', async () => {
    addHeadTags();
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Carpetas/ }));
    expect(document.title).toBe(PAGE_META.home.title.es);
    expect(head('link[rel="canonical"]', 'href')).toBe('https://diferenciaitor.vercel.app/');
  });

  it('cambia el título al inglés al cambiar de idioma', async () => {
    addHeadTags();
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.title).toBe(PAGE_META.home.title.en);
    expect(head('meta[name="description"]', 'content')).toBe(PAGE_META.home.description.en);
  });
});

describe('Encabezados y idioma por defecto', () => {
  it('la portada tiene un único h1 con la palabra clave, sea cual sea la herramienta', async () => {
    const user = userEvent.setup();
    renderApp();
    const h1 = () => screen.getAllByRole('heading', { level: 1 });
    expect(h1()).toHaveLength(1);
    expect(h1()[0]).toHaveTextContent('Comparar textos, archivos y carpetas online');
    await user.click(screen.getByRole('button', { name: /Archivos/ }));
    expect(h1()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Carpetas/ }));
    expect(h1()).toHaveLength(1);
  });

  it('"Acerca de" y "Privacidad" también tienen un único h1', async () => {
    window.history.replaceState(null, '', '/acerca-de');
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Acerca de DiferenciAItor' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('arranca en español aunque el navegador (o Googlebot) declare inglés', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    try {
      renderApp();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Comparar textos, archivos y carpetas online');
      expect(document.documentElement.lang).toBe('es');
    } finally {
      Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
    }
  });

  it('recuerda la elección manual de idioma', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await user.click(screen.getByRole('button', { name: 'English' }));
    first.unmount();
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Compare texts, files and folders online');
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { I18nProvider } from '../i18n';
import { DEFAULT_DIFF_OPTIONS, DEFAULT_VIEW_SETTINGS } from '../types';
import { computeDiff } from '../utils/diffEngine';
import { DiffViewer } from './DiffViewer';

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
    await user.click(screen.getByRole('button', { name: 'Acerca de' }));
    expect(await screen.findByText('Acerca de DiferenciAItor')).toBeInTheDocument();
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

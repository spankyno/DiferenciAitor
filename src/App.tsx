import { useCallback, useEffect, useState } from 'react';
import { AboutView } from './components/AboutView';
import { FileDiffView } from './components/FileDiffView';
import { Footer } from './components/Footer';
import { HomeHeading } from './components/HomeHeading';
import { FolderDiffView } from './components/FolderDiffView';
import { ModeSelector } from './components/ModeSelector';
import { Navbar } from './components/Navbar';
import { PrivacyView } from './components/PrivacyView';
import { TextDiffView } from './components/TextDiffView';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { mergeDefaults, usePersistentState } from './hooks/usePersistentState';
import { useI18n } from './i18n';
import { legacyRedirect, navigate, routeFromLocation } from './router';
import {
  DEFAULT_DIFF_OPTIONS,
  DEFAULT_VIEW_SETTINGS,
  type DiffMode,
  type ViewSettings,
} from './types';

const parseView = (raw: unknown): ViewSettings => {
  const v = mergeDefaults(DEFAULT_VIEW_SETTINGS)(raw);
  return v.viewMode === 'unified' || v.viewMode === 'side-by-side' ? v : DEFAULT_VIEW_SETTINGS;
};

const systemPrefersDark = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;

export default function App() {
  const { lang } = useI18n();
  const [mode, setModeState] = useState<DiffMode>(routeFromLocation);
  // Los módulos ya visitados se mantienen montados (ocultos) para conservar su estado.
  const [visited, setVisited] = useState<ReadonlySet<DiffMode>>(
    () => new Set([routeFromLocation()]),
  );

  const [options, setOptions] = usePersistentState(
    'options',
    DEFAULT_DIFF_OPTIONS,
    mergeDefaults(DEFAULT_DIFF_OPTIONS),
  );
  const [settings, setSettings] = usePersistentState('view', DEFAULT_VIEW_SETTINGS, parseView);
  const [theme, setTheme] = usePersistentState<'dark' | 'light'>(
    'theme',
    systemPrefersDark() ? 'dark' : 'light',
    (raw) => (raw === 'light' ? 'light' : 'dark'),
  );
  const dark = theme === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#020617' : '#ffffff');
  }, [dark]);

  // Los enlaces antiguos (/#about, /#privacy) pasan a su URL real, ya sea al abrir la página
  // o al cambiar el hash con la app abierta.
  const fixLegacyUrl = useCallback(() => {
    const target = legacyRedirect();
    if (target) window.history.replaceState(null, '', target);
  }, []);

  useEffect(() => {
    fixLegacyUrl();
  }, [fixLegacyUrl]);

  // Atrás/Adelante, cambios de hash y navegación interna (navigate()) llegan como popstate/hashchange.
  useEffect(() => {
    const sync = () => {
      fixLegacyUrl();
      const m = routeFromLocation();
      setModeState(m);
      setVisited((v) => (v.has(m) ? v : new Set(v).add(m)));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [fixLegacyUrl]);

  const setMode = useCallback((m: DiffMode) => navigate(m), []);

  useDocumentMeta(mode, lang);

  const shared = { options, onOptionsChange: setOptions, settings, onSettingsChange: setSettings };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar dark={dark} onToggleTheme={() => setTheme(dark ? 'light' : 'dark')} />
      {mode !== 'about' && mode !== 'privacy' && (
        <>
          <HomeHeading />
          <ModeSelector mode={mode} setMode={setMode} />
        </>
      )}
      <main className="flex-1">
        {visited.has('text') && (
          <div hidden={mode !== 'text'}>
            <TextDiffView {...shared} />
          </div>
        )}
        {visited.has('files') && (
          <div hidden={mode !== 'files'}>
            <FileDiffView {...shared} />
          </div>
        )}
        {visited.has('folders') && (
          <div hidden={mode !== 'folders'}>
            <FolderDiffView {...shared} />
          </div>
        )}
        {mode === 'about' && <AboutView setMode={setMode} />}
        {mode === 'privacy' && <PrivacyView setMode={setMode} />}
      </main>
      <Footer />
    </div>
  );
}

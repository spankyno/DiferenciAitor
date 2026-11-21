import { useCallback, useEffect, useState } from 'react';
import { AboutView } from './components/AboutView';
import { FileDiffView } from './components/FileDiffView';
import { Footer } from './components/Footer';
import { FolderDiffView } from './components/FolderDiffView';
import { ModeSelector } from './components/ModeSelector';
import { Navbar } from './components/Navbar';
import { PrivacyView } from './components/PrivacyView';
import { TextDiffView } from './components/TextDiffView';
import { mergeDefaults, usePersistentState } from './hooks/usePersistentState';
import { useI18n } from './i18n';
import {
  DEFAULT_DIFF_OPTIONS,
  DEFAULT_VIEW_SETTINGS,
  type DiffMode,
  type ViewSettings,
} from './types';

const MODES: DiffMode[] = ['text', 'files', 'folders', 'about', 'privacy'];

function modeFromHash(): DiffMode {
  const h = window.location.hash.replace('#', '');
  return (MODES as string[]).includes(h) ? (h as DiffMode) : 'text';
}

const parseView = (raw: unknown): ViewSettings => {
  const v = mergeDefaults(DEFAULT_VIEW_SETTINGS)(raw);
  return v.viewMode === 'unified' || v.viewMode === 'side-by-side' ? v : DEFAULT_VIEW_SETTINGS;
};

const systemPrefersDark = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;

export default function App() {
  const { t } = useI18n();
  const [mode, setModeState] = useState<DiffMode>(modeFromHash);
  // Los módulos ya visitados se mantienen montados (ocultos) para conservar su estado.
  const [visited, setVisited] = useState<ReadonlySet<DiffMode>>(() => new Set([modeFromHash()]));

  const [options, setOptions] = usePersistentState('options', DEFAULT_DIFF_OPTIONS, mergeDefaults(DEFAULT_DIFF_OPTIONS));
  const [settings, setSettings] = usePersistentState('view', DEFAULT_VIEW_SETTINGS, parseView);
  const [theme, setTheme] = usePersistentState<'dark' | 'light'>(
    'theme',
    systemPrefersDark() ? 'dark' : 'light',
    (raw) => (raw === 'light' ? 'light' : 'dark'),
  );
  const dark = theme === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#ffffff');
  }, [dark]);

  useEffect(() => {
    const onHash = () => {
      const m = modeFromHash();
      setModeState(m);
      setVisited((v) => (v.has(m) ? v : new Set(v).add(m)));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setMode = useCallback((m: DiffMode) => {
    setModeState(m);
    setVisited((v) => (v.has(m) ? v : new Set(v).add(m)));
    if (window.location.hash !== `#${m}`) window.history.pushState(null, '', `#${m}`);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    document.title = `DiferenciAItor — ${t(`mode.${mode}` as 'mode.text')}`;
  }, [mode, t]);

  const shared = { options, onOptionsChange: setOptions, settings, onSettingsChange: setSettings };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar dark={dark} onToggleTheme={() => setTheme(dark ? 'light' : 'dark')} onHome={() => setMode('text')} />
      {mode !== 'about' && mode !== 'privacy' && <ModeSelector mode={mode} setMode={setMode} />}
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

import { FileDiff, Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { focusRing } from './ui';

export function Navbar({
  dark,
  onToggleTheme,
  onHome,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  onHome: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
            <FileDiff className="w-4.5 h-4.5" />
          </span>
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">
            Diferenci<span className="text-indigo-600 dark:text-indigo-400">AI</span>tor
          </span>
        </button>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={t('nav.language')} className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {(['es', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                aria-label={l === 'es' ? 'Español' : 'English'}
                lang={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md ${focusRing} ${
                  lang === l
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={dark ? t('nav.lightMode') : t('nav.darkMode')}
            title={dark ? t('nav.lightMode') : t('nav.darkMode')}
            className={`p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRing}`}
          >
            {dark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>
    </header>
  );
}

import { FileText, FolderTree, Files } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DiffMode } from '../types';
import { focusRing } from './ui';

export function ModeSelector({ mode, setMode }: { mode: DiffMode; setMode: (m: DiffMode) => void }) {
  const { t } = useI18n();
  const items = [
    { id: 'text' as const, icon: FileText, label: t('mode.text'), desc: t('mode.textDesc') },
    { id: 'files' as const, icon: Files, label: t('mode.files'), desc: t('mode.filesDesc') },
    { id: 'folders' as const, icon: FolderTree, label: t('mode.folders'), desc: t('mode.foldersDesc') },
  ];
  return (
    <nav aria-label={t('mode.label')} className="max-w-7xl mx-auto px-4 pt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(({ id, icon: Icon, label, desc }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setMode(id)}
              className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${focusRing} ${
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-900 dark:text-white'
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  active ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-sm">{label}</span>
                <span className={`block text-xs ${active ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>
                  {desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

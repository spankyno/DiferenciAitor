import { Lock } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DiffMode } from '../types';
import { focusRing } from './ui';

export function Footer({ setMode }: { setMode: (m: DiffMode) => void }) {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <p className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          {t('footer.privacy')}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setMode('about')} className={`font-semibold hover:underline rounded ${focusRing}`}>
            {t('footer.about')}
          </button>
          <span>© 2026 Aitor Sánchez Gutiérrez</span>
        </div>
      </div>
    </footer>
  );
}

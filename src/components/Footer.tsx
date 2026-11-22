import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { AppLink } from './AppLink';
import { Logo } from './Logo';
import type { DiffMode } from '../types';
import { focusRing } from './ui';

const link = `inline-flex items-center gap-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-4 transition-colors ${focusRing}`;

function Internal({ mode, children }: { mode: DiffMode; children: ReactNode }) {
  return (
    <li>
      <AppLink mode={mode} className={link}>
        {children}
      </AppLink>
    </li>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
        {children}
        <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
        <span className="sr-only"> {t('footer.newTab')}</span>
      </a>
    </li>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-10 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col items-center gap-3 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-extrabold tracking-tight text-sm text-slate-900 dark:text-white">
            Diferenci<span className="text-indigo-600 dark:text-indigo-400">AI</span>tor
          </span>
        </div>

        <nav aria-label={t('footer.nav')}>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            <Internal mode="about">{t('footer.about')}</Internal>
            <Internal mode="privacy">{t('footer.privacyLink')}</Internal>
            <External href="https://aitorsanchez.pages.dev/">{t('footer.blog')}</External>
            <External href="https://aitorhub.vercel.app/">{t('footer.hub')}</External>
            <External href="https://aitorsanchez.pages.dev/contacto/">
              {t('footer.contact')}
            </External>
          </ul>
        </nav>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <p className="max-w-7xl mx-auto px-4 py-2.5 text-xs text-center md:text-left text-slate-600 dark:text-slate-400">
          {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}

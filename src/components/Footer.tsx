import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Logo } from './Logo';
import { focusRing } from './ui';

const link = `inline-flex items-center gap-1.5 rounded text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-4 transition-colors ${focusRing}`;

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function Internal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} className={link}>
        {children}
      </a>
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
    <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <nav aria-label={t('footer.nav')} className="max-w-7xl mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[minmax(0,1.6fr)_1fr_1fr]">
          <div className="col-span-2 md:col-span-1 space-y-4 max-w-sm">
            <div className="flex items-center gap-2.5">
              <Logo size={32} />
              <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">
                Diferenci<span className="text-indigo-600 dark:text-indigo-400">AI</span>tor
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('footer.tagline')}</p>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-500">{t('footer.note')}</p>
          </div>

          <Column title={t('footer.colApp')}>
            <Internal href="#about">{t('footer.about')}</Internal>
            <Internal href="#privacy">{t('footer.privacyLink')}</Internal>
          </Column>

          <Column title={t('footer.colAuthor')}>
            <External href="https://aitorsanchez.pages.dev/">{t('footer.blog')}</External>
            <External href="https://aitorhub.vercel.app/">{t('footer.hub')}</External>
            <External href="https://aitorsanchez.pages.dev/contacto/">{t('footer.contact')}</External>
          </Column>
        </div>
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <p className="max-w-7xl mx-auto px-4 py-5 text-xs text-center md:text-left text-slate-600 dark:text-slate-400">
          {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}

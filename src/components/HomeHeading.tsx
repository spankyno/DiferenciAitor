import { useI18n } from '../i18n';

/** Único <h1> de la portada (compartido por las tres herramientas). */
export function HomeHeading() {
  const { t } = useI18n();
  return (
    <header className="max-w-7xl mx-auto px-4 pt-7 text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {t('home.h1')}
      </h1>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{t('home.lead')}</p>
    </header>
  );
}

import { ArrowRight, CheckCircle2, Cpu, FileCode2, Globe, Lock, Shield, Zap } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DiffMode } from '../types';
import { btnPrimary, card } from './ui';

export function AboutView({ setMode }: { setMode: (m: DiffMode) => void }) {
  const { t } = useI18n();
  const pillars = [
    { icon: Lock, tone: 'emerald', title: t('about.p1Title'), body: t('about.p1Body') },
    { icon: Zap, tone: 'indigo', title: t('about.p2Title'), body: t('about.p2Body') },
    { icon: Shield, tone: 'purple', title: t('about.p3Title'), body: t('about.p3Body') },
  ];
  const tone: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  };
  const modes = [
    { title: t('about.m1Title'), body: t('about.m1Body') },
    { title: t('about.m2Title'), body: t('about.m2Body') },
    { title: t('about.m3Title'), body: t('about.m3Body') },
  ];
  const stack = [
    { icon: Cpu, title: 'React 19 & Vite', desc: t('about.s1') },
    { icon: FileCode2, title: t('about.s2Title'), desc: t('about.s2') },
    { icon: Shield, title: 'Web Crypto API', desc: t('about.s3') },
    { icon: Globe, title: 'Tailwind CSS v4', desc: t('about.s4') },
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          {t('about.title')}
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-slate-400">{t('about.lead')}</p>
      </div>

      <figure className="mx-auto max-w-4xl">
        <img
          src="/og-image.png"
          alt={t('about.imageAlt')}
          width={1248}
          height={832}
          decoding="async"
          className="block w-full h-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-indigo-950/10 dark:shadow-black/40"
        />
      </figure>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map(({ icon: Icon, tone: tn, title, body }) => (
          <div key={title} className={`${card} p-6 space-y-3`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone[tn]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </div>

      <div className={`${card} p-8 space-y-6`}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('about.modesTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modes.map((m) => (
            <div key={m.title} className="space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {m.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{m.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} p-8 space-y-4`}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('about.shortcutsTitle')}</h2>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <li><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">n</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">p</kbd> — {t('about.shortcutNav')}</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">Enter</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">Shift+Enter</kbd> — {t('about.shortcutSearch')}</li>
        </ul>
      </div>

      <div className={`${card} p-8 space-y-6`}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('about.stackTitle')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stack.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center text-center gap-2">
              <Icon className="w-6 h-6 text-indigo-500" />
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{title}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={() => setMode('text')} className={`${btnPrimary} px-6 py-3 text-sm`}>
          <span>{t('about.cta')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

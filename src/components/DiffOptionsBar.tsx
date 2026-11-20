import { SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DiffOptions } from '../types';
import { Checkbox, card } from './ui';

export function DiffOptionsBar({
  options,
  onChange,
  extra,
}: {
  options: DiffOptions;
  onChange: (o: DiffOptions) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const set = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className={`${card} p-4 flex flex-wrap items-center gap-x-5 gap-y-2`}>
      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
        <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
        {t('options.title')}
      </span>
      <Checkbox
        label={t('options.ignoreWhitespace')}
        title={t('options.ignoreWhitespaceHint')}
        checked={options.ignoreWhitespace}
        onChange={(v) => set('ignoreWhitespace', v)}
      />
      <Checkbox
        label={t('options.ignoreCase')}
        checked={options.ignoreCase}
        onChange={(v) => set('ignoreCase', v)}
      />
      <Checkbox
        label={t('options.ignoreBlankLines')}
        checked={options.ignoreBlankLines}
        onChange={(v) => set('ignoreBlankLines', v)}
      />
      <Checkbox
        label={t('options.formatJson')}
        title={t('options.formatJsonHint')}
        checked={options.formatJson}
        onChange={(v) => set('formatJson', v)}
      />
      {extra}
    </div>
  );
}

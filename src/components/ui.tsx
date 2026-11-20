import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { copyToClipboard } from '../utils/download';

export const card =
  'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

export const btnSecondary = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:pointer-events-none ${focusRing}`;

export const btnPrimary = `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50 disabled:pointer-events-none ${focusRing}`;

export const btnDanger = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 ${focusRing}`;

export function Checkbox({
  label,
  checked,
  onChange,
  mono,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  mono?: boolean;
  title?: string;
}) {
  return (
    <label
      title={title}
      className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700 dark:text-slate-300"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`rounded border-slate-300 text-indigo-600 dark:border-slate-600 dark:bg-slate-800 ${focusRing}`}
      />
      <span className={mono ? 'font-mono' : ''}>{label}</span>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${focusRing} ${
            value === o.value
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Botón de copiar con su propio estado de "copiado". */
export function CopyButton({
  getText,
  title,
  label,
  className = '',
}: {
  getText: () => string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { t } = useI18n();

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyToClipboard(getText());
    setState(ok ? 'ok' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`${label ? btnSecondary : `p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRing}`} ${className}`}
    >
      {state === 'ok' ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {label && <span>{state === 'ok' ? t('common.copied') : state === 'fail' ? t('common.copyFailed') : label}</span>}
      <span className="sr-only" role="status">
        {state === 'ok' ? t('common.copied') : state === 'fail' ? t('common.copyFailed') : ''}
      </span>
    </button>
  );
}

export function IconButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string },
) {
  const { className = '', ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none ${focusRing} ${className}`}
    />
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
      <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
      <span>{label}</span>
    </div>
  );
}

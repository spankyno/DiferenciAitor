import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, Equal, FileWarning, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDiff } from '../hooks/useDiff';
import { useI18n } from '../i18n';
import type { DiffOptions, ViewSettings } from '../types';
import { differOnlyInLineEndings } from '../utils/diffEngine';
import { downloadText } from '../utils/download';
import { analyzeFile, type FileAnalysis } from '../utils/fileAnalysis';
import { createUnifiedPatch, patchToMarkdown } from '../utils/patch';
import { DiffOptionsBar } from './DiffOptionsBar';
import { DiffViewer } from './DiffViewer';
import { FilePicker } from './FilePicker';
import { CopyButton, Spinner, btnDanger, btnSecondary, card } from './ui';

interface Props {
  options: DiffOptions;
  onOptionsChange: (o: DiffOptions) => void;
  settings: ViewSettings;
  onSettingsChange: (s: ViewSettings) => void;
}

export function FileDiffView({ options, onOptionsChange, settings, onSettingsChange }: Props) {
  const { t } = useI18n();
  const [a, setA] = useState<FileAnalysis | null>(null);
  const [b, setB] = useState<FileAnalysis | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  // Evita que una lectura lenta antigua pise a una más reciente.
  const seq = useRef({ A: 0, B: 0 });

  const load = async (side: 'A' | 'B', file: File) => {
    const id = ++seq.current[side];
    const [setLoading, setInfo] = side === 'A' ? [setLoadingA, setA] : [setLoadingB, setB];
    setLoading(true);
    const info = await analyzeFile(file);
    if (id !== seq.current[side]) return;
    setInfo(info);
    setLoading(false);
  };

  const clear = (side: 'A' | 'B') => {
    seq.current[side]++;
    if (side === 'A') {
      setA(null);
      setLoadingA(false);
    } else {
      setB(null);
      setLoadingB(false);
    }
  };

  const swap = () => {
    seq.current.A++;
    seq.current.B++;
    setA(b);
    setB(a);
    setLoadingA(false);
    setLoadingB(false);
  };

  const textA = a?.text ?? null;
  const textB = b?.text ?? null;
  const bothText = textA !== null && textB !== null;
  const { result, loading, error } = useDiff(bothText ? textA : null, bothText ? textB : null, options);

  const ready = a && b;
  const sameHash = !!(a && b && !a.hashSkipped && !b.hashSkipped && a.hash === b.hash);
  const sameSizeDate = !!(a && b && a.hashSkipped && a.size === b.size && a.file.lastModified === b.file.lastModified);
  const patch = () => createUnifiedPatch(a!.file.name, b!.file.name, textA ?? '', textB ?? '');

  let banner: { tone: 'ok' | 'info' | 'warn'; title: string; body?: string } | null = null;
  if (ready) {
    if (sameHash) {
      banner = { tone: 'ok', title: t('file.identical'), body: sameSizeDate ? undefined : t('file.sameSize') };
    } else if (sameSizeDate) {
      banner = { tone: 'info', title: t('file.sameBySizeDate') };
    } else if (result?.identical) {
      banner = {
        tone: 'info',
        title: t('file.equivalent'),
        body: differOnlyInLineEndings(textA!, textB!) ? t('file.onlyLineEndings') : t('file.equivalentBody'),
      };
    } else {
      const diff = Math.abs(a.size - b.size);
      banner = {
        tone: 'warn',
        title: t('file.differences'),
        body: diff === 0 ? t('file.sameSize') : t('file.sizeDiff', { bytes: diff.toLocaleString() }),
      };
    }
  }

  const tones = {
    ok: ['bg-emerald-500/10 text-emerald-500', <CheckCircle2 key="i" className="w-6 h-6" />],
    info: ['bg-sky-500/10 text-sky-500', <Equal key="i" className="w-6 h-6" />],
    warn: ['bg-amber-500/10 text-amber-500', <AlertTriangle key="i" className="w-6 h-6" />],
  } as const;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('file.heading')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('file.subheading')}</p>
      </div>

      <div className={`${card} p-4 flex flex-wrap items-center justify-end gap-2`}>
        <button type="button" className={btnSecondary} disabled={!a && !b} onClick={swap}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {t('actions.swap')}
        </button>
        <button
          type="button"
          className={btnDanger}
          disabled={!a && !b}
          onClick={() => {
            clear('A');
            clear('B');
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('actions.clear')}
        </button>
      </div>

      <DiffOptionsBar options={options} onChange={onOptionsChange} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FilePicker
          title={t('file.titleA')}
          dot="bg-red-500"
          analysis={a}
          loading={loadingA}
          inputId="file-a"
          onFile={(f) => load('A', f)}
          onClear={() => clear('A')}
        />
        <FilePicker
          title={t('file.titleB')}
          dot="bg-emerald-500"
          analysis={b}
          loading={loadingB}
          inputId="file-b"
          onFile={(f) => load('B', f)}
          onClear={() => clear('B')}
        />
      </div>

      {!ready && !loadingA && !loadingB && (a || b) && (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">{t('file.needBoth')}</p>
      )}

      {banner && (
        <div className={`${card} p-5 flex items-center gap-3`} role="status">
          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${tones[banner.tone][0]}`}>
            {tones[banner.tone][1]}
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">{banner.title}</h3>
            {banner.body && <p className="text-xs text-slate-600 dark:text-slate-400">{banner.body}</p>}
          </div>
        </div>
      )}

      {ready && !sameHash && !bothText && (
        <div className={`${card} p-5 flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300`}>
          <FileWarning className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <span>
            {a.isBinary || b.isBinary ? t('file.noDiffBinary') : t('file.noDiffLarge')}
          </span>
        </div>
      )}

      {bothText && !sameHash && (
        error ? (
          <div role="alert" className={`${card} p-5 text-sm text-red-700 dark:text-red-300`}>
            {t('common.error', { message: error })}
          </div>
        ) : !result ? (
          <div className={`${card} p-8 flex justify-center`}>
            <Spinner label={t('common.comparing')} />
          </div>
        ) : (
          !result.identical && (
            <div className={loading ? 'opacity-60 transition-opacity' : ''} aria-busy={loading}>
              <DiffViewer
                result={result}
                settings={settings}
                onSettingsChange={onSettingsChange}
                labelA={a!.file.name}
                labelB={b!.file.name}
                actions={
                  <>
                    <CopyButton getText={() => patchToMarkdown(patch())} title={t('actions.copyMarkdown')} label={t('actions.copyMarkdown')} />
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => downloadText(patch(), `${b!.file.name}.patch`, 'text/x-diff')}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t('actions.exportPatch')}
                    </button>
                  </>
                }
              />
            </div>
          )
        )
      )}
    </div>
  );
}

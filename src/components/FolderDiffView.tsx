import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Download,
  Equal,
  Eye,
  FileCode2,
  FolderGit2,
  MinusCircle,
  MoveRight,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiff } from '../hooks/useDiff';
import { mergeDefaults, usePersistentState } from '../hooks/usePersistentState';
import { useI18n, type TFunction } from '../i18n';
import type {
  DiffOptions,
  FolderComparisonItem,
  FolderFileEntry,
  FolderStatus,
  ViewSettings,
} from '../types';
import { downloadText } from '../utils/download';
import { readTextIfPossible } from '../utils/fileAnalysis';
import {
  compareFolders,
  effectiveStatus,
  findEquivalent,
  folderStats,
} from '../utils/folderCompare';
import { scanFolder, type FolderSource, type ScanError, type ScanProgress } from '../utils/folderScan';
import { DEFAULT_IGNORE_PATTERNS, compileIgnore, parsePatterns } from '../utils/glob';
import { formatBytes } from '../utils/hash';
import { createUnifiedPatch, patchToMarkdown } from '../utils/patch';
import { buildReportRows, toCSV, toHTML, toJSON } from '../utils/report';
import { DiffOptionsBar } from './DiffOptionsBar';
import { DiffViewer } from './DiffViewer';
import {
  Checkbox,
  CopyButton,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  focusRing,
} from './ui';

interface Props {
  options: DiffOptions;
  onOptionsChange: (o: DiffOptions) => void;
  settings: ViewSettings;
  onSettingsChange: (s: ViewSettings) => void;
}

interface Side {
  source: FolderSource | null;
  entries: Map<string, FolderFileEntry>;
  errors: ScanError[];
  ignored: number;
}

const EMPTY_SIDE: Side = { source: null, entries: new Map(), errors: [], ignored: 0 };

type SideKey = 'A' | 'B';
type Filter = 'all' | FolderStatus;

const STATUS_STYLE: Record<FolderStatus, string> = {
  identical: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  equivalent: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  modified: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  added: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  deleted: 'bg-red-500/15 text-red-800 dark:text-red-300',
  renamed: 'bg-violet-500/15 text-violet-800 dark:text-violet-300',
};

function statusLabel(t: TFunction, s: FolderStatus): string {
  return t(`status.${s}`);
}

function StatusIcon({ status }: { status: FolderStatus }) {
  const cls = 'w-3 h-3 shrink-0';
  switch (status) {
    case 'identical':
      return <CheckCircle2 className={cls} />;
    case 'equivalent':
      return <Equal className={cls} />;
    case 'modified':
      return <AlertTriangle className={cls} />;
    case 'added':
      return <PlusCircle className={cls} />;
    case 'deleted':
      return <MinusCircle className={cls} />;
    case 'renamed':
      return <MoveRight className={cls} />;
  }
}

/* -------------------------------------------------------------------------- */
/*  Inspector: lee el contenido solo cuando se abre                            */
/* -------------------------------------------------------------------------- */

type InspectMode = 'diff' | 'contentA' | 'contentB' | 'info';

function useFileText(file: File | undefined, enabled: boolean) {
  const [state, setState] = useState<{ text: string | null; loading: boolean; error?: string }>({
    text: null,
    loading: enabled && !!file,
  });
  useEffect(() => {
    if (!enabled || !file) {
      setState({ text: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ text: null, loading: true });
    readTextIfPossible(file)
      .then((text) => !cancelled && setState({ text, loading: false }))
      .catch((e) => !cancelled && setState({ text: null, loading: false, error: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [file, enabled]);
  return state;
}

function Inspector({
  item,
  mode,
  nameA,
  nameB,
  options,
  settings,
  onSettingsChange,
  onClose,
}: {
  item: FolderComparisonItem;
  mode: InspectMode;
  nameA: string;
  nameB: string;
  options: DiffOptions;
  settings: ViewSettings;
  onSettingsChange: (s: ViewSettings) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const fileA = item.fileA;
  const fileB = item.fileB;

  const needA = mode === 'diff' || mode === 'contentA';
  const needB = mode === 'diff' || mode === 'contentB';
  const ta = useFileText(fileA?.file, needA);
  const tb = useFileText(fileB?.file, needB);
  const loading = ta.loading || tb.loading;

  const diffReady = mode === 'diff' && ta.text !== null && tb.text !== null;
  const { result, loading: diffLoading, error } = useDiff(
    diffReady ? ta.text : null,
    diffReady ? tb.text : null,
    options,
  );

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [item, mode]);

  const title =
    mode === 'diff'
      ? t('folder.inspectDiff', { path: item.path })
      : mode === 'contentB'
        ? t('folder.inspectNew', { path: item.path })
        : mode === 'contentA'
          ? t('folder.inspectOld', { path: item.path })
          : t('folder.inspectInfo', { path: item.path });

  const text = mode === 'contentA' ? ta.text : mode === 'contentB' ? tb.text : null;

  const unavailable = (
    <p className="p-4 text-sm text-slate-700 dark:text-slate-300">{t('folder.noPreview')}</p>
  );

  const meta = (label: string, f?: FolderFileEntry) =>
    f && (
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs min-w-0">
        <p className="font-bold text-slate-900 dark:text-white">{label}</p>
        <p className="font-mono text-slate-700 dark:text-slate-300 break-all">{f.relativePath}</p>
        <p className="text-slate-600 dark:text-slate-400">
          {formatBytes(f.size)} · {new Date(f.lastModified).toLocaleString()}
        </p>
        <div className="flex items-center gap-1 min-w-0">
          <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">
            SHA-256: {f.hash || t('file.noHash')}
          </p>
          {f.hash && <CopyButton getText={() => f.hash} title={t('file.copyHash')} />}
        </div>
      </div>
    );

  return (
    <div ref={ref} className={`${card} border-indigo-500/40 p-5 space-y-4 shadow-xl`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 break-all">
            <FileCode2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <span>{title}</span>
          </h3>
          {item.status === 'renamed' && (
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1 break-all">
              {item.fileA?.relativePath} → {item.fileB?.relativePath}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className={btnSecondary}>
          <X className="w-3.5 h-3.5" />
          {t('folder.closeInspector')}
        </button>
      </div>

      {mode === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meta(nameA, fileA)}
          {meta(nameB, fileB)}
          {item.status === 'renamed' && (
            <p className="md:col-span-2 text-xs text-slate-700 dark:text-slate-300">{t('folder.renamedNote')}</p>
          )}
          {(fileA?.isBinary || fileB?.isBinary) && (
            <p className="md:col-span-2 text-xs text-amber-800 dark:text-amber-300">{t('file.noDiffBinary')}</p>
          )}
        </div>
      )}

      {mode !== 'info' && loading && (
        <div className="py-6 flex justify-center">
          <Spinner label={t('file.reading')} />
        </div>
      )}

      {mode === 'diff' && !loading && !diffReady && <div className="rounded-xl border border-slate-200 dark:border-slate-800">{unavailable}</div>}

      {mode === 'diff' && diffReady && (
        error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('common.error', { message: error })}</p>
        ) : !result ? (
          <div className="py-6 flex justify-center">
            <Spinner label={t('common.comparing')} />
          </div>
        ) : result.identical ? (
          <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2" role="status">
            <Equal className="w-4 h-4 text-sky-500" />
            {t('folder.equivalentNote')}
          </p>
        ) : (
          <div className={diffLoading ? 'opacity-60 transition-opacity' : ''}>
            <DiffViewer
              result={result}
              settings={settings}
              onSettingsChange={onSettingsChange}
              labelA={`${nameA}/${item.path}`}
              labelB={`${nameB}/${item.path}`}
              maxHeight="60vh"
              actions={
                <>
                  <CopyButton
                    getText={() => patchToMarkdown(createUnifiedPatch(`${nameA}/${item.path}`, `${nameB}/${item.path}`, ta.text ?? '', tb.text ?? ''))}
                    title={t('actions.copyMarkdown')}
                    label={t('actions.copyMarkdown')}
                  />
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() =>
                      downloadText(
                        createUnifiedPatch(`${nameA}/${item.path}`, `${nameB}/${item.path}`, ta.text ?? '', tb.text ?? ''),
                        `${item.path.split('/').pop()}.patch`,
                        'text/x-diff',
                      )
                    }
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('actions.exportPatch')}
                  </button>
                </>
              }
            />
          </div>
        )
      )}

      {(mode === 'contentA' || mode === 'contentB') && !loading && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {text === null ? (
            unavailable
          ) : (
            <pre
              className={`p-4 font-mono text-xs whitespace-pre-wrap break-all overflow-auto max-h-[60vh] ${
                mode === 'contentB' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'
              }`}
            >
              {text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Selector de carpeta                                                        */
/* -------------------------------------------------------------------------- */

function FolderPicker({
  title,
  dot,
  side,
  scanning,
  progress,
  inputId,
  onPick,
  onFiles,
  onCancel,
  apiSupported,
}: {
  title: string;
  dot: string;
  side: Side;
  scanning: boolean;
  progress?: ScanProgress;
  inputId: string;
  onPick: () => void;
  onFiles: (files: FileList) => void;
  onCancel: () => void;
  apiSupported: boolean;
}) {
  const { t } = useI18n();
  const name = side.source?.name;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const skipped = useMemo(() => [...side.entries.values()].filter((e) => e.hashSkipped).length, [side.entries]);

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full inline-block ${dot}`} aria-hidden />
          {title}
        </span>
        {name && !scanning && (
          <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
            {t('folder.loaded', { name, n: side.entries.size })}
          </span>
        )}
      </div>

      {apiSupported ? (
        <button type="button" onClick={onPick} disabled={scanning} className={`${btnPrimary} w-full`}>
          <FolderGit2 className="w-4 h-4" />
          {t('folder.pick')}
        </button>
      ) : (
        <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
          {t('folder.noApi')}
        </p>
      )}

      <div className="text-center">
        {apiSupported && <span className="text-[11px] text-slate-500">{t('folder.orLegacy')}</span>}
        <input
          id={inputId}
          type="file"
          // @ts-expect-error atributo no estándar, soportado por todos los navegadores modernos
          webkitdirectory=""
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <label
          htmlFor={inputId}
          className={`block mt-1 cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline has-[:focus-visible]:ring-2`}
        >
          {apiSupported ? t('folder.browse') : t('folder.pickLegacy')}
        </label>
      </div>

      {scanning && (
        <div className="space-y-2" role="status">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span>
              {progress?.phase === 'hashing'
                ? t('folder.hashing', { done: progress.done, total: progress.total })
                : t('folder.listing', { n: progress?.done ?? 0 })}
            </span>
            <button type="button" onClick={onCancel} className="font-semibold text-red-700 dark:text-red-400 hover:underline">
              {t('common.cancel')}
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-[width]"
              style={{ width: progress?.phase === 'hashing' ? `${pct}%` : '8%' }}
            />
          </div>
        </div>
      )}

      {!scanning && side.ignored > 0 && (
        <p className="text-[11px] text-slate-600 dark:text-slate-400">{t('folder.ignored', { n: side.ignored })}</p>
      )}
      {!scanning && skipped > 0 && (
        <p className="text-[11px] text-amber-800 dark:text-amber-300">{t('folder.skippedHash', { n: skipped })}</p>
      )}
      {!scanning && side.errors.length > 0 && (
        <details className="text-[11px] text-red-800 dark:text-red-300">
          <summary className="cursor-pointer font-semibold">{t('folder.errors', { n: side.errors.length })}</summary>
          <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto font-mono">
            {side.errors.slice(0, 50).map((e, i) => (
              <li key={i} className="break-all">
                {e.path}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vista principal                                                            */
/* -------------------------------------------------------------------------- */

const ROW_HEIGHT = 46;
const rowGrid = 'grid grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)_8rem_9.5rem] lg:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)_9rem_11rem_9.5rem]';

export function FolderDiffView({ options, onOptionsChange, settings, onSettingsChange }: Props) {
  const { t } = useI18n();
  const [sideA, setSideA] = useState<Side>(EMPTY_SIDE);
  const [sideB, setSideB] = useState<Side>(EMPTY_SIDE);
  const [scanning, setScanning] = useState<Record<SideKey, boolean>>({ A: false, B: false });
  const [progress, setProgress] = useState<Partial<Record<SideKey, ScanProgress>>>({});
  const [scanError, setScanError] = useState<string | null>(null);
  const abort = useRef<Partial<Record<SideKey, AbortController>>>({});

  const [ignoreText, setIgnoreText] = usePersistentState<string>('ignore', DEFAULT_IGNORE_PATTERNS, (raw) =>
    typeof raw === 'string' ? raw : DEFAULT_IGNORE_PATTERNS,
  );
  const [ignoreDraft, setIgnoreDraft] = useState(ignoreText);
  const [prefs, setPrefs] = usePersistentState('folderPrefs', { ignorePathCase: false }, mergeDefaults({ ignorePathCase: false }));

  const [filter, setFilter] = useState<Filter>('all');
  const [pathQuery, setPathQuery] = useState('');
  const [inspected, setInspected] = useState<{ item: FolderComparisonItem; mode: InspectMode } | null>(null);
  const [equivalent, setEquivalent] = useState<ReadonlySet<string>>(new Set());
  const [checkingEq, setCheckingEq] = useState(false);

  const apiSupported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  const setters = { A: setSideA, B: setSideB } as const;

  useEffect(() => () => {
    abort.current.A?.abort();
    abort.current.B?.abort();
  }, []);

  const scan = useCallback(
    async (key: SideKey, source: FolderSource, patterns: string) => {
      abort.current[key]?.abort();
      const ctrl = new AbortController();
      abort.current[key] = ctrl;
      setScanError(null);
      setInspected(null);
      setScanning((s) => ({ ...s, [key]: true }));
      setProgress((p) => ({ ...p, [key]: undefined }));
      try {
        const result = await scanFolder(source, compileIgnore(parsePatterns(patterns)), {
          signal: ctrl.signal,
          onProgress: (p) => !ctrl.signal.aborted && setProgress((prev) => ({ ...prev, [key]: p })),
        });
        if (ctrl.signal.aborted) return;
        setters[key]({ source, entries: result.entries, errors: result.errors, ignored: result.ignored });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setScanError(e instanceof Error ? e.message : String(e));
      } finally {
        if (abort.current[key] === ctrl) setScanning((s) => ({ ...s, [key]: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pickFolder = async (key: SideKey) => {
    if (!window.showDirectoryPicker) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await scan(key, { kind: 'handle', name: handle.name, handle }, ignoreText);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // el usuario canceló
      setScanError(e instanceof Error ? e.message : String(e));
    }
  };

  const pickFiles = (key: SideKey, list: FileList) => {
    const files = Array.from(list);
    const first = files[0];
    const name = first?.webkitRelativePath.split('/')[0] || (key === 'A' ? 'A' : 'B');
    void scan(key, { kind: 'files', name, files }, ignoreText);
  };

  const cancel = (key: SideKey) => {
    abort.current[key]?.abort();
    setScanning((s) => ({ ...s, [key]: false }));
  };

  const rescan = () => {
    setIgnoreText(ignoreDraft);
    if (sideA.source) void scan('A', sideA.source, ignoreDraft);
    if (sideB.source) void scan('B', sideB.source, ignoreDraft);
  };

  const swap = () => {
    abort.current.A?.abort();
    abort.current.B?.abort();
    setScanning({ A: false, B: false });
    setInspected(null);
    setSideA(sideB);
    setSideB(sideA);
  };

  const clear = () => {
    abort.current.A?.abort();
    abort.current.B?.abort();
    setScanning({ A: false, B: false });
    setSideA(EMPTY_SIDE);
    setSideB(EMPTY_SIDE);
    setInspected(null);
    setScanError(null);
    setFilter('all');
    setPathQuery('');
  };

  const busy = scanning.A || scanning.B;
  const ready = !!sideA.source && !!sideB.source && !busy;

  const items = useMemo(
    () => (ready ? compareFolders(sideA.entries, sideB.entries, { ignorePathCase: prefs.ignorePathCase }) : []),
    [ready, sideA.entries, sideB.entries, prefs.ignorePathCase],
  );

  // Segunda pasada: los "modificados" que solo difieren en saltos de línea, espacios, etc.
  useEffect(() => {
    if (items.length === 0) {
      setEquivalent(new Set());
      return;
    }
    const ctrl = new AbortController();
    setCheckingEq(true);
    findEquivalent(items, options, ctrl.signal)
      .then((set) => !ctrl.signal.aborted && setEquivalent(set))
      .catch(() => undefined)
      .finally(() => !ctrl.signal.aborted && setCheckingEq(false));
    return () => ctrl.abort();
  }, [items, options]);

  const stats = useMemo(() => folderStats(items, equivalent), [items, equivalent]);

  const filtered = useMemo(() => {
    const q = pathQuery.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== 'all' && effectiveStatus(i, equivalent) !== filter) return false;
      if (q && !i.path.toLowerCase().includes(q) && !(i.fileA?.relativePath.toLowerCase().includes(q) ?? false)) return false;
      return true;
    });
  }, [items, equivalent, filter, pathQuery]);

  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const nameA = sideA.source?.name ?? 'A';
  const nameB = sideB.source?.name ?? 'B';

  const exportReport = (format: 'csv' | 'json' | 'html') => {
    const rows = buildReportRows(items, (i) => effectiveStatus(i, equivalent), (s) => statusLabel(t, s));
    const headers = [
      t('report.status'),
      t('report.path'),
      t('report.from'),
      t('report.sizeA'),
      t('report.sizeB'),
      t('report.hashA'),
      t('report.hashB'),
    ];
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const base = `diferenciaitor-${stamp}`;
    if (format === 'csv') downloadText(toCSV(rows, headers), `${base}.csv`, 'text/csv');
    else if (format === 'json') {
      downloadText(
        toJSON(rows, { generatedAt: new Date().toISOString(), folderA: nameA, folderB: nameB, stats }),
        `${base}.json`,
        'application/json',
      );
    } else {
      downloadText(
        toHTML(rows, headers, t('report.title', { a: nameA, b: nameB }), t('report.subtitle', { date: new Date().toLocaleString() })),
        `${base}.html`,
        'text/html',
      );
    }
  };

  const openItem = (item: FolderComparisonItem) => {
    const status = effectiveStatus(item, equivalent);
    const textual = (f?: FolderFileEntry) => !!f && !f.isBinary;
    let mode: InspectMode = 'info';
    if ((status === 'modified' || status === 'equivalent') && textual(item.fileA) && textual(item.fileB)) mode = 'diff';
    else if (status === 'added' && textual(item.fileB)) mode = 'contentB';
    else if (status === 'deleted' && textual(item.fileA)) mode = 'contentA';
    setInspected({ item, mode });
  };

  const filterButtons: { key: Filter; label: string; count: number; on: string; off: string }[] = [
    { key: 'all', label: t('filter.all'), count: stats.total, on: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', off: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { key: 'modified', label: t('status.modified'), count: stats.modified, on: 'bg-amber-600 text-white', off: 'bg-amber-500/10 text-amber-800 dark:text-amber-300' },
    { key: 'added', label: t('status.added'), count: stats.added, on: 'bg-emerald-600 text-white', off: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
    { key: 'deleted', label: t('status.deleted'), count: stats.deleted, on: 'bg-red-600 text-white', off: 'bg-red-500/10 text-red-800 dark:text-red-300' },
    { key: 'renamed', label: t('status.renamed'), count: stats.renamed, on: 'bg-violet-600 text-white', off: 'bg-violet-500/10 text-violet-800 dark:text-violet-300' },
    { key: 'equivalent', label: t('status.equivalent'), count: stats.equivalent, on: 'bg-sky-600 text-white', off: 'bg-sky-500/10 text-sky-800 dark:text-sky-300' },
    { key: 'identical', label: t('status.identical'), count: stats.identical, on: 'bg-slate-600 text-white', off: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  ];

  const anyLoaded = !!sideA.source || !!sideB.source;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('folder.heading')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('folder.subheading')}</p>
      </div>

      <div className={`${card} p-4 flex flex-wrap items-center justify-end gap-2`}>
        <button type="button" className={btnSecondary} disabled={!anyLoaded} onClick={swap}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {t('actions.swap')}
        </button>
        <button type="button" className={btnDanger} disabled={!anyLoaded && !scanError} onClick={clear}>
          <Trash2 className="w-3.5 h-3.5" />
          {t('actions.clear')}
        </button>
      </div>

      <DiffOptionsBar
        options={options}
        onChange={onOptionsChange}
        extra={
          <Checkbox
            label={t('folder.ignorePathCase')}
            title={t('folder.ignorePathCaseHint')}
            checked={prefs.ignorePathCase}
            onChange={(v) => setPrefs({ ignorePathCase: v })}
          />
        }
      />

      <details className={`${card} p-4`}>
        <summary className={`cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 ${focusRing} rounded`}>
          {t('folder.excludeTitle')}
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">{t('folder.excludeHelp')}</p>
          <textarea
            value={ignoreDraft}
            onChange={(e) => setIgnoreDraft(e.target.value)}
            rows={5}
            spellCheck={false}
            aria-label={t('folder.excludeTitle')}
            className={`w-full p-3 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${focusRing}`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={rescan} disabled={busy}>
              {anyLoaded ? t('folder.applyRescan') : t('folder.applyPatterns')}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setIgnoreDraft(DEFAULT_IGNORE_PATTERNS)}>
              {t('folder.restoreDefaults')}
            </button>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FolderPicker
          title={t('folder.titleA')}
          dot="bg-red-500"
          side={sideA}
          scanning={scanning.A}
          progress={progress.A}
          inputId="folder-a"
          apiSupported={apiSupported}
          onPick={() => pickFolder('A')}
          onFiles={(f) => pickFiles('A', f)}
          onCancel={() => cancel('A')}
        />
        <FolderPicker
          title={t('folder.titleB')}
          dot="bg-emerald-500"
          side={sideB}
          scanning={scanning.B}
          progress={progress.B}
          inputId="folder-b"
          apiSupported={apiSupported}
          onPick={() => pickFolder('B')}
          onFiles={(f) => pickFiles('B', f)}
          onCancel={() => cancel('B')}
        />
      </div>

      {scanError && (
        <p role="alert" className={`${card} p-4 text-sm text-red-700 dark:text-red-300`}>
          {t('common.error', { message: scanError })}
        </p>
      )}

      {!ready && !busy && anyLoaded && !scanError && (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">{t('folder.needBoth')}</p>
      )}

      {ready && items.length === 0 && (
        <p className={`${card} p-8 text-center text-sm text-slate-600 dark:text-slate-400`}>{t('folder.empty')}</p>
      )}

      {ready && items.length > 0 && (
        <div className="space-y-4">
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label={t('filter.label')}>
              {filterButtons.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${focusRing} ${filter === f.key ? f.on : f.off}`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
              {checkingEq && <span className="text-[11px] text-slate-500 ml-1">{t('folder.checkingEquivalent')}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={pathQuery}
                  onChange={(e) => setPathQuery(e.target.value)}
                  placeholder={t('folder.searchPlaceholder')}
                  aria-label={t('folder.searchPlaceholder')}
                  className={`w-64 max-w-full pl-8 pr-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${focusRing}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('report.export')}>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('report.export')}:</span>
                {(['csv', 'json', 'html'] as const).map((f) => (
                  <button key={f} type="button" className={btnSecondary} onClick={() => exportReport(f)}>
                    <Download className="w-3.5 h-3.5" />
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`${card} overflow-hidden`}>
            <div
              className={`${rowGrid} text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800`}
            >
              <div className="py-2.5 px-4">{t('folder.colStatus')}</div>
              <div className="py-2.5 px-4">{t('folder.colPath')}</div>
              <div className="py-2.5 px-4">{t('folder.colSize')}</div>
              <div className="py-2.5 px-4 hidden lg:block">{t('folder.colHash')}</div>
              <div className="py-2.5 px-4 text-right">{t('folder.colAction')}</div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">{t('folder.noMatches')}</p>
            ) : (
              <div ref={listRef} className="overflow-auto" style={{ maxHeight: '60vh' }} role="region" aria-label={t('folder.listLabel')} tabIndex={0}>
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((v) => {
                    const item = filtered[v.index]!;
                    const status = effectiveStatus(item, equivalent);
                    const textual = (f?: FolderFileEntry) => !!f && !f.isBinary;
                    const canDiff = (status === 'modified' || status === 'equivalent') && textual(item.fileA) && textual(item.fileB);
                    const size =
                      status === 'modified' || status === 'equivalent' || status === 'renamed'
                        ? status === 'renamed'
                          ? formatBytes(item.fileB?.size ?? 0)
                          : `${formatBytes(item.fileA?.size ?? 0)} → ${formatBytes(item.fileB?.size ?? 0)}`
                        : formatBytes((item.fileA ?? item.fileB)?.size ?? 0);
                    const hashOf = (f?: FolderFileEntry) => (f?.hash ? f.hash.slice(0, 10) : '—');
                    const hash =
                      status === 'modified' || status === 'equivalent'
                        ? `${hashOf(item.fileA)} → ${hashOf(item.fileB)}`
                        : hashOf(item.fileB ?? item.fileA);

                    let action: React.ReactNode = <span className="text-slate-400 text-[11px]">—</span>;
                    if (status !== 'identical') {
                      const label = canDiff ? t('folder.viewDiff') : status === 'added' ? t('folder.viewContent') : status === 'deleted' ? t('folder.viewOriginal') : t('folder.details');
                      action = (
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className={`px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs inline-flex items-center gap-1 whitespace-nowrap ${focusRing}`}
                        >
                          {canDiff ? <ArrowRight className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{label}</span>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={v.key}
                        className={`${rowGrid} absolute left-0 w-full items-center text-xs border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/20`}
                        style={{ top: 0, height: v.size, transform: `translateY(${v.start}px)` }}
                      >
                        <div className="px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold ${STATUS_STYLE[status]}`}>
                            <StatusIcon status={status} />
                            <span className="truncate">{statusLabel(t, status)}</span>
                          </span>
                        </div>
                        <div className="px-4 min-w-0 font-mono font-medium text-slate-900 dark:text-white">
                          <div className="truncate" title={item.path}>{item.path}</div>
                          {status === 'renamed' && (
                            <div className="truncate text-[10px] text-slate-500" title={item.fileA?.relativePath}>
                              ← {item.fileA?.relativePath}
                            </div>
                          )}
                        </div>
                        <div className="px-4 text-slate-600 dark:text-slate-400 truncate">{size}</div>
                        <div className="px-4 font-mono text-[10px] text-slate-500 truncate hidden lg:block" title={item.fileB?.hash || item.fileA?.hash}>
                          {hash}
                        </div>
                        <div className="px-4 text-right">{action}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('folder.showing', { shown: filtered.length, total: items.length })}
          </p>

          {inspected && (
            <Inspector
              item={inspected.item}
              mode={inspected.mode}
              nameA={nameA}
              nameB={nameB}
              options={options}
              settings={settings}
              onSettingsChange={onSettingsChange}
              onClose={() => setInspected(null)}
            />
          )}
        </div>
      )}

      {busy && !scanError && (
        <div className={`${card} p-6 flex justify-center`}>
          <Spinner label={t('folder.working')} />
        </div>
      )}

    </div>
  );
}

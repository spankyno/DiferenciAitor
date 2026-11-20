import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns,
  Info,
  Rows,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { DiffLine, DiffResult, DiffRow, ViewSettings } from '../types';
import { Checkbox, IconButton, SegmentedControl, card, focusRing } from './ui';

/** Líneas de contexto que se muestran alrededor de cada cambio al plegar. */
const CONTEXT = 3;
/** No se pliegan tramos de menos de estas líneas (no compensa). */
const MIN_FOLD = 4;
/** A partir de este número de entradas se virtualiza la lista. */
const VIRTUALIZE_FROM = 400;

interface UniLine {
  kind: 'equal' | 'removed' | 'added';
  oldNo?: number;
  newNo?: number;
  line: DiffLine;
  blank?: boolean;
}

type Entry =
  | { type: 'fold'; start: number; end: number }
  | { type: 'sbs'; row: DiffRow; changed: boolean }
  | { type: 'uni'; uni: UniLine; changed: boolean };

function entriesFor(
  rows: DiffRow[],
  unified: boolean,
  collapse: boolean,
  expanded: ReadonlySet<number>,
): Entry[] {
  const n = rows.length;
  const visible = new Uint8Array(n);
  if (collapse) {
    for (let i = 0; i < n; i++) {
      if (rows[i]!.kind !== 'equal') {
        const from = Math.max(0, i - CONTEXT);
        const to = Math.min(n - 1, i + CONTEXT);
        for (let k = from; k <= to; k++) visible[k] = 1;
      }
    }
  } else {
    visible.fill(1);
  }

  const out: Entry[] = [];
  const pushRow = (row: DiffRow) => {
    if (!unified) {
      out.push({ type: 'sbs', row, changed: row.kind !== 'equal' });
      return;
    }
    if (row.kind === 'equal') {
      const line = (row.left ?? row.right)!;
      const u: UniLine = { kind: 'equal', line };
      if (row.left) u.oldNo = row.left.no;
      if (row.right) u.newNo = row.right.no;
      if (row.blank) u.blank = true;
      out.push({ type: 'uni', uni: u, changed: false });
    } else {
      if (row.left && row.kind !== 'added') {
        out.push({
          type: 'uni',
          uni: { kind: 'removed', oldNo: row.left.no, line: row.left },
          changed: true,
        });
      }
      if (row.right && row.kind !== 'removed') {
        out.push({
          type: 'uni',
          uni: { kind: 'added', newNo: row.right.no, line: row.right },
          changed: true,
        });
      }
    }
  };

  let i = 0;
  while (i < n) {
    if (visible[i]) {
      pushRow(rows[i]!);
      i++;
      continue;
    }
    let j = i;
    while (j < n && !visible[j]) j++;
    if (j - i >= MIN_FOLD && !expanded.has(i)) out.push({ type: 'fold', start: i, end: j });
    else for (let k = i; k < j; k++) pushRow(rows[k]!);
    i = j;
  }
  return out;
}

function entryText(e: Entry): string {
  if (e.type === 'fold') return '';
  if (e.type === 'uni') return e.uni.line.text;
  return `${e.row.left?.text ?? ''}\n${e.row.right?.text ?? ''}`;
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

const gridSbs = 'grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem_minmax(0,1fr)]';
const gridUni = 'grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)]';
const numCell =
  'py-0.5 px-2 text-right text-slate-500 dark:text-slate-500 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40';
const textCell = 'py-0.5 px-3 whitespace-pre-wrap break-all min-w-0';

function Content({ line, side }: { line: DiffLine; side: 'left' | 'right' | 'plain' }) {
  if (!line.parts) return <>{line.text === '' ? '\u00A0' : line.text}</>;
  const hl = side === 'left' ? 'bg-red-500/30 rounded-sm' : 'bg-emerald-500/30 rounded-sm';
  return (
    <>
      {line.parts.map((p, i) => (
        <span key={i} className={p.changed ? hl : undefined}>
          {p.text}
        </span>
      ))}
    </>
  );
}

export interface DiffViewerProps {
  result: DiffResult;
  settings: ViewSettings;
  onSettingsChange: (s: ViewSettings) => void;
  labelA: string;
  labelB: string;
  /** Botones extra de la barra (exportar, copiar...). */
  actions?: ReactNode;
  /** Altura máxima del área desplazable. */
  maxHeight?: string;
}

export function DiffViewer({
  result,
  settings,
  onSettingsChange,
  labelA,
  labelB,
  actions,
  maxHeight = '70vh',
}: DiffViewerProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unified = settings.viewMode === 'unified';

  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [current, setCurrent] = useState(-1);
  const [query, setQuery] = useState('');
  const [matchPos, setMatchPos] = useState(-1);

  // Un resultado nuevo reinicia plegado, navegación y búsqueda de coincidencias.
  useEffect(() => {
    setExpanded(new Set());
    setCurrent(-1);
    setMatchPos(-1);
  }, [result]);

  const entries = useMemo(
    () => entriesFor(result.rows, unified, settings.collapseEqual, expanded),
    [result.rows, unified, settings.collapseEqual, expanded],
  );

  const hunks = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (e.type !== 'fold' && e.changed && (i === 0 || !isChanged(entries[i - 1]!))) {
        let end = i;
        while (end + 1 < entries.length && isChanged(entries[end + 1]!)) end++;
        out.push({ start: i, end });
      }
    }
    return out;
  }, [entries]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entryText(entries[i]!).toLowerCase().includes(q)) out.push(i);
    }
    return out;
  }, [entries, q]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  useEffect(() => setMatchPos(-1), [q]);

  const virtual = entries.length > VIRTUALIZE_FROM;
  const virtualizer = useVirtualizer({
    count: virtual ? entries.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 25,
  });

  const scrollToEntry = useCallback(
    (index: number) => {
      if (virtual) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      } else {
        scrollRef.current
          ?.querySelector<HTMLElement>(`[data-entry="${index}"]`)
          ?.scrollIntoView({ block: 'center' });
      }
    },
    [virtual, virtualizer],
  );

  const goHunk = useCallback(
    (delta: 1 | -1) => {
      if (hunks.length === 0) return;
      const next = current < 0 ? (delta === 1 ? 0 : hunks.length - 1) : (current + delta + hunks.length) % hunks.length;
      setCurrent(next);
      scrollToEntry(hunks[next]!.start);
    },
    [hunks, current, scrollToEntry],
  );

  const goMatch = useCallback(
    (delta: 1 | -1) => {
      if (matches.length === 0) return;
      const next = matchPos < 0 ? (delta === 1 ? 0 : matches.length - 1) : (matchPos + delta + matches.length) % matches.length;
      setMatchPos(next);
      scrollToEntry(matches[next]!);
    },
    [matches, matchPos, scrollToEntry],
  );

  // Atajos: n / p para siguiente / anterior cambio (si no se está escribiendo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      const root = rootRef.current;
      if (!root || root.closest('[hidden]')) return;
      if (e.key === 'n') goHunk(1);
      else if (e.key === 'p') goHunk(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goHunk]);

  const { stats } = result;
  const currentRange = current >= 0 ? hunks[current] : undefined;

  const renderEntry = (entry: Entry, index: number) => {
    const inCurrent = currentRange !== undefined && index >= currentRange.start && index <= currentRange.end;
    const isMatch = matchSet.has(index);
    const marker = isMatch ? (matches[matchPos] === index ? 'ring-2 ring-amber-400' : 'ring-1 ring-amber-400/70') : '';
    const hunkRing = inCurrent ? 'ring-1 ring-inset ring-indigo-400/70' : '';
    const font = settings.monospace ? 'font-mono' : 'font-sans';

    if (entry.type === 'fold') {
      const count = entry.end - entry.start;
      return (
        <button
          type="button"
          onClick={() => setExpanded((prev) => new Set(prev).add(entry.start))}
          className={`w-full flex items-center justify-center gap-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border-y border-slate-200 dark:border-slate-800 ${focusRing}`}
        >
          <ChevronsUpDown className="w-3.5 h-3.5" />
          {t('diff.foldedLines', { n: count })}
        </button>
      );
    }

    if (entry.type === 'sbs') {
      const { row } = entry;
      const leftTint =
        row.kind === 'removed' || row.kind === 'modified'
          ? 'bg-red-500/10'
          : !row.left
            ? 'bg-slate-100/70 dark:bg-slate-800/30'
            : '';
      const rightTint =
        row.kind === 'added' || row.kind === 'modified'
          ? 'bg-emerald-500/10'
          : !row.right
            ? 'bg-slate-100/70 dark:bg-slate-800/30'
            : '';
      const dim = row.blank ? 'opacity-60' : '';
      const kindLabel =
        row.kind === 'removed'
          ? t('diff.removedLine')
          : row.kind === 'added'
            ? t('diff.addedLine')
            : row.kind === 'modified'
              ? t('diff.modifiedLine')
              : '';
      return (
        <div
          className={`${gridSbs} ${font} text-xs text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/60 ${dim} ${marker} ${hunkRing}`}
        >
          <div className={`${numCell} ${leftTint}`}>
            {kindLabel && <span className="sr-only">{kindLabel} </span>}
            {row.left && (
              <>
                <span aria-hidden className="mr-1 font-bold text-red-600 dark:text-red-400">
                  {row.kind === 'removed' ? '−' : row.kind === 'modified' ? '~' : ''}
                </span>
                {row.left.no}
              </>
            )}
          </div>
          <div className={`${textCell} border-r border-slate-200 dark:border-slate-800 ${leftTint}`}>
            {row.left ? <Content line={row.left} side="left" /> : '\u00A0'}
          </div>
          <div className={`${numCell} ${rightTint}`}>
            {row.right && (
              <>
                <span aria-hidden className="mr-1 font-bold text-emerald-600 dark:text-emerald-400">
                  {row.kind === 'added' ? '+' : row.kind === 'modified' ? '~' : ''}
                </span>
                {row.right.no}
              </>
            )}
          </div>
          <div className={`${textCell} ${rightTint}`}>
            {row.right ? <Content line={row.right} side="right" /> : '\u00A0'}
          </div>
        </div>
      );
    }

    const { uni } = entry;
    const tint =
      uni.kind === 'removed' ? 'bg-red-500/10' : uni.kind === 'added' ? 'bg-emerald-500/10' : '';
    const symbol = uni.kind === 'removed' ? '−' : uni.kind === 'added' ? '+' : ' ';
    const symColor =
      uni.kind === 'removed'
        ? 'text-red-600 dark:text-red-400'
        : uni.kind === 'added'
          ? 'text-emerald-600 dark:text-emerald-400'
          : '';
    const label =
      uni.kind === 'removed' ? t('diff.removedLine') : uni.kind === 'added' ? t('diff.addedLine') : '';
    return (
      <div
        className={`${gridUni} ${font} text-xs text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/60 ${tint} ${uni.blank ? 'opacity-60' : ''} ${marker} ${hunkRing}`}
      >
        <div className={numCell}>{uni.oldNo ?? ''}</div>
        <div className={numCell}>{uni.newNo ?? ''}</div>
        <div className={`py-0.5 text-center font-bold select-none ${symColor}`} aria-hidden>
          {symbol}
        </div>
        <div className={textCell}>
          {label && <span className="sr-only">{label} </span>}
          <Content line={uni.line} side={uni.kind === 'removed' ? 'left' : 'right'} />
        </div>
      </div>
    );
  };

  const header = unified ? (
    <div
      className={`${gridUni} text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10`}
    >
      <div className="py-1.5 px-2 text-right">A</div>
      <div className="py-1.5 px-2 text-right">B</div>
      <div />
      <div className="py-1.5 px-3 truncate">{t('diff.content')}</div>
    </div>
  ) : (
    <div
      className={`${gridSbs} text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10`}
    >
      <div className="py-1.5 px-2 text-right">#A</div>
      <div className="py-1.5 px-3 truncate border-r border-slate-200 dark:border-slate-800" title={labelA}>
        {labelA}
      </div>
      <div className="py-1.5 px-2 text-right">#B</div>
      <div className="py-1.5 px-3 truncate" title={labelB}>
        {labelB}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`${card} overflow-hidden`}>
      {/* Barra de estadísticas y vista */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs" role="status" aria-live="polite">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
            +{stats.added} {t('stats.added')}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 font-semibold">
            −{stats.removed} {t('stats.removed')}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
            ~{stats.modified} {t('stats.modified')}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold">
            {t('stats.similarity')}: {stats.similarity}%
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            label={t('view.collapse')}
            checked={settings.collapseEqual}
            onChange={(v) => onSettingsChange({ ...settings, collapseEqual: v })}
          />
          <Checkbox
            label={t('view.mono')}
            mono
            checked={settings.monospace}
            onChange={(v) => onSettingsChange({ ...settings, monospace: v })}
          />
          <SegmentedControl
            label={t('view.mode')}
            value={settings.viewMode}
            onChange={(viewMode) => onSettingsChange({ ...settings, viewMode })}
            options={[
              { value: 'side-by-side', label: t('view.sideBySide'), icon: <Columns className="w-3.5 h-3.5" /> },
              { value: 'unified', label: t('view.unified'), icon: <Rows className="w-3.5 h-3.5" /> },
            ]}
          />
        </div>
      </div>

      {(result.approximate || result.jsonNormalized) && (
        <div className="px-3 pt-3 space-y-2">
          {result.approximate && (
            <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('diff.approximate')}</span>
            </p>
          )}
          {result.jsonNormalized && (
            <p className="flex items-start gap-2 text-xs text-sky-800 dark:text-sky-300 bg-sky-500/10 rounded-lg px-3 py-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('diff.jsonNormalized')}</span>
            </p>
          )}
        </div>
      )}

      {/* Navegación, búsqueda y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1" role="group" aria-label={t('nav.changes')}>
            <IconButton aria-label={`${t('nav.prev')} (p)`} title={`${t('nav.prev')} (p)`} disabled={hunks.length === 0} onClick={() => goHunk(-1)}>
              <ChevronUp className="w-4 h-4" />
            </IconButton>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400 min-w-[7.5rem] text-center">
              {hunks.length === 0
                ? t('nav.noChanges')
                : t('nav.position', { n: current < 0 ? '–' : current + 1, total: hunks.length })}
            </span>
            <IconButton aria-label={`${t('nav.next')} (n)`} title={`${t('nav.next')} (n)`} disabled={hunks.length === 0} onClick={() => goHunk(1)}>
              <ChevronDown className="w-4 h-4" />
            </IconButton>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    goMatch(e.shiftKey ? -1 : 1);
                  }
                }}
                placeholder={t('search.placeholder')}
                aria-label={t('search.label')}
                className={`w-44 pl-8 pr-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${focusRing}`}
              />
            </div>
            {q && (
              <>
                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400 min-w-[4.5rem] text-center">
                  {matches.length === 0
                    ? t('search.none')
                    : t('search.position', { n: matchPos < 0 ? '–' : matchPos + 1, total: matches.length })}
                </span>
                <IconButton aria-label={t('search.prev')} disabled={matches.length === 0} onClick={() => goMatch(-1)}>
                  <ChevronUp className="w-4 h-4" />
                </IconButton>
                <IconButton aria-label={t('search.next')} disabled={matches.length === 0} onClick={() => goMatch(1)}>
                  <ChevronDown className="w-4 h-4" />
                </IconButton>
              </>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Lista de líneas */}
      <div
        ref={scrollRef}
        className="overflow-auto border-t border-slate-200 dark:border-slate-800"
        style={{ maxHeight }}
        role="region"
        aria-label={t('diff.regionLabel')}
        tabIndex={0}
      >
        {header}
        {virtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => (
              <div
                key={v.key}
                data-index={v.index}
                data-entry={v.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}
              >
                {renderEntry(entries[v.index]!, v.index)}
              </div>
            ))}
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} data-entry={i}>
              {renderEntry(entry, i)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function isChanged(e: Entry): boolean {
  return e.type !== 'fold' && e.changed;
}

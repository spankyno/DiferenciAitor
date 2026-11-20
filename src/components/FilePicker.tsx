import { Calendar, FileWarning, HardDrive, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { FileAnalysis } from '../utils/fileAnalysis';
import { formatBytes, formatDate } from '../utils/hash';
import { CopyButton, IconButton, Spinner, card } from './ui';

export function FilePicker({
  title,
  dot,
  analysis,
  loading,
  inputId,
  onFile,
  onClear,
}: {
  title: string;
  dot: string;
  analysis: FileAnalysis | null;
  loading: boolean;
  inputId: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null | undefined) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`${card} p-5 space-y-4 transition-colors ${dragging ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full inline-block ${dot}`} aria-hidden />
          {title}
        </span>
        {analysis && (
          <IconButton aria-label={t('file.remove')} title={t('file.remove')} onClick={onClear}>
            <X className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Spinner label={t('file.reading')} />
        </div>
      ) : analysis ? (
        <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate" title={analysis.file.name}>
            {analysis.file.name}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" /> {formatBytes(analysis.size)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {formatDate(analysis.file.lastModified, locale)}
            </span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate" title={analysis.hash}>
              SHA-256: {analysis.hash || t('file.noHash')}
            </p>
            {analysis.hash && <CopyButton getText={() => analysis.hash} title={t('file.copyHash')} />}
          </div>
          {analysis.isBinary && (
            <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <FileWarning className="w-3.5 h-3.5" /> {t('file.binary')}
            </p>
          )}
          {!analysis.isBinary && analysis.tooLargeForText && (
            <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <FileWarning className="w-3.5 h-3.5" /> {t('file.tooLarge')}
            </p>
          )}
          {analysis.error && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {t('common.error', { message: analysis.error })}
            </p>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div className="text-center">
            <span className="text-sm font-medium text-slate-900 dark:text-white">{t('file.select')}</span>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('file.orDrop')}</p>
          </div>
        </label>
      )}

      {/* Un único input por panel: sirve tanto para elegir como para cambiar de archivo. */}
      <input
        id={inputId}
        type="file"
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      {analysis && !loading && (
        <label
          htmlFor={inputId}
          className="block text-center cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
        >
          {t('file.change')}
        </label>
      )}
    </div>
  );
}

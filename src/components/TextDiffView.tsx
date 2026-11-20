import { ArrowLeftRight, Download, FileText, Sparkles, Trash2, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDiff } from '../hooks/useDiff';
import { useI18n } from '../i18n';
import type { DiffOptions, ViewSettings } from '../types';
import { downloadText } from '../utils/download';
import { createUnifiedPatch, patchToMarkdown } from '../utils/patch';
import { splitLines } from '../utils/text';
import { DiffOptionsBar } from './DiffOptionsBar';
import { DiffViewer } from './DiffViewer';
import { CopyButton, Spinner, btnDanger, btnSecondary, card, focusRing } from './ui';

const SAMPLE_A = {
  es: [
    '// Configuración inicial del servidor',
    "import express from 'express';",
    "import cors from 'cors';",
    '',
    'const app = express();',
    'const PORT = process.env.PORT || 3000;',
    '',
    'app.use(cors());',
    'app.use(express.json());',
    '',
    "app.get('/api/health', (req, res) => {",
    "  res.json({ status: 'ok', timestamp: Date.now() });",
    '});',
    '',
    'app.listen(PORT, () => {',
    '  console.log(`Servidor corriendo en puerto ${PORT}`);',
    '});',
  ],
  en: [
    '// Initial server setup',
    "import express from 'express';",
    "import cors from 'cors';",
    '',
    'const app = express();',
    'const PORT = process.env.PORT || 3000;',
    '',
    'app.use(cors());',
    'app.use(express.json());',
    '',
    "app.get('/api/health', (req, res) => {",
    "  res.json({ status: 'ok', timestamp: Date.now() });",
    '});',
    '',
    'app.listen(PORT, () => {',
    '  console.log(`Server running on port ${PORT}`);',
    '});',
  ],
};

const SAMPLE_B = {
  es: [
    '// Configuración optimizada del servidor',
    "import express from 'express';",
    "import cors from 'cors';",
    "import helmet from 'helmet';",
    '',
    'const app = express();',
    'const PORT = process.env.PORT || 4000;',
    '',
    'app.use(cors());',
    'app.use(helmet());',
    "app.use(express.json({ limit: '10mb' }));",
    '',
    "app.get('/api/health', (req, res) => {",
    "  res.json({ status: 'healthy', uptime: process.uptime() });",
    '});',
    '',
    "app.get('/api/metrics', (req, res) => {",
    '  res.json({ memory: process.memoryUsage() });',
    '});',
    '',
    'app.listen(PORT, () => {',
    '  console.log(`Servidor seguro ejecutándose en puerto ${PORT}`);',
    '});',
  ],
  en: [
    '// Optimised server setup',
    "import express from 'express';",
    "import cors from 'cors';",
    "import helmet from 'helmet';",
    '',
    'const app = express();',
    'const PORT = process.env.PORT || 4000;',
    '',
    'app.use(cors());',
    'app.use(helmet());',
    "app.use(express.json({ limit: '10mb' }));",
    '',
    "app.get('/api/health', (req, res) => {",
    "  res.json({ status: 'healthy', uptime: process.uptime() });",
    '});',
    '',
    "app.get('/api/metrics', (req, res) => {",
    '  res.json({ memory: process.memoryUsage() });',
    '});',
    '',
    'app.listen(PORT, () => {',
    '  console.log(`Secure server running on port ${PORT}`);',
    '});',
  ],
};

interface Props {
  options: DiffOptions;
  onOptionsChange: (o: DiffOptions) => void;
  settings: ViewSettings;
  onSettingsChange: (s: ViewSettings) => void;
}

function TextPane({
  title,
  dot,
  value,
  onChange,
  placeholder,
  mono,
  copyTitle,
}: {
  title: string;
  dot: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono: boolean;
  copyTitle: string;
}) {
  const { t } = useI18n();
  const lines = useMemo(() => splitLines(value).length, [value]);
  return (
    <div className={`${card} p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full inline-block ${dot}`} aria-hidden />
          <span className="font-bold text-sm text-slate-900 dark:text-white">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {t('text.counts', { lines, chars: value.length })}
          </span>
          <CopyButton getText={() => value} title={copyTitle} />
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={title}
        spellCheck={false}
        className={`w-full h-48 p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-y ${focusRing} ${
          mono ? 'font-mono' : 'font-sans'
        }`}
      />
    </div>
  );
}

export function TextDiffView({ options, onOptionsChange, settings, onSettingsChange }: Props) {
  const { t, lang } = useI18n();
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');

  const empty = textA === '' && textB === '';
  const { result, loading, error } = useDiff(empty ? null : textA, empty ? null : textB, options, 150);

  const patch = () => createUnifiedPatch('A', 'B', textA, textB);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className={`${card} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300">
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>{t('text.mode')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setTextA(SAMPLE_A[lang].join('\n'));
              setTextB(SAMPLE_B[lang].join('\n'));
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            {t('actions.sample')}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setTextA(textB);
              setTextB(textA);
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {t('actions.swap')}
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={empty}
            onClick={() => {
              setTextA('');
              setTextB('');
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('actions.clear')}
          </button>
        </div>
      </div>

      <DiffOptionsBar options={options} onChange={onOptionsChange} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TextPane
          title={t('text.titleA')}
          dot="bg-red-500"
          value={textA}
          onChange={setTextA}
          placeholder={t('text.placeholderA')}
          mono={settings.monospace}
          copyTitle={t('text.copyA')}
        />
        <TextPane
          title={t('text.titleB')}
          dot="bg-emerald-500"
          value={textB}
          onChange={setTextB}
          placeholder={t('text.placeholderB')}
          mono={settings.monospace}
          copyTitle={t('text.copyB')}
        />
      </div>

      {empty ? (
        <div className={`${card} p-10 text-center text-sm text-slate-600 dark:text-slate-400`}>
          {t('text.emptyHint')}
        </div>
      ) : error ? (
        <div role="alert" className={`${card} p-6 text-sm text-red-700 dark:text-red-300`}>
          {t('common.error', { message: error })}
        </div>
      ) : !result ? (
        <div className={`${card} p-8 flex justify-center`}>
          <Spinner label={t('common.comparing')} />
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {result.identical ? (
            <div className={`${card} p-10 text-center space-y-3`} role="status">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('text.identicalTitle')}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('text.identicalBody')}</p>
            </div>
          ) : (
            <DiffViewer
              result={result}
              settings={settings}
              onSettingsChange={onSettingsChange}
              labelA={t('text.labelA')}
              labelB={t('text.labelB')}
              actions={
                <>
                  <CopyButton getText={() => patchToMarkdown(patch())} title={t('actions.copyMarkdown')} label={t('actions.copyMarkdown')} />
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => downloadText(patch(), `diferenciaitor-${Date.now()}.patch`, 'text/x-diff')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('actions.exportPatch')}
                  </button>
                </>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

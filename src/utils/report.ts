import type { FolderComparisonItem, FolderStatus } from '../types';

export interface ReportRow {
  status: FolderStatus;
  statusLabel: string;
  path: string;
  /** Ruta anterior (solo en renombrados). */
  fromPath: string;
  sizeA: number | '';
  sizeB: number | '';
  hashA: string;
  hashB: string;
}

export function buildReportRows(
  items: FolderComparisonItem[],
  statusOf: (item: FolderComparisonItem) => FolderStatus,
  labelOf: (status: FolderStatus) => string,
): ReportRow[] {
  return items.map((i) => {
    const status = statusOf(i);
    return {
      status,
      statusLabel: labelOf(status),
      path: i.path,
      fromPath: i.status === 'renamed' ? (i.fileA?.relativePath ?? '') : '',
      sizeA: i.fileA ? i.fileA.size : '',
      sizeB: i.fileB ? i.fileB.size : '',
      hashA: i.fileA?.hash ?? '',
      hashB: i.fileB?.hash ?? '',
    };
  });
}

/** Neutraliza celdas que Excel/Calc interpretarían como fórmulas (CSV injection). */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: ReportRow[], headers: string[]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.statusLabel, r.path, r.fromPath, r.sizeA, r.sizeB, r.hashA, r.hashB].map(csvCell).join(','),
    );
  }
  // BOM para que Excel detecte UTF-8.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function toJSON(rows: ReportRow[], meta: Record<string, unknown>): string {
  return JSON.stringify({ ...meta, items: rows.map(({ statusLabel: _l, ...rest }) => rest) }, null, 2);
}

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toHTML(
  rows: ReportRow[],
  headers: string[],
  title: string,
  subtitle: string,
): string {
  const color: Record<FolderStatus, string> = {
    identical: '#64748b',
    equivalent: '#0ea5e9',
    modified: '#d97706',
    added: '#059669',
    deleted: '#dc2626',
    renamed: '#7c3aed',
  };
  const body = rows
    .map(
      (r) =>
        `<tr><td style="color:${color[r.status]};font-weight:600">${esc(r.statusLabel)}</td>` +
        `<td>${esc(r.path)}</td><td>${esc(r.fromPath)}</td><td>${esc(r.sizeA)}</td>` +
        `<td>${esc(r.sizeB)}</td><td class="h">${esc(r.hashA)}</td><td class="h">${esc(r.hashB)}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:2rem;color:#0f172a}h1{margin:0 0 .25rem}
p{color:#475569;margin:0 0 1rem}table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #e2e8f0;padding:.4rem .6rem;text-align:left;vertical-align:top}
th{background:#f1f5f9}.h{font:11px ui-monospace,monospace;color:#64748b;word-break:break-all}</style></head>
<body><h1>${esc(title)}</h1><p>${esc(subtitle)}</p>
<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>
${body}
</tbody></table></body></html>`;
}

export type DiffMode = 'text' | 'files' | 'folders' | 'about';

export type ViewMode = 'side-by-side' | 'unified';

/** Opciones que afectan al *resultado* de la comparación. */
export interface DiffOptions {
  /** Ignora todo el espacio en blanco (espacios, tabuladores...). */
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  /** Las líneas vacías no cuentan como diferencia. */
  ignoreBlankLines: boolean;
  /** Si ambos textos son JSON válido, los compara formateados y con claves ordenadas. */
  formatJson: boolean;
}

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  formatJson: false,
};

/** Opciones que solo afectan a cómo se muestra el resultado. */
export interface ViewSettings {
  viewMode: ViewMode;
  monospace: boolean;
  /** Pliega los bloques largos de líneas sin cambios. */
  collapseEqual: boolean;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  viewMode: 'side-by-side',
  monospace: true,
  collapseEqual: true,
};

export interface InlinePart {
  text: string;
  changed: boolean;
}

export interface DiffLine {
  /** Número de línea (base 1) en el texto original. */
  no: number;
  text: string;
  /** Resaltado dentro de la línea (solo en líneas modificadas). */
  parts?: InlinePart[];
}

export type RowKind = 'equal' | 'removed' | 'added' | 'modified';

export interface DiffRow {
  kind: RowKind;
  left?: DiffLine;
  right?: DiffLine;
  /** Línea vacía ignorada por la opción "omitir líneas vacías". */
  blank?: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  /** Líneas comparadas en cada lado. */
  totalA: number;
  totalB: number;
  /** 0 a 100. Dos textos vacíos son 100 % similares. */
  similarity: number;
}

export interface DiffResult {
  rows: DiffRow[];
  stats: DiffStats;
  identical: boolean;
  /** El algoritmo exacto superó el límite de tiempo y se aplicó una aproximación. */
  approximate: boolean;
  /** Se comparó el JSON formateado en lugar del texto original. */
  jsonNormalized: boolean;
}

export type FolderStatus = 'identical' | 'equivalent' | 'modified' | 'added' | 'deleted' | 'renamed';

export interface FolderFileEntry {
  relativePath: string;
  name: string;
  size: number;
  lastModified: number;
  /** SHA-256 en hexadecimal. Vacío si el archivo superó el límite de tamaño. */
  hash: string;
  isBinary: boolean;
  /** Referencia al archivo: el contenido se lee solo cuando hace falta. */
  file: File;
  /** El hash no se calculó por el tamaño del archivo. */
  hashSkipped: boolean;
}

export interface FolderComparisonItem {
  path: string;
  status: FolderStatus;
  fileA?: FolderFileEntry;
  fileB?: FolderFileEntry;
}

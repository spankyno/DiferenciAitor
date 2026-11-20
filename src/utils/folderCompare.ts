import type {
  DiffOptions,
  FolderComparisonItem,
  FolderFileEntry,
  FolderStatus,
} from '../types';
import { areEquivalent } from './diffEngine';
import { MAX_TEXT_DIFF_BYTES } from './hash';
import { runPool } from './pool';
import { readTextIfPossible } from './fileAnalysis';

export interface CompareOptions {
  /** Trata `A.TXT` y `a.txt` como la misma ruta. */
  ignorePathCase: boolean;
}

/** ¿Tienen el mismo contenido? Si no hay hash, se recurre a tamaño y fecha. */
function sameContent(a: FolderFileEntry, b: FolderFileEntry): boolean {
  if (a.size !== b.size) return false;
  if (a.hashSkipped || b.hashSkipped) return a.lastModified === b.lastModified;
  return a.hash === b.hash;
}

export function compareFolders(
  filesA: Map<string, FolderFileEntry>,
  filesB: Map<string, FolderFileEntry>,
  options: CompareOptions,
): FolderComparisonItem[] {
  const keyOf = (p: string) => (options.ignorePathCase ? p.toLowerCase() : p);
  const mapA = new Map<string, FolderFileEntry>();
  const mapB = new Map<string, FolderFileEntry>();
  filesA.forEach((v, k) => mapA.set(keyOf(k), v));
  filesB.forEach((v, k) => mapB.set(keyOf(k), v));

  const items: FolderComparisonItem[] = [];
  const deleted: FolderComparisonItem[] = [];
  const added: FolderComparisonItem[] = [];

  for (const [key, fileA] of mapA) {
    const fileB = mapB.get(key);
    if (fileB) {
      items.push({
        path: fileB.relativePath,
        status: sameContent(fileA, fileB) ? 'identical' : 'modified',
        fileA,
        fileB,
      });
    } else {
      deleted.push({ path: fileA.relativePath, status: 'deleted', fileA });
    }
  }
  for (const [key, fileB] of mapB) {
    if (!mapA.has(key)) added.push({ path: fileB.relativePath, status: 'added', fileB });
  }

  // Renombrados / movidos: mismo contenido (hash) bajo otra ruta. Se ignoran los archivos vacíos.
  const deletedByHash = new Map<string, FolderComparisonItem[]>();
  for (const d of deleted) {
    const f = d.fileA!;
    if (f.hash && f.size > 0) {
      const list = deletedByHash.get(f.hash) ?? [];
      list.push(d);
      deletedByHash.set(f.hash, list);
    }
  }
  const renamedFrom = new Set<FolderComparisonItem>();
  const remainingAdded: FolderComparisonItem[] = [];
  for (const a of added) {
    const f = a.fileB!;
    const candidates = f.hash && f.size > 0 ? deletedByHash.get(f.hash) : undefined;
    const match = candidates?.shift();
    if (match) {
      renamedFrom.add(match);
      items.push({ path: a.path, status: 'renamed', fileA: match.fileA!, fileB: f });
    } else {
      remainingAdded.push(a);
    }
  }
  for (const d of deleted) if (!renamedFrom.has(d)) items.push(d);
  items.push(...remainingAdded);

  return items.sort((x, y) => x.path.localeCompare(y.path));
}

export interface FolderStats {
  identical: number;
  equivalent: number;
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
  total: number;
}

export function folderStats(
  items: FolderComparisonItem[],
  equivalent: ReadonlySet<string>,
): FolderStats {
  const s: FolderStats = {
    identical: 0,
    equivalent: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    total: items.length,
  };
  for (const i of items) s[effectiveStatus(i, equivalent)]++;
  return s;
}

export function effectiveStatus(
  item: FolderComparisonItem,
  equivalent: ReadonlySet<string>,
): FolderStatus {
  return item.status === 'modified' && equivalent.has(item.path) ? 'equivalent' : item.status;
}

/**
 * Entre los archivos "modificados", detecta los que son iguales una vez aplicadas
 * las opciones (saltos de línea, espacios, mayúsculas...). Devuelve sus rutas.
 */
export async function findEquivalent(
  items: FolderComparisonItem[],
  options: DiffOptions,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const result = new Set<string>();
  const candidates = items.filter(
    (i) =>
      i.status === 'modified' &&
      i.fileA &&
      i.fileB &&
      !i.fileA.isBinary &&
      !i.fileB.isBinary &&
      i.fileA.size <= MAX_TEXT_DIFF_BYTES &&
      i.fileB.size <= MAX_TEXT_DIFF_BYTES,
  );
  await runPool(
    candidates,
    4,
    async (item) => {
      try {
        const [ta, tb] = await Promise.all([
          readTextIfPossible(item.fileA!.file),
          readTextIfPossible(item.fileB!.file),
        ]);
        if (ta !== null && tb !== null && areEquivalent(ta, tb, options)) result.add(item.path);
      } catch {
        /* archivo ilegible: se queda como modificado */
      }
    },
    { signal },
  );
  return result;
}

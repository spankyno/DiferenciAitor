import type { FolderFileEntry } from '../types';
import { MAX_HASH_BYTES, sha256 } from './hash';
import { runPool } from './pool';
import { readBuffer } from './readFile';
import { looksBinary } from './text';

export type FolderSource =
  | { kind: 'handle'; name: string; handle: FileSystemDirectoryHandle }
  | { kind: 'files'; name: string; files: File[] };

export interface ScanError {
  path: string;
  message: string;
}

export interface ScanResult {
  entries: Map<string, FolderFileEntry>;
  errors: ScanError[];
  /** Archivos omitidos por los patrones de exclusión. */
  ignored: number;
}

export interface ScanProgress {
  phase: 'listing' | 'hashing';
  done: number;
  total: number;
  current?: string;
}

interface Pending {
  path: string;
  getFile: () => Promise<File>;
}

const CONCURRENCY = 4;

/** Recorre un directorio con la File System Access API, saltando las carpetas ignoradas. */
async function listHandle(
  dir: FileSystemDirectoryHandle,
  isIgnored: (path: string, isDir?: boolean) => boolean,
  out: Pending[],
  errors: ScanError[],
  counters: { ignored: number },
  signal: AbortSignal | undefined,
  onProgress: ((p: ScanProgress) => void) | undefined,
  prefix = '',
): Promise<void> {
  try {
    for await (const entry of dir.values()) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        if (isIgnored(path, true)) {
          counters.ignored++;
          continue;
        }
        await listHandle(
          entry as FileSystemDirectoryHandle,
          isIgnored,
          out,
          errors,
          counters,
          signal,
          onProgress,
          path,
        );
      } else {
        if (isIgnored(path, false)) {
          counters.ignored++;
          continue;
        }
        const fh = entry as FileSystemFileHandle;
        out.push({ path, getFile: () => fh.getFile() });
        if (out.length % 200 === 0) {
          onProgress?.({ phase: 'listing', done: out.length, total: 0, current: path });
        }
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    errors.push({ path: prefix || '/', message: e instanceof Error ? e.message : String(e) });
  }
}

async function buildEntry(path: string, file: File): Promise<FolderFileEntry> {
  const base = {
    relativePath: path,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    file,
  };
  if (file.size > MAX_HASH_BYTES) {
    const head = new Uint8Array(await readBuffer(file.slice(0, 8192)));
    return { ...base, hash: '', hashSkipped: true, isBinary: looksBinary(head) };
  }
  const buffer = await readBuffer(file);
  const isBinary = looksBinary(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)));
  return { ...base, hash: await sha256(buffer), hashSkipped: false, isBinary };
}

/** Escanea una carpeta: lista, filtra, y calcula hash de cada archivo sin guardar su contenido. */
export async function scanFolder(
  source: FolderSource,
  isIgnored: (path: string, isDir?: boolean) => boolean,
  options: { signal?: AbortSignal; onProgress?: (p: ScanProgress) => void } = {},
): Promise<ScanResult> {
  const { signal, onProgress } = options;
  const pending: Pending[] = [];
  const errors: ScanError[] = [];
  const counters = { ignored: 0 };

  if (source.kind === 'handle') {
    await listHandle(source.handle, isIgnored, pending, errors, counters, signal, onProgress);
  } else {
    for (const file of source.files) {
      const rel = (file.webkitRelativePath || file.name).split('/').slice(1).join('/');
      if (!rel) continue;
      if (isIgnored(rel, false)) {
        counters.ignored++;
        continue;
      }
      pending.push({ path: rel, getFile: async () => file });
    }
  }

  const entries = new Map<string, FolderFileEntry>();
  await runPool(
    pending,
    CONCURRENCY,
    async (p) => {
      try {
        const file = await p.getFile();
        entries.set(p.path, await buildEntry(p.path, file));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        errors.push({ path: p.path, message: e instanceof Error ? e.message : String(e) });
      }
    },
    {
      signal,
      onProgress: (done, total) => onProgress?.({ phase: 'hashing', done, total }),
    },
  );

  return { entries, errors, ignored: counters.ignored };
}

import { MAX_HASH_BYTES, MAX_TEXT_DIFF_BYTES, sha256 } from './hash';
import { readBuffer } from './readFile';
import { decodeText, looksBinary } from './text';

export interface FileAnalysis {
  file: File;
  size: number;
  hash: string;
  hashSkipped: boolean;
  isBinary: boolean;
  /** Contenido de texto. Solo si no es binario y no supera el límite. */
  text?: string;
  tooLargeForText: boolean;
  /** Error de lectura o de hash, si lo hubo. */
  error?: string;
}

/** Lee un archivo una sola vez: hash, detección de binario y texto. */
export async function analyzeFile(file: File): Promise<FileAnalysis> {
  const base = { file, size: file.size, tooLargeForText: file.size > MAX_TEXT_DIFF_BYTES };
  try {
    if (file.size > MAX_HASH_BYTES) {
      const head = new Uint8Array(await readBuffer(file.slice(0, 8192)));
      return { ...base, hash: '', hashSkipped: true, isBinary: looksBinary(head) };
    }
    const buffer = await readBuffer(file);
    const isBinary = looksBinary(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)));
    let hash = '';
    let error: string | undefined;
    try {
      hash = await sha256(buffer);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const out: FileAnalysis = { ...base, hash, hashSkipped: hash === '', isBinary };
    if (error) out.error = error;
    if (!isBinary && !base.tooLargeForText) out.text = decodeText(buffer);
    return out;
  } catch (e) {
    return {
      ...base,
      hash: '',
      hashSkipped: true,
      isBinary: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Lee un archivo como texto, o null si es binario / demasiado grande. */
export async function readTextIfPossible(file: File): Promise<string | null> {
  if (file.size > MAX_TEXT_DIFF_BYTES) return null;
  const buffer = await readBuffer(file);
  if (looksBinary(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)))) return null;
  return decodeText(buffer);
}

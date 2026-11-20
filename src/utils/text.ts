import type { DiffOptions } from '../types';

/** Divide en líneas aceptando \r\n, \r y \n. Un salto de línea final no genera una línea vacía. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

/** Clave de comparación de una línea según las opciones activas. */
export function lineKey(line: string, options: DiffOptions): string {
  let key = line;
  if (options.ignoreCase) key = key.toLowerCase();
  if (options.ignoreWhitespace) key = key.replace(/\s+/g, '');
  return key;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/** Devuelve el JSON formateado con claves ordenadas, o null si el texto no es JSON válido. */
export function tryFormatJson(text: string): string | null {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed === '') return null;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null;
  try {
    return JSON.stringify(sortKeys(JSON.parse(trimmed)), null, 2);
  } catch {
    return null;
  }
}

/**
 * Prepara los dos textos para compararlos. El formateo JSON solo se aplica
 * si *ambos* textos son JSON válido, para no comparar cosas distintas.
 */
export function prepareTexts(
  textA: string,
  textB: string,
  options: DiffOptions,
): { a: string; b: string; jsonNormalized: boolean } {
  if (options.formatJson) {
    const fa = tryFormatJson(textA);
    const fb = tryFormatJson(textB);
    if (fa !== null && fb !== null) return { a: fa, b: fb, jsonNormalized: true };
  }
  return { a: textA, b: textB, jsonNormalized: false };
}

/** Similitud de Dice entre dos cadenas usando bigramas (0 a 1). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const x = a.length > 400 ? a.slice(0, 400) : a;
  const y = b.length > 400 ? b.slice(0, 400) : b;
  if (x.length < 2 || y.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.substr(i, 2);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.substr(i, 2);
    const c = counts.get(g);
    if (c) {
      hits++;
      counts.set(g, c - 1);
    }
  }
  return (2 * hits) / (x.length - 1 + (y.length - 1));
}

/** Detecta si un fichero es binario mirando sus primeros bytes. */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  if (n === 0) return false;
  // BOM UTF-16: es texto aunque contenga bytes nulos.
  if (n >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
    return false;
  }
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!;
    if (b === 0) return true;
    if (b < 7 || (b > 13 && b < 32 && b !== 27)) suspicious++;
  }
  return suspicious / n > 0.1;
}

/** Decodifica bytes como texto, respetando BOM UTF-16 y cayendo en UTF-8. */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

import * as Diff from 'diff';
import type {
  DiffLine,
  DiffOptions,
  DiffResult,
  DiffRow,
  DiffStats,
  InlinePart,
} from '../types';
import { isBlankLine, lineKey, prepareTexts, similarity, splitLines } from './text';

/* -------------------------------------------------------------------------- */
/*  Operaciones elementales sobre secuencias de enteros                        */
/* -------------------------------------------------------------------------- */

type Op =
  | { t: 'eq'; a: number; b: number }
  | { t: 'del'; a: number }
  | { t: 'ins'; b: number };

interface SeqContext {
  ops: Op[];
  approximate: boolean;
}

/** Tiempo máximo (ms) que se concede a Myers en cada tramo antes de aproximar. */
const MYERS_TIMEOUT_MS = 1500;
const MAX_ANCHOR_DEPTH = 64;

/** Subsecuencia creciente más larga (O(n log n)). Devuelve índices dentro de `values`. */
function longestIncreasing(values: number[]): number[] {
  const tails: number[] = [];
  const prev: number[] = new Array(values.length).fill(-1);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (values[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const out: number[] = [];
  let k = tails.length > 0 ? tails[tails.length - 1]! : -1;
  while (k >= 0) {
    out.push(k);
    k = prev[k]!;
  }
  return out.reverse();
}

function emitAll(
  ctx: SeqContext,
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): void {
  for (let i = aStart; i < aEnd; i++) ctx.ops.push({ t: 'del', a: i });
  for (let j = bStart; j < bEnd; j++) ctx.ops.push({ t: 'ins', b: j });
}

/**
 * Diff de A[aStart,aEnd) contra B[bStart,bEnd).
 * 1) recorta prefijo/sufijo comunes; 2) busca líneas únicas en ambos lados
 * (anclas, como "patience diff") y recursa en los huecos; 3) si no hay anclas
 * usa Myers con límite de tiempo.
 */
function diffRange(
  A: number[],
  B: number[],
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  ctx: SeqContext,
  depth: number,
): void {
  let s = 0;
  while (aStart + s < aEnd && bStart + s < bEnd && A[aStart + s] === B[bStart + s]) s++;
  for (let k = 0; k < s; k++) ctx.ops.push({ t: 'eq', a: aStart + k, b: bStart + k });
  aStart += s;
  bStart += s;

  let e = 0;
  while (aEnd - 1 - e >= aStart && bEnd - 1 - e >= bStart && A[aEnd - 1 - e] === B[bEnd - 1 - e]) {
    e++;
  }
  const tailA = aEnd - e;
  const tailB = bEnd - e;

  const emitTail = () => {
    for (let k = 0; k < e; k++) ctx.ops.push({ t: 'eq', a: tailA + k, b: tailB + k });
  };

  aEnd = tailA;
  bEnd = tailB;

  if (aStart === aEnd || bStart === bEnd) {
    emitAll(ctx, aStart, aEnd, bStart, bEnd);
    emitTail();
    return;
  }

  // Anclas: ids que aparecen exactamente una vez en cada lado.
  if (depth < MAX_ANCHOR_DEPTH) {
    const countA = new Map<number, number>();
    const posA = new Map<number, number>();
    for (let i = aStart; i < aEnd; i++) {
      const id = A[i]!;
      countA.set(id, (countA.get(id) ?? 0) + 1);
      posA.set(id, i);
    }
    const countB = new Map<number, number>();
    const posB = new Map<number, number>();
    for (let j = bStart; j < bEnd; j++) {
      const id = B[j]!;
      countB.set(id, (countB.get(id) ?? 0) + 1);
      posB.set(id, j);
    }
    const pairsA: number[] = [];
    const pairsB: number[] = [];
    for (let i = aStart; i < aEnd; i++) {
      const id = A[i]!;
      if (countA.get(id) === 1 && countB.get(id) === 1) {
        pairsA.push(i);
        pairsB.push(posB.get(id)!);
      }
    }
    if (pairsA.length > 0) {
      const lis = longestIncreasing(pairsB);
      let curA = aStart;
      let curB = bStart;
      for (const idx of lis) {
        const ai = pairsA[idx]!;
        const bj = pairsB[idx]!;
        diffRange(A, B, curA, ai, curB, bj, ctx, depth + 1);
        ctx.ops.push({ t: 'eq', a: ai, b: bj });
        curA = ai + 1;
        curB = bj + 1;
      }
      diffRange(A, B, curA, aEnd, curB, bEnd, ctx, depth + 1);
      emitTail();
      return;
    }
  }

  // Sin anclas: Myers de jsdiff con límite de tiempo.
  const subA = A.slice(aStart, aEnd);
  const subB = B.slice(bStart, bEnd);
  const changes = Diff.diffArrays(subA, subB, { timeout: MYERS_TIMEOUT_MS } as never) as
    | Diff.ArrayChange<number>[]
    | undefined;

  if (!changes) {
    ctx.approximate = true;
    emitAll(ctx, aStart, aEnd, bStart, bEnd);
  } else {
    let ia = aStart;
    let ib = bStart;
    for (const ch of changes) {
      const n = ch.value.length;
      if (ch.added) {
        for (let k = 0; k < n; k++) ctx.ops.push({ t: 'ins', b: ib++ });
      } else if (ch.removed) {
        for (let k = 0; k < n; k++) ctx.ops.push({ t: 'del', a: ia++ });
      } else {
        for (let k = 0; k < n; k++) ctx.ops.push({ t: 'eq', a: ia++, b: ib++ });
      }
    }
  }
  emitTail();
}

/** Diff de dos secuencias de enteros. Exportado para pruebas. */
export function diffSequences(A: number[], B: number[]): SeqContext {
  const ctx: SeqContext = { ops: [], approximate: false };
  diffRange(A, B, 0, A.length, 0, B.length, ctx, 0);
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Resaltado dentro de la línea                                               */
/* -------------------------------------------------------------------------- */

const TOKEN_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
const MAX_INLINE_LENGTH = 3000;

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

function mergeParts(parts: InlinePart[]): InlinePart[] {
  const out: InlinePart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.changed === p.changed) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Calcula el resaltado de palabra entre dos líneas, respetando las opciones. */
export function inlineDiff(
  left: string,
  right: string,
  options: DiffOptions,
): { left: InlinePart[]; right: InlinePart[] } | undefined {
  if (left.length > MAX_INLINE_LENGTH || right.length > MAX_INLINE_LENGTH) return undefined;
  const tl = tokenize(left);
  const tr = tokenize(right);
  const norm = (t: string) => {
    if (/^\s+$/.test(t)) return options.ignoreWhitespace ? '' : t;
    return options.ignoreCase ? t.toLowerCase() : t;
  };
  const kl = tl.map(norm);
  const kr = tr.map(norm);
  const changes = Diff.diffArrays(kl, kr);
  const lp: InlinePart[] = [];
  const rp: InlinePart[] = [];
  let i = 0;
  let j = 0;
  for (const ch of changes) {
    const n = ch.value.length;
    if (ch.added) {
      for (let k = 0; k < n; k++) rp.push({ text: tr[j++]!, changed: true });
    } else if (ch.removed) {
      for (let k = 0; k < n; k++) lp.push({ text: tl[i++]!, changed: true });
    } else {
      for (let k = 0; k < n; k++) {
        lp.push({ text: tl[i++]!, changed: false });
        rp.push({ text: tr[j++]!, changed: false });
      }
    }
  }
  return { left: mergeParts(lp), right: mergeParts(rp) };
}

/* -------------------------------------------------------------------------- */
/*  Emparejado de líneas eliminadas/añadidas dentro de un bloque               */
/* -------------------------------------------------------------------------- */

const PAIR_THRESHOLD = 0.4;
const MAX_DP_CELLS = 40000;

interface Pair {
  d?: number;
  i?: number;
}

/**
 * Empareja líneas eliminadas (D) con añadidas (I) de un mismo bloque por
 * similitud, manteniendo el orden. Lo que no se empareja queda como
 * eliminado o añadido puro.
 */
function pairBlock(D: string[], I: string[]): Pair[] {
  const out: Pair[] = [];
  if (D.length === 0 || I.length === 0) {
    D.forEach((_, d) => out.push({ d }));
    I.forEach((_, i) => out.push({ i }));
    return out;
  }

  if (D.length * I.length > MAX_DP_CELLS) {
    // Bloque enorme: emparejado posicional solo si las líneas se parecen.
    const n = Math.min(D.length, I.length);
    for (let k = 0; k < n; k++) {
      if (similarity(D[k]!, I[k]!) >= PAIR_THRESHOLD) out.push({ d: k, i: k });
      else {
        out.push({ d: k });
        out.push({ i: k });
      }
    }
    for (let k = n; k < D.length; k++) out.push({ d: k });
    for (let k = n; k < I.length; k++) out.push({ i: k });
    return out;
  }

  const nd = D.length;
  const ni = I.length;
  const sim: number[][] = [];
  for (let d = 0; d < nd; d++) {
    const row: number[] = new Array(ni);
    for (let i = 0; i < ni; i++) {
      const s = similarity(D[d]!, I[i]!);
      row[i] = s >= PAIR_THRESHOLD ? s : -1;
    }
    sim.push(row);
  }
  // best[d][i] = mejor puntuación usando D[d..] e I[i..]
  const best: number[][] = Array.from({ length: nd + 1 }, () => new Array(ni + 1).fill(0));
  for (let d = nd - 1; d >= 0; d--) {
    for (let i = ni - 1; i >= 0; i--) {
      let v = Math.max(best[d + 1]![i]!, best[d]![i + 1]!);
      const s = sim[d]![i]!;
      if (s >= 0) v = Math.max(v, best[d + 1]![i + 1]! + s);
      best[d]![i] = v;
    }
  }
  let d = 0;
  let i = 0;
  while (d < nd || i < ni) {
    if (d >= nd) {
      out.push({ i: i++ });
    } else if (i >= ni) {
      out.push({ d: d++ });
    } else {
      const s = sim[d]![i]!;
      if (s >= 0 && best[d]![i] === best[d + 1]![i + 1]! + s) {
        out.push({ d, i });
        d++;
        i++;
      } else if (best[d]![i] === best[d + 1]![i]) {
        out.push({ d: d++ });
      } else {
        out.push({ i: i++ });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  API pública                                                                */
/* -------------------------------------------------------------------------- */

function internKeys(
  keysA: string[],
  keysB: string[],
  idxA: number[],
  idxB: number[],
): { A: number[]; B: number[] } {
  const ids = new Map<string, number>();
  const id = (k: string) => {
    let v = ids.get(k);
    if (v === undefined) {
      v = ids.size;
      ids.set(k, v);
    }
    return v;
  };
  return { A: idxA.map((i) => id(keysA[i]!)), B: idxB.map((j) => id(keysB[j]!)) };
}

function emptyStats(): DiffStats {
  return { added: 0, removed: 0, modified: 0, unchanged: 0, totalA: 0, totalB: 0, similarity: 100 };
}

function finishStats(stats: DiffStats): DiffStats {
  stats.totalA = stats.unchanged + stats.removed + stats.modified;
  stats.totalB = stats.unchanged + stats.added + stats.modified;
  const total = stats.totalA + stats.totalB;
  stats.similarity = total === 0 ? 100 : Math.round(((2 * stats.unchanged) / total) * 100);
  return stats;
}

/**
 * Compara dos textos línea a línea.
 *
 * - Los saltos de línea (CRLF/LF/CR), el BOM y el salto final se normalizan siempre.
 * - Las opciones se aplican tanto a la comparación de líneas como al resaltado interno.
 * - Las líneas "modificadas" son pares eliminada/añadida suficientemente parecidos.
 */
export function computeDiff(textA: string, textB: string, options: DiffOptions): DiffResult {
  const prepared = prepareTexts(textA, textB, options);
  const linesA = splitLines(prepared.a);
  const linesB = splitLines(prepared.b);
  const keysA = linesA.map((l) => lineKey(l, options));
  const keysB = linesB.map((l) => lineKey(l, options));

  const keep = (lines: string[]) => {
    const idx: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!options.ignoreBlankLines || !isBlankLine(lines[i]!)) idx.push(i);
    }
    return idx;
  };
  const idxA = keep(linesA);
  const idxB = keep(linesB);
  const { A, B } = internKeys(keysA, keysB, idxA, idxB);
  const { ops, approximate } = diffSequences(A, B);

  const rows: DiffRow[] = [];
  const stats = emptyStats();
  let curA = 0; // siguiente línea original de A aún no emitida
  let curB = 0;

  const line = (lines: string[], i: number): DiffLine => ({ no: i + 1, text: lines[i]! });

  /** Emite las líneas vacías ignoradas anteriores a (untilA, untilB). */
  const flushBlanks = (untilA: number, untilB: number) => {
    const blanksA: number[] = [];
    const blanksB: number[] = [];
    for (; curA < untilA; curA++) blanksA.push(curA);
    for (; curB < untilB; curB++) blanksB.push(curB);
    const n = Math.max(blanksA.length, blanksB.length);
    for (let k = 0; k < n; k++) {
      const row: DiffRow = { kind: 'equal', blank: true };
      if (k < blanksA.length) row.left = line(linesA, blanksA[k]!);
      if (k < blanksB.length) row.right = line(linesB, blanksB[k]!);
      rows.push(row);
    }
  };

  const pushEqual = (ia: number, ib: number) => {
    flushBlanks(ia, ib);
    rows.push({ kind: 'equal', left: line(linesA, ia), right: line(linesB, ib) });
    curA = ia + 1;
    curB = ib + 1;
    stats.unchanged++;
  };

  const flushBlock = (dels: number[], inss: number[]) => {
    if (dels.length === 0 && inss.length === 0) return;
    const pairs = pairBlock(
      dels.map((i) => keysA[i]!),
      inss.map((j) => keysB[j]!),
    );
    for (const p of pairs) {
      if (p.d !== undefined && p.i !== undefined) {
        const ia = dels[p.d]!;
        const ib = inss[p.i]!;
        flushBlanks(ia, ib);
        const left = line(linesA, ia);
        const right = line(linesB, ib);
        const parts = inlineDiff(left.text, right.text, options);
        if (parts) {
          left.parts = parts.left;
          right.parts = parts.right;
        }
        rows.push({ kind: 'modified', left, right });
        curA = ia + 1;
        curB = ib + 1;
        stats.modified++;
      } else if (p.d !== undefined) {
        const ia = dels[p.d]!;
        flushBlanks(ia, curB);
        rows.push({ kind: 'removed', left: line(linesA, ia) });
        curA = ia + 1;
        stats.removed++;
      } else if (p.i !== undefined) {
        const ib = inss[p.i]!;
        flushBlanks(curA, ib);
        rows.push({ kind: 'added', right: line(linesB, ib) });
        curB = ib + 1;
        stats.added++;
      }
    }
  };

  let dels: number[] = [];
  let inss: number[] = [];
  for (const op of ops) {
    if (op.t === 'del') {
      dels.push(idxA[op.a]!);
    } else if (op.t === 'ins') {
      inss.push(idxB[op.b]!);
    } else {
      flushBlock(dels, inss);
      dels = [];
      inss = [];
      pushEqual(idxA[op.a]!, idxB[op.b]!);
    }
  }
  flushBlock(dels, inss);
  flushBlanks(linesA.length, linesB.length);

  finishStats(stats);
  return {
    rows,
    stats,
    identical: stats.added === 0 && stats.removed === 0 && stats.modified === 0,
    approximate,
    jsonNormalized: prepared.jsonNormalized,
  };
}

/**
 * ¿Son equivalentes los dos textos con estas opciones? Más barato que un diff completo.
 */
export function areEquivalent(textA: string, textB: string, options: DiffOptions): boolean {
  const prepared = prepareTexts(textA, textB, options);
  const norm = (text: string) => {
    let lines = splitLines(text);
    if (options.ignoreBlankLines) lines = lines.filter((l) => !isBlankLine(l));
    return lines.map((l) => lineKey(l, options));
  };
  const a = norm(prepared.a);
  const b = norm(prepared.b);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** ¿Difieren los textos solo en saltos de línea / BOM / salto final? */
export function differOnlyInLineEndings(textA: string, textB: string): boolean {
  if (textA === textB) return false;
  const strictEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((l, i) => l === b[i]);
  return strictEqual(splitLines(textA), splitLines(textB));
}

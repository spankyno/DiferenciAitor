import { describe, expect, it } from 'vitest';
import {
  areEquivalent,
  computeDiff,
  differOnlyInLineEndings,
  diffSequences,
  inlineDiff,
} from './diffEngine';
import { DEFAULT_DIFF_OPTIONS, type DiffOptions, type DiffResult } from '../types';
import { splitLines } from './text';

const opts = (o: Partial<DiffOptions> = {}): DiffOptions => ({ ...DEFAULT_DIFF_OPTIONS, ...o });
const kinds = (r: DiffResult) => r.rows.map((x) => x.kind).join(',');

/** Reconstruye A y B a partir de las filas: invariante fundamental del diff. */
function rebuild(r: DiffResult) {
  const a: string[] = [];
  const b: string[] = [];
  for (const row of r.rows) {
    if (row.left) a.push(row.left.text);
    if (row.right) b.push(row.right.text);
  }
  return { a, b };
}

describe('computeDiff: casos básicos', () => {
  it('textos vacíos son idénticos y 100 % similares', () => {
    const r = computeDiff('', '', opts());
    expect(r.identical).toBe(true);
    expect(r.stats.similarity).toBe(100);
    expect(r.rows).toHaveLength(0);
  });

  it('vacío contra texto: todo añadido', () => {
    const r = computeDiff('', 'a\nb', opts());
    expect(r.stats).toMatchObject({ added: 2, removed: 0, modified: 0, similarity: 0 });
  });

  it('textos idénticos', () => {
    const r = computeDiff('a\nb\nc', 'a\nb\nc', opts());
    expect(r.identical).toBe(true);
    expect(r.stats.similarity).toBe(100);
  });

  it('numera las líneas desde 1 en cada lado', () => {
    const r = computeDiff('a\nb\nc', 'a\nX\nb\nc', opts());
    const added = r.rows.find((x) => x.kind === 'added')!;
    expect(added.right!.no).toBe(2);
    const last = r.rows[r.rows.length - 1]!;
    expect(last.left!.no).toBe(3);
    expect(last.right!.no).toBe(4);
  });

  it('una línea cambiada se muestra como modificada con resaltado', () => {
    const r = computeDiff('const PORT = 3000;', 'const PORT = 4000;', opts());
    expect(kinds(r)).toBe('modified');
    expect(r.stats.modified).toBe(1);
    const changed = r.rows[0]!.left!.parts!.filter((p) => p.changed).map((p) => p.text);
    expect(changed).toEqual(['3000']);
  });

  it('líneas sin parecido no se emparejan como modificadas', () => {
    const r = computeDiff('aaaaaaaa', 'zzzzzzzz', opts());
    expect(kinds(r)).toBe('removed,added');
  });
});

describe('computeDiff: bugs corregidos respecto a v0', () => {
  it('CRLF y LF no generan diferencias', () => {
    const r = computeDiff('a\r\nb\r\nc', 'a\nb\nc', opts());
    expect(r.identical).toBe(true);
    expect(r.stats.similarity).toBe(100);
  });

  it('un salto de línea final no es una diferencia', () => {
    expect(computeDiff('a\nb', 'a\nb\n', opts()).identical).toBe(true);
  });

  it('el BOM se ignora', () => {
    expect(computeDiff('\uFEFFa', 'a', opts()).identical).toBe(true);
  });

  it('"omitir líneas vacías" funciona', () => {
    const base = computeDiff('a\nb', 'a\n\n\nb', opts());
    expect(base.stats.added).toBe(2);
    const ign = computeDiff('a\nb', 'a\n\n\nb', opts({ ignoreBlankLines: true }));
    expect(ign.identical).toBe(true);
    // Las líneas vacías siguen visibles (marcadas), no desaparecen.
    expect(ign.rows.filter((x) => x.blank)).toHaveLength(2);
    expect(rebuild(ign).b).toEqual(['a', '', '', 'b']);
  });

  it('"ignorar espacios" ignora internos, tabuladores, indentación y finales', () => {
    const o = opts({ ignoreWhitespace: true });
    expect(computeDiff('a  b', 'a b', o).identical).toBe(true);
    expect(computeDiff('a\tb', 'a b', o).identical).toBe(true);
    expect(computeDiff('  a', 'a', o).identical).toBe(true);
    expect(computeDiff('a ', 'a', o).identical).toBe(true);
    expect(computeDiff('a b', 'a c', o).identical).toBe(false);
  });

  it('el resaltado interno respeta "ignorar mayúsculas"', () => {
    const r = computeDiff('Hola Mundo', 'hola mundo!', opts({ ignoreCase: true }));
    expect(r.rows[0]!.left!.parts!.some((p) => p.changed)).toBe(false);
    expect(r.rows[0]!.right!.parts!.filter((p) => p.changed).map((p) => p.text)).toEqual(['!']);
  });

  it('el resaltado interno respeta "ignorar espacios"', () => {
    const parts = inlineDiff('a  b c', 'a b d', opts({ ignoreWhitespace: true }))!;
    expect(parts.left.filter((p) => p.changed).map((p) => p.text)).toEqual(['c']);
  });

  it('el bloque desigual se alinea por similitud, no por posición', () => {
    // 'Y' no tiene pareja; 'x2' sí debe emparejarse con 'x2!'
    const r = computeDiff('a\nY\nx2\nz', 'a\nx2!\nz', opts());
    expect(kinds(r)).toBe('equal,removed,modified,equal');
  });

  it('las estadísticas cuentan modificadas por separado', () => {
    const r = computeDiff('uno\ndos\ntres', 'uno\ndos!\ntres\ncuatro', opts());
    expect(r.stats).toMatchObject({ added: 1, removed: 0, modified: 1, unchanged: 2 });
  });
});

describe('computeDiff: JSON', () => {
  it('compara JSON formateado y con claves ordenadas', () => {
    const a = '{"b":1,"a":[1,2]}';
    const b = '{\n  "a": [1, 2],\n  "b": 1\n}';
    expect(computeDiff(a, b, opts()).identical).toBe(false);
    const r = computeDiff(a, b, opts({ formatJson: true }));
    expect(r.identical).toBe(true);
    expect(r.jsonNormalized).toBe(true);
  });

  it('si uno de los textos no es JSON, no formatea ninguno', () => {
    const r = computeDiff('{"a":1}', 'no es json', opts({ formatJson: true }));
    expect(r.jsonNormalized).toBe(false);
  });
});

describe('invariantes (fuzzing)', () => {
  // PRNG determinista para tests reproducibles.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  const vocab = ['', 'a', 'b', 'c', 'foo', 'bar', 'foo bar', '  x', 'X', 'return;', '}', '{'];

  function randomText(rand: () => number, n: number) {
    return Array.from({ length: n }, () => vocab[Math.floor(rand() * vocab.length)]!).join('\n');
  }

  it('reconstruir A y B desde las filas devuelve los originales (todas las opciones)', () => {
    const rand = rng(42);
    const combos: Partial<DiffOptions>[] = [
      {},
      { ignoreCase: true },
      { ignoreWhitespace: true },
      { ignoreBlankLines: true },
      { ignoreCase: true, ignoreWhitespace: true, ignoreBlankLines: true },
    ];
    for (let n = 0; n < 300; n++) {
      const ta = randomText(rand, Math.floor(rand() * 25));
      const tb = randomText(rand, Math.floor(rand() * 25));
      for (const c of combos) {
        const r = computeDiff(ta, tb, opts(c));
        const { a, b } = rebuild(r);
        expect(a).toEqual(splitLines(ta));
        expect(b).toEqual(splitLines(tb));
        // La numeración es consecutiva en cada lado.
        const nosA = r.rows.filter((x) => x.left).map((x) => x.left!.no);
        expect(nosA).toEqual(nosA.map((_, i) => i + 1));
      }
    }
  });

  it('diffSequences es una secuencia de edición válida', () => {
    const rand = rng(7);
    for (let n = 0; n < 300; n++) {
      const A = Array.from({ length: Math.floor(rand() * 30) }, () => Math.floor(rand() * 6));
      const B = Array.from({ length: Math.floor(rand() * 30) }, () => Math.floor(rand() * 6));
      const { ops } = diffSequences(A, B);
      const outA: number[] = [];
      const outB: number[] = [];
      for (const op of ops) {
        if (op.t !== 'ins') outA.push(A[op.a]!);
        if (op.t !== 'del') outB.push(B[op.b]!);
        if (op.t === 'eq') expect(A[op.a]).toBe(B[op.b]);
      }
      expect(outA).toEqual(A);
      expect(outB).toEqual(B);
    }
  });

  it('no inventa diferencias: A contra A es siempre idéntico', () => {
    const rand = rng(99);
    for (let n = 0; n < 100; n++) {
      const t = randomText(rand, Math.floor(rand() * 40));
      expect(computeDiff(t, t, opts()).identical).toBe(true);
    }
  });
});

describe('equivalencia', () => {
  it('areEquivalent coincide con computeDiff', () => {
    const o = opts({ ignoreWhitespace: true, ignoreCase: true });
    expect(areEquivalent('A  b\r\nc', 'a b\nC\n', o)).toBe(true);
    expect(areEquivalent('a', 'b', o)).toBe(false);
  });

  it('detecta diferencias solo de saltos de línea', () => {
    expect(differOnlyInLineEndings('a\r\nb', 'a\nb')).toBe(true);
    expect(differOnlyInLineEndings('a\nb', 'a\nb')).toBe(false);
    expect(differOnlyInLineEndings('a\nb', 'a\nc')).toBe(false);
  });
});

describe('rendimiento', () => {
  const big = (n: number, every: number) =>
    Array.from({ length: n }, (_, i) => (i % every === 0 ? `cambio ${i}` : `linea ${i}`)).join('\n');

  it('30.000 líneas con ~14 % de cambios en tiempo razonable (antes: 7 s)', () => {
    const t0 = Date.now();
    const r = computeDiff(big(30000, 1000), big(30000, 7), opts());
    const ms = Date.now() - t0;
    expect(r.rows.length).toBeGreaterThan(30000);
    expect(ms).toBeLessThan(3000);
  });

  it('textos totalmente distintos no se cuelgan', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `a${i % 3}`).join('\n');
    const b = Array.from({ length: 5000 }, (_, i) => `b${i % 3}`).join('\n');
    const t0 = Date.now();
    computeDiff(a, b, opts());
    expect(Date.now() - t0).toBeLessThan(8000);
  });
});

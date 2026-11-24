import { describe, expect, it } from 'vitest';
import { compileIgnore, parsePatterns } from './glob';
import { compareFolders, effectiveStatus, findEquivalent, folderStats } from './folderCompare';
import { buildReportRows, toCSV, toHTML, toJSON } from './report';
import { decodeText, looksBinary, splitLines, tryFormatJson, similarity } from './text';
import { formatBytes } from './hash';
import { createUnifiedPatch } from './patch';
import { runPool } from './pool';
import { DEFAULT_DIFF_OPTIONS, type FolderFileEntry } from '../types';

describe('text', () => {
  it('splitLines normaliza saltos y descarta el final', () => {
    expect(splitLines('a\r\nb\rc\nd\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines('\n')).toEqual(['']);
    expect(splitLines('a\n\n')).toEqual(['a', '']);
  });

  it('looksBinary distingue texto, binario y UTF-16', () => {
    expect(looksBinary(new TextEncoder().encode('hola\nmundo\tñ'))).toBe(false);
    expect(looksBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]))).toBe(true);
    expect(looksBinary(new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))).toBe(false);
    expect(looksBinary(new Uint8Array([]))).toBe(false);
  });

  it('decodeText soporta UTF-8 y UTF-16', () => {
    expect(decodeText(new TextEncoder().encode('ñandú').buffer)).toBe('ñandú');
    const utf16 = new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]);
    expect(decodeText(utf16.buffer).replace(/^\uFEFF/, '')).toBe('hi');
  });

  it('tryFormatJson ordena claves y rechaza no-JSON', () => {
    expect(tryFormatJson('{"b":1,"a":2}')).toBe('{\n  "a": 2,\n  "b": 1\n}');
    expect(tryFormatJson('hola')).toBeNull();
    expect(tryFormatJson('{roto')).toBeNull();
    expect(tryFormatJson('123')).toBeNull();
  });

  it('similarity', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abcdef', 'abcdeg')).toBeGreaterThan(0.6);
    expect(similarity('aaaa', 'zzzz')).toBe(0);
    expect(similarity('a', 'b')).toBe(0);
  });

  it('formatBytes es robusto', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(-1)).toBe('-');
    expect(formatBytes(NaN)).toBe('-');
  });
});

describe('glob / exclusiones', () => {
  const ign = (pats: string, path: string, isDir = false) =>
    compileIgnore(parsePatterns(pats))(path, isDir);

  it('parsePatterns ignora comentarios y vacíos', () => {
    expect(parsePatterns('# nota\n\n .git/ \r\nnode_modules/')).toEqual(['.git/', 'node_modules/']);
  });
  it('nombre sin barra: a cualquier profundidad', () => {
    expect(ign('.DS_Store', 'a/b/.DS_Store')).toBe(true);
    expect(ign('.DS_Store', 'a/b/c.txt')).toBe(false);
  });
  it('carpeta con barra final: solo carpetas y su contenido', () => {
    expect(ign('node_modules/', 'node_modules', true)).toBe(true);
    expect(ign('node_modules/', 'x/node_modules/y/z.js')).toBe(true);
    expect(ign('node_modules/', 'node_modules')).toBe(false); // es un archivo llamado así
  });
  it('comodines', () => {
    expect(ign('*.log', 'logs/a.log')).toBe(true);
    expect(ign('*.log', 'logs/a.txt')).toBe(false);
    expect(ign('src/**/*.test.ts', 'src/a/b/x.test.ts')).toBe(true);
    expect(ign('src/**/*.test.ts', 'lib/x.test.ts')).toBe(false);
    expect(ign('/dist', 'dist/a.js')).toBe(true); // la barra inicial ancla a la raíz
    expect(ign('/dist', 'x/dist/a.js')).toBe(false);
  });
  it('rutas con barra se anclan a la raíz', () => {
    expect(ign('docs/build', 'docs/build/a.html')).toBe(true);
    expect(ign('docs/build', 'x/docs/build/a.html')).toBe(false);
  });
  it('caracteres especiales de regex no rompen', () => {
    expect(ign('a+b(1).txt', 'a+b(1).txt')).toBe(true);
  });
  it('sin patrones no ignora nada', () => {
    expect(ign('', 'cualquier/cosa')).toBe(false);
  });
});

function entry(path: string, hash: string, size = 10, extra: Partial<FolderFileEntry> = {}): FolderFileEntry {
  return {
    relativePath: path,
    name: path.split('/').pop()!,
    size,
    lastModified: 1,
    hash,
    isBinary: false,
    hashSkipped: false,
    file: new File([''], path),
    ...extra,
  };
}
const mapOf = (...e: FolderFileEntry[]) => new Map(e.map((x) => [x.relativePath, x]));

describe('compareFolders', () => {
  it('clasifica idénticos, modificados, añadidos y eliminados', () => {
    const items = compareFolders(
      mapOf(entry('a.txt', 'h1'), entry('b.txt', 'h2'), entry('c.txt', 'h3')),
      mapOf(entry('a.txt', 'h1'), entry('b.txt', 'hX'), entry('d.txt', 'h4')),
      { ignorePathCase: false },
    );
    const by = Object.fromEntries(items.map((i) => [i.path, i.status]));
    expect(by).toEqual({ 'a.txt': 'identical', 'b.txt': 'modified', 'c.txt': 'deleted', 'd.txt': 'added' });
  });

  it('detecta renombrados / movidos por hash', () => {
    const items = compareFolders(
      mapOf(entry('old/x.js', 'H', 50)),
      mapOf(entry('new/y.js', 'H', 50)),
      { ignorePathCase: false },
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: 'renamed', path: 'new/y.js' });
    expect(items[0]!.fileA!.relativePath).toBe('old/x.js');
  });

  it('no trata archivos vacíos como renombrados', () => {
    const items = compareFolders(mapOf(entry('a', 'E', 0)), mapOf(entry('b', 'E', 0)), {
      ignorePathCase: false,
    });
    expect(items.map((i) => i.status).sort()).toEqual(['added', 'deleted']);
  });

  it('con un hash repetido empareja uno a uno', () => {
    const items = compareFolders(
      mapOf(entry('a1', 'H', 5)),
      mapOf(entry('b1', 'H', 5), entry('b2', 'H', 5)),
      { ignorePathCase: false },
    );
    expect(items.map((i) => i.status).sort()).toEqual(['added', 'renamed']);
  });

  it('ignorePathCase unifica rutas que solo difieren en mayúsculas', () => {
    const strict = compareFolders(mapOf(entry('Readme.md', 'h')), mapOf(entry('README.md', 'h')), {
      ignorePathCase: false,
    });
    expect(strict.some((i) => i.status === 'identical')).toBe(false);
    const loose = compareFolders(mapOf(entry('Readme.md', 'h')), mapOf(entry('README.md', 'h')), {
      ignorePathCase: true,
    });
    expect(loose.map((i) => i.status)).toEqual(['identical']);
  });

  it('sin hash (archivo enorme) compara tamaño y fecha', () => {
    const big = (s: number, t: number) => entry('g.bin', '', s, { hashSkipped: true, lastModified: t });
    const r = (a: FolderFileEntry, b: FolderFileEntry) =>
      compareFolders(mapOf(a), mapOf(b), { ignorePathCase: false })[0]!.status;
    expect(r(big(5, 1), big(5, 1))).toBe('identical');
    expect(r(big(5, 1), big(5, 2))).toBe('modified');
    expect(r(big(5, 1), big(6, 1))).toBe('modified');
  });

  it('folderStats y effectiveStatus', () => {
    const items = compareFolders(mapOf(entry('a', 'h1')), mapOf(entry('a', 'h2')), { ignorePathCase: false });
    expect(folderStats(items, new Set()).modified).toBe(1);
    expect(folderStats(items, new Set(['a'])).equivalent).toBe(1);
    expect(effectiveStatus(items[0]!, new Set(['a']))).toBe('equivalent');
  });
});

describe('findEquivalent', () => {
  const fileEntry = (path: string, content: string) =>
    entry(path, content, content.length, { file: new File([content], path) });

  it('marca como equivalentes los que solo difieren en CRLF/espacios según opciones', async () => {
    const items = compareFolders(
      mapOf(fileEntry('a.txt', 'uno\r\ndos\r\n'), fileEntry('b.txt', 'uno\ndos')),
      mapOf(fileEntry('a.txt', 'uno\ndos\n'), fileEntry('b.txt', 'uno\ndos!')),
      { ignorePathCase: false },
    );
    const eq = await findEquivalent(items, DEFAULT_DIFF_OPTIONS);
    expect([...eq]).toEqual(['a.txt']);
  });

  it('no mira archivos binarios', async () => {
    const items = compareFolders(
      mapOf(entry('i.png', 'h1', 5, { isBinary: true })),
      mapOf(entry('i.png', 'h2', 5, { isBinary: true })),
      { ignorePathCase: false },
    );
    expect((await findEquivalent(items, DEFAULT_DIFF_OPTIONS)).size).toBe(0);
  });
});

describe('report', () => {
  const items = compareFolders(
    mapOf(entry('=cmd|calc.txt', 'h1'), entry('c,d.txt', 'h2')),
    mapOf(entry('=cmd|calc.txt', 'h9'), entry('c,d.txt', 'h2')),
    { ignorePathCase: false },
  );
  const rows = buildReportRows(items, (i) => i.status, (s) => s.toUpperCase());

  it('CSV escapa comas y neutraliza fórmulas', () => {
    const csv = toCSV(rows, ['Estado', 'Ruta', 'Origen', 'A', 'B', 'HA', 'HB']);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"c,d.txt"');
    expect(csv).toContain("'=cmd|calc.txt");
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });

  it('HTML escapa contenido', () => {
    const html = toHTML(
      buildReportRows(
        compareFolders(new Map(), mapOf(entry('<img src=x onerror=alert(1)>', 'h')), { ignorePathCase: false }),
        (i) => i.status,
        (s) => s,
      ),
      ['x'],
      '<b>t</b>',
      's',
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;b&gt;t&lt;/b&gt;');
  });

  it('JSON es válido', () => {
    const parsed = JSON.parse(toJSON(rows, { a: 1 }));
    expect(parsed.items).toHaveLength(2);
    expect(parsed.a).toBe(1);
  });
});

describe('patch', () => {
  it('genera un diff unificado estándar', () => {
    const p = createUnifiedPatch('a.txt', 'b.txt', 'uno\ndos\n', 'uno\ntres\n');
    expect(p).toContain('--- a.txt');
    expect(p).toContain('+++ b.txt');
    expect(p).toMatch(/@@ -1,2 \+1,2 @@/);
    expect(p).toContain('-dos');
    expect(p).toContain('+tres');
  });
});

describe('runPool', () => {
  it('respeta la concurrencia máxima y procesa todo', async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await runPool(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async (n) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 2));
        seen.push(n);
        active--;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('se puede cancelar', async () => {
    const ctrl = new AbortController();
    let n = 0;
    const p = runPool(
      Array.from({ length: 100 }, (_, i) => i),
      2,
      async () => {
        n++;
        if (n === 5) ctrl.abort();
        await new Promise((r) => setTimeout(r, 1));
      },
      { signal: ctrl.signal },
    );
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(n).toBeLessThan(100);
  });
});


describe('seguridad: patrones de exclusión sin retroceso exponencial', () => {
  /** Implementación ANTERIOR (RegExp). Se conserva solo como oráculo de referencia del fuzzing. */
  function refCompile(patterns: string[]) {
    const escapeRe = (x: string) => x.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const toSource = (glob: string) => {
      let out = '';
      for (let i = 0; i < glob.length; i++) {
        const c = glob[i]!;
        if (c === '*') {
          if (glob[i + 1] === '*') {
            if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
          } else out += '[^/]*';
        } else if (c === '?') out += '[^/]';
        else out += escapeRe(c);
      }
      return out;
    };
    const rules = patterns.map((pattern) => {
      let p = pattern;
      const dirOnly = p.endsWith('/');
      if (dirOnly) p = p.slice(0, -1);
      const anchored = p.includes('/');
      if (p.startsWith('/')) p = p.slice(1);
      return { re: new RegExp(`^${toSource(p)}$`), dirOnly, anchored };
    });
    return (path: string, isDir = false) => {
      const parts = path.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const dir = i === parts.length - 1 ? isDir : true;
        const prefix = parts.slice(0, i + 1).join('/');
        for (const r of rules) {
          if (r.dirOnly && !dir) continue;
          if (r.re.test(r.anchored ? prefix : parts[i]!)) return true;
        }
      }
      return false;
    };
  }

  it('da EXACTAMENTE los mismos resultados que la versión con RegExp (fuzzing)', () => {
    let seed = 11;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[Math.floor(rand() * chars.length)]).join('');
    let compared = 0;
    for (let n = 0; n < 4000; n++) {
      const pats = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick('ab/*?.x', 1 + Math.floor(rand() * 7)));
      const neu = compileIgnore(pats);
      const ref = refCompile(pats);
      for (let k = 0; k < 6; k++) {
        const path = pick('ab/.x', Math.floor(rand() * 10));
        for (const isDir of [false, true]) {
          expect(neu(path, isDir), `patrones=${JSON.stringify(pats)} ruta=${JSON.stringify(path)} dir=${isDir}`).toBe(ref(path, isDir));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(40_000);
  });

  it('un patrón con muchos comodines ya no congela (antes: 10 comodines = 0,7 s y ×4 por cada uno)', () => {
    const pat = '*a'.repeat(30) + '*b';
    const path = 'a'.repeat(200) + 'c';
    const t0 = performance.now();
    expect(compileIgnore([pat])(path)).toBe(false);
    expect(compileIgnore(['**/*a'.repeat(15) + '*b'])(path)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('sigue encontrando coincidencias reales con muchos comodines', () => {
    expect(compileIgnore(['*a*a*a*a*b'])('xaxaxaxaxb')).toBe(true);
    expect(compileIgnore(['src/**/*.test.ts'])('src/a/b/c/x.test.ts')).toBe(true);
  });

  it('es rápido con muchas rutas y los patrones habituales', () => {
    const ign = compileIgnore(parsePatterns('.git/\nnode_modules/\n.DS_Store\n*.log\nbuild/**/*.map'));
    const t0 = performance.now();
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (ign(`src/mod${i % 50}/sub/archivo${i}.ts`)) hits++;
    expect(hits).toBe(0);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});

/**
 * Patrones de exclusión estilo .gitignore (simplificado).
 *
 *  - `nombre`        coincide con cualquier archivo o carpeta con ese nombre, a cualquier profundidad.
 *  - `nombre/`       solo carpetas con ese nombre.
 *  - `ruta/con/barra` se ancla a la raíz de la carpeta comparada.
 *  - `*` (sin /), `**` (con /) y `?` como comodines.
 *  - Líneas vacías y las que empiezan por `#` se ignoran.
 */

export const DEFAULT_IGNORE_PATTERNS = [
  '.git/',
  'node_modules/',
  '.DS_Store',
  'Thumbs.db',
  '.next/',
  '.vercel/',
].join('\n');

export function parsePatterns(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

function escapeRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToSource(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += escapeRe(c);
    }
  }
  return out;
}

interface Rule {
  re: RegExp;
  dirOnly: boolean;
  anchored: boolean;
}

function compileRule(pattern: string): Rule {
  let p = pattern;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  return { re: new RegExp(`^${globToSource(p)}$`), dirOnly, anchored };
}

/** Devuelve una función que indica si una ruta relativa debe ignorarse. */
export function compileIgnore(patterns: string[]): (path: string, isDir?: boolean) => boolean {
  const rules = patterns.map(compileRule);
  if (rules.length === 0) return () => false;

  return (path: string, isDir = false) => {
    const parts = path.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const dir = last ? isDir : true; // los tramos intermedios son carpetas
      const prefix = parts.slice(0, i + 1).join('/');
      const name = parts[i]!;
      for (const r of rules) {
        if (r.dirOnly && !dir) continue;
        if (r.re.test(r.anchored ? prefix : name)) return true;
      }
    }
    return false;
  };
}

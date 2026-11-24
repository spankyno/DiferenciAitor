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

/**
 * Se emparejan SIN expresiones regulares: una RegExp con varios comodines (`*a*a*a*b`) retrocede
 * de forma exponencial y congela la pestaña. Aquí el coste es O(tokens × longitud del texto).
 */
type Token =
  | { t: 'lit'; c: string }
  | { t: 'any1' } //       ?   un carácter distinto de "/"
  | { t: 'star' } //       *   cualquier cosa salvo "/"
  | { t: 'dstar' } //      **  cualquier cosa, incluida "/"
  | { t: 'dstarSlash' }; // **/ cero o más carpetas

function tokenize(glob: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          out.push({ t: 'dstarSlash' });
          i += 2;
        } else {
          out.push({ t: 'dstar' });
          i += 1;
        }
      } else {
        out.push({ t: 'star' });
      }
    } else if (c === '?') {
      out.push({ t: 'any1' });
    } else {
      out.push({ t: 'lit', c });
    }
  }
  return out;
}

/** ¿Coincide TODO el texto con los tokens? Programación dinámica sobre posiciones del texto. */
function matchTokens(tokens: Token[], text: string): boolean {
  const m = text.length;
  let cur = new Uint8Array(m + 1);
  let next = new Uint8Array(m + 1);
  cur[0] = 1;

  for (const tok of tokens) {
    next.fill(0);
    switch (tok.t) {
      case 'lit':
        for (let j = 0; j < m; j++) if (cur[j] && text[j] === tok.c) next[j + 1] = 1;
        break;
      case 'any1':
        for (let j = 0; j < m; j++) if (cur[j] && text[j] !== '/') next[j + 1] = 1;
        break;
      case 'star':
        for (let j = 0; j <= m; j++) {
          if (cur[j] || (j > 0 && next[j - 1] && text[j - 1] !== '/')) next[j] = 1;
        }
        break;
      case 'dstar':
        for (let j = 0; j <= m; j++) if (cur[j] || (j > 0 && next[j - 1])) next[j] = 1;
        break;
      case 'dstarSlash': {
        let seen = false; // ¿hay alguna posición alcanzable en [0, j)?
        for (let j = 0; j <= m; j++) {
          if (cur[j] || (j > 0 && text[j - 1] === '/' && seen)) next[j] = 1;
          if (cur[j]) seen = true;
        }
        break;
      }
    }
    [cur, next] = [next, cur];
  }
  return cur[m] === 1;
}

interface Rule {
  /** Patrón sin comodines: comparación directa (lo habitual: .git, node_modules...). */
  literal?: string;
  tokens: Token[];
  dirOnly: boolean;
  anchored: boolean;
}

function compileRule(pattern: string): Rule {
  let p = pattern;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  const tokens = tokenize(p);
  const rule: Rule = { tokens, dirOnly, anchored };
  if (tokens.every((t) => t.t === 'lit')) rule.literal = p;
  return rule;
}

function ruleMatches(rule: Rule, text: string): boolean {
  if (rule.literal !== undefined) return text === rule.literal;
  return matchTokens(rule.tokens, text);
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
        if (ruleMatches(r, r.anchored ? prefix : name)) return true;
      }
    }
    return false;
  };
}

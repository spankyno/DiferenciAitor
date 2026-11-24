import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../seo/render';

const root = resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');
const TRACKER = 'https://aitors-hub-dashboard.asanchezgu.workers.dev';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const vercel = JSON.parse(read('vercel.json')) as { headers: HeaderRule[] };
const globalHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]));
const csp = globalHeaders['Content-Security-Policy']!;
const directive = (name: string) =>
  csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s === name || s.startsWith(name + ' '))
    ?.split(/\s+/)
    .slice(1) ?? [];

describe('CSP estricta (vercel.json)', () => {
  it('los scripts solo pueden venir del sitio y del panel de analítica; sin inline ni eval', () => {
    expect(directive('script-src')).toEqual(["'self'", TRACKER]);
  });

  it('los estilos solo del sitio: sin unsafe-inline', () => {
    expect(directive('style-src')).toEqual(["'self'"]);
  });

  it('workers solo del sitio (sin blob:), imágenes sin data:/blob:', () => {
    expect(directive('worker-src')).toEqual(["'self'"]);
    expect(directive('img-src')).toEqual(["'self'", TRACKER]);
  });

  it('las conexiones solo al sitio y al panel de analítica', () => {
    expect(directive('connect-src')).toEqual(["'self'", TRACKER]);
  });

  it('cierra plugins, <base>, formularios y marcos; fuerza HTTPS', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('el único origen externo permitido en toda la política es el del panel', () => {
    expect(new Set(csp.match(/https?:\/\/[^\s;]+/g))).toEqual(new Set([TRACKER]));
    expect(csp).not.toMatch(/\*|unsafe-eval|unsafe-inline|data:|blob:/);
  });
});

describe('cabeceras de seguridad (vercel.json)', () => {
  it('HSTS con vigencia de al menos un año', () => {
    const hsts = globalHeaders['Strict-Transport-Security']!;
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it('anti-sniffing, anti-marcos, aislamiento de ventana y sin referrer', () => {
    expect(globalHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(globalHeaders['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(globalHeaders['Referrer-Policy']).toBe('no-referrer');
  });

  it('deniega las APIs sensibles del navegador que la app no usa', () => {
    const pp = globalHeaders['Permissions-Policy']!;
    for (const f of ['camera', 'microphone', 'geolocation', 'payment', 'usb', 'serial']) {
      expect(pp).toContain(`${f}=()`);
    }
  });

  it('la Permissions-Policy solo usa características que Chrome reconoce (bluetooth no lo es y genera un aviso)', () => {
    expect(globalHeaders['Permissions-Policy']).not.toContain('bluetooth');
  });

  it('sw.js se sirve sin caché para que las correcciones lleguen enseguida', () => {
    const sw = vercel.headers.find((h) => h.source === '/sw.js')!;
    expect(sw.headers.find((h) => h.key === 'Cache-Control')?.value).toContain('no-cache');
  });
});

describe('HTML compatible con la CSP estricta', () => {
  const pages = {
    'index.html': read('index.html'),
    'acerca-de': renderPage(read('index.html'), 'about'),
    privacidad: renderPage(read('index.html'), 'privacy'),
  };

  it.each(Object.entries(pages))('%s: sin atributos style, sin <style> y sin scripts inline ejecutables', (_name, html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    expect(d.querySelectorAll('[style]')).toHaveLength(0);
    expect(d.querySelectorAll('style')).toHaveLength(0);
    const inline = [...d.querySelectorAll('script:not([src])')].filter((s) => s.getAttribute('type') !== 'application/ld+json');
    expect(inline).toHaveLength(0);
    // Ningún manejador de eventos en línea (onclick=...).
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('los únicos scripts externos son los propios y el del panel de analítica', () => {
    const d = new DOMParser().parseFromString(pages['index.html'], 'text/html');
    const srcs = [...d.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')!);
    for (const src of srcs) {
      expect(src.startsWith('/') || src.startsWith(`${TRACKER}/`), src).toBe(true);
    }
  });

  it('la hoja de estilos de la app incluye las reglas del contenido estático', () => {
    expect(read('src/index.css')).toContain('.ssr');
  });
});

describe('service worker', () => {
  const sw = read('public/sw.js');

  it('solo gestiona peticiones GET del propio origen', () => {
    expect(sw).toContain("req.method !== 'GET' || url.origin !== self.location.origin");
  });

  it('solo cachea respuestas correctas y del propio origen (res.type === "basic")', () => {
    expect(sw).toContain("res.type === 'basic'");
    expect(sw).toContain('res.ok');
  });

  it('caché primero únicamente para /assets/ (inmutables); el resto se revalida', () => {
    expect(sw).toContain("url.pathname.startsWith('/assets/')");
    expect(sw).toContain('stale-while-revalidate');
  });

  it('cada versión limpia las cachés antiguas', () => {
    expect(sw).toMatch(/const CACHE = 'diferenciaitor-v\d+'/);
    expect(sw).toContain('caches.delete(k)');
  });
});

describe('security.txt (RFC 9116)', () => {
  const txt = read('public/.well-known/security.txt');

  it('tiene los campos obligatorios', () => {
    expect(txt).toMatch(/^Contact: (mailto:|https:)/m);
    expect(txt).toMatch(/^Expires: /m);
  });

  it('no está caducado y no vence a más de un año', () => {
    const expires = new Date(/^Expires: (.+)$/m.exec(txt)![1]!).getTime();
    expect(expires).toBeGreaterThan(Date.now());
    expect(expires).toBeLessThan(Date.now() + 366 * 24 * 3600 * 1000);
  });

  it('declara su URL canónica', () => {
    expect(txt).toContain('Canonical: https://diferenciaitor.vercel.app/.well-known/security.txt');
  });
});

describe('cadena de suministro y CI', () => {
  const pkg = JSON.parse(read('package.json')) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    engines: { node: string };
  };

  it('el servidor de desarrollo no se expone a la red local', () => {
    expect(pkg.scripts.dev).not.toMatch(/0\.0\.0\.0|--host/);
  });

  it('no hay scripts de ciclo de vida que se ejecuten al instalar', () => {
    for (const s of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']) {
      expect(pkg.scripts[s], s).toBeUndefined();
    }
  });

  it('ninguna dependencia usa git, URL, "*" o "latest"', () => {
    for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(spec, name).not.toMatch(/^(git|github:|http|file:|link:)|\*|latest/);
    }
  });

  it('las dependencias de producción son solo las esperadas (alerta si aparece una nueva)', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@tanstack/react-virtual', 'diff', 'lucide-react', 'react', 'react-dom']);
  });

  it('engines.node es compatible con las herramientas instaladas (vitest 5 exige Node 22.12+)', () => {
    expect(pkg.engines.node).toBe('^22.12.0 || ^24.0.0 || >=26.0.0');
  });

  it('el lockfile existe (instalaciones reproducibles)', () => {
    expect(existsSync(resolve(root, 'package-lock.json'))).toBe(true);
  });

  it('el CI usa permisos mínimos, no persiste credenciales y audita las dependencias de producción', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^permissions:\s*\n\s+contents: read/m);
    expect(ci).toContain('persist-credentials: false');
    expect(ci).toContain('npm audit --omit=dev');
    expect(ci).toContain('timeout-minutes');
  });

  it('Dependabot vigila npm y GitHub Actions', () => {
    const d = read('.github/dependabot.yml');
    expect(d).toContain('package-ecosystem: npm');
    expect(d).toContain('package-ecosystem: github-actions');
  });
});

/** Todos los .ts/.tsx de la app (sin tests). */
function appSources(dir = resolve(root, 'src')): { file: string; code: string }[] {
  const out: { file: string; code: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...appSources(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      out.push({ file: p.replace(root + '/', ''), code: readFileSync(p, 'utf8') });
    }
  }
  return out;
}

describe('código de la app: sin sumideros peligrosos', () => {
  const sources = appSources();

  it('se están analizando los archivos de la app', () => {
    expect(sources.length).toBeGreaterThan(30);
  });

  it.each([
    ['inserción de HTML', /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|createContextualFragment|document\.write/],
    ['ejecución dinámica', /\beval\s*\(|new Function\s*\(|setTimeout\(\s*['"`]|setInterval\(\s*['"`]/],
    ['srcdoc / iframes', /srcdoc|<iframe/],
    ['redirecciones por asignación', /location\.(href|assign|replace)\s*=/],
  ])('ningún archivo usa %s', (_label, re) => {
    const offenders = sources.filter((s) => re.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('PROMESA DE PRIVACIDAD: el código de la app no hace ninguna petición de red', () => {
    const re = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|new Image\s*\(|navigator\.connection/;
    const offenders = sources.filter((s) => re.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('todo enlace con target="_blank" lleva rel="noopener noreferrer"', () => {
    for (const s of sources) {
      for (const m of s.code.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        expect(m[0], s.file).toMatch(/rel="noopener noreferrer"/);
      }
    }
  });

  it('las carpetas se piden en solo lectura (File System Access API)', () => {
    const folder = sources.find((s) => s.file.endsWith('FolderDiffView.tsx'))!;
    expect(folder.code).toContain("showDirectoryPicker({ mode: 'read' })");
    expect(sources.some((s) => /createWritable|getFileHandle\([^)]*create\s*:\s*true|requestPermission\([^)]*readwrite/.test(s.code))).toBe(false);
  });

  it('no se persiste el contenido de textos ni archivos en el almacenamiento del navegador', () => {
    const users = sources.filter((s) => /localStorage|sessionStorage|indexedDB/.test(s.code)).map((s) => s.file);
    expect(users).toEqual(['src/hooks/usePersistentState.ts']);
    const calls = sources.filter((s) => /usePersistentState\s*[<(]/.test(s.code) && !s.file.endsWith('usePersistentState.ts'));
    const keys = calls.flatMap((s) => [...s.code.matchAll(/usePersistentState(?:<[^>]*>)?\(\s*'([^']+)'/g)].map((m) => m[1]));
    expect(keys.sort()).toEqual(['folderPrefs', 'ignore', 'lang', 'options', 'theme', 'view']);
  });
});

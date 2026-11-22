import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIVACY_TITLES } from './content/privacy';
import { es } from './i18n/messages';
import { PAGE_META, pageIdForMode, pageUrl, type PageId } from '../seo/meta';
import { renderPage } from '../seo/render';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');
const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content');

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };

/** Detecta el formato por su firma (no por la extensión) y lee las dimensiones. */
function imageInfo(buf: Buffer): { mime: string; width: number; height: number } {
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error('formato de imagen no reconocido');
}

const SITE = 'https://diferenciaitor.vercel.app/';
const TRACKER = 'https://aitors-hub-dashboard.asanchezgu.workers.dev';

describe('index.html: SEO', () => {
  it('incluye la etiqueta de verificación de propiedad de Google', () => {
    expect(meta('meta[name="google-site-verification"]')).toBe('MEiDmnJOvnWITHUi0HCLxuoulOEm0oTM4fwQMugxoyY');
  });

  it('declara canonical y el autor', () => {
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SITE);
    expect(meta('meta[name="author"]')).toBe('Aitor Sánchez Gutiérrez');
  });

  it('referencia og-image.png con URL absoluta en Open Graph y Twitter', () => {
    const img = `${SITE}og-image.png`;
    expect(meta('meta[property="og:image"]')).toBe(img);
    expect(meta('meta[property="og:image:secure_url"]')).toBe(img);
    expect(meta('meta[name="twitter:image"]')).toBe(img);
    expect(meta('meta[property="og:image:width"]')).toBe('1248');
    expect(meta('meta[property="og:image:height"]')).toBe('832');
    expect(meta('meta[property="og:image:alt"]')).toBeTruthy();
    expect(meta('meta[name="twitter:image:alt"]')).toBeTruthy();
    expect(meta('meta[property="og:url"]')).toBe(SITE);
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('la imagen OG existe y su formato REAL y dimensiones coinciden con lo declarado', () => {
    // og-image.png es en realidad un JPEG: se declara el tipo real, no el de la extensión.
    const info = imageInfo(readFileSync(resolve(root, 'public/og-image.png')));
    expect(info.width).toBe(1248);
    expect(info.height).toBe(832);
    expect(meta('meta[property="og:image:type"]')).toBe(info.mime);
    expect(Number(meta('meta[property="og:image:width"]'))).toBe(info.width);
    expect(Number(meta('meta[property="og:image:height"]'))).toBe(info.height);
  });

  it('Vercel sirve og-image.png con el Content-Type de su formato real', () => {
    const info = imageInfo(readFileSync(resolve(root, 'public/og-image.png')));
    const entry = vercel.headers.find((h) => h.source === '/og-image.png');
    expect(entry?.headers.find((h) => h.key === 'Content-Type')?.value).toBe(info.mime);
  });

  it('pesa lo bastante poco para compartirse (WhatsApp ~300 KB)', () => {
    expect(readFileSync(resolve(root, 'public/og-image.png')).length).toBeLessThan(300 * 1024);
  });

  it('el título y la descripción tienen una longitud adecuada para buscadores', () => {
    expect(doc.title.length).toBeLessThanOrEqual(65);
    expect(meta('meta[name="description"]')!.length).toBeLessThanOrEqual(160);
  });
});

describe('index.html: JSON-LD', () => {
  const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
  interface Node {
  '@type': string;
  '@id'?: string;
  url?: string;
  image?: string;
  name?: string;
  sameAs?: string[];
  contactPoint?: { url: string };
  author?: { '@id': string };
  publisher?: { '@id': string };
}
  const graph: Node[] = ld['@graph'];
  const byType = (t: string) => graph.find((n) => n['@type'] === t)!;

  it('es un grafo de schema.org con WebSite, WebApplication y Person', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(graph.map((n) => n['@type']).sort()).toEqual(['Person', 'WebApplication', 'WebSite']);
  });

  it('referencia la URL de la aplicación', () => {
    expect(byType('WebSite').url).toBe(SITE);
    expect(byType('WebApplication').url).toBe(SITE);
    expect(byType('WebApplication').image).toBe(`${SITE}og-image.png`);
  });

  it('describe al autor con blog, Aitor Hub y contacto', () => {
    const p = byType('Person');
    expect(p.name).toBe('Aitor Sánchez Gutiérrez');
    expect(p.url).toBe('https://aitorsanchez.pages.dev');
    expect(p.sameAs).toEqual(['https://aitorsanchez.pages.dev', 'https://aitorhub.vercel.app']);
    expect(p.contactPoint?.url).toBe('https://aitorsanchez.pages.dev/contacto');
  });

  it('la aplicación y la web apuntan al autor mediante @id existente', () => {
    const ids = new Set(graph.map((n) => n['@id']));
    expect(ids.has(byType('WebApplication').author?.['@id'])).toBe(true);
    expect(ids.has(byType('WebSite').publisher?.['@id'])).toBe(true);
  });
});

describe('index.html: analítica', () => {
  const tracker = doc.querySelector(`script[src="${TRACKER}/tracker.js"]`);

  it('incluye el script de seguimiento con su configuración', () => {
    expect(tracker).not.toBeNull();
    expect(tracker!.getAttribute('data-app')).toBe('diferenciaitor');
    expect(tracker!.getAttribute('data-key')).toBe('ak_a2b3b125b08046038ab09dda55271f5e');
    expect(tracker!.hasAttribute('async')).toBe(true);
  });
});

describe('vercel.json: CSP', () => {
  const csp = vercel.headers[0]!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
  const dir = (name: string) => csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' '))!;

  it('permite el tracker en script-src, connect-src e img-src', () => {
    for (const d of ['script-src', 'connect-src', 'img-src']) expect(dir(d)).toContain(TRACKER);
  });

  it('no abre nada más: ningún otro origen externo ni comodines', () => {
    const origins = csp.match(/https?:\/\/[^\s;]+/g) ?? [];
    expect(new Set(origins)).toEqual(new Set([TRACKER]));
    expect(csp).not.toMatch(/\*/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(dir('script-src')).not.toContain("'unsafe-inline'");
  });
});

describe('favicon e iconos', () => {
  it.each([
    ['public/favicon-16.png', 16],
    ['public/favicon-32.png', 32],
    ['public/apple-touch-icon.png', 180],
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['public/icon-maskable-512.png', 512],
  ])('%s es un PNG de %ipx', (file, size) => {
    const png = readFileSync(resolve(root, file));
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });

  it('existen favicon.ico (con 16, 32 y 48 px) y favicon.svg', () => {
    const ico = readFileSync(resolve(root, 'public/favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1); // tipo icono
    const n = ico.readUInt16LE(4);
    const sizes = Array.from({ length: n }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
    expect(existsSync(resolve(root, 'public/favicon.svg'))).toBe(true);
  });

  it('index.html enlaza todos los iconos, y todos existen', () => {
    const hrefs = [...doc.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map(
      (l) => l.getAttribute('href')!,
    );
    expect(hrefs).toEqual(
      expect.arrayContaining(['/favicon.ico', '/favicon.svg', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png', '/manifest.webmanifest']),
    );
    for (const h of hrefs) expect(existsSync(resolve(root, 'public', h.slice(1)))).toBe(true);
  });

  it('el manifest referencia iconos que existen', () => {
    const m = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as {
      icons: { src: string; purpose?: string }[];
    };
    for (const i of m.icons) expect(existsSync(resolve(root, 'public', i.src.slice(1)))).toBe(true);
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('robots.txt y sitemap.xml apuntan a la URL de producción', () => {
    expect(readFileSync(resolve(root, 'public/robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8')).toContain(`<loc>${SITE}</loc>`);
  });
});

describe('metadatos por página (seo/meta.ts)', () => {
  const ids = Object.keys(PAGE_META) as PageId[];

  it('títulos y descripciones caben en los límites de los buscadores, en ES y EN', () => {
    for (const id of ids) {
      for (const lang of ['es', 'en'] as const) {
        expect(PAGE_META[id].title[lang].length, `${id} title ${lang}`).toBeLessThanOrEqual(65);
        expect(PAGE_META[id].description[lang].length, `${id} desc ${lang}`).toBeLessThanOrEqual(160);
        expect(PAGE_META[id].description[lang].length, `${id} desc ${lang}`).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it('cada página tiene título y descripción únicos (sin contenido duplicado)', () => {
    for (const lang of ['es', 'en'] as const) {
      expect(new Set(ids.map((i) => PAGE_META[i].title[lang])).size).toBe(ids.length);
      expect(new Set(ids.map((i) => PAGE_META[i].description[lang])).size).toBe(ids.length);
    }
  });

  it('la portada incluye las palabras clave principales', () => {
    const t = PAGE_META.home.title.es.toLowerCase();
    for (const k of ['comparar', 'textos', 'archivos', 'carpetas', 'online']) expect(t).toContain(k);
  });

  it('las herramientas comparten portada; about y privacy tienen la suya', () => {
    expect(['text', 'files', 'folders'].map(pageIdForMode)).toEqual(['home', 'home', 'home']);
    expect(pageIdForMode('about')).toBe('about');
    expect(pageIdForMode('privacy')).toBe('privacy');
  });
});

describe('index.html coincide con seo/meta.ts (no hay parpadeo de título al arrancar React)', () => {
  it('título y descripción de la portada', () => {
    expect(doc.title).toBe(PAGE_META.home.title.es);
    expect(meta('meta[name="description"]')).toBe(PAGE_META.home.description.es);
    expect(meta('meta[property="og:title"]')).toBe(PAGE_META.home.title.es);
    expect(meta('meta[property="og:description"]')).toBe(PAGE_META.home.description.es);
    expect(meta('meta[name="twitter:title"]')).toBe(PAGE_META.home.title.es);
    expect(meta('meta[name="twitter:description"]')).toBe(PAGE_META.home.description.es);
  });
});

describe('contenido estático de la portada (rastreadores sin JavaScript)', () => {
  const root = doc.getElementById('root')!;

  it('hay contenido real dentro de #root, con marcadores para el build', () => {
    expect(html).toContain('<!--static-->');
    expect(html).toContain('<!--/static-->');
    expect(root.textContent!.trim().length).toBeGreaterThan(300);
  });

  it('tiene un único h1 idéntico al de la app', () => {
    const h1s = root.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]!.textContent).toBe(es['home.h1']);
  });

  it('enlaza (con enlaces rastreables) a las páginas secundarias', () => {
    const hrefs = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/acerca-de', '/privacidad']));
  });

  it('menciona las tres herramientas', () => {
    const text = root.textContent!.toLowerCase();
    for (const k of ['comparar textos', 'comparar archivos', 'comparar carpetas', '.patch']) expect(text).toContain(k);
  });
});

describe('páginas estáticas generadas en el build (renderPage)', () => {
  const secondary = ['about', 'privacy'] as const;

  it.each(secondary)('%s: título, descripción, canonical y Open Graph propios', (id) => {
    const d = new DOMParser().parseFromString(renderPage(html, id), 'text/html');
    const url = pageUrl(id);
    expect(d.title).toBe(PAGE_META[id].title.es);
    expect(d.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(PAGE_META[id].description.es);
    expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(url);
    expect(d.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(url);
    expect(d.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(PAGE_META[id].title.es);
    expect(d.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(PAGE_META[id].title.es);
  });

  it.each(secondary)('%s: conserva la imagen social, la verificación de Google y el tracker', (id) => {
    const out = renderPage(html, id);
    expect(out).toContain('google-site-verification');
    expect(out).toContain(`${SITE}og-image.png`);
    expect(out).toContain(`${TRACKER}/tracker.js`);
    expect(out).toContain('data-app="diferenciaitor"');
  });

  it.each(secondary)('%s: un único h1 y sin restos de la portada', (id) => {
    const d = new DOMParser().parseFromString(renderPage(html, id), 'text/html');
    const h1 = d.querySelectorAll('#root h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]!.textContent).not.toBe(es['home.h1']);
  });

  it('about: reutiliza los textos de la app (fuente única) y enlaza a las demás páginas', () => {
    const d = new DOMParser().parseFromString(renderPage(html, 'about'), 'text/html');
    expect(d.querySelector('#root h1')!.textContent).toBe(es['about.title']);
    const h2 = [...d.querySelectorAll('#root h2')].map((e) => e.textContent);
    expect(h2).toEqual([es['about.p1Title'], es['about.p2Title'], es['about.p3Title'], es['about.modesTitle']]);
    const hrefs = [...d.querySelectorAll('#root a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/privacidad']);
  });

  it('privacy: lista las 11 secciones de la política', () => {
    const d = new DOMParser().parseFromString(renderPage(html, 'privacy'), 'text/html');
    const items = [...d.querySelectorAll('#root li')].map((e) => e.textContent);
    expect(items).toEqual([...PRIVACY_TITLES]);
    expect(items).toHaveLength(11);
  });

  it.each(secondary)('%s: JSON-LD válido con la página y sus migas de pan', (id) => {
    const d = new DOMParser().parseFromString(renderPage(html, id), 'text/html');
    const ld = JSON.parse(d.querySelector('script[type="application/ld+json"]')!.textContent!);
    const graph = ld['@graph'] as { '@type': string; '@id'?: string; url?: string; itemListElement?: { position: number; item: string }[]; breadcrumb?: { '@id': string }; isPartOf?: { '@id': string } }[];
    const page = graph.find((n) => n['@type'] === (id === 'about' ? 'AboutPage' : 'WebPage'))!;
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList')!;
    expect(page.url).toBe(pageUrl(id));
    expect(page.isPartOf?.['@id']).toBe(`${SITE}#website`);
    expect(page.breadcrumb?.['@id']).toBe(crumbs['@id']);
    expect(crumbs.itemListElement!.map((i) => [i.position, i.item])).toEqual([[1, SITE], [2, pageUrl(id)]]);
    // Se conserva el grafo original (sitio, aplicación y autor).
    expect(graph.map((n) => n['@type'])).toEqual(expect.arrayContaining(['WebSite', 'WebApplication', 'Person']));
  });

  it('falla de forma ruidosa si la plantilla no tiene los marcadores o las etiquetas esperadas', () => {
    expect(() => renderPage(html.replace('<!--static-->', ''), 'about')).toThrow(/marcadores/);
    expect(() => renderPage(html.replace(/<link rel="canonical"[^>]*>/, ''), 'about')).toThrow(/canonical/);
    expect(() => renderPage(html.replace(/<meta\s+name="description"[\s\S]*?\/>/, ''), 'about')).toThrow(/description/);
  });
});

describe('sitemap, URLs limpias y service worker', () => {
  const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('el sitemap lista exactamente las páginas con URL propia', () => {
    expect(locs).toEqual((Object.keys(PAGE_META) as PageId[]).map(pageUrl));
  });

  it('todas las URLs del sitemap son absolutas, sin hash y sin barra final (salvo la raíz)', () => {
    for (const l of locs) {
      expect(l).toMatch(/^https:\/\/diferenciaitor\.vercel\.app\//);
      expect(l).not.toContain('#');
      if (l !== SITE) expect(l.endsWith('/')).toBe(false);
    }
  });

  it('vercel.json sirve las páginas sin .html y sin barra final', () => {
    const cfg = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as { cleanUrls?: boolean; trailingSlash?: boolean };
    expect(cfg.cleanUrls).toBe(true);
    expect(cfg.trailingSlash).toBe(false);
  });

  it('el service worker precachea las páginas y cachea cada navegación por su URL', () => {
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    for (const p of ['/', '/acerca-de', '/privacidad']) expect(sw).toContain(`'${p}'`);
    expect(sw).toContain('c.put(req, copy)'); // y no bajo la clave "/"
    expect(sw).not.toContain("c.put('/', copy)");
    expect(sw).toContain('Promise.allSettled'); // una ruta que falle no rompe la instalación
  });
});

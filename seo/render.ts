import { PRIVACY_TITLES, PRIVACY_UPDATED } from '../src/content/privacy';
import { es } from '../src/i18n/messages';
import { PAGE_META, SITE, pageUrl, type PageId } from './meta';

/** Genera el HTML estático de las páginas secundarias a partir de la portada ya compilada. */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nav = (links: [string, string][]) =>
  `<nav aria-label="Enlaces">${links.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ')}</nav>`;

const STATIC_BODY: Record<Exclude<PageId, 'home'>, string> = {
  about: `<main class="ssr">
<h1>${esc(es['about.title'])}</h1>
<p>${esc(es['about.lead'])}</p>
<h2>${esc(es['about.p1Title'])}</h2><p>${esc(es['about.p1Body'])}</p>
<h2>${esc(es['about.p2Title'])}</h2><p>${esc(es['about.p2Body'])}</p>
<h2>${esc(es['about.p3Title'])}</h2><p>${esc(es['about.p3Body'])}</p>
<h2>${esc(es['about.modesTitle'])}</h2>
<ul>
<li><strong>${esc(es['about.m1Title'])}</strong> ${esc(es['about.m1Body'])}</li>
<li><strong>${esc(es['about.m2Title'])}</strong> ${esc(es['about.m2Body'])}</li>
<li><strong>${esc(es['about.m3Title'])}</strong> ${esc(es['about.m3Body'])}</li>
</ul>
${nav([['/', 'Comparar textos, archivos y carpetas'], ['/privacidad', es['footer.privacyLink']]])}
</main>`,
  privacy: `<main class="ssr">
<h1>${esc(es['privacy.title'])}</h1>
<p><strong>Última actualización:</strong> ${PRIVACY_UPDATED}</p>
<p>El responsable del tratamiento es Aitor Sánchez Gutiérrez.</p>
<ol>
${PRIVACY_TITLES.map((t) => `<li>${esc(t)}</li>`).join('\n')}
</ol>
${nav([['/', 'Comparar textos, archivos y carpetas'], ['/acerca-de', es['footer.about']]])}
</main>`,
};

function setMeta(html: string, attr: 'name' | 'property', name: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`Falta <meta ${attr}="${name}"> en la plantilla`);
  return html.replace(re, (_m, a: string, b: string) => `${a}${esc(value)}${b}`);
}

function addJsonLd(html: string, id: Exclude<PageId, 'home'>, url: string): string {
  const re = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const m = re.exec(html);
  if (!m) throw new Error('Falta el bloque JSON-LD en la plantilla');
  const ld = JSON.parse(m[2]!) as { '@graph': unknown[] };
  const meta = PAGE_META[id];
  ld['@graph'].push(
    {
      '@type': id === 'about' ? 'AboutPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: meta.title.es,
      description: meta.description.es,
      inLanguage: 'es',
      isPartOf: { '@id': `${SITE}/#website` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      ...(id === 'about' ? { about: { '@id': `${SITE}/#app` } } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: id === 'about' ? es['footer.about'] : es['footer.privacyLink'], item: url },
      ],
    },
  );
  return html.replace(re, (_m, a: string, _body: string, c: string) => `${a}\n${JSON.stringify(ld, null, 2)}\n    ${c}`);
}

/** Devuelve el HTML de una página secundaria a partir del `index.html` compilado. */
export function renderPage(template: string, id: Exclude<PageId, 'home'>): string {
  const meta = PAGE_META[id];
  const url = pageUrl(id);
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(meta.title.es)}</title>`);
  html = setMeta(html, 'name', 'description', meta.description.es);
  html = setMeta(html, 'property', 'og:title', meta.title.es);
  html = setMeta(html, 'property', 'og:description', meta.description.es);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'name', 'twitter:title', meta.title.es);
  html = setMeta(html, 'name', 'twitter:description', meta.description.es);

  const canonical = /(<link rel="canonical" href=")[^"]*(")/;
  if (!canonical.test(html)) throw new Error('Falta <link rel="canonical"> en la plantilla');
  html = html.replace(canonical, (_m, a: string, b: string) => `${a}${url}${b}`);

  const marker = /<!--static-->[\s\S]*?<!--\/static-->/;
  if (!marker.test(html)) throw new Error('Faltan los marcadores <!--static--> en la plantilla');
  html = html.replace(marker, () => `<!--static-->\n${STATIC_BODY[id]}\n<!--/static-->`);

  return addJsonLd(html, id, url);
}

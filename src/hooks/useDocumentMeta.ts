import { useEffect } from 'react';
import { PAGE_META, pageIdForMode, pageUrl } from '../../seo/meta';
import type { Lang } from '../i18n';
import type { DiffMode } from '../types';

function setAttr(selector: string, attr: string, value: string) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

/**
 * Mantiene título, descripción, canonical y Open Graph acordes a la página mostrada
 * al navegar sin recargar. (Cada URL ya sale con sus metadatos correctos en el HTML estático.)
 */
export function useDocumentMeta(mode: DiffMode, lang: Lang) {
  useEffect(() => {
    const id = pageIdForMode(mode);
    const meta = PAGE_META[id];
    const title = meta.title[lang];
    const description = meta.description[lang];
    const url = pageUrl(id);

    document.title = title;
    setAttr('meta[name="description"]', 'content', description);
    setAttr('meta[property="og:title"]', 'content', title);
    setAttr('meta[property="og:description"]', 'content', description);
    setAttr('meta[property="og:url"]', 'content', url);
    setAttr('meta[name="twitter:title"]', 'content', title);
    setAttr('meta[name="twitter:description"]', 'content', description);
    setAttr('link[rel="canonical"]', 'href', url);
  }, [mode, lang]);
}

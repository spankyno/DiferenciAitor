/**
 * Metadatos SEO de cada página. Fuente única: la usan la app (título/descripción en
 * cambios de ruta), el generador de HTML estático (build) y los tests.
 * Los textos en español son los que ven los buscadores en el HTML inicial.
 */
export const SITE = 'https://diferenciaitor.vercel.app';

export type PageId = 'home' | 'about' | 'privacy';
type Lang = 'es' | 'en';

export interface PageMeta {
  id: PageId;
  /** Ruta pública. */
  path: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
}

export const PAGE_META: Record<PageId, PageMeta> = {
  home: {
    id: 'home',
    path: '/',
    title: {
      es: 'Comparar textos, archivos y carpetas online | DiferenciAItor',
      en: 'Compare texts, files and folders online | DiferenciAItor',
    },
    description: {
      es: 'Compara textos, archivos y carpetas online y gratis. Resalta las diferencias línea a línea, detecta renombrados y exporta .patch. Sin subir nada.',
      en: 'Compare texts, files and folders online for free. Highlights line-by-line differences, detects renamed files and exports .patch. Nothing is uploaded.',
    },
  },
  about: {
    id: 'about',
    path: '/acerca-de',
    title: {
      es: 'Acerca de DiferenciAItor | Comparador de textos y carpetas',
      en: 'About DiferenciAItor | Text, file and folder comparison',
    },
    description: {
      es: 'Qué es DiferenciAItor y cómo funciona: un comparador online gratuito de textos, archivos y carpetas que trabaja en tu navegador, sin registro.',
      en: 'What DiferenciAItor is and how it works: a free online tool to compare texts, files and folders in your browser, with no sign-up.',
    },
  },
  privacy: {
    id: 'privacy',
    path: '/privacidad',
    title: {
      es: 'Política de privacidad | DiferenciAItor',
      en: 'Privacy policy | DiferenciAItor',
    },
    description: {
      es: 'Política de privacidad de DiferenciAItor: qué datos de visita se recogen, para qué, cuánto tiempo se conservan y cómo ejercer tus derechos.',
      en: 'DiferenciAItor privacy policy: which visit data is collected, why, how long it is kept and how to exercise your rights.',
    },
  },
};

export const pageUrl = (id: PageId): string => (id === 'home' ? `${SITE}/` : `${SITE}${PAGE_META[id].path}`);

/** Las tres herramientas comparten la portada; "Acerca de" y "Privacidad" tienen página propia. */
export const pageIdForMode = (mode: string): PageId =>
  mode === 'about' ? 'about' : mode === 'privacy' ? 'privacy' : 'home';

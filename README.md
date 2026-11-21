# DiferenciAItor

Comparador de **textos, archivos y carpetas** que funciona 100 % en el navegador: nada se sube a ningún servidor.

## Características

- **Texto**: vista lado a lado o unificada, resaltado dentro de la línea, plegado de bloques sin cambios, navegación entre cambios (`n` / `p`), búsqueda, copiar como Markdown y exportar `.patch` estándar (aplicable con `git apply`).
- **Archivos**: arrastrar y soltar, huella SHA-256, detección de binarios (incl. UTF-16), y aviso cuando los archivos solo difieren en saltos de línea.
- **Carpetas**: exclusiones configurables (estilo `.gitignore`), detección de archivos **renombrados/movidos**, estado **equivalente** (iguales según las opciones), progreso con cancelación, filtros, y exportación del informe a **CSV / JSON / HTML**.
- **Opciones**: ignorar espacios, mayúsculas, líneas vacías, y normalizar JSON (claves ordenadas). Se aplican a la comparación *y* al resaltado interno.
- **Rendimiento**: el diff se calcula en un **Web Worker** (cancelable); las listas largas se **virtualizan**. 30.000 líneas se comparan en ~0,2 s.
- **Extras**: pie con enlaces, página de privacidad, ES/EN, modo claro/oscuro (sigue al sistema), PWA con uso sin conexión, accesibilidad por teclado y lector de pantalla.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 105 tests (motor, utilidades, componentes y SEO/CSP)
npm run lint       # ESLint + tsc (modo estricto)
npm run build      # genera dist/
```

Requiere Node `^20.19` o `>=22.12` (ver `.nvmrc`).

## Despliegue en Vercel (plan gratuito)

Es un sitio estático: no necesita servidor, variables de entorno ni funciones.

1. Sube el repositorio a GitHub y créalo como proyecto en Vercel.
2. Vercel detecta Vite automáticamente (`vercel.json` ya fija `npm run build` y `dist`).
3. Despliega. No hay nada más que configurar.

`vercel.json` añade una **Content-Security-Policy** que solo permite conexiones al propio sitio y al panel de analítica (`aitors-hub-dashboard.asanchezgu.workers.dev`, en `script-src`, `connect-src` e `img-src`). Cualquier otro origen queda bloqueado, de modo que se puede comprobar desde las herramientas de desarrollo que los textos y archivos comparados no salen del navegador.

### Analítica, privacidad y SEO

- **Analítica**: el script de seguimiento está en `index.html`. Si cambias de panel, actualiza también el origen en la CSP de `vercel.json` (hay un test que lo vigila).
- **Política de privacidad**: `src/components/PrivacyView.tsx`, accesible en `/#privacy`. Es el texto legal en español; si cambia, actualiza también la fecha.
- **SEO**: `index.html` incluye canonical, Open Graph, Twitter Card, JSON-LD (WebSite, WebApplication y Person), verificación de Google Search Console, `robots.txt` y `sitemap.xml`.
- **Iconos**: se generan con la misma geometría que el logo (`src/components/Logo.tsx`): `favicon.ico` (16/32/48), `favicon.svg`, PNG, `apple-touch-icon` e iconos de la PWA (incl. *maskable*).
- **`og-image.png` es en realidad un JPEG** (1248×832, ~200 KB). Se mantiene el nombre, pero `og:image:type` declara `image/jpeg` y `vercel.json` fuerza ese `Content-Type`. Si quieres un PNG real o renombrarla a `.jpg`, actualiza `index.html`, `AboutView.tsx` y `vercel.json`.

## Estructura

```
src/
  utils/diffEngine.ts   Motor: normalización, patience + Myers, alineación por similitud
  utils/folder*.ts      Escaneo (concurrente, con cancelación), comparación y renombrados
  utils/report.ts       Informes CSV/JSON/HTML (con protección frente a CSV injection)
  workers/              Web Worker del diff
  hooks/useDiff.ts      Worker + cancelación + respaldo en hilo principal
  components/           DiffViewer compartido por los tres módulos
  i18n/                 Diccionarios ES/EN (tipados: el compilador exige las mismas claves)
```

## Notas de diseño

- **Saltos de línea** (CRLF/LF/CR), BOM y salto final se normalizan siempre: no cuentan como diferencia.
- **Ignorar espacios** elimina *todo* el espacio en blanco (equivale a `git diff -w`).
- El **patch exportado** es siempre exacto (no aplica las opciones de ignorar), para que se pueda aplicar.
- Límites: hash hasta 128 MB por archivo; diff de líneas hasta 5 MB por archivo. Por encima, se compara por tamaño/fecha o solo por hash.
- El contenido de los textos **no se guarda** en el navegador (solo preferencias), por privacidad.

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { PAGE_META } from './seo/meta';
import { renderPage } from './seo/render';

/** Tras compilar, genera dist/acerca-de.html y dist/privacidad.html con su propio título, metadatos y contenido. */
function prerenderPages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'prerender-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      for (const id of ['about', 'privacy'] as const) {
        const file = `${PAGE_META[id].path.slice(1)}.html`;
        fs.writeFileSync(path.join(outDir, file), renderPage(template, id));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderPages()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
  },
});

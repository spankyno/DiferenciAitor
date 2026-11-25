import path from 'path';
import { defineConfig } from 'vitest/config';

// Configuración de tests aparte: no necesita los plugins de Vite (React/Tailwind).
// El JSX (runtime automático) se toma de `jsx: react-jsx` en tsconfig.json; no hace falta configurar `esbuild`
// (Vite 8 usa Oxc) y esa opción dependía de que esbuild estuviera instalado.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

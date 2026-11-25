import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');
const json = <T>(f: string) => JSON.parse(read(f)) as T;

/**
 * Regresión: `npm run build` falló en Vercel con
 *   vitest.config.ts: 'jsx' does not exist in type 'ESBuildOptions'
 * porque ese tipo depende de que `esbuild` (dependencia opcional de Vite) esté instalado, y la
 * instalación de Vercel no lo incluía. Un tipo de una herramienta de tests no debe poder tumbar un despliegue.
 */
describe('el build de despliegue no depende de las herramientas de test', () => {
  const app = json<{ include: string[] }>('tsconfig.json');
  const node = json<{ include: string[]; extends: string }>('tsconfig.node.json');
  const scripts = json<{ scripts: Record<string, string> }>('package.json').scripts;

  it('tsconfig.json (el que usa `npm run build`) no incluye las configuraciones de herramientas', () => {
    expect(app.include.join(' ')).not.toMatch(/vite\.config|vitest\.config/);
  });

  it('las configuraciones de herramientas se comprueban aparte (tsconfig.node.json)', () => {
    expect(node.extends).toBe('./tsconfig.json');
    expect(node.include).toEqual(['vite.config.ts', 'vitest.config.ts']);
  });

  it('`build` solo comprueba la app; `lint` comprueba además las configuraciones', () => {
    expect(scripts.build).toBe('tsc --noEmit && vite build');
    expect(scripts.lint).toContain('tsc --noEmit -p tsconfig.node.json');
  });

  it('vitest.config.ts no usa la opción `esbuild` (Vite 8 usa Oxc y el tipo depende de esbuild)', () => {
    expect(read('vitest.config.ts')).not.toMatch(/^\s*esbuild\s*:/m);
  });

  it('el JSX automático se declara en tsconfig.json', () => {
    expect(json<{ compilerOptions: { jsx: string } }>('tsconfig.json').compilerOptions.jsx).toBe('react-jsx');
  });

  it('no queda un bun.lock que haga que Vercel use Bun con un lockfile obsoleto', () => {
    expect(() => readFileSync(resolve(root, 'bun.lock'))).toThrow();
    expect(() => readFileSync(resolve(root, 'bun.lockb'))).toThrow();
  });
});

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// La app detecta el idioma del navegador; los tests parten del español.
Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });

// jsdom no implementa estas APIs de layout.
Element.prototype.scrollIntoView = () => undefined;
window.scrollTo = () => undefined;

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
});

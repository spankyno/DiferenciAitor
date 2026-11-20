/** Archivos mayores que esto no se hashean (se leerían enteros en memoria). */
export const MAX_HASH_BYTES = 128 * 1024 * 1024;
/** Archivos mayores que esto no se comparan como texto línea a línea. */
export const MAX_TEXT_DIFF_BYTES = 5 * 1024 * 1024;

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 con Web Crypto. Lanza si la API no está disponible (contexto no seguro). */
export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto no disponible (requiere HTTPS o localhost)');
  const input: BufferSource = data instanceof Uint8Array ? (data as Uint8Array<ArrayBuffer>) : data;
  return toHex(await subtle.digest('SHA-256', input));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDate(timestamp: number, locale = 'es-ES'): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

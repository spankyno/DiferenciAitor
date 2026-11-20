/** Lee un Blob/File como ArrayBuffer. Usa FileReader si `arrayBuffer()` no existe (Safari antiguo, jsdom). */
export function readBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Error de lectura'));
    reader.readAsArrayBuffer(blob);
  });
}

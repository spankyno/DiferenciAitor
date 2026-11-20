/// <reference types="vite/client" />

interface Window {
  /** File System Access API (Chromium). */
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

import { computeDiff } from '../utils/diffEngine';
import type { DiffOptions, DiffResult } from '../types';

export interface DiffRequest {
  id: number;
  textA: string;
  textB: string;
  options: DiffOptions;
}

export type DiffResponse =
  | { id: number; result: DiffResult }
  | { id: number; error: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<DiffRequest>) => void) | null;
  postMessage: (message: DiffResponse) => void;
};

ctx.onmessage = (e) => {
  const { id, textA, textB, options } = e.data;
  try {
    ctx.postMessage({ id, result: computeDiff(textA, textB, options) });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

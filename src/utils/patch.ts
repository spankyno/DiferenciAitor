import * as Diff from 'diff';

/** Diff unificado estándar (aplicable con `git apply` / `patch`). Siempre exacto, sin opciones de ignorar. */
export function createUnifiedPatch(
  nameA: string,
  nameB: string,
  textA: string,
  textB: string,
): string {
  return Diff.createTwoFilesPatch(nameA, nameB, textA, textB, '', '', { context: 3 });
}

export function patchToMarkdown(patch: string): string {
  return '```diff\n' + patch.replace(/\n$/, '') + '\n```\n';
}

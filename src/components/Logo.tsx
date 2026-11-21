/** Marca de DiferenciAItor: dos paneles, "eliminado" en rojo y "añadido" en verde. Misma geometría que favicon.svg. */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill="#6366f1" />
      <rect x="2.5" y="2.5" width="59" height="59" rx="11.5" fill="#0f172a" />
      <rect x="8" y="12" width="22" height="40" rx="4" fill="#4a1d26" />
      <rect x="34" y="12" width="22" height="40" rx="4" fill="#0f3b33" />
      <rect x="12" y="18" width="14" height="6" rx="2" fill="#94a3b8" />
      <rect x="12" y="29" width="14" height="6" rx="2" fill="#f87171" />
      <rect x="12" y="40" width="10" height="6" rx="2" fill="#94a3b8" />
      <rect x="38" y="18" width="14" height="6" rx="2" fill="#94a3b8" />
      <rect x="38" y="29" width="14" height="6" rx="2" fill="#34d399" />
      <rect x="38" y="40" width="10" height="6" rx="2" fill="#94a3b8" />
      <rect x="31" y="10" width="2" height="44" rx="1" fill="#6366f1" />
    </svg>
  );
}

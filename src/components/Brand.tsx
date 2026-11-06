export function Brand() {
  return (
    <span className="brand">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="var(--ink)" />
        <path d="M16 5v13" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 18 11 27h10Z" fill="var(--accent)" />
      </svg>
      <span className="brand-name">Plumbline</span>
    </span>
  );
}

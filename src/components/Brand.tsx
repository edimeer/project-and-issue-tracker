export function Brand() {
  return (
    <span className="brand">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect className="logo-bg" width="32" height="32" rx="4" />
        <path className="logo-thread" d="M16 5v13" strokeWidth="2.4" strokeLinecap="round" />
        <circle className="logo-bob" cx="16" cy="23" r="5" />
      </svg>
      <span className="brand-name">Plumbline</span>
    </span>
  );
}

const strokes: Record<string, React.ReactNode> = {
  "": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  stock: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9m-4.5-16 9 4.5" />
    </>
  ),
  offers: (
    <>
      <path d="M3 7h16m-4-4 4 4-4 4m6 6H5m4-4-4 4 4 4" />
    </>
  ),
  orders: (
    <>
      <path d="M8 4H5v17h14V4h-3m-8 9h8m-8 4h6" />
      <rect x="8" y="2" width="8" height="5" rx="1" />
    </>
  ),
  prices: (
    <>
      <path d="M3 3v17h18M7 14l4-4 4 2 5-6" />
      <path d="M16 6h4v4" />
    </>
  ),
  alerts: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-9 12a3 3 0 0 0 6 0" />
    </>
  ),
  agents: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  demand: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  supply: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  operations: (
    <>
      <path d="m12 2 8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  imports: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4m-12 4v6h16v-6" />
    </>
  ),
  voice: (
    <>
      <path d="M5 4h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c-9 2-18-7-16-16Z" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

export function WorkspaceIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {strokes[name] ?? strokes.arrow}
    </svg>
  );
}

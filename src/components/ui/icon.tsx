/** Icon SVG nội bộ (stroke=currentColor, 1.5px) — thay ký tự unicode rời rạc. */

const PATHS: Record<string, React.ReactNode> = {
  check: <path d="M4 12.5l5 5L20 6.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 3.5L22 20H2L12 3.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.5v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l2-2.5h6l2 2.5h3v10H4v-10z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-up": <path d="M6 15l6-6 6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "panel-left": (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7L12 3.5z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </>
  ),
  "help-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 114 2c-.8.7-1.6 1.1-1.6 2.3" />
      <path d="M12 17v.01" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-7 4 14 2.5-7h5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c1-2.9 3.1-4.3 5.5-4.3s4.5 1.4 5.5 4.3" />
      <path d="M15.5 5.7a3.2 3.2 0 010 5.6M17.5 15.5c1.4.7 2.5 2 3 4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4H6v16h8" />
      <path d="M10 12h11M18 8.5L21.5 12 18 15.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4.5" y="6" width="15" height="14" rx="2" />
      <path d="M4.5 10h15M8.5 3.5V7M15.5 3.5V7" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h8L19 8.5V20.5H6V3.5z" />
      <path d="M13.5 3.5v5.5H19" />
    </>
  ),
  shield: <path d="M12 3.5l7.5 3v6c0 4.5-3.2 7.2-7.5 8-4.3-.8-7.5-3.5-7.5-8v-6l7.5-3z" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 10-2.3 5.6" />
      <path d="M20 12V6.5M20 12h-5.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13l2.5-7.5h11L20 13v6.5H4V13z" />
      <path d="M4 13h5l1.5 2h3L15 13h5" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 3.5L17 11.5H6" />
    </>
  ),
  filter: (
    <>
      <path d="M3 3h18" />
      <path d="M7 9h10" />
      <path d="M11 15h6" />
      <path d="M3 3v18" />
    </>
  ),
  "scan-face": (
    <>
      <path d="M4 8V6a2 2 0 012-2h2" />
      <path d="M16 4h2a2 2 0 012 2v2" />
      <path d="M20 16v2a2 2 0 01-2 2h-2" />
      <path d="M8 20H6a2 2 0 01-2-2v-2" />
      <circle cx="12" cy="10.5" r="2.1" />
      <path d="M8.6 16c.8-1.7 2-2.5 3.4-2.5s2.6.8 3.4 2.5" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.88.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.88l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.88-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9c.14.6.66 1.03 1.56 1.03H21a2 2 0 110 4h-.09c-.9 0-1.42.43-1.51 1.03z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M10 20a2.2 2.2 0 004 0" />
    </>
  ),
  "clipboard-check": (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 11.5l2.5 2.5 4.5-4.5" />
    </>
  ),
  "file-text": (
    <>
      <path d="M6 3.5h8L19 8.5V20.5H6V3.5z" />
      <path d="M13.5 3.5v5.5H19" />
      <path d="M9 12h6M9 15.5h6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M4 12h15" />
      <path d="M14 7l5 5-5 5" />
    </>
  ),
  "arrow-up": (
    <>
      <path d="M12 20V5" />
      <path d="M7 10l5-5 5 5" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 4v15" />
      <path d="M7 14l5 5 5-5" />
    </>
  ),
  "more-horizontal": (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  "user-check": (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20c1-3.1 3.2-4.6 6-4.6 1 0 1.9.2 2.7.6" />
      <path d="M15 16.5l2 2 4-4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 4l3 3M14 6l3 3" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a2 2 0 012-2h7a2 2 0 012 2v16" />
      <path d="M15 9h3a2 2 0 012 2v10" />
      <path d="M2 21h20" />
      <path d="M8 7h3M8 11h3M8 15h3" />
    </>
  ),
  "id-card": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2" />
      <path d="M14.5 10h4M14.5 13.5h4" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

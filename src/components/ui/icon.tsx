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
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
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

import type { ComponentChildren } from "preact";

type P = { size?: number };

const Svg = ({ size = 24, children }: P & { children: ComponentChildren }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    {children}
  </svg>
);

export const IconHome = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconTasks = (p: P) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></Svg>;
export const IconCourses = (p: P) => <Svg {...p}><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconLogo = (p: P) => (
  <svg viewBox="0 0 2000 2000" width={p.size ?? 32} height={p.size ?? 32} aria-hidden="true" fill="currentColor">
    <g transform="translate(329.5, 1292.0) scale(1.1868, -1.1868)">
      <path d="M1085 -170Q1007 -209 919 -209Q841 -209 777 -185Q639 -134 542 14Q517 50 449.0 152.0Q381 254 361 282Q326 337 305 342V352Q306 352 307.5 352.0Q309 352 311.0 352.0Q313 352 315.0 352.0Q317 352 320.0 352.0Q323 352 325 352Q376 352 419 375Q484 411 484 508Q484 579 444.0 617.5Q404 656 348 656H272V73Q272 47 291.0 28.5Q310 10 336 10H349V0H45V10H58Q83 10 102.0 28.0Q121 46 122 72V627Q121 653 102.5 671.5Q84 690 58 690H45V700H388Q517 700 588 641Q644 595 644.0 511.0Q644 427 589.5 374.5Q535 322 465 322Q459 322 452 323Q493 301 520.5 274.0Q548 247 568.5 223.0Q589 199 603.5 180.5Q618 162 642.0 131.5Q666 101 692.0 68.0Q718 35 749.5 0.5Q781 -34 819.5 -65.0Q858 -96 898 -116Q983 -159 1085 -160Z" />
    </g>
  </svg>
);
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconTrophy = (p: P) => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6" /></Svg>;
export const IconUser = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></Svg>;
export const IconCoffee = (p: P) => <Svg {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3" /></Svg>;

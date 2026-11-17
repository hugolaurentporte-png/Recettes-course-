import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Base>
);
export const FridgeIcon = (p: P) => (
  <Base {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M5 10h14M9 5v2M9 13v3" /></Base>
);
export const BookIcon = (p: P) => (
  <Base {...p}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" /></Base>
);
export const CartIcon = (p: P) => (
  <Base {...p}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11.5l2-8H6.2" /></Base>
);
export const CalendarIcon = (p: P) => (
  <Base {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Base>
);
export const PlusIcon = (p: P) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>;
export const CheckIcon = (p: P) => <Base {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>;
export const XIcon = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>;
export const SearchIcon = (p: P) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>;
export const BoltIcon = (p: P) => <Base {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Base>;
export const ClockIcon = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>;
export const BackIcon = (p: P) => <Base {...p}><path d="M15 18 9 12l6-6" /></Base>;
export const TrashIcon = (p: P) => (
  <Base {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Base>
);
export const MinusIcon = (p: P) => <Base {...p}><path d="M5 12h14" /></Base>;

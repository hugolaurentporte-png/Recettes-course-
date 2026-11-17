"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { BookIcon, CalendarIcon, CartIcon, FridgeIcon, HomeIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/frigo/", label: "Mon frigo", Icon: FridgeIcon },
  { href: "/planning/", label: "Planning", Icon: CalendarIcon },
  { href: "/recettes/", label: "Recettes", Icon: BookIcon },
  { href: "/courses/", label: "Courses", Icon: CartIcon },
] as const;

export function BottomNav() {
  const path = usePathname() ?? "/";
  const { shopping } = useStore();
  const toBuy = shopping.filter((i) => i.deletedAt === null && !i.checked).length;

  return (
    <nav aria-label="Navigation principale"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")) || (href === "/recettes/" && path.startsWith("/carnet"));
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? "text-brand-700" : "text-stone-500"}`}>
                <Icon width={26} height={26} strokeWidth={active ? 2.4 : 1.8} />
                {label}
                {href === "/courses/" && toBuy > 0 && (
                  <span className="absolute right-[16%] top-2 min-w-[20px] rounded-full bg-warm-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white"
                    aria-label={`${toBuy} articles à acheter`}>
                    {toBuy > 99 ? "99+" : toBuy}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

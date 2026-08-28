"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/shared/global-search";

const navigationItems = [
  { href: "/home", label: "Home" },
  { href: "/clients", label: "Clienti" },
  { href: "/sessions", label: "Sessioni" },
  { href: "/payments", label: "Pagamenti" },
  { href: "/vouchers", label: "Buoni" },
  { href: "/config", label: "Configurazione" },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="border-b border-[#d8d0c5] bg-[#fdfbf8]" aria-label="Navigazione principale">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-3 sm:px-8 lg:px-12">
          <Link className="mr-auto text-sm font-semibold tracking-[0.08em] text-[#9b5d43]" href="/home">
            GIULIA MALOSSO PHOTOGRAPHY
          </Link>
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`border-b-2 py-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#9b5d43] text-[#9b5d43]"
                    : "border-transparent text-[#675f57] hover:text-[#27231f]"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-b border-[#d8d0c5] bg-[#efe6dc]">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-8 lg:px-12">
          <GlobalSearch />
        </div>
      </div>
    </>
  );
}
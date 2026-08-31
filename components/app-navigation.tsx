"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, Camera, Plus, TicketPlus, UserRoundPlus } from "lucide-react";
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
  const router = useRouter();

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

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
          <button className="text-sm font-medium text-[#675f57] hover:text-[#27231f]" onClick={handleLogout} type="button">Esci</button>
        </div>
      </nav>
      <div className="border-b border-[#d8d0c5] bg-[#efe6dc]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-8 lg:px-12">
          {pathname === "/home" ? <h1 className="mr-3 text-2xl font-semibold">Dashboard</h1> : null}
          <div className="min-w-[16rem] flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <Link aria-label="Nuovo cliente" className="grid size-11 place-items-center bg-[#9b5d43] text-white transition-colors hover:bg-[#7f4934] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]" href="/clients?new=1" title="Nuovo cliente">
              <UserRoundPlus className="size-5" strokeWidth={1.8} />
            </Link>
            <Link aria-label="Nuova sessione" className="relative grid size-11 place-items-center bg-[#9b5d43] text-white transition-colors hover:bg-[#7f4934] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]" href="/sessions?new=1" title="Nuova sessione">
              <Camera className="size-5" strokeWidth={1.8} />
              <Plus className="absolute bottom-1 right-1 size-3 bg-[#9b5d43]" strokeWidth={2.5} />
            </Link>
            <Link aria-label="Registra pagamento" className="relative grid size-11 place-items-center bg-[#9b5d43] text-white transition-colors hover:bg-[#7f4934] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]" href="/payments?new=1" title="Registra pagamento">
              <Banknote className="size-5" strokeWidth={1.8} />
              <Plus className="absolute bottom-1 right-1 size-3 bg-[#9b5d43]" strokeWidth={2.5} />
            </Link>
            <Link aria-label="Nuovo buono regalo" className="grid size-11 place-items-center bg-[#9b5d43] text-white transition-colors hover:bg-[#7f4934] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]" href="/vouchers?new=1" title="Nuovo buono regalo">
              <TicketPlus className="size-5" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
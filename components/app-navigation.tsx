"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Banknote, Calendar, Camera, ChevronDown, Home, MoreHorizontal, Plus, TicketPlus, Users, UserRoundPlus, X } from "lucide-react";
import { GlobalSearch } from "@/components/shared/global-search";

const navigationItems = [
  { href: "/home", label: "Home" },
  { href: "/clients", label: "Clienti" },
  { href: "/sessions", label: "Sessioni" },
  { href: "/payments", label: "Pagamenti" },
  { href: "/vouchers", label: "Buoni" },
  { href: "/prenotazioni", label: "Prenotazioni" },
  { href: "/pacchetti", label: "Pacchetti" },
];

const settingsLinks = [
  { href: "/config", label: "Configurazione" },
  { href: "/mailerlite", label: "MailerLite" },
  { href: "/calendly", label: "Calendly" },
];

const mobileTabs = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/clients", label: "Clienti", icon: Users },
  { href: "/sessions", label: "Sessioni", icon: Calendar },
  { href: "/payments", label: "Pagamenti", icon: Banknote },
];

const moreLinks = [
  { href: "/vouchers", label: "Buoni regalo" },
  { href: "/prenotazioni", label: "Prenotazioni" },
  { href: "/pacchetti", label: "Pacchetti" },
  { href: "/config", label: "Configurazione" },
  { href: "/mailerlite", label: "MailerLite" },
  { href: "/calendly", label: "Calendly" },
];

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSettingsOpen) return;
    function handlePointer(event: MouseEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) setIsSettingsOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSettingsOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isSettingsOpen]);

  if (pathname === "/login" || pathname.startsWith("/prenota/")) return null;

  const isSettingsActive = settingsLinks.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="hidden border-b border-[#d8d0c5] bg-[#fdfbf8] sm:block" aria-label="Navigazione principale">
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
          <div className="relative" ref={settingsRef}>
            <button
              aria-expanded={isSettingsOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-1 border-b-2 py-1 text-sm font-medium transition-colors ${
                isSettingsActive ? "border-[#9b5d43] text-[#9b5d43]" : "border-transparent text-[#675f57] hover:text-[#27231f]"
              }`}
              onClick={() => setIsSettingsOpen((open) => !open)}
              type="button"
            >
              Impostazioni
              <ChevronDown className={`size-4 transition-transform ${isSettingsOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
            </button>
            {isSettingsOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-48 border border-[#d8d0c5] bg-[#fdfbf8] py-1 shadow-lg" role="menu">
                {settingsLinks.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`block px-4 py-2 text-sm ${isActive ? "font-semibold text-[#9b5d43]" : "text-[#27231f] hover:bg-[#f1e3db]"}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setIsSettingsOpen(false)}
                      role="menuitem"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
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

      <nav aria-label="Navigazione mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d8d0c5] bg-[#fdfbf8] pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-5">
          {mobileTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? "text-[#9b5d43]" : "text-[#675f57]"}`}
                href={tab.href}
                key={tab.href}
              >
                <Icon className="size-6" strokeWidth={1.8} />
                {tab.label}
              </Link>
            );
          })}
          <button
            aria-expanded={isMoreOpen}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isMoreOpen ? "text-[#9b5d43]" : "text-[#675f57]"}`}
            onClick={() => setIsMoreOpen(true)}
            type="button"
          >
            <MoreHorizontal className="size-6" strokeWidth={1.8} />
            Altro
          </button>
        </div>
      </nav>

      {isMoreOpen ? (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button aria-label="Chiudi" className="absolute inset-0 bg-[#27231f]/45" onClick={() => setIsMoreOpen(false)} type="button" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[#fdfbf8] pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#eee8df] px-5 py-4">
              <p className="text-sm font-semibold">Altro</p>
              <button aria-label="Chiudi" onClick={() => setIsMoreOpen(false)} type="button">
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>
            {moreLinks.map((link) => (
              <Link className="block border-b border-[#eee8df] px-5 py-4 text-sm font-medium" href={link.href} key={link.href} onClick={() => setIsMoreOpen(false)}>
                {link.label}
              </Link>
            ))}
            <button
              className="block w-full px-5 py-4 text-left text-sm font-medium text-[#a53e31]"
              onClick={() => { setIsMoreOpen(false); void handleLogout(); }}
              type="button"
            >
              Esci
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
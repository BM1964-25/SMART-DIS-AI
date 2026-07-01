"use client";

import {
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CheckSquare,
  FileSearch,
  FolderInput,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck
} from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const navigation = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Upload", href: "/upload", icon: FolderInput },
  { label: "Fristen", href: "/deadlines", icon: CalendarClock },
  { label: "Aufgaben", href: "/tasks", icon: CheckSquare },
  { label: "Suche", href: "/search", icon: FileSearch },
  { label: "Chat", href: "/chat", icon: MessageSquareText },
  { label: "Analyse", icon: BrainCircuit },
  { label: "Risiken", icon: ShieldCheck }
] as const;

const legalLinks = [
  { label: "Impressum", href: "https://www.built-smart-hub.com/impressum" },
  { label: "Datenschutz", href: "https://www.built-smart-hub.com/datenschutz" },
  { label: "AGB", href: "https://www.built-smart-hub.com/agb" },
  {
    label: "Widerrufbelehrung",
    href: "https://www.built-smart-hub.com/widerrufbelehrung"
  }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header className="bg-white/86 sticky top-0 z-30 border-b border-border backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/smart-document-intelligence.png"
              alt="SMART DIS-AI"
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded-lg object-contain"
            />
            <div>
              <p className="text-sm font-semibold leading-5 text-foreground">BuiltSmart AI</p>
              <p className="text-xs leading-4 text-muted-foreground">SMART DIS-AI</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Plattformbasis aktiv
          </div>
        </div>
      </header>

      <input
        id="sidebar-collapse-control"
        className="sidebar-toggle sr-only"
        type="checkbox"
        aria-label="Menü einklappen oder ausklappen"
      />

      <div className="app-shell-grid mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="lg:top-22 lg:sticky lg:h-[calc(100vh-6.5rem)]">
          <nav className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2 shadow-subtle">
            <label
              htmlFor="sidebar-collapse-control"
              className="sidebar-collapse-trigger inline-flex h-10 min-w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Menü einklappen oder ausklappen"
            >
              <PanelLeftClose
                className="sidebar-collapse-close h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <PanelLeftOpen
                className="sidebar-collapse-open hidden h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span className="sidebar-nav-label">Einklappen</span>
            </label>
            {navigation.map((item) => {
              const className = cn(
                "sidebar-nav-item inline-flex h-10 min-w-fit items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                "href" in item && pathname === item.href
                  ? "bg-foreground text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              );
              const navigationItem =
                "href" in item ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className={className}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="sidebar-nav-label">{item.label}</span>
                  </a>
                ) : (
                  <button
                    key={item.label}
                    className={cn(className, "cursor-not-allowed opacity-50 hover:bg-transparent")}
                    disabled
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="sidebar-nav-label">{item.label}</span>
                  </button>
                );

              return navigationItem;
            })}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 py-10 text-center sm:px-6 lg:flex-row lg:px-8 lg:text-left">
          <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-center">
            <Image
              src="/smart-document-intelligence.png"
              alt="SMART DIS-AI"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">SMART DIS-AI</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Intelligente Dokumentanalyse für Wissen, Risiken, Fristen und sichere
                Entscheidungen.
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground lg:text-right">
            <p>© 2026 SmartBuilt-AI · Powered by BuiltSmart Hub - Bernhard Metzger</p>
            <nav className="mt-3" aria-label="Rechtliche Links">
              {legalLinks.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? <span className="px-2 text-slate-300">|</span> : null}
                  <a
                    href={link.href}
                    className="font-medium text-muted-foreground transition hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

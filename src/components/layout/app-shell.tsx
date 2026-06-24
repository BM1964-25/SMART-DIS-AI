"use client";

import {
  BarChart3,
  BrainCircuit,
  CalendarClock,
  FileSearch,
  FolderInput,
  MessageSquareText,
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
  { label: "Suche", href: "/search", icon: FileSearch },
  { label: "Chat", href: "/chat", icon: MessageSquareText },
  { label: "Analyse", icon: BrainCircuit },
  { label: "Risiken", icon: ShieldCheck }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="lg:top-22 lg:sticky lg:h-[calc(100vh-6.5rem)]">
          <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-surface p-2 shadow-subtle lg:flex-col">
            {navigation.map((item) => {
              const className = cn(
                "inline-flex h-10 min-w-fit items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                "href" in item && pathname === item.href
                  ? "bg-foreground text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              );

              if ("href" in item) {
                return (
                  <a key={item.label} href={item.href} className={className}>
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </a>
                );
              }

              return (
                <button
                  key={item.label}
                  className={cn(className, "cursor-not-allowed opacity-50 hover:bg-transparent")}
                  disabled
                  type="button"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

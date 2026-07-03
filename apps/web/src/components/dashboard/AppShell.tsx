"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  GitBranch,
  PanelLeft,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/landing/Hero";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Repositories", href: "/dashboard#repositories", icon: Boxes },
  { label: "Migration Runs", href: "/dashboard#runs", icon: GitBranch },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo />
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-background px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">
                Personal workspace
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-text-muted">
                LOCAL · PHASE 8
              </p>
            </div>
            <ChevronDown className="size-3.5 text-text-muted" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Dashboard">
          <p className="mb-2 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Workspace
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : item.href === "/settings"
                  ? pathname === "/settings"
                  : false;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[9px] px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-mono">Workspace ready</span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-text-muted">
            Public repository analysis is ready.
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary lg:hidden"
              aria-label="Dashboard navigation"
              title="Navigation is shown on larger screens"
            >
              <PanelLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-text-primary">
                {title}
              </h1>
              <p className="hidden truncate text-[11px] text-text-muted sm:block">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-[9px] text-text-muted sm:flex">
              <span className="size-1.5 rounded-full bg-success" />
              LOCAL
            </div>
            <ThemeToggle />
            <div
              className="flex size-9 items-center justify-center rounded-[9px] bg-primary text-xs font-bold text-white dark:text-[#051411]"
              aria-label="Workspace avatar"
            >
              CS
            </div>
          </div>
        </header>

        <div className="border-b border-border bg-surface px-4 py-2 lg:hidden">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Mobile dashboard">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <main className="mx-auto max-w-[1320px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

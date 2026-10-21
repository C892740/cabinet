"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  CollectionsIcon,
  CpuIcon,
  GamepadIcon,
  HomeIcon,
  LibraryIcon,
  ShieldIcon,
  TvIcon,
} from "../Icons";
import { Logo } from "../Logo";

const nav: {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  badge?: string;
}[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/collections", label: "Collections", icon: CollectionsIcon },
  { href: "/emulators", label: "Emulators", icon: CpuIcon, badge: "Soon" },
  { href: "/tv", label: "TV Mode", icon: TvIcon },
  { href: "/shell", label: "Layouts", icon: GamepadIcon, badge: "New" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.07] bg-white/[0.025] px-4 py-6 backdrop-blur-2xl lg:flex">
      <Link href="/" className="focus-ring mx-2 mb-9 rounded-2xl">
        <Logo size={34} />
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                active
                  ? "bg-white/[0.1] text-white shadow-soft"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {active && (
                <span className="accent-gradient absolute left-0 h-6 w-[3px] rounded-full" />
              )}
              <item.icon size={20} className="shrink-0" />
              {item.label}
              {item.badge && (
                <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="my-4 h-px bg-white/[0.07]" />

        <Link
          href="/admin"
          className={`focus-ring group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
            pathname === "/admin"
              ? "bg-white/[0.1] text-white shadow-soft"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <ShieldIcon size={20} className="shrink-0" />
          Admin
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/45">
            🔒 key
          </span>
        </Link>
      </nav>

      <div className="glass flex items-center gap-3 rounded-2xl p-3">
        <span
          className="accent-gradient inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
        >
          AA
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">Alex Admin</p>
          <p className="truncate text-xs text-white/45">admin@cabinet.local</p>
        </div>
      </div>
    </aside>
  );
}

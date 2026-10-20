"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "../Logo";
import { Sidebar } from "./Sidebar";
import { SearchIcon, ShieldIcon } from "../Icons";

const mobileLinks = [
  { href: "/library", label: "Library" },
  { href: "/collections", label: "Collections" },
  { href: "/tv", label: "TV" },
  { href: "/emulators", label: "Emulators" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <Sidebar />

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/library" className="glass rounded-full p-2.5 text-white/75">
              <SearchIcon size={18} />
            </Link>
            <Link href="/admin" className="glass rounded-full p-2.5 text-white/75">
              <ShieldIcon size={18} />
            </Link>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === link.href
                  ? "accent-gradient text-white"
                  : "bg-white/[0.06] text-white/60"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="px-5 pb-24 pt-8 sm:px-8 lg:pl-[288px] lg:pr-10"
      >
        {children}
      </motion.main>
    </div>
  );
}

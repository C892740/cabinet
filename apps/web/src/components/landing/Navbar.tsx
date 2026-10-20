"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GithubIcon } from "../Icons";
import { Logo } from "../Logo";
import { site } from "@/lib/site";

const links = [
  { href: "#features", label: "Features" },
  { href: "#tv", label: "TV Mode" },
  { href: "#apps", label: "Download" },
  { href: "#security", label: "Security" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-3 transition-all duration-500 ${
          scrolled ? "glass-strong shadow-card" : "border border-transparent"
        }`}
      >
        <Link href="/" className="focus-ring rounded-full">
          <Logo size={32} />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="focus-ring rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors duration-300 hover:bg-white/[0.07] hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={site.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/85 transition-all duration-300 hover:bg-white/[0.12] sm:inline-flex"
          >
            <GithubIcon size={17} />
            GitHub
          </a>
          <Link href="/library" className="btn-primary !px-5 !py-2.5 text-sm">
            Open Library
          </Link>
        </div>
      </nav>
    </header>
  );
}

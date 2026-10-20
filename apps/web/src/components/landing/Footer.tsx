import Link from "next/link";
import { Logo } from "../Logo";
import { GithubIcon } from "../Icons";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Library", href: "/library" },
      { label: "TV Mode", href: "/tv" },
      { label: "Emulators (soon)", href: "/emulators" },
      { label: "Admin dashboard", href: "/admin" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub repository", href: site.repoUrl },
      { label: "Latest release", href: site.downloadUrl },
      { label: "Report an issue", href: `${site.repoUrl}/issues` },
      { label: "Roadmap", href: `${site.repoUrl}#roadmap` },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "Deploy to Vercel + Neon", href: `${site.repoUrl}#readme` },
      { label: "Build the Windows app", href: `${site.repoUrl}#readme` },
      { label: "Key vault guide", href: `${site.repoUrl}#readme` },
      { label: "Architecture", href: `${site.repoUrl}#architecture` },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] px-6 pb-14 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo size={36} />
            <p className="mt-5 max-w-xs leading-relaxed text-white/50">
              {site.tagline} A modern, self-hostable retro game library for web, desktop
              and TV.
            </p>
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <GithubIcon size={16} />
              github.com/cabinet-roms/cabinet
            </a>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/40">
                {column.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-white/60 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/60 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.07] pt-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.author}. Not affiliated with RomM or any
            platform manufacturer.
          </p>
          <p className="max-w-xl sm:text-right">
            Cabinet ships no games. Bring your own legally obtained ROMs and BIOS files —
            you are responsible for the dumps in your library.
          </p>
        </div>
      </div>
    </footer>
  );
}

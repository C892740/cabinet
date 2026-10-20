import type { Metadata } from "next";
import { LibraryExplorer } from "@/components/app/LibraryExplorer";
import { getRepo } from "@/lib/repo";

export const metadata: Metadata = {
  title: "Library",
  description: "Browse, search and filter your Cabinet game library.",
};

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const repo = getRepo();
  const [roms, platforms] = await Promise.all([repo.listRoms(), repo.listPlatforms()]);

  return <LibraryExplorer initialRoms={roms} platforms={platforms} />;
}

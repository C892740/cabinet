import type { Metadata } from "next";
import { ShellStage } from "@/components/shells/ShellStage";
import { getRepo } from "@/lib/repo";

export const metadata: Metadata = {
  title: "Shell",
  description: "Play your library with the console layout that feels like home.",
};

export const dynamic = "force-dynamic";

export default async function ShellPage() {
  const repo = getRepo();
  const [roms, platforms] = await Promise.all([repo.listRoms(), repo.listPlatforms()]);
  return <ShellStage initialRoms={roms} platforms={platforms} />;
}

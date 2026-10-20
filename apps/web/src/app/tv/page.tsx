import type { Metadata } from "next";
import { TVMode } from "@/components/tv/TVMode";
import { getRepo } from "@/lib/repo";

export const metadata: Metadata = {
  title: "TV Mode",
  description:
    "Cabinet's living-room interface: big tiles, gamepad navigation and support for two controllers.",
};

export const dynamic = "force-dynamic";

export default async function TVPage() {
  const repo = getRepo();
  const [roms, platforms] = await Promise.all([repo.listRoms(), repo.listPlatforms()]);
  return <TVMode roms={roms} platforms={platforms} />;
}

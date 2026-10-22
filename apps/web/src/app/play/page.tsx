import type { Metadata } from "next";
import { PlayClient } from "@/components/emulator/PlayClient";

export const metadata: Metadata = {
  title: "Play — Cabinet",
  description: "In-browser play with cloud save states, screenshots and netplay.",
};

export const dynamic = "force-dynamic";

export default function PlayPage() {
  return <PlayClient />;
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { KeyPrompt } from "@/components/admin/KeyPrompt";
import { getRepo } from "@/lib/repo";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  description: "Key-protected administration dashboard for Cabinet.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const unlocked = verifyAdminToken(cookies().get(ADMIN_COOKIE)?.value);

  if (!unlocked) {
    return <KeyPrompt />;
  }

  const repo = getRepo();
  const [stats, users] = await Promise.all([repo.stats(), repo.listUsers()]);
  return <AdminDashboard stats={stats} users={users} />;
}

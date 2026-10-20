"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClockIcon,
  DatabaseIcon,
  GamepadIcon,
  LockIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
} from "../Icons";
import { timeAgo } from "@/lib/format";
import type { AdminStats, User } from "@/lib/types";

function StatCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

const statCards = (stats: AdminStats) => [
  { label: "Registered users", value: stats.totalUsers, icon: UsersIcon, accent: "from-violet-500 to-indigo-500" },
  { label: "Games in library", value: stats.totalRoms, icon: SparklesIcon, accent: "from-sky-400 to-blue-600" },
  { label: "Platforms", value: stats.totalPlatforms, icon: GamepadIcon, accent: "from-emerald-400 to-teal-500" },
  { label: "Hours played", value: stats.totalPlaytimeHours, icon: ClockIcon, accent: "from-orange-400 to-rose-500" },
];

export function AdminDashboard({ stats, users }: { stats: AdminStats; users: User[] }) {
  const router = useRouter();

  async function lock() {
    await fetch("/api/admin/lock", { method: "POST" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
              Admin dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <ShieldIcon size={13} />
              Unlocked
            </span>
          </div>
          <p className="mt-2 text-white/50">
            Overview of your Cabinet instance — users, library and recent activity.
          </p>
        </div>
        <button type="button" onClick={lock} className="btn-glass">
          <LockIcon size={16} />
          Lock dashboard
        </button>
      </div>

      {/* stat cards */}
      <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards(stats).map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="glass glass-hover rounded-3xl p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/50">{card.label}</p>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white`}
              >
                <card.icon size={19} />
              </span>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
              <StatCounter value={card.value} />
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* recent activity */}
        <section className="glass rounded-3xl p-7">
          <h2 className="text-lg font-semibold tracking-tight text-white">Recent activity</h2>
          <ul className="mt-5 divide-y divide-white/[0.07]">
            {stats.recentEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-4 py-3.5">
                <span className="accent-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
                  <ClockIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">{event.action}</p>
                  <p className="truncate text-xs text-white/40">{event.actorEmail}</p>
                </div>
                <span className="shrink-0 text-xs text-white/40">{timeAgo(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* system panel */}
        <section className="glass rounded-3xl p-7">
          <h2 className="text-lg font-semibold tracking-tight text-white">System</h2>
          <dl className="mt-5 space-y-4">
            {[
              ["Database", "Neon Postgres (serverless)"],
              ["Storage used", `${(stats.storageMb / 1024).toFixed(1)} GB`],
              ["Session signing", "HMAC-SHA256"],
              ["Password hashing", "scrypt (N=2¹⁵)"],
              ["Admin sessions", "8-hour signed tokens"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="text-sm text-white/45">{label}</dt>
                <dd className="text-sm font-medium text-white/85">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
            <DatabaseIcon size={18} className="mt-0.5 shrink-0 text-violet-300" />
            <p className="text-xs leading-relaxed text-white/60">
              Key rotation is done with the <code className="text-violet-200">cabinet-keyvault</code>{" "}
              CLI: seal a new admin key, store the vault offline, then update{" "}
              <code className="text-violet-200">ADMIN_KEY_HASH</code>.
            </p>
          </div>
        </section>
      </div>

      {/* users */}
      <section className="glass mt-6 rounded-3xl p-7">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white">Users</h2>
          <span className="text-sm text-white/45">{users.length} accounts</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.12em] text-white/35">
                <th className="pb-3 pr-4 font-medium">User</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {users.map((user) => (
                <tr key={user.id} className="text-white/80">
                  <td className="py-3.5 pr-4">
                    <span className="flex items-center gap-3">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{
                          backgroundImage: `linear-gradient(135deg, hsl(${user.avatarHue} 70% 55%), hsl(${(user.avatarHue + 45) % 360} 70% 42%))`,
                        }}
                      >
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      {user.displayName}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-white/55">{user.email}</td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-violet-400/15 text-violet-200"
                          : "bg-white/[0.07] text-white/60"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3.5 text-white/45">{timeAgo(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
